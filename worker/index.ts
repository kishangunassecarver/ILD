/**
 * The member API.
 *
 * The site itself is a static export; this Worker sits beside it and only ever
 * handles `/api/*`. Static assets are matched before the Worker runs, so nothing
 * here is in the way of a normal page load.
 *
 * Sign-in is by emailed one-time link. There are no passwords anywhere in this
 * codebase, which is a deliberate constraint rather than a shortcut: a city
 * directory has no business holding credentials people have reused elsewhere.
 */
import {
  badRequest,
  clearedCookie,
  createSession,
  currentMember,
  hashToken,
  isEmail,
  json,
  normaliseEmail,
  now,
  randomToken,
  readCookie,
  readJson,
  sameOrigin,
  SESSION_COOKIE,
  sessionCookie,
  tokenExpiry,
  TOKEN_LIFETIME_MINUTES,
  unauthorised,
  withinRateLimit,
  type Env,
} from "./lib";
import {
  adminDecide,
  adminSubmissions,
  claimListing,
  myBusinesses,
  submitEdit,
  submitEnquiry,
} from "./business";

const SAVE_KINDS = new Set(["listing", "event", "deal", "page"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      // Only reachable if asset matching missed; hand it back to the assets.
      return new Response("Not found", { status: 404 });
    }

    const secure = url.protocol === "https:";

    // Every mutation is a POST, and every POST must come from this origin.
    if (request.method === "POST" && !sameOrigin(request)) {
      return json({ error: "Cross-site request refused" }, { status: 403 });
    }

    try {
      switch (`${request.method} ${url.pathname}`) {
        case "POST /api/auth/request":
          return await requestSignIn(request, env, url);
        case "GET /api/auth/verify":
          return await verifySignIn(request, env, url, secure);
        case "POST /api/auth/signout":
          return await signOut(request, env, secure);
        case "GET /api/me":
          return await me(request, env);
        case "GET /api/saves":
          return await listSaves(request, env);
        case "POST /api/saves":
          return await toggleSave(request, env);
        case "POST /api/business/claim":
          return await claimListing(request, env);
        case "GET /api/business/mine":
          return await myBusinesses(request, env);
        case "POST /api/business/edit":
          return await submitEdit(request, env);
        case "POST /api/enquiries":
          return await submitEnquiry(request, env);
        case "GET /api/admin/submissions":
          return await adminSubmissions(request, env);
        case "POST /api/admin/decide":
          return await adminDecide(request, env);
        default:
          return json({ error: "Unknown endpoint" }, { status: 404 });
      }
    } catch (error) {
      // Never leak a stack trace or SQL to the browser.
      console.error("[api]", error);
      return json({ error: "Something went wrong" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

/* -------------------------------------------------------------------------
 * Sign in
 * ---------------------------------------------------------------------- */

async function requestSignIn(request: Request, env: Env, url: URL): Promise<Response> {
  const body = await readJson<{ email: unknown; name: unknown }>(request);

  if (!isEmail(body.email)) return badRequest("That does not look like an email address.");

  const email = normaliseEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : null;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  /*
   * Two limits. The per-email one stops this being used to spam somebody's
   * inbox; the per-IP one stops one client working through a list of addresses.
   */
  const allowed =
    (await withinRateLimit(env, `email:${email}`, 5, 3600)) &&
    (await withinRateLimit(env, `ip:${ip}`, 20, 3600));

  if (!allowed) {
    return json(
      { error: "Too many sign-in requests. Try again in an hour." },
      { status: 429 }
    );
  }

  const token = randomToken();

  await env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, email, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(await hashToken(token), email, tokenExpiry(), now())
    .run();

  // Remember the name now; the member row is created on verification.
  if (name) {
    await env.DB.prepare(
      `INSERT INTO members (id, email, name, created_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(members.name, ?3)`
    )
      .bind(randomToken(), email, name, now())
      .run();
  }

  const origin = env.SITE_URL?.replace(/\/+$/, "") ?? url.origin;
  const link = `${origin}/api/auth/verify?token=${token}`;

  await sendSignInEmail(env, email, link);

  /*
   * The same answer whether or not that address has an account. Saying "no
   * account found" would turn this into a way to check who is a member.
   */
  return json({
    ok: true,
    message: `Check ${email} for a sign-in link. It expires in ${TOKEN_LIFETIME_MINUTES} minutes.`,
  });
}

async function sendSignInEmail(env: Env, email: string, link: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    // Local development, or production with the key not yet set. Logging the
    // link keeps the flow testable rather than silently broken.
    console.log(`[auth] sign-in link for ${email}: ${link}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: email,
      subject: "Your I Love Durban sign-in link",
      text: [
        "Tap the link below to sign in. It works once and expires in " +
          TOKEN_LIFETIME_MINUTES +
          " minutes.",
        "",
        link,
        "",
        "If you did not ask for this, you can ignore it — nobody can sign in without the link.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("[auth] Resend rejected the send:", response.status, await response.text());
    throw new Error("Could not send the sign-in email");
  }
}

async function verifySignIn(request: Request, env: Env, url: URL, secure: boolean): Promise<Response> {
  const token = url.searchParams.get("token");
  const failure = Response.redirect(`${url.origin}/join/?error=link`, 302);

  if (!token) return failure;

  const hash = await hashToken(token);

  const row = await env.DB.prepare(
    "SELECT email, expires_at, used_at FROM login_tokens WHERE token_hash = ?1"
  )
    .bind(hash)
    .first<{ email: string; expires_at: number; used_at: number | null }>();

  // One use, and only before it expires.
  if (!row || row.used_at !== null || row.expires_at < now()) return failure;

  await env.DB.prepare("UPDATE login_tokens SET used_at = ?1 WHERE token_hash = ?2")
    .bind(now(), hash)
    .run();

  let member = await env.DB.prepare("SELECT id FROM members WHERE email = ?1")
    .bind(row.email)
    .first<{ id: string }>();

  if (!member) {
    const id = randomToken();
    await env.DB.prepare(
      "INSERT INTO members (id, email, created_at) VALUES (?1, ?2, ?3)"
    )
      .bind(id, row.email, now())
      .run();
    member = { id };
  }

  await env.DB.prepare("UPDATE members SET last_seen_at = ?1 WHERE id = ?2")
    .bind(now(), member.id)
    .run();

  const session = await createSession(env, member.id);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/saved/`,
      "Set-Cookie": sessionCookie(session, secure),
    },
  });
}

async function signOut(request: Request, env: Env, secure: boolean): Promise<Response> {
  const sessionId = readCookie(request, SESSION_COOKIE);

  // Delete the session server-side, so the cookie being kept means nothing.
  if (sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(sessionId).run();
  }

  return json({ ok: true }, { headers: { "Set-Cookie": clearedCookie(secure) } });
}

async function me(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);

  return json({ member: member ?? null });
}

/* -------------------------------------------------------------------------
 * Saved places
 * ---------------------------------------------------------------------- */

async function listSaves(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const { results } = await env.DB.prepare(
    "SELECT kind, slug, created_at FROM saves WHERE member_id = ?1 ORDER BY created_at DESC"
  )
    .bind(member.id)
    .all<{ kind: string; slug: string; created_at: number }>();

  return json({ saves: results ?? [] });
}

async function toggleSave(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ kind: unknown; slug: unknown }>(request);
  const kind = typeof body.kind === "string" ? body.kind : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  // Constrain both, so this cannot be used as arbitrary key-value storage.
  if (!SAVE_KINDS.has(kind)) return badRequest("Unknown kind of thing to save.");
  if (!/^[a-z0-9][a-z0-9\-/]{0,120}$/.test(slug)) return badRequest("That is not a valid slug.");

  const existing = await env.DB.prepare(
    "SELECT 1 AS found FROM saves WHERE member_id = ?1 AND kind = ?2 AND slug = ?3"
  )
    .bind(member.id, kind, slug)
    .first<{ found: number }>();

  if (existing) {
    await env.DB.prepare("DELETE FROM saves WHERE member_id = ?1 AND kind = ?2 AND slug = ?3")
      .bind(member.id, kind, slug)
      .run();

    return json({ saved: false });
  }

  await env.DB.prepare(
    "INSERT INTO saves (member_id, kind, slug, created_at) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(member.id, kind, slug, now())
    .run();

  return json({ saved: true });
}
