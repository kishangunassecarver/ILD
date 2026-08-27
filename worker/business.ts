/**
 * The business-owner API: claiming a listing, and submitting edits to it.
 *
 * Two rules shape everything here.
 *
 * Nothing an owner submits reaches the live site directly. Claims and edits go
 * into a queue that a person approves in WordPress, because "I own this
 * restaurant" is a sentence anyone can type, and because WordPress stays the
 * single source of truth for published content.
 *
 * Every field is validated individually against an allow-list. An owner can
 * change their opening hours; they cannot change their star rating, whether they
 * are featured, or which hub they appear in.
 */
import {
  badRequest,
  currentMember,
  json,
  now,
  randomToken,
  readJson,
  unauthorised,
  withinRateLimit,
  type Env,
  type Member,
} from "./lib";
import {
  buildCheckout,
  cancelSubscription,
  itnConfirmedByPayfast,
  itnSignatureValid,
  parseItn,
  payfastConfig,
  PREMIUM_PRICE_RANDS,
} from "./payfast";

/** Slug shape shared with the saves endpoint: lowercase, no traversal. */
const SLUG = /^[a-z0-9][a-z0-9\-]{0,120}$/;

/** The hubs a listing can belong to. Mirrors HubSlug in lib/types.ts. */
const HUBS = new Set(["eat-drink", "stay", "things-to-do", "shop", "services"]);

/* -------------------------------------------------------------------------
 * Editable fields
 * ---------------------------------------------------------------------- */

type FieldKind = "line" | "text" | "paragraphs" | "list" | "url" | "phone";

interface FieldRule {
  kind: FieldKind;
  /** Max characters for a line/text, or max entries for a list. */
  max: number;
  /** Max characters per entry, for lists and paragraph arrays. */
  each?: number;
  label: string;
}

/**
 * What a business owner is allowed to change about their own listing.
 *
 * Everything absent from this list is either editorial (whether a place is
 * featured), sourced from somewhere else (the Google rating), or structural (the
 * slug and hub, which are URLs). Adding a key here is the only way to widen what
 * owners can touch, which is deliberate.
 */
const EDITABLE: Record<string, FieldRule> = {
  name: { kind: "line", max: 120, label: "Business name" },
  blurb: { kind: "line", max: 200, label: "One-line summary" },
  body: { kind: "paragraphs", max: 8, each: 900, label: "Description" },
  category: { kind: "line", max: 60, label: "Category" },
  area: { kind: "line", max: 60, label: "Area" },
  price: { kind: "line", max: 8, label: "Price band" },
  cta: { kind: "line", max: 40, label: "Button label" },
  address: { kind: "line", max: 200, label: "Address" },
  phone: { kind: "phone", max: 40, label: "Phone" },
  website: { kind: "url", max: 300, label: "Website" },
  hours: { kind: "list", max: 14, each: 80, label: "Opening hours" },
  amenities: { kind: "list", max: 20, each: 60, label: "Amenities" },
  tags: { kind: "list", max: 12, each: 40, label: "Tags" },
};

/**
 * Normalise submitted text.
 *
 * Strips control characters and the zero-width family, then folds non-breaking
 * spaces back to ordinary ones — people paste all three out of Word and PDFs
 * without realising, and they render as invisible junk or unbreakable lines.
 */
