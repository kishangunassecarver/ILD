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
  triggerDeploy,
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
import { deliverEmail, type AuthEmail } from "./email";
import { decideEvent, handleEventItn, pendingEventSubmissions } from "./events";

/** Slug shape shared with the saves endpoint: lowercase, no traversal. */
export const SLUG = /^[a-z0-9][a-z0-9\-]{0,120}$/;

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
  // Premium only, and every entry must be a URL our own uploader issued —
  // both enforced in submitEdit, on top of the shape rules here.
  gallery: { kind: "list", max: 10, each: 300, label: "Gallery photos" },
  // The featured photo. Own-uploader URLs only, enforced in submitEdit.
  imageUrl: { kind: "line", max: 300, label: "Featured photo" },
};

/**
 * Normalise submitted text.
 *
 * Strips control characters and the zero-width family, then folds non-breaking
 * spaces back to ordinary ones — people paste all three out of Word and PDFs
 * without realising, and they render as invisible junk or unbreakable lines.
 */
export function clean(value: string): string {
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

  /*
   * A listing that already has an owner is not claimable. That covers listings
   * someone added through "Add a Listing" and had verified, and listings whose
   * claim was approved for somebody else — either way, ownership disputes are
   * a support conversation, not a form.
   */
  const owned = await env.DB.prepare(
    `SELECT 1 AS x FROM listing_claims WHERE slug = ?1 AND status = 'approved' AND member_id != ?2
     UNION
     SELECT 1 AS x FROM listing_submissions WHERE slug = ?1 AND status != 'rejected' AND member_id != ?2`
  )
    .bind(slug, member.id)
    .first();

  if (owned) {
    return badRequest(
      "That listing is already managed by its owner. If you believe that is wrong, contact us and we will look into it."
    );
  }

  // A listing somebody is actively paying for is spoken for, whoever published
  // it — a Premium (featured) listing with a live subscription cannot be claimed.
  const premium = await env.DB.prepare(
    "SELECT 1 AS x FROM subscriptions WHERE slug = ?1 AND status = 'active' AND member_id != ?2"
  )
    .bind(slug, member.id)
    .first();

  if (premium) {
    return badRequest(
      "That listing has an active Premium subscription and is already managed by its owner. If you believe that is wrong, contact us and we will look into it."
    );
  }

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

  const businessName = text(body.businessName, 120) ?? slug;

  // The reviewer's nudge, so the claim is not waiting on someone remembering
  // to check the queue.
  await notifyNewClaim(env, member, slug, businessName);

  // And the customer's receipt.
  const dashboard = `${siteBase(env, request)}/my-business/`;
  await sendMemberEmail(env, member.email, {
    subject: `We've received your claim: ${businessName}`,
    heading: "Your claim is in review",
    paragraphs: [
      `Thanks — you have asked to manage "${businessName}" on I Love Durban.`,
      "A person reviews every claim, usually within two working days. We may phone the number you gave to verify it.",
      "You will get an email the moment it is decided, and once approved the listing appears on your dashboard, ready to edit.",
    ],
    cta: { label: "Open my dashboard", href: dashboard },
    footnote: "You are getting this because a claim was submitted from your I Love Durban account.",
    link: dashboard,
  });

  return json({ status: "pending", id });
}

