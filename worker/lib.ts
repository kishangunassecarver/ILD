/**
 * Shared pieces of the member API.
 *
 * Kept separate from the route handlers so the security-relevant parts — token
 * hashing, session lookup, rate limiting — sit in one place that can be read
 * top to bottom.
 */

export interface Env {
  DB: D1Database;
  /** The static site, served through the Worker (see serveAsset). */
  ASSETS: Fetcher;
  /** Listing photos, keyed "listings/<id>.<ext>", content type in metadata. */
  MEDIA: KVNamespace;
  /** PayFast live credentials. Unset means the sandbox test merchant. */
  PAYFAST_MERCHANT_ID?: string;
  PAYFAST_MERCHANT_KEY?: string;
  PAYFAST_PASSPHRASE?: string;
  /** Resend API key. Without it, sign-in links are logged instead of emailed. */
  RESEND_API_KEY?: string;
  /** Verified sender, e.g. "I Love Durban <hello@ilovedurban.co.za>". */
  MAIL_FROM?: string;
  /** Public origin, used to build sign-in links. */
  SITE_URL?: string;
  /**
   * Shared secret the WordPress plugin uses to read and decide on the owner
   * submission queue. Unset means the admin endpoints are closed.
   */
  ADMIN_TOKEN?: string;
  /**
   * The Cloudflare deploy hook. When set, the Worker triggers a site rebuild
   * after changes that must reach the public site without waiting for the
   * next WordPress publish (a Premium activation, an owner deleting a listing).
   */
  DEPLOY_HOOK_URL?: string;
  /** Where to send "an owner has submitted an edit" notifications. */
  REVIEW_EMAIL?: string;
  /** Where "list your business" enquiries go. Falls back to REVIEW_EMAIL. */
  ENQUIRY_EMAIL?: string;
}

export const SESSION_COOKIE = "ild_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** 32 bytes of randomness, URL-safe. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a sign-in token before it touches the database.
 *
 * SHA-256 with no salt is right here, unlike for passwords: the input is 32
 * bytes of our own randomness, so there is nothing to brute-force or rainbow-
 * table, and a per-row salt would only stop us looking the token up.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* -------------------------------------------------------------------------
 * Passwords
 *
 * PBKDF2-HMAC-SHA256 via WebCrypto — the only password KDF Workers run
 * natively. Each hash records its own iteration count, so the cost can be
 * raised later and old hashes still verify (and quietly upgrade on the next
 * successful sign-in).
 * ---------------------------------------------------------------------- */

export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const PBKDF2_ITERATIONS = 100_000;

export function passwordProblem(value: unknown): string | null {
  if (typeof value !== "string" || value.length < PASSWORD_MIN) {
    return `Use a password of at least ${PASSWORD_MIN} characters.`;
  }
  if (value.length > PASSWORD_MAX) {
    return "That password is too long.";
  }
  return null;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256
  );

  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** → "pbkdf2:100000:saltHex:hashHex" */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");

  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltHex, expected] = stored.split(":");
  if (scheme !== "pbkdf2" || !iterationsRaw || !saltHex || !expected) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 1_000_000) return false;

  const salt = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < salt.length; i += 1) {
    salt[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  }

  const derived = await pbkdf2(password, salt, iterations);

  // Constant-time compare; both sides are hex of fixed length.
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) {
    diff |= derived.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Parse a JSON body, treating anything unparseable as an empty object.
 *
 * Typed as Partial so the caller still has to check each field — the point is
 * that a malformed body is a validation failure, not a 500.
 */
export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Member data must never be cached by a CDN or a shared proxy.
      "Cache-Control": "private, no-store",
      ...init.headers,
    },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function unauthorised(): Response {
  return json({ error: "Not signed in" }, { status: 401 });
}

/** A plausible email address. Deliberately permissive — the link is the real check. */
export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface Member {
  id: string;
  email: string;
  name: string | null;
}

/** The member behind the request's session cookie, if any. */
export async function currentMember(request: Request, env: Env): Promise<Member | null> {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT m.id, m.email, m.name
       FROM sessions s
       JOIN members m ON m.id = s.member_id
      WHERE s.id = ?1 AND s.expires_at > ?2`
  )
    .bind(sessionId, now())
    .first<Member>();

  return row ?? null;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      // A malformed cookie ("%zz") must read as "no cookie", not throw a 500
      // on every request until the browser clears it.
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function createSession(env: Env, memberId: string): Promise<string> {
  const id = randomToken();
  const expires = now() + SESSION_DAYS * 86400;

  await env.DB.prepare(
    "INSERT INTO sessions (id, member_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(id, memberId, expires, now())
    .run();

  return id;
}

export function sessionCookie(id: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    // Lax rather than Strict: the sign-in link arrives from an email client, and
    // Strict would drop the cookie on that first navigation.
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86400}`,
  ];

  if (secure) parts.push("Secure");

  return parts.join("; ");
}

export function clearedCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

export function tokenExpiry(): number {
  return now() + TOKEN_MINUTES * 60;
}

export const TOKEN_LIFETIME_MINUTES = TOKEN_MINUTES;

/**
 * Simple rolling-window rate limit.
 *
 * Returns false when the caller has used up its allowance. Applied to sign-in
 * requests so the endpoint cannot be used to send a stranger a hundred emails,
 * or to enumerate which addresses have accounts by timing.
 */
export async function withinRateLimit(
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const current = now();

  const row = await env.DB.prepare("SELECT count, window_from FROM rate_limits WHERE bucket = ?1")
    .bind(bucket)
    .first<{ count: number; window_from: number }>();

  if (!row || current - row.window_from >= windowSeconds) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, count, window_from) VALUES (?1, 1, ?2)
       ON CONFLICT (bucket) DO UPDATE SET count = 1, window_from = ?2`
    )
      .bind(bucket, current)
      .run();

    return true;
  }

  if (row.count >= limit) return false;

  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE bucket = ?1")
    .bind(bucket)
    .run();

  return true;
}

/**
 * Trigger a site rebuild, at most once a minute.
 *
 * Best-effort: a rebuild that does not fire only delays the change until the
 * next publish, so nothing here is allowed to fail the caller.
 */
export async function triggerDeploy(env: Env, reason: string): Promise<void> {
  if (!env.DEPLOY_HOOK_URL) return;

  if (!(await withinRateLimit(env, "deploy:hook", 1, 60))) return;

  try {
    await fetch(env.DEPLOY_HOOK_URL, { method: "POST", body: "" });
    console.log(`[deploy] rebuild triggered: ${reason}`);
  } catch (error) {
    console.error(`[deploy] hook failed (${reason}):`, error);
  }
}

/**
 * Reject cross-site POSTs.
 *
 * The session cookie is SameSite=Lax, which already blocks cross-site form
 * posts, but checking Origin costs nothing and does not depend on the browser
 * getting Lax right.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true; // Same-origin fetches may omit it entirely.

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