function clean(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Validate one submitted field.
 *
 * Returns the cleaned value, or an error message naming the field so the owner
 * knows which box to fix.
 */
function validateField(key: string, raw: unknown): { value: unknown } | { error: string } {
  const rule = EDITABLE[key];
  if (!rule) return { error: `${key} is not a field you can change.` };

  // An empty string clears an optional field, which is a legitimate edit.
  if (raw === null || raw === "") return { value: null };

  if (rule.kind === "list" || rule.kind === "paragraphs") {
    if (!Array.isArray(raw)) return { error: `${rule.label} must be a list.` };
    if (raw.length > rule.max) {
      return { error: `${rule.label}: keep it to ${rule.max} entries or fewer.` };
    }

    const entries: string[] = [];
    for (const entry of raw) {
      if (typeof entry !== "string") return { error: `${rule.label} must be a list of text.` };

      const trimmed = clean(entry);
      if (!trimmed) continue; // Blank rows are how a form says "removed".

      if (trimmed.length > (rule.each ?? 200)) {
        return { error: `${rule.label}: one entry is longer than ${rule.each} characters.` };
      }
      entries.push(trimmed);
    }

    return { value: entries };
  }

  if (typeof raw !== "string") return { error: `${rule.label} must be text.` };

  const value = clean(raw);
  if (value.length > rule.max) {
    return { error: `${rule.label}: keep it under ${rule.max} characters.` };
  }

  if (rule.kind === "url") {
    // Only http(s). A javascript: or data: URL here would end up rendered as an
    // href on a public page.
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return { error: `${rule.label} does not look like a web address.` };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: `${rule.label} must start with http:// or https://.` };
    }

    return { value: parsed.toString() };
  }

  if (rule.kind === "phone" && !/^[0-9+()\-\s]{6,40}$/.test(value)) {
    return { error: `${rule.label} does not look like a phone number.` };
  }

  if (rule.kind === "line" && value.includes("\n")) {
    return { error: `${rule.label} must be a single line.` };
  }

  return { value };
}

/* -------------------------------------------------------------------------
 * Claiming a listing
 * ---------------------------------------------------------------------- */

export async function claimListing(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{
    slug: unknown;
    hub: unknown;
    businessName: unknown;
    contactName: unknown;
    contactPhone: unknown;
    role: unknown;
    note: unknown;
  }>(request);

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const hub = typeof body.hub === "string" ? body.hub.trim() : "";

  if (!SLUG.test(slug)) return badRequest("That is not a valid listing.");
  if (!HUBS.has(hub)) return badRequest("That is not a valid section.");

  // A claim is reviewed by a person, so the cost of a bad one is someone's time.
  if (!(await withinRateLimit(env, `claim:${member.id}`, 10, 86400))) {
    return json({ error: "You have submitted a lot of claims today. Try again tomorrow." }, { status: 429 });
  }

  const text = (value: unknown, max: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = clean(value).slice(0, max);

    return trimmed || null;
  };

  const existing = await env.DB.prepare(
    "SELECT id, status FROM listing_claims WHERE member_id = ?1 AND slug = ?2"
  )
    .bind(member.id, slug)
    .first<{ id: string; status: string }>();

  // Already approved: nothing to do, and re-submitting must not quietly reset it
  // to pending and lock the owner out of their own listing.
  if (existing?.status === "approved") {
    return json({ status: "approved", id: existing.id });
  }

  const id = existing?.id ?? randomToken();

  await env.DB.prepare(
    `INSERT INTO listing_claims
       (id, member_id, slug, hub, business_name, contact_name, contact_phone, role, note, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)
     ON CONFLICT (member_id, slug) DO UPDATE SET
       hub = ?4, business_name = ?5, contact_name = ?6, contact_phone = ?7,
       role = ?8, note = ?9, status = 'pending', created_at = ?10,
       decided_at = NULL, decided_note = NULL`
  )
    .bind(
      id,
      member.id,
      slug,
      hub,
      text(body.businessName, 120),
      text(body.contactName, 80) ?? member.name,
      text(body.contactPhone, 40),
      text(body.role, 60),
      text(body.note, 600),
      now()
    )
    .run();

  return json({ status: "pending", id });
}

/* -------------------------------------------------------------------------
 * Adding a brand-new listing
 * ---------------------------------------------------------------------- */

/** What a new-listing submission must carry, beyond the shared EDITABLE rules. */
const REQUIRED_ON_CREATE = ["name", "category", "area", "blurb"] as const;

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_KEY = /^listings\/[a-f0-9]{64}\.(jpg|png|webp)$/;

/**
 * One photo, uploaded before the listing is submitted.
 *
 * The bytes land in our own storage and are served back through /api/media/*,
 * so a listing photo is never a link to somebody else's server.
 */