/** Best-effort alert to the review inbox about a new claim. */
async function notifyNewClaim(
  env: Env,
  member: Member,
  slug: string,
  businessName: string
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.REVIEW_EMAIL) {
    console.log(`[business] claim queued: ${slug} by ${member.email}`);
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
        subject: `New claim awaiting review: ${businessName}`,
        text: [
          `${member.email} has claimed "${businessName}" (${slug}).`,
          "",
          "Review it under I Love Durban → Owner Submissions in WordPress.",
          "Edit access stays off until the claim is approved there.",
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("[business] could not notify about the new claim:", error);
  }
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
export function isOwnMediaUrl(value: unknown): value is string {
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

      const dashboard = `${siteBase(env, request)}/my-business/`;
      await sendMemberEmail(env, member.email, {
        subject: `We've received your listing: ${String(fields.name)}`,
        heading: "Your listing is in review",
        paragraphs: [
          `Thanks for adding "${String(fields.name)}" to I Love Durban.`,
          "A person on our team reviews every listing before it goes live — you will get another email the moment it is approved.",
          "• Your free listing never expires",
          "• Edit your details, hours and photo any time from your dashboard",
          "• Go Premium whenever you like for a photo gallery and top placement with the Featured badge",
        ],
        cta: { label: "Open my dashboard", href: dashboard },
        footnote:
          "You are getting this because a listing was submitted from your I Love Durban account.",
        link: dashboard,
      });

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
 * Customer lifecycle mail
 *
 * Every mail here is best-effort by design: the action that earned the email
 * has already succeeded, and a mail provider having a bad moment must never
 * undo a submission, a payment or a cancellation.
 * ---------------------------------------------------------------------- */

export function siteBase(env: Env, request: Request): string {
  return (env.SITE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
}

export async function sendMemberEmail(env: Env, to: string, mail: AuthEmail): Promise<void> {
  try {
    await deliverEmail(env, to, mail);
  } catch (error) {
    console.error(`[mail] could not send "${mail.subject}" to ${to}:`, error);
  }
}

export async function memberEmailById(env: Env, memberId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT email FROM members WHERE id = ?1")
    .bind(memberId)
    .first<{ email: string }>();

  return row?.email ?? null;
}

/** The listing's display name, straight from what the owner submitted. */
async function listingNameFor(env: Env, slug: string): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT fields FROM listing_submissions WHERE slug = ?1 ORDER BY created_at DESC LIMIT 1"
  )
    .bind(slug)
    .first<{ fields: string }>();

  const parsed = row ? (safeParse(row.fields) as Record<string, unknown> | null) : null;
  return parsed && typeof parsed.name === "string" && parsed.name ? parsed.name : slug;
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

  // Billing history, newest first — each row has an invoice behind it.
  const invoices = await env.DB.prepare(
    `SELECT p.pf_payment_id, p.status, p.amount_cents, p.created_at, s.slug
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.member_id = ?1
      ORDER BY p.created_at DESC LIMIT 60`
  )
    .bind(member.id)
    .all<Record<string, unknown>>();

  return json({
    claims: claims.results ?? [],
    invoices: invoices.results ?? [],
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

  // The featured photo must come from our own uploader (or be cleared).
  if ("imageUrl" in fields && fields.imageUrl !== null && !isOwnMediaUrl(fields.imageUrl)) {
    return badRequest("Upload the photo through the dashboard first.");
  }

  // The gallery is a Premium feature, and only our own uploads belong in it.
  if ("gallery" in fields && fields.gallery !== null) {
    const entries = fields.gallery as string[];

    for (const entry of entries) {
      if (!isOwnMediaUrl(entry)) {
        return badRequest("Gallery photos must be uploaded through the dashboard.");
      }
    }

    if (entries.length > 0 && !(await isPremium(env, slug))) {
      return json(
        { error: "The photo gallery is a Premium feature. Upgrade the listing first." },
        { status: 403 }
      );
    }
  }

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

export function isAdmin(request: Request, env: Env): boolean {
  // Without a configured token the admin endpoints are closed, not open.
  if (!env.ADMIN_TOKEN) return false;

  const header = request.headers.get("Authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";

  return supplied.length > 0 && secretsMatch(supplied, env.ADMIN_TOKEN);
}

/**
 * POST /api/business/delete — an owner removing their own listing.
 *
 * Only listings that came in through "Add a Listing" can be deleted here;
 * curated directory content is not an owner's to remove. Deleting a Premium
 * listing cancels its subscription at PayFast first — nobody keeps paying for
 * a listing they removed.
 *
 * The WordPress post stays (the plugin stops publishing the slug and the
 * admin can trash the post whenever); the site drops it at the next rebuild.
 */
export async function ownerDeleteListing(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG.test(slug)) return badRequest("That is not a valid listing.");

  const submission = await env.DB.prepare(
    `SELECT id FROM listing_submissions
      WHERE member_id = ?1 AND slug = ?2 AND status IN ('pending','approved')`
  )
    .bind(member.id, slug)
    .first<{ id: string }>();

  if (!submission) {
    return json({ error: "Only listings you added yourself can be removed here." }, { status: 403 });
  }

  // Money first.
  const { results } = await env.DB.prepare(
    "SELECT id, pf_token, status FROM subscriptions WHERE slug = ?1 AND status IN ('active','initiated')"
  )
    .bind(slug)
    .all<{ id: string; pf_token: string | null; status: string }>();

  let premiumCancelled = false;

  for (const subscription of results ?? []) {
    if (subscription.status === "active" && subscription.pf_token) {
      const done = await cancelSubscription(env, subscription.pf_token);
      if (!done) {
        return json(
          {
            error:
              "PayFast did not accept the subscription cancellation. Try again in a minute — the listing was not removed.",
          },
          { status: 502 }
        );
      }
    }

    if (subscription.status === "active") premiumCancelled = true;

    await env.DB.prepare("UPDATE subscriptions SET status = ?1, updated_at = ?2 WHERE id = ?3")
      .bind(subscription.status === "active" ? "cancelled" : "failed", now(), subscription.id)
      .run();
  }

  const note = "Removed by you.";

  await env.DB.prepare(
    `UPDATE listing_submissions SET status = 'deleted', decided_at = ?1, decided_note = ?2
      WHERE id = ?3`
  )
    .bind(now(), note, submission.id)
    .run();

  await env.DB.prepare(
    `UPDATE listing_claims SET status = 'rejected', decided_at = ?1, decided_note = ?2
      WHERE slug = ?3 AND member_id = ?4 AND status != 'rejected'`
  )
    .bind(now(), note, slug, member.id)
    .run();

  await env.DB.prepare(
    `UPDATE listing_edits SET status = 'superseded', decided_at = ?1
      WHERE slug = ?2 AND status = 'pending'`
  )
    .bind(now(), slug)
    .run();

  await triggerDeploy(env, `owner removed ${slug}`);

  {
    const site = siteBase(env, request);
    const dashboard = `${site}/my-business/`;
    const name = await listingNameFor(env, slug);

    await sendMemberEmail(env, member.email, {
      subject: `Listing removed: ${name}`,
      heading: "Your listing has been removed",
      paragraphs: [
        `As requested, "${name}" has been removed from I Love Durban. It comes off the public site within a few minutes.`,
        ...(premiumCancelled
          ? [
              "Its Premium subscription has been cancelled — you will not be billed again, and your past invoices stay available on your dashboard.",
            ]
          : []),
        "You are always welcome back — you can add a new listing any time.",
      ],
      cta: { label: "Open my dashboard", href: dashboard },
      link: dashboard,
    });
  }

  return json({ ok: true });
}

/**
 * GET /api/admin/removed — slugs whose owners deleted them. The WordPress
 * plugin consults this at build time and stops publishing those listings.
 */
export async function adminRemoved(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT DISTINCT slug FROM listing_submissions WHERE status = 'deleted'"
  ).all<{ slug: string }>();

  return json({ slugs: (results ?? []).map((row) => row.slug) });
}

/* -------------------------------------------------------------------------
 * Premium subscriptions (PayFast)
 * ---------------------------------------------------------------------- */

/** Premium = an active subscription on the slug. */
async function isPremium(env: Env, slug: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS x FROM subscriptions WHERE slug = ?1 AND status = 'active'"
  )
    .bind(slug)
    .first();

  return Boolean(row);
}

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

  // Abandoned checkouts must not haunt the dashboard as "waiting for PayFast".
  await env.DB.prepare(
    `UPDATE subscriptions SET status = 'failed', updated_at = ?1
      WHERE member_id = ?2 AND slug = ?3 AND status = 'initiated'`
  )
    .bind(now(), member.id, slug)
    .run();

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

  /*
   * Live mode is strict: the signature must verify with our passphrase. The
   * shared sandbox merchant signs with or without one depending on account
   * settings, so in sandbox either form is accepted — the validation postback
   * to PayFast below still has to pass either way.
   */
  const signatureOk =
    itnSignatureValid(itn, config.passphrase) || (!config.live && itnSignatureValid(itn, ""));

  if (!signatureOk) {
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
    "SELECT id, member_id, slug, amount_cents, status FROM subscriptions WHERE id = ?1"
  )
    .bind(paymentId)
    .first<{
      id: string;
      member_id: string;
      slug: string;
      amount_cents: number;
      status: string;
    }>();

  if (!subscription) {
    // Not a subscription — maybe a one-off event placement order.
    const handled = await handleEventItn(env, request, itn, paymentId, status, grossCents);
    if (!handled) console.error("[billing] ITN for an unknown payment:", paymentId);
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

    // Premium perks (the gallery) reach the public site on the next build.
    await triggerDeploy(env, `premium activated for ${subscription.slug}`);

    // Tell the customer. First payment gets the full welcome-to-Premium mail
    // with the subscription details; every monthly charge after that gets a
    // simple receipt.
    const email = await memberEmailById(env, subscription.member_id);
    if (email) {
      const site = siteBase(env, request);
      const dashboard = `${site}/my-business/`;
      const name = await listingNameFor(env, subscription.slug);
      const amount = `R${(grossCents / 100).toFixed(2)}`;
      const firstActivation = subscription.status !== "active";

      await sendMemberEmail(
        env,
        email,
        firstActivation
          ? {
              subject: `Premium is active: ${name}`,
              heading: "Welcome to Premium!",
              paragraphs: [
                `Your payment of ${amount} was received and "${name}" is now a Premium listing.`,
                "Here is what your subscription includes:",
                "• Priority placement — your listing sits at the top with the Featured badge",
                "• A photo gallery of up to 10 photos, editable from your dashboard",
                `• Billed ${amount} per month via PayFast — cancel any time from your dashboard`,
                "Your invoice is ready under Subscriptions & invoices on your dashboard, and every monthly payment adds a new one.",
              ],
              cta: { label: "Open my dashboard", href: dashboard },
              footnote: "Premium perks appear on the public site within a few minutes.",
              link: dashboard,
            }
          : {
              subject: `Payment received: ${name}`,
              heading: "Thanks — payment received",
              paragraphs: [
                `Your monthly Premium payment of ${amount} for "${name}" went through.`,
                "The invoice is on your dashboard under Subscriptions & invoices.",
              ],
              cta: { label: "View my invoices", href: dashboard },
              link: dashboard,
            }
      );
    }
  } else if (status === "CANCELLED") {
    // Guarded update: when the cancellation started on our dashboard the row
    // is already cancelled and the customer already has their mail — the ITN
    // echo must not send a second one.
    const { meta: cancelMeta } = await env.DB.prepare(
      "UPDATE subscriptions SET status = 'cancelled', updated_at = ?1 WHERE id = ?2 AND status != 'cancelled'"
    )
      .bind(now(), subscription.id)
      .run();

    await env.DB.prepare(
      "UPDATE listing_submissions SET plan = 'free' WHERE slug = ?1"
    )
      .bind(subscription.slug)
      .run();

    // A cancellation that started on PayFast's side reaches us only here —
    // the perks must still come off the site.
    await triggerDeploy(env, `premium cancelled (ITN) for ${subscription.slug}`);

    if ((cancelMeta?.changes ?? 0) > 0) {
      const email = await memberEmailById(env, subscription.member_id);
      if (email) {
        const site = siteBase(env, request);
        const dashboard = `${site}/my-business/`;
        const name = await listingNameFor(env, subscription.slug);

        await sendMemberEmail(env, email, {
          subject: `Premium cancelled: ${name}`,
          heading: "Your Premium subscription is cancelled",
          paragraphs: [
            `PayFast has confirmed the cancellation of the Premium subscription for "${name}".`,
            "Your listing stays live on the free plan — it never expires. The photo gallery and priority placement come off shortly.",
            "You will not be billed again, and your past invoices stay available on your dashboard.",
            "Changed your mind? You can go Premium again any time.",
          ],
          cta: { label: "Open my dashboard", href: dashboard },
          link: dashboard,
        });
      }
    }
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

  // The gallery comes off the public listing on the next build.
  await triggerDeploy(env, `premium cancelled for ${slug}`);

  {
    const site = siteBase(env, request);
    const dashboard = `${site}/my-business/`;
    const name = await listingNameFor(env, slug);

    await sendMemberEmail(env, member.email, {
      subject: `Premium cancelled: ${name}`,
      heading: "Your Premium subscription is cancelled",
      paragraphs: [
        `As requested, the Premium subscription for "${name}" has been cancelled.`,
        "Your listing stays live on the free plan — it never expires. The photo gallery and priority placement come off shortly.",
        "You will not be billed again, and your past invoices stay available on your dashboard.",
        "Changed your mind? You can go Premium again any time.",
      ],
      cta: { label: "Open my dashboard", href: dashboard },
      link: dashboard,
    });
  }

  return json({ ok: true });
}

/**
 * GET /api/billing/invoice?id=… — a printable, branded invoice for one payment.
 * Only the member the subscription belongs to can open it.
 */
export async function billingInvoice(request: Request, env: Env, url: URL): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return new Response("Sign in to view invoices.", { status: 401 });

  const id = url.searchParams.get("id") ?? "";
  if (!/^[\w\-:.]{4,120}$/.test(id)) return new Response("Not found", { status: 404 });

  const payment = await env.DB.prepare(
    `SELECT p.pf_payment_id, p.status, p.amount_cents, p.created_at, s.slug, s.member_id
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.pf_payment_id = ?1`
  )
    .bind(id)
    .first<{
      pf_payment_id: string;
      status: string;
      amount_cents: number;
      created_at: number;
      slug: string;
      member_id: string;
    }>();

  if (!payment || payment.member_id !== member.id) {
    return new Response("Not found", { status: 404 });
  }

  const esc = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const date = new Date(payment.created_at * 1000).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const amount = `R ${(payment.amount_cents / 100).toFixed(2)}`;
  const font = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(payment.pf_payment_id)}</title></head>
<body style="margin:0;background:#EEF2F7;font-family:${font};">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:#021734;padding:24px 36px;">
      <div style="font-weight:800;font-size:22px;color:#fff;">I <span style="color:#F6514D;">&#10084;&#65039;</span> DURBAN</div>
      <div style="font-size:9px;letter-spacing:2.5px;color:#8CA3B8;padding-top:4px;">THE HEARTBEAT OF OUR CITY</div>
    </div>
    <div style="padding:32px 36px;color:#334A5E;font-size:14px;line-height:1.6;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:20px;font-weight:800;color:#01122C;">Tax Invoice / Receipt</div>
          <div style="color:#8CA3B8;font-size:12px;">No. ${esc(payment.pf_payment_id)}</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#8CA3B8;">
          ${esc(date)}<br>Status: <strong style="color:${payment.status === "COMPLETE" ? "#1a7f4f" : "#B92F2C"};">${esc(payment.status === "COMPLETE" ? "PAID" : payment.status)}</strong>
        </div>
      </div>
      <div style="margin-top:20px;font-size:12px;color:#8CA3B8;">Billed to</div>
      <div>${esc(member.name ?? "")}${member.name ? " — " : ""}${esc(member.email)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px;">
        <tr style="text-align:left;color:#8CA3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
          <th style="padding:8px 0;border-bottom:1px solid #E4EAF1;">Description</th>
          <th style="padding:8px 0;border-bottom:1px solid #E4EAF1;text-align:right;">Amount</th>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E4EAF1;">
            Premium Listing — <strong>${esc(payment.slug)}</strong><br>
            <span style="font-size:12px;color:#8CA3B8;">Monthly subscription, billed via PayFast</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #E4EAF1;text-align:right;vertical-align:top;">${amount}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;font-weight:800;color:#01122C;">Total</td>
          <td style="padding:12px 0;text-align:right;font-weight:800;color:#01122C;">${amount}</td>
        </tr>
      </table>
      <p style="font-size:11px;color:#8CA3B8;margin-top:24px;">
        This document confirms payment received via PayFast. Print or save it for your records
        (your browser's Print &rarr; Save as PDF).
      </p>
    </div>
    <div style="background:#F6F9FC;padding:16px 36px;font-size:11px;color:#8CA3B8;text-align:center;">
      I Love Durban &middot; ilovedurban.co.za
    </div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

/**
 * Wind down every open subscription on a slug: cancel active ones at PayFast
 * (best-effort), then close them locally. Used whenever a listing stops
 * existing — deleted in WordPress, removed by its owner, or rejected after
 * the owner already paid.
 */
async function closeSubscriptionsForSlug(env: Env, slug: string): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT id, pf_token, status FROM subscriptions WHERE slug = ?1 AND status IN ('active','initiated')"
  )
    .bind(slug)
    .all<{ id: string; pf_token: string | null; status: string }>();

  // Only cancelled *active* subscriptions count — a failed 'initiated'
  // checkout never billed anyone, so callers must not tell the customer
  // their billing stopped.
  let closed = 0;
  for (const subscription of results ?? []) {
    if (subscription.status === "active" && subscription.pf_token) {
      const done = await cancelSubscription(env, subscription.pf_token);
      if (!done) {
        console.error(`[billing] PayFast refused the cancel for ${subscription.id} (${slug})`);
      }
    }

    await env.DB.prepare("UPDATE subscriptions SET status = ?1, updated_at = ?2 WHERE id = ?3")
      .bind(subscription.status === "active" ? "cancelled" : "failed", now(), subscription.id)
      .run();

    if (subscription.status === "active") closed += 1;
  }

  return closed;
}

/**
 * POST /api/admin/listing-removed — WordPress deleted (or trashed) a listing.
 *
 * The listing post was the source of truth, so everything hanging off it is
 * wound down: active subscriptions are cancelled at PayFast and locally,
 * pending checkouts are failed, and the owner's submission, claim and pending
 * edits are closed with a note saying why.
 */
export async function adminListingRemoved(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG.test(slug)) return badRequest("That is not a valid listing slug.");

  const note = "This listing was removed from the site.";

  // The submitter, looked up before the rows below get closed off.
  const owner = await env.DB.prepare(
    `SELECT member_id, fields FROM listing_submissions
      WHERE slug = ?1 AND status != 'rejected'
      ORDER BY created_at DESC LIMIT 1`
  )
    .bind(slug)
    .first<{ member_id: string; fields: string }>();

  // Cancel the money first — we must never keep charging for a listing that
  // no longer exists.
  const cancelled = await closeSubscriptionsForSlug(env, slug);

  await env.DB.prepare(
    `UPDATE listing_submissions SET status = 'rejected', decided_at = ?1, decided_note = ?2
      WHERE slug = ?3 AND status != 'rejected'`
  )
    .bind(now(), note, slug)
    .run();

  await env.DB.prepare(
    `UPDATE listing_claims SET status = 'rejected', decided_at = ?1, decided_note = ?2
      WHERE slug = ?3 AND status != 'rejected'`
  )
    .bind(now(), note, slug)
    .run();

  await env.DB.prepare(
    `UPDATE listing_edits SET status = 'superseded', decided_at = ?1
      WHERE slug = ?2 AND status = 'pending'`
  )
    .bind(now(), slug)
    .run();

  if (owner) {
    const ownerEmail = await memberEmailById(env, owner.member_id);
    if (ownerEmail) {
      const parsed = safeParse(owner.fields) as Record<string, unknown> | null;
      const name =
        parsed && typeof parsed.name === "string" && parsed.name ? parsed.name : slug;
      const dashboard = `${siteBase(env, request)}/my-business/`;

      await sendMemberEmail(env, ownerEmail, {
        subject: `Listing removed: ${name}`,
        heading: "Your listing has been removed",
        paragraphs: [
          `"${name}" has been removed from I Love Durban by our team.`,
          ...(cancelled > 0
            ? [
                "Its Premium subscription has been cancelled — you will not be billed again, and your past invoices stay available on your dashboard.",
              ]
            : []),
          "If you think this was a mistake, reply to this email or reach us through the contact page — we are happy to take a look.",
        ],
        cta: { label: "Open my dashboard", href: dashboard },
        link: dashboard,
      });
    }
  }

  return json({ ok: true, subscriptionsClosed: cancelled });
}

