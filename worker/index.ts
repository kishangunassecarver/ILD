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
  hashPassword,
  hashToken,
  isEmail,
  json,
  normaliseEmail,
  now,
  passwordProblem,
  randomToken,
  readCookie,
  readJson,
  sameOrigin,
  SESSION_COOKIE,
  sessionCookie,
  tokenExpiry,
  TOKEN_LIFETIME_MINUTES,
  unauthorised,
  verifyPassword,
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
import { emailHtml, emailText, type AuthEmail } from "./email";

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
        case "POST /api/auth/register":
          return await register(request, env, secure);
        case "POST /api/auth/login":
          return await loginWithPassword(request, env, secure);
        case "POST /api/auth/forgot":
          return await forgotPassword(request, env, url);
        case "POST /api/auth/reset":
          return await resetPassword(request, env, secure);
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

async function sendAuthEmail(env: Env, email: string, mail: AuthEmail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    // Local development, or production with the key not yet set. Logging the
    // link keeps the flow testable rather than silently broken.
    console.log(`[auth] ${mail.subject} for ${email}: ${mail.link}`);
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
      subject: mail.subject,
      text: emailText(mail),
      html: emailHtml(mail),
    }),
  });

  if (!response.ok) {
    console.error("[auth] Resend rejected the send:", response.status, await response.text());
    throw new Error("Could not send the email");
  }
}

async function sendSignInEmail(env: Env, email: string, link: string): Promise<void> {
  await sendAuthEmail(env, email, {
    subject: "Your I Love Durban sign-in link",
    heading: "Sign in to I Love Durban",
    paragraphs: [
      `Tap the button below to sign in. The link works once and expires in ${TOKEN_LIFETIME_MINUTES} minutes.`,
    ],
    cta: { label: "Sign me in", href: link },
    footnote:
      "If you did not ask for this, you can ignore it — nobody can sign in without the link.",
    link,
  });
}

/**
 * The welcome email, sent once when an account comes into existence — whether
 * through registration or a first-time email-link sign-in.
 *
 * Best-effort by design: a mail provider having a bad moment must never turn
 * a successful sign-up into an error.
 */
async function sendWelcomeEmail(
  env: Env,
  email: string,
  name: string | null,
  origin: string
): Promise<void> {
  const site = env.SITE_URL?.replace(/\/+$/, "") ?? origin;

  try {
    await sendAuthEmail(env, email, {
      subject: "Welcome to I Love Durban",
      heading: `Welcome${name ? `, ${name}` : ""}!`,
      paragraphs: [
        "Your I Love Durban account is ready. Here is what it unlocks:",
        "• Save your favourite places, events and deals — they follow you everywhere",
        "• Book tables, stays and experiences",
        "• Earn Durban Points on the offers you redeem",
        "• Own a business? Claim your listing and keep it up to date yourself",
        "Support local — we're glad you're here.",
      ],
      cta: { label: "Start exploring", href: site },
      footnote: "You are getting this because an account was created with your address on I Love Durban.",
      link: site,
    });
  } catch (error) {
    console.error("[auth] could not send the welcome email:", error);
  }
}

/* -------------------------------------------------------------------------
 * Password sign-in
 * ---------------------------------------------------------------------- */

async function register(request: Request, env: Env, secure: boolean): Promise<Response> {
  const body = await readJson<{ email: unknown; name: unknown; password: unknown }>(request);

  if (!isEmail(body.email)) return badRequest("That does not look like an email address.");

  const weak = passwordProblem(body.password);
  if (weak) return badRequest(weak);

  const email = normaliseEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) || null : null;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  if (!(await withinRateLimit(env, `register:${ip}`, 10, 3600))) {
    return json({ error: "Too many new accounts from this connection. Try again later." }, { status: 429 });
  }

  const existing = await env.DB.prepare(
    "SELECT id, password_hash FROM members WHERE email = ?1"
  )
    .bind(email)
    .first<{ id: string; password_hash: string | null }>();

  /*
   * An existing account is never overwritten from here: typing an email address
   * is not proof of owning it. The reset flow is the door for both cases — it
   * proves ownership by email first.
   */
  if (existing) {
    return badRequest(
      existing.password_hash
        ? "That email already has an account. Sign in instead, or use “Forgot password”."
        : "That email already has an account that signs in by email link. Use “Forgot password” to set a password for it."
    );
  }

  const id = randomToken();

  await env.DB.prepare(
    "INSERT INTO members (id, email, name, password_hash, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)"
  )
    .bind(id, email, name, await hashPassword(body.password as string), now())
    .run();

  const session = await createSession(env, id);

  await sendWelcomeEmail(env, email, name, new URL(request.url).origin);

  return json(
    { ok: true, member: { id, email, name } },
    { headers: { "Set-Cookie": sessionCookie(session, secure) } }
  );
}

