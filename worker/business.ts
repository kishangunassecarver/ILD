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

  const edits = await env.DB.prepare(
    `SELECT id, slug, fields, status, created_at, decided_at, decided_note
       FROM listing_edits WHERE member_id = ?1 ORDER BY created_at DESC LIMIT 50`
  )
    .bind(member.id)
    .all<{ id: string; slug: string; fields: string; status: string; created_at: number }>();

  return json({
    claims: claims.results ?? [],
    edits: (edits.results ?? []).map((row) => ({
      ...row,
      // Parse here so the browser is not re-parsing a string inside JSON.
      fields: safeParse(row.fields),
    })),
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

  return json({
    claims: claims.results ?? [],
    edits: (edits.results ?? []).map((row) => ({ ...row, fields: safeParse(row.fields) })),
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

  return badRequest("Unknown submission type.");
}