/**
 * GET /api/admin/premium — the slugs with an active Premium subscription.
 *
 * WordPress asks at build time and strips premium-only content (the gallery)
 * from any listing that is not on this list, so a lapsed subscription takes
 * its perks off the public site at the next rebuild.
 */
/**
 * POST /api/admin/deploy — fire the build hook on demand and report what
 * Cloudflare actually said. The lifecycle callers ignore the outcome (they
 * are best-effort); this exists so a human can test the hook end to end.
 */
export async function adminDeploy(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  return json({ result: await triggerDeploy(env, "manual admin trigger") });
}

export async function adminPremium(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT DISTINCT slug FROM subscriptions WHERE status = 'active'"
  ).all<{ slug: string }>();

  return json({ slugs: (results ?? []).map((row) => row.slug) });
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
    events: await pendingEventSubmissions(env),
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

  if (type === "event") {
    if (decision !== "approve" && decision !== "reject") return badRequest("Unknown decision.");
    return decideEvent(request, env, id, decision, note);
  }

  if (type === "claim") {
    if (decision !== "approve" && decision !== "reject") return badRequest("Unknown decision.");

    // RETURNING tells us both that it was still pending (else no row) and who
    // to email about the outcome.
    const claim = await env.DB.prepare(
      `UPDATE listing_claims SET status = ?1, decided_at = ?2, decided_note = ?3
        WHERE id = ?4 AND status = 'pending'
        RETURNING member_id, slug, hub, business_name`
    )
      .bind(decision === "approve" ? "approved" : "rejected", now(), note, id)
      .first<{ member_id: string; slug: string; hub: string; business_name: string | null }>();

    // No row means it was already decided; say so rather than pretending.
    if (!claim) return json({ ok: false });

    const ownerEmail = await memberEmailById(env, claim.member_id);
    if (ownerEmail) {
      const site = siteBase(env, request);
      const name = claim.business_name || claim.slug;
      const dashboard = `${site}/my-business/`;
      const listingUrl = `${site}/${claim.hub}/${claim.slug}/`;

      await sendMemberEmail(
        env,
        ownerEmail,
        decision === "approve"
          ? {
              subject: `Your claim is approved: ${name}`,
              heading: `"${name}" is yours to manage`,
              paragraphs: [
                "Your claim has been verified and approved — the listing now shows on your dashboard.",
                "From there you can:",
                "• Update your details, hours and photos any time (every edit is reviewed before it goes live)",
                "• Go Premium for a photo gallery and top placement with the Featured badge",
                "Welcome aboard — support local!",
              ],
              cta: { label: "Manage my listing", href: dashboard },
              footnote: `Your listing: ${listingUrl}`,
              link: dashboard,
            }
          : {
              subject: `About your claim: ${name}`,
              heading: "Your claim was not approved",
              paragraphs: [
                `We could not verify your claim on "${name}" this time.`,
                ...(note ? [`Note from the review team: ${note}`] : []),
                "If you can share more proof — an email address on the business domain, a company registration — you are welcome to submit the claim again, or contact us and a person will help.",
              ],
              cta: { label: "Open my dashboard", href: dashboard },
              link: dashboard,
            }
      );
    }

    return json({ ok: true });
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

    const parsed = safeParse(submission.fields) as Record<string, unknown>;
    const businessName =
      typeof parsed.name === "string" && parsed.name ? parsed.name : submission.slug;
    let subscriptionsClosed = 0;

    if (decision === "reject") {
      // The owner may have paid for Premium from day one; a rejected listing
      // must never keep billing them.
      subscriptionsClosed = await closeSubscriptionsForSlug(env, submission.slug);
    }

    if (decision === "approve") {
      /*
       * Approval also hands the submitter the keys: an approved claim row, so
       * the ordinary edit flow works on the listing from now on.
       */
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

    const ownerEmail = await memberEmailById(env, submission.member_id);
    if (ownerEmail) {
      const site = siteBase(env, request);
      const listingUrl = `${site}/${submission.hub}/${submission.slug}/`;
      const dashboard = `${site}/my-business/`;

      await sendMemberEmail(
        env,
        ownerEmail,
        decision === "approve"
          ? {
              subject: `Your listing is live: ${businessName}`,
              heading: `"${businessName}" is live on I Love Durban!`,
              paragraphs: [
                "Your listing has been approved and published. It can take a few minutes to appear while the site republishes.",
                "From your dashboard you can:",
                "• Update your details, hours and featured photo any time",
                "• Go Premium for a photo gallery and top placement with the Featured badge",
                "Welcome aboard — support local!",
              ],
              cta: { label: "See my listing", href: listingUrl },
              footnote: `Manage it any time at ${dashboard}`,
              link: listingUrl,
            }
          : {
              subject: `About your listing: ${businessName}`,
              heading: "Your listing was not approved",
              paragraphs: [
                `"${businessName}" did not make it onto I Love Durban this time.`,
                ...(note ? [`Note from the review team: ${note}`] : []),
                ...(subscriptionsClosed > 0
                  ? [
                      "The Premium subscription for this listing has been cancelled — you will not be billed again.",
                    ]
                  : []),
                "You are welcome to update the details and submit it again from your dashboard.",
              ],
              cta: { label: "Open my dashboard", href: dashboard },
              link: dashboard,
            }
      );
    }

    return json({ ok: true });
  }

  return badRequest("Unknown submission type.");
}