export async function uploadListingImage(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  if (!(await withinRateLimit(env, `upload:${member.id}`, 20, 86400))) {
    return json({ error: "Too many uploads today. Try again tomorrow." }, { status: 429 });
  }

  const type = request.headers.get("Content-Type") ?? "";
  const ext = IMAGE_TYPES[type];
  if (!ext) return badRequest("Upload a JPEG, PNG or WebP image.");

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return badRequest("That file is empty.");
  if (bytes.byteLength > IMAGE_MAX_BYTES) {
    return badRequest("Keep the photo under 5 MB.");
  }

  const key = `listings/${randomToken()}.${ext}`;
  await env.MEDIA.put(key, bytes, { metadata: { contentType: type } });

  return json({ ok: true, key, url: `/api/media/${key}` });
}

/** GET /api/media/<key> — the other half of the upload. */
export async function serveMedia(request: Request, env: Env, url: URL): Promise<Response> {
  const key = url.pathname.slice("/api/media/".length);

  if (!MEDIA_KEY.test(key)) return new Response("Not found", { status: 404 });

  const found = await env.MEDIA.getWithMetadata<{ contentType?: string }>(key, "arrayBuffer");
  if (!found.value) return new Response("Not found", { status: 404 });

  return new Response(found.value, {
    headers: {
      "Content-Type": found.metadata?.contentType ?? "application/octet-stream",
      // The key is content-addressed randomness; the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/** A URL our own upload endpoint issued, and nothing else. */
function isOwnMediaUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/api/media/") &&
    MEDIA_KEY.test(value.slice("/api/media/".length))
  );
}

export async function createListing(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ hub: unknown; fields: unknown; image: unknown }>(request);

  const hub = typeof body.hub === "string" ? body.hub.trim() : "";
  if (!HUBS.has(hub)) return badRequest("Choose which section the listing belongs in.");

  if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
    return badRequest("The listing details are missing.");
  }

  const fields: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(body.fields as Record<string, unknown>)) {
    const result = validateField(key, raw);
    if ("error" in result) return badRequest(result.error);
    if (result.value !== null) fields[key] = result.value;
  }

  for (const key of REQUIRED_ON_CREATE) {
    if (!fields[key]) {
      return badRequest(`${EDITABLE[key].label} is required.`);
    }
  }

  // Free plan: one featured image, from our own uploader only.
  const image = body.image == null || body.image === "" ? null : body.image;
  if (image !== null && !isOwnMediaUrl(image)) {
    return badRequest("Upload the photo through the dashboard first.");
  }

  if (!(await withinRateLimit(env, `create:${member.id}`, 5, 86400))) {
    return json(
      { error: "You have added a lot of listings today. Try again tomorrow." },
      { status: 429 }
    );
  }

  /*
   * The slug comes from the name; a suffix is tried when it is taken. The
   * unique index is the real referee — two simultaneous submissions cannot
   * both win the same slug.
   */
  const base =
    String(fields.name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "listing";

  const id = randomToken();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug =
      attempt === 0 ? base : attempt < 5 ? `${base}-${attempt + 1}` : `${base}-${id.slice(0, 6)}`;

    try {
      await env.DB.prepare(
        `INSERT INTO listing_submissions
           (id, member_id, slug, hub, fields, image_url, plan, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'free', 'pending', ?7)`
      )
        .bind(id, member.id, slug, hub, JSON.stringify(fields), image, now())
        .run();

      await notifyNewListing(env, member, slug, String(fields.name));

      return json({ ok: true, id, slug, status: "pending" });
    } catch (error) {
      // UNIQUE violation on the slug: try the next suffix. Anything else is real.
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }

  return badRequest("A listing with that name already exists. Try a more specific name.");
}

async function notifyNewListing(
  env: Env,
  member: Member,
  slug: string,
  name: string
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.REVIEW_EMAIL) {
    console.log(`[business] new listing queued: ${slug} by ${member.email}`);
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.REVIEW_EMAIL,
        subject: `New listing awaiting review: ${name}`,
        text: [
          `${member.email} has submitted a new listing: "${name}" (${slug}).`,
          "",
          "Review it under I Love Durban → Owner Submissions in WordPress.",
          "It will not appear on the site until it is approved there.",
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("[business] could not notify about the new listing:", error);
  }
}