async function loginWithPassword(request: Request, env: Env, secure: boolean): Promise<Response> {
  const body = await readJson<{ email: unknown; password: unknown }>(request);

  if (!isEmail(body.email) || typeof body.password !== "string") {
    return json({ error: "That email and password do not match." }, { status: 401 });
  }

  const email = normaliseEmail(body.email);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  // Tight limits: this is the endpoint credential-stuffing goes after.
  const allowed =
    (await withinRateLimit(env, `login:${email}`, 10, 900)) &&
    (await withinRateLimit(env, `login-ip:${ip}`, 30, 900));

  if (!allowed) {
    return json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const member = await env.DB.prepare(
    "SELECT id, email, name, password_hash FROM members WHERE email = ?1"
  )
    .bind(email)
    .first<{ id: string; email: string; name: string | null; password_hash: string | null }>();

  if (member && !member.password_hash) {
    // Joined in the email-link era. The reset flow sets their first password.
    return json(
      {
        error:
          "This account has no password yet. Use “Forgot password” to set one, or email yourself a sign-in link.",
      },
      { status: 401 }
    );
  }

  if (!member || !(await verifyPassword(body.password, member.password_hash as string))) {
    return json({ error: "That email and password do not match." }, { status: 401 });
  }

  await env.DB.prepare("UPDATE members SET last_seen_at = ?1 WHERE id = ?2")
    .bind(now(), member.id)
    .run();

  const session = await createSession(env, member.id);

  return json(
    { ok: true, member: { id: member.id, email: member.email, name: member.name } },
    { headers: { "Set-Cookie": sessionCookie(session, secure) } }
  );
}

async function forgotPassword(request: Request, env: Env, url: URL): Promise<Response> {
  const body = await readJson<{ email: unknown }>(request);

  if (!isEmail(body.email)) return badRequest("That does not look like an email address.");

  const email = normaliseEmail(body.email);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  const allowed =
    (await withinRateLimit(env, `reset:${email}`, 5, 3600)) &&
    (await withinRateLimit(env, `reset-ip:${ip}`, 20, 3600));

  if (!allowed) {
    return json({ error: "Too many reset requests. Try again in an hour." }, { status: 429 });
  }

  const member = await env.DB.prepare("SELECT id FROM members WHERE email = ?1")
    .bind(email)
    .first<{ id: string }>();

  // Only issue tokens for accounts that exist — but answer identically either
  // way, so this cannot be used to check who is a member.
  if (member) {
    const token = randomToken();

    await env.DB.prepare(
      "INSERT INTO password_resets (token_hash, email, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(await hashToken(token), email, tokenExpiry(), now())
      .run();

    const origin = env.SITE_URL?.replace(/\/+$/, "") ?? url.origin;
    const link = `${origin}/reset/?token=${token}`;

    await sendAuthEmail(env, email, {
      subject: "Reset your I Love Durban password",
      heading: "Choose a new password",
      paragraphs: [
        `Tap the button below to choose a new password. The link works once and expires in ${TOKEN_LIFETIME_MINUTES} minutes.`,
      ],
      cta: { label: "Reset my password", href: link },
      footnote:
        "If you did not ask for this, you can ignore it — your password has not changed.",
      link,
    });
  }

  return json({
    ok: true,
    message: `If ${email} has an account, a reset link is on its way. It expires in ${TOKEN_LIFETIME_MINUTES} minutes.`,
  });
}

async function resetPassword(request: Request, env: Env, secure: boolean): Promise<Response> {
  const body = await readJson<{ token: unknown; password: unknown }>(request);

  if (typeof body.token !== "string" || !body.token) {
    return badRequest("That reset link is not valid.");
  }

  const weak = passwordProblem(body.password);
  if (weak) return badRequest(weak);

  /*
   * Claim the token atomically — mark it used and read its email in the same
   * statement, so two racing requests cannot both spend it.
   */
  const claimed = await env.DB.prepare(
    `UPDATE password_resets SET used_at = ?1
      WHERE token_hash = ?2 AND used_at IS NULL AND expires_at > ?1
      RETURNING email`
  )
    .bind(now(), await hashToken(body.token))
    .first<{ email: string }>();

  if (!claimed) {
    return badRequest("That reset link has expired or was already used. Request a fresh one.");
  }

  const member = await env.DB.prepare("SELECT id, email, name FROM members WHERE email = ?1")
    .bind(claimed.email)
    .first<{ id: string; email: string; name: string | null }>();

  if (!member) return badRequest("That account no longer exists.");

  await env.DB.prepare("UPDATE members SET password_hash = ?1, last_seen_at = ?2 WHERE id = ?3")
    .bind(await hashPassword(body.password as string), now(), member.id)
    .run();

  // A reset means the old credentials may be compromised: end every session.
  await env.DB.prepare("DELETE FROM sessions WHERE member_id = ?1").bind(member.id).run();

  const session = await createSession(env, member.id);

  return json(
    { ok: true, member },
    { headers: { "Set-Cookie": sessionCookie(session, secure) } }
  );
}

async function verifySignIn(request: Request, env: Env, url: URL, secure: boolean): Promise<Response> {
  const token = url.searchParams.get("token");
  const failure = Response.redirect(`${url.origin}/join/?error=link`, 302);

  if (!token) return failure;

  /*
   * One use, and only before it expires — claimed atomically, so two racing
   * requests with the same link cannot both get a session out of it.
   */
  const row = await env.DB.prepare(
    `UPDATE login_tokens SET used_at = ?1
      WHERE token_hash = ?2 AND used_at IS NULL AND expires_at >= ?1
      RETURNING email`
  )
    .bind(now(), await hashToken(token))
    .first<{ email: string }>();

  if (!row) return failure;

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

    // Their first sign-in created the account: welcome them.
    await sendWelcomeEmail(env, row.email, null, url.origin);
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