/* -------------------------------------------------------------------------
 * What this member owns
 * ---------------------------------------------------------------------- */

export async function myBusinesses(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const claims = await env.DB.prepare(
    `SELECT id, slug, hub, business_name, status, created_at, decided_at, decided_note
       FROM listing_claims WHERE member_id = ?1 ORDER BY created_at DESC`
  )
    .bind(member.id)
    .all<Record<string, unknown>>();

  const submissions = await env.DB.prepare(
    `SELECT id, slug, hub, fields, image_url, plan, status, created_at, decided_at, decided_note
       FROM listing_submissions WHERE member_id = ?1 ORDER BY created_at DESC LIMIT 50`
  )
    .bind(member.id)
    .all<{ fields: string } & Record<string, unknown>>();

  const edits = await env.DB.prepare(
    `SELECT id, slug, fields, status, created_at, decided_at, decided_note
       FROM listing_edits WHERE member_id = ?1 ORDER BY created_at DESC LIMIT 50`
  )
    .bind(member.id)
    .all<{ id: string; slug: string; fields: string; status: string; created_at: number }>();

  const subscriptions = await env.DB.prepare(
    `SELECT id, slug, status, amount_cents, last_paid_at, created_at
       FROM subscriptions WHERE member_id = ?1 ORDER BY created_at DESC`
  )
    .bind(member.id)
    .all<Record<string, unknown>>();

  return json({
    claims: claims.results ?? [],
    submissions: (submissions.results ?? []).map((row) => ({
      ...row,
      fields: safeParse(row.fields),
    })),
    edits: (edits.results ?? []).map((row) => ({
      ...row,
      // Parse here so the browser is not re-parsing a string inside JSON.
      fields: safeParse(row.fields),
    })),
    subscriptions: subscriptions.results ?? [],
    premiumPrice: PREMIUM_PRICE_RANDS,
    // Handy for the dashboard, and keeps the field list in one place.
    editable: Object.fromEntries(
      Object.entries(EDITABLE).map(([key, rule]) => [key, { label: rule.label, kind: rule.kind }])
    ),
  });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------
 * Submitting an edit
 * ---------------------------------------------------------------------- */

export async function submitEdit(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown; fields: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  if (!SLUG.test(slug)) return badRequest("That is not a valid listing.");

  // Ownership is the approved claim, not the request.
  const claim = await env.DB.prepare(
    "SELECT hub FROM listing_claims WHERE member_id = ?1 AND slug = ?2 AND status = 'approved'"
  )
    .bind(member.id, slug)
    .first<{ hub: string }>();

  if (!claim) {
    return json({ error: "You do not manage that listing yet." }, { status: 403 });
  }

  if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
    return badRequest("No changes were submitted.");
  }

  const fields: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(body.fields as Record<string, unknown>)) {
    const result = validateField(key, raw);
    if ("error" in result) return badRequest(result.error);

    fields[key] = result.value;
  }

  if (Object.keys(fields).length === 0) return badRequest("No changes were submitted.");

  if (!(await withinRateLimit(env, `edit:${member.id}`, 30, 86400))) {
    return json({ error: "You have submitted a lot of changes today. Try again tomorrow." }, { status: 429 });
  }

  /*
   * Supersede this owner's earlier pending edit for the same listing rather than
   * queueing a second one. Otherwise a reviewer sees two versions of the same
   * change and has to work out which is current.
   */
  await env.DB.prepare(
    `UPDATE listing_edits SET status = 'superseded', decided_at = ?1
      WHERE member_id = ?2 AND slug = ?3 AND status = 'pending'`
  )
    .bind(now(), member.id, slug)
    .run();

  const id = randomToken();

  await env.DB.prepare(
    `INSERT INTO listing_edits (id, member_id, slug, hub, fields, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`
  )
    .bind(id, member.id, slug, claim.hub, JSON.stringify(fields), now())
    .run();

  await notifyReviewer(env, member, slug, fields);

  return json({ ok: true, id, status: "pending" });
}

/** Best-effort nudge so a queued edit is not waiting on someone remembering to look. */
async function notifyReviewer(
  env: Env,
  member: Member,
  slug: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.REVIEW_EMAIL) {
    console.log(`[business] edit queued for ${slug} by ${member.email}`);
    return;
  }

  const changed = Object.keys(fields)
    .map((key) => EDITABLE[key]?.label ?? key)
    .join(", ");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.REVIEW_EMAIL,
        subject: `Listing edit awaiting review: ${slug}`,
        text: [
          `${member.email} has submitted changes to ${slug}.`,
          `Fields changed: ${changed}`,
          "",
          "Review it under I Love Durban → Owner submissions in WordPress.",
        ].join("\n"),
      }),
    });
  } catch (error) {
    // A failed notification must not fail the submission — the edit is saved.
    console.error("[business] could not notify reviewer:", error);
  }
}

/* -------------------------------------------------------------------------
 * Enquiries from the "List your business" page
 * ---------------------------------------------------------------------- */

export async function submitEnquiry(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{
    name: unknown;
    email: unknown;
    phone: unknown;
    business: unknown;
    plan: unknown;
    message: unknown;
    // Extra context some forms collect. Folded into the stored message rather
    // than given columns — they are free text for a human, not query targets.
    category: unknown;
    area: unknown;
  }>(request);

  const name = typeof body.name === "string" ? clean(body.name).slice(0, 80) : "";
  const email = typeof body.email === "string" ? clean(body.email).toLowerCase().slice(0, 160) : "";

  if (!name) return badRequest("Please give us your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return badRequest("That does not look like an email address.");
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!(await withinRateLimit(env, `enquiry:${ip}`, 10, 3600))) {
    return json({ error: "Too many enquiries from this connection. Try again later." }, { status: 429 });
  }

  const optional = (value: unknown, max: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = clean(value).slice(0, max);

    return trimmed || null;
  };

  // Prefix the free-text message with whatever extra context the form sent.
  const context = [
    optional(body.category, 60) && `Category: ${optional(body.category, 60)}`,
    optional(body.area, 80) && `Area: ${optional(body.area, 80)}`,
  ].filter(Boolean);

  const message =
    [context.join("\n"), optional(body.message, 2000)].filter(Boolean).join("\n\n") || null;

  const id = randomToken();

  // Stored first. If the email fails we still have the enquiry.
  await env.DB.prepare(
    `INSERT INTO enquiries (id, name, email, phone, business, plan, message, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(
      id,
      name,
      email,
      optional(body.phone, 40),
      optional(body.business, 120),
      optional(body.plan, 60),
      message,
      now()
    )
    .run();

  await sendEnquiry(env, {
    name,
    email,
    phone: optional(body.phone, 40),
    business: optional(body.business, 120),
    plan: optional(body.plan, 60),
    message,
  });

  return json({
    ok: true,
    message: "Thanks — we have your details and will be in touch within two working days.",
  });
}

async function sendEnquiry(
  env: Env,
  enquiry: {
    name: string;
    email: string;
    phone: string | null;
    business: string | null;
    plan: string | null;
    message: string | null;
  }
): Promise<void> {
  const to = env.ENQUIRY_EMAIL ?? env.REVIEW_EMAIL;

  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to) {
    console.log("[enquiry]", JSON.stringify(enquiry));
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to,
        // So a reply goes to the business, not to the site's own sender.
        reply_to: enquiry.email,
        subject: `Listing enquiry: ${enquiry.business ?? enquiry.name}`,
        text: [
          `Name: ${enquiry.name}`,
          `Email: ${enquiry.email}`,
          `Phone: ${enquiry.phone ?? "—"}`,
          `Business: ${enquiry.business ?? "—"}`,
          `Interested in: ${enquiry.plan ?? "—"}`,
          "",
          enquiry.message ?? "(no message)",
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("[enquiry] could not send:", error);
  }
}

/* -------------------------------------------------------------------------
 * Admin: the queue WordPress reads and decides on
 * ---------------------------------------------------------------------- */

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * Lengths are compared first because they are not secret, then every byte is
 * examined regardless of where the first difference falls.
 */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;
}

function isAdmin(request: Request, env: Env): boolean {
  // Without a configured token the admin endpoints are closed, not open.
  if (!env.ADMIN_TOKEN) return false;

  const header = request.headers.get("Authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";

  return supplied.length > 0 && secretsMatch(supplied, env.ADMIN_TOKEN);
}

/* -------------------------------------------------------------------------
 * Premium subscriptions (PayFast)
 * ---------------------------------------------------------------------- */

/** The member owns this slug if a claim or a submission of theirs says so. */
async function ownsListing(env: Env, memberId: string, slug: string): Promise<boolean> {
  const claim = await env.DB.prepare(
    "SELECT 1 AS x FROM listing_claims WHERE member_id = ?1 AND slug = ?2 AND status = 'approved'"
  )
    .bind(memberId, slug)
    .first();

  if (claim) return true;

  const submission = await env.DB.prepare(
    "SELECT 1 AS x FROM listing_submissions WHERE member_id = ?1 AND slug = ?2 AND status != 'rejected'"
  )
    .bind(memberId, slug)
    .first();

  return Boolean(submission);
}

export async function billingCheckout(request: Request, env: Env, url: URL): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  if (!SLUG.test(slug)) return badRequest("That is not a valid listing.");
  if (!(await ownsListing(env, member.id, slug))) {
    return json({ error: "You do not manage that listing." }, { status: 403 });
  }

  const active = await env.DB.prepare(
    "SELECT 1 AS x FROM subscriptions WHERE slug = ?1 AND status = 'active'"
  )
    .bind(slug)
    .first();

  if (active) return badRequest("That listing already has an active Premium subscription.");

  if (!(await withinRateLimit(env, `checkout:${member.id}`, 10, 3600))) {
    return json({ error: "Too many checkout attempts. Try again later." }, { status: 429 });
  }

  const id = randomToken();
  await env.DB.prepare(
    `INSERT INTO subscriptions (id, member_id, slug, status, amount_cents, created_at)
     VALUES (?1, ?2, ?3, 'initiated', ?4, ?5)`
  )
    .bind(id, member.id, slug, PREMIUM_PRICE_RANDS * 100, now())
    .run();

  const site = (env.SITE_URL ?? url.origin).replace(/\/+$/, "");

  const checkout = buildCheckout(env, {
    paymentId: id,
    email: member.email,
    itemName: "I Love Durban Premium Listing",
    itemDescription: `Monthly Premium subscription for ${slug}`,
    returnUrl: `${site}/my-business/?upgraded=${encodeURIComponent(slug)}`,
    cancelUrl: `${site}/my-business/?checkout=cancelled`,
    notifyUrl: `${site}/api/billing/notify`,
    customSlug: slug,
    customMemberId: member.id,
  });

  return json({ ok: true, ...checkout });
}

/**
 * The ITN webhook — PayFast telling us what happened, server to server.
 *
 * Trust is earned three times over before anything changes: the signature must
 * verify against our passphrase, PayFast itself must confirm the notification
 * when asked, and the amount must be what a Premium subscription costs.
 */
export async function billingNotify(request: Request, env: Env): Promise<Response> {
  const itn = parseItn(await request.text());
  const config = payfastConfig(env);

  const paymentId = itn.params.get("m_payment_id") ?? "";
  const status = itn.params.get("payment_status") ?? "";
  const grossCents = Math.round(parseFloat(itn.params.get("amount_gross") ?? "0") * 100);

  const ok = () => new Response("OK", { status: 200 });

  if (!itnSignatureValid(itn, config.passphrase)) {
    console.error("[billing] ITN signature mismatch for", paymentId);
    return ok(); // Never give a prober a different answer.
  }

  if ((itn.params.get("merchant_id") ?? "") !== config.merchantId) {
    console.error("[billing] ITN for a different merchant:", itn.params.get("merchant_id"));
    return ok();
  }

  if (!(await itnConfirmedByPayfast(itn, config))) {
    console.error("[billing] PayFast did not confirm the ITN for", paymentId);
    return ok();
  }

  const subscription = await env.DB.prepare(
    "SELECT id, member_id, slug, amount_cents FROM subscriptions WHERE id = ?1"
  )
    .bind(paymentId)
    .first<{ id: string; member_id: string; slug: string; amount_cents: number }>();

  if (!subscription) {
    console.error("[billing] ITN for an unknown subscription:", paymentId);
    return ok();
  }

  // Idempotent: a re-delivered notification hits the primary key and stops.
  const pfPaymentId = itn.params.get("pf_payment_id") ?? `${paymentId}:${status}:${now()}`;
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO payments (pf_payment_id, subscription_id, status, amount_cents, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(pfPaymentId, subscription.id, status, grossCents, now())
    .run();

  if ((meta?.changes ?? 0) === 0) return ok();

  if (status === "COMPLETE") {
    if (grossCents !== subscription.amount_cents) {
      console.error(
        `[billing] amount mismatch for ${paymentId}: got ${grossCents}, expected ${subscription.amount_cents}`
      );
      return ok();
    }

    await env.DB.prepare(
      `UPDATE subscriptions
          SET status = 'active', pf_token = COALESCE(?1, pf_token), last_paid_at = ?2, updated_at = ?2
        WHERE id = ?3`
    )
      .bind(itn.params.get("token") ?? null, now(), subscription.id)
      .run();

    // Premium is a paid flag on the submission too, for the WordPress queue.
    await env.DB.prepare(
      "UPDATE listing_submissions SET plan = 'premium' WHERE slug = ?1 AND status != 'rejected'"
    )
      .bind(subscription.slug)
      .run();
  } else if (status === "CANCELLED") {
    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'cancelled', updated_at = ?1 WHERE id = ?2"
    )
      .bind(now(), subscription.id)
      .run();

    await env.DB.prepare(
      "UPDATE listing_submissions SET plan = 'free' WHERE slug = ?1"
    )
      .bind(subscription.slug)
      .run();
  }

  return ok();
}

export async function billingCancel(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  const subscription = await env.DB.prepare(
    `SELECT id, pf_token FROM subscriptions
      WHERE member_id = ?1 AND slug = ?2 AND status = 'active'`
  )
    .bind(member.id, slug)
    .first<{ id: string; pf_token: string | null }>();

  if (!subscription) return badRequest("No active Premium subscription for that listing.");

  if (subscription.pf_token) {
    const cancelled = await cancelSubscription(env, subscription.pf_token);
    if (!cancelled) {
      return json(
        { error: "PayFast did not accept the cancellation. Try again, or contact support." },
        { status: 502 }
      );
    }
  }

  await env.DB.prepare(
    "UPDATE subscriptions SET status = 'cancelled', updated_at = ?1 WHERE id = ?2"
  )
    .bind(now(), subscription.id)
    .run();

  await env.DB.prepare("UPDATE listing_submissions SET plan = 'free' WHERE slug = ?1")
    .bind(slug)
    .run();

  return json({ ok: true });
}

export async function adminSubmissions(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const claims = await env.DB.prepare(
    `SELECT c.id, c.slug, c.hub, c.business_name, c.contact_name, c.contact_phone,
            c.role, c.note, c.created_at, m.email AS member_email, m.name AS member_name
       FROM listing_claims c
       JOIN members m ON m.id = c.member_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at`
  ).all<Record<string, unknown>>();

  const edits = await env.DB.prepare(
    `SELECT e.id, e.slug, e.hub, e.fields, e.created_at,
            m.email AS member_email, m.name AS member_name
       FROM listing_edits e
       JOIN members m ON m.id = e.member_id
      WHERE e.status = 'pending'
      ORDER BY e.created_at`
  ).all<{ fields: string } & Record<string, unknown>>();

  const enquiries = await env.DB.prepare(
    `SELECT id, name, email, phone, business, plan, message, created_at
       FROM enquiries WHERE handled_at IS NULL ORDER BY created_at DESC LIMIT 100`
  ).all<Record<string, unknown>>();

  const listings = await env.DB.prepare(
    `SELECT s.id, s.slug, s.hub, s.fields, s.image_url, s.plan, s.created_at,
            m.email AS member_email, m.name AS member_name
       FROM listing_submissions s
       JOIN members m ON m.id = s.member_id
      WHERE s.status = 'pending'
      ORDER BY s.created_at`
  ).all<{ fields: string } & Record<string, unknown>>();

  return json({
    claims: claims.results ?? [],
    edits: (edits.results ?? []).map((row) => ({ ...row, fields: safeParse(row.fields) })),
    listings: (listings.results ?? []).map((row) => ({ ...row, fields: safeParse(row.fields) })),
    enquiries: enquiries.results ?? [],
  });
}

export async function adminDecide(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const body = await readJson<{ type: unknown; id: unknown; decision: unknown; note: unknown }>(
    request
  );

  const type = body.type;
  const id = typeof body.id === "string" ? body.id : "";
  const decision = body.decision;
  const note = typeof body.note === "string" ? clean(body.note).slice(0, 400) || null : null;

  if (!/^[a-f0-9]{16,80}$/.test(id)) return badRequest("Unknown submission.");

  if (type === "claim") {
    if (decision !== "approve" && decision !== "reject") return badRequest("Unknown decision.");

    const { meta } = await env.DB.prepare(
      `UPDATE listing_claims SET status = ?1, decided_at = ?2, decided_note = ?3
        WHERE id = ?4 AND status = 'pending'`
    )
      .bind(decision === "approve" ? "approved" : "rejected", now(), note, id)
      .run();

    // changes === 0 means it was already decided; say so rather than pretending.
    return json({ ok: (meta?.changes ?? 0) > 0 });
  }

  if (type === "edit") {
    if (decision !== "apply" && decision !== "reject") return badRequest("Unknown decision.");

    const { meta } = await env.DB.prepare(
      `UPDATE listing_edits SET status = ?1, decided_at = ?2, decided_note = ?3
        WHERE id = ?4 AND status = 'pending'`
    )
      .bind(decision === "apply" ? "applied" : "rejected", now(), note, id)
      .run();

    return json({ ok: (meta?.changes ?? 0) > 0 });
  }

  if (type === "enquiry") {
    const { meta } = await env.DB.prepare(
      "UPDATE enquiries SET handled_at = ?1 WHERE id = ?2 AND handled_at IS NULL"
    )
      .bind(now(), id)
      .run();

    return json({ ok: (meta?.changes ?? 0) > 0 });
  }

  if (type === "listing") {
    if (decision !== "approve" && decision !== "reject") return badRequest("Unknown decision.");

    const submission = await env.DB.prepare(
      `UPDATE listing_submissions SET status = ?1, decided_at = ?2, decided_note = ?3
        WHERE id = ?4 AND status = 'pending'
        RETURNING member_id, slug, hub, fields`
    )
      .bind(decision === "approve" ? "approved" : "rejected", now(), note, id)
      .first<{ member_id: string; slug: string; hub: string; fields: string }>();

    if (!submission) return json({ ok: false });

    if (decision === "approve") {
      /*
       * Approval also hands the submitter the keys: an approved claim row, so
       * the ordinary edit flow works on the listing from now on.
       */
      const parsed = safeParse(submission.fields) as Record<string, unknown>;

      await env.DB.prepare(
        `INSERT INTO listing_claims
           (id, member_id, slug, hub, business_name, status, created_at, decided_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'approved', ?6, ?6)
         ON CONFLICT (member_id, slug) DO UPDATE SET
           status = 'approved', decided_at = ?6, decided_note = NULL`
      )
        .bind(
          randomToken(),
          submission.member_id,
          submission.slug,
          submission.hub,
          typeof parsed.name === "string" ? parsed.name : null,
          now()
        )
        .run();
    }

    return json({ ok: true });
  }

  return badRequest("Unknown submission type.");
}
