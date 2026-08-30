/**
 * Publisher events: submit an event, buy placement, watch it go live.
 *
 * The same two rules as business listings apply. Nothing a publisher submits
 * reaches the site without a person approving it in WordPress, and every field
 * is validated against an allow-list.
 *
 * Placement is a three-tier ladder — free, Featured, Premium — and the paid
 * tiers are ONE-OFF PayFast payments: an event ends, so nothing recurs. Once
 * the event's date passes, the site stops showing it and the dashboard marks
 * it "Ended".
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
import { buildCheckout, type Itn } from "./payfast";
import { EVENT_TIER_PRICES_RANDS, type EventPaidTier } from "../lib/pricing";
import {
  clean,
  isAdmin,
  isOwnMediaUrl,
  memberEmailById,
  sendMemberEmail,
  siteBase,
  SLUG,
} from "./business";

/* -------------------------------------------------------------------------
 * Fields
 * ---------------------------------------------------------------------- */

type EventFieldKind = "line" | "text" | "paragraphs" | "url" | "date";

interface EventFieldRule {
  kind: EventFieldKind;
  max: number;
  each?: number;
  label: string;
}

/** What a publisher may set on their event. Mirrors the WordPress schema. */
const EVENT_FIELDS: Record<string, EventFieldRule> = {
  title: { kind: "line", max: 120, label: "Event name" },
  date: { kind: "date", max: 10, label: "Date" },
  dateLabel: { kind: "line", max: 60, label: "Date label" },
  venue: { kind: "line", max: 120, label: "Venue" },
  area: { kind: "line", max: 80, label: "Area" },
  category: { kind: "line", max: 60, label: "Category" },
  blurb: { kind: "text", max: 240, label: "One-line summary" },
  body: { kind: "paragraphs", max: 12, each: 600, label: "Full description" },
  price: { kind: "line", max: 60, label: "Price" },
  ticketUrl: { kind: "url", max: 300, label: "Ticket link" },
};

const REQUIRED_ON_CREATE = ["title", "date", "venue", "area", "category", "blurb"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateEventField(key: string, raw: unknown): { value: unknown } | { error: string } {
  const rule = EVENT_FIELDS[key];
  if (!rule) return { error: `"${key}" is not something an event can set.` };

  if (raw == null || raw === "") return { value: null };

  switch (rule.kind) {
    case "line":
    case "text": {
      if (typeof raw !== "string") return { error: `${rule.label} must be text.` };
      const value = clean(raw).slice(0, rule.max);
      return { value: value || null };
    }
    case "date": {
      if (typeof raw !== "string" || !ISO_DATE.test(raw.trim())) {
        return { error: "The date must be in YYYY-MM-DD form." };
      }
      const when = Date.parse(`${raw.trim()}T00:00:00Z`);
      if (Number.isNaN(when)) return { error: "That is not a real date." };
      // 23:59 local grace: an event is submittable on its own day.
      if (when < Date.now() - 36 * 3600 * 1000) {
        return { error: "The event date has already passed." };
      }
      return { value: raw.trim() };
    }
    case "url": {
      if (typeof raw !== "string") return { error: `${rule.label} must be a link.` };
      const value = clean(raw).slice(0, rule.max);
      if (!value) return { value: null };
      if (!/^https?:\/\//i.test(value)) return { error: `${rule.label} must start with http(s)://.` };
      return { value };
    }
    case "paragraphs": {
      if (typeof raw === "string") {
        const paragraphs = raw
          .split(/\n\s*\n/)
          .map((p) => clean(p).slice(0, rule.each ?? 600))
          .filter(Boolean)
          .slice(0, rule.max);
        return { value: paragraphs.length ? paragraphs : null };
      }
      if (Array.isArray(raw)) {
        const paragraphs = raw
          .filter((p): p is string => typeof p === "string")
          .map((p) => clean(p).slice(0, rule.each ?? 600))
          .filter(Boolean)
          .slice(0, rule.max);
        return { value: paragraphs.length ? paragraphs : null };
      }
      return { error: `${rule.label} must be text.` };
    }
  }
}

function eventTitleOf(fieldsJson: string, slug: string): string {
  try {
    const parsed = JSON.parse(fieldsJson) as Record<string, unknown>;
    return typeof parsed.title === "string" && parsed.title ? parsed.title : slug;
  } catch {
    return slug;
  }
}

/* -------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------- */

export async function createEvent(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ fields: unknown; image: unknown }>(request);

  if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
    return badRequest("The event details are missing.");
  }

  const fields: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(body.fields as Record<string, unknown>)) {
    const result = validateEventField(key, raw);
    if ("error" in result) return badRequest(result.error);
    if (result.value !== null) fields[key] = result.value;
  }

  for (const key of REQUIRED_ON_CREATE) {
    if (!fields[key]) return badRequest(`${EVENT_FIELDS[key].label} is required.`);
  }

  const image = body.image == null || body.image === "" ? null : body.image;
  if (image !== null && !isOwnMediaUrl(image)) {
    return badRequest("Upload the photo through the dashboard first.");
  }

  if (!(await withinRateLimit(env, `create-event:${member.id}`, 5, 86400))) {
    return json(
      { error: "You have added a lot of events today. Try again tomorrow." },
      { status: 429 }
    );
  }

  const base =
    String(fields.title)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "event";

  const id = randomToken();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug =
      attempt === 0 ? base : attempt < 5 ? `${base}-${attempt + 1}` : `${base}-${id.slice(0, 6)}`;

    try {
      await env.DB.prepare(
        `INSERT INTO event_submissions (id, member_id, slug, fields, image_url, tier, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'free', 'pending', ?6)`
      )
        .bind(id, member.id, slug, JSON.stringify(fields), image, now())
        .run();

      await notifyNewEvent(env, member, slug, String(fields.title));

      const dashboard = `${siteBase(env, request)}/my-events/`;
      await sendMemberEmail(env, member.email, {
        subject: `We've received your event: ${String(fields.title)}`,
        heading: "Your event is in review",
        paragraphs: [
          `Thanks for adding "${String(fields.title)}" to I Love Durban.`,
          "A person on our team reviews every event before it goes live — you will get another email the moment it is approved.",
          "• Free event listings stay free",
          "• Boost it to Featured or Premium any time for top placement — a once-off payment, no subscription",
          "• Once the event date passes it quietly comes off the site",
        ],
        cta: { label: "Open my events", href: dashboard },
        footnote: "You are getting this because an event was submitted from your I Love Durban account.",
        link: dashboard,
      });

      return json({ ok: true, id, slug, status: "pending" });
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }

  return badRequest("An event with that name already exists. Try a more specific name.");
}

/** Best-effort alert to the review inbox about a new event. */
async function notifyNewEvent(
  env: Env,
  member: Member,
  slug: string,
  title: string
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.REVIEW_EMAIL) {
    console.log(`[events] new event queued: ${slug} by ${member.email}`);
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
        subject: `New event awaiting review: ${title}`,
        text: [
          `${member.email} has submitted a new event: "${title}" (${slug}).`,
          "",
          "Review it under I Love Durban → Owner Submissions in WordPress.",
          "It will not appear on the site until it is approved there.",
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("[events] could not notify about the new event:", error);
  }
}

/* -------------------------------------------------------------------------
 * Mine
 * ---------------------------------------------------------------------- */

export async function myEvents(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const submissions = await env.DB.prepare(
    `SELECT id, slug, fields, image_url, tier, status, created_at, decided_at, decided_note
       FROM event_submissions WHERE member_id = ?1 ORDER BY created_at DESC`
  )
    .bind(member.id)
    .all();

  const orders = await env.DB.prepare(
    `SELECT id, slug, tier, amount_cents, status, created_at
       FROM event_orders WHERE member_id = ?1 ORDER BY created_at DESC`
  )
    .bind(member.id)
    .all();

  return json({
    events: (submissions.results ?? []).map((row) => ({
      ...row,
      fields: safeParseJson(String(row.fields)),
    })),
    orders: orders.results ?? [],
    prices: EVENT_TIER_PRICES_RANDS,
  });
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------
 * Delete (publisher's own)
 * ---------------------------------------------------------------------- */

export async function deleteEvent(request: Request, env: Env): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG.test(slug)) return badRequest("That is not a valid event.");

  const submission = await env.DB.prepare(
    `SELECT id, fields FROM event_submissions
      WHERE member_id = ?1 AND slug = ?2 AND status IN ('pending','approved')`
  )
    .bind(member.id, slug)
    .first<{ id: string; fields: string }>();

  if (!submission) {
    return json({ error: "Only events you added yourself can be removed here." }, { status: 403 });
  }

  // One-off payments: nothing recurring to cancel — just close open checkouts.
  await env.DB.prepare(
    "UPDATE event_orders SET status = 'failed', updated_at = ?1 WHERE slug = ?2 AND status = 'initiated'"
  )
    .bind(now(), slug)
    .run();

  await env.DB.prepare(
    `UPDATE event_submissions SET status = 'deleted', decided_at = ?1, decided_note = 'Removed by you.'
      WHERE id = ?2`
  )
    .bind(now(), submission.id)
    .run();

  await triggerDeploy(env, `publisher removed event ${slug}`);

  const title = eventTitleOf(submission.fields, slug);
  const dashboard = `${siteBase(env, request)}/my-events/`;
  await sendMemberEmail(env, member.email, {
    subject: `Event removed: ${title}`,
    heading: "Your event has been removed",
    paragraphs: [
      `As requested, "${title}" has been removed from I Love Durban. It comes off the public site within a few minutes.`,
      "You are always welcome back — you can add a new event any time.",
    ],
    cta: { label: "Open my events", href: dashboard },
    link: dashboard,
  });

  return json({ ok: true });
}

/* -------------------------------------------------------------------------
 * Checkout — one-off Featured / Premium placement
 * ---------------------------------------------------------------------- */

export async function eventCheckout(request: Request, env: Env, url: URL): Promise<Response> {
  const member = await currentMember(request, env);
  if (!member) return unauthorised();

  const body = await readJson<{ slug: unknown; tier: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const tier = body.tier === "featured" || body.tier === "premium" ? body.tier : null;

  if (!SLUG.test(slug)) return badRequest("That is not a valid event.");
  if (!tier) return badRequest("Choose Featured or Premium.");

  const submission = await env.DB.prepare(
    `SELECT id, fields, tier FROM event_submissions
      WHERE member_id = ?1 AND slug = ?2 AND status IN ('pending','approved')`
  )
    .bind(member.id, slug)
    .first<{ id: string; fields: string; tier: string }>();

  if (!submission) return badRequest("That event is not yours to upgrade.");
  if (submission.tier === "premium" || (submission.tier === "featured" && tier === "featured")) {
    return badRequest("That event already has this placement (or better).");
  }

  const priceRands = EVENT_TIER_PRICES_RANDS[tier as EventPaidTier];
  const title = eventTitleOf(submission.fields, slug);

  // A fresh checkout supersedes any abandoned one.
  await env.DB.prepare(
    "UPDATE event_orders SET status = 'failed', updated_at = ?1 WHERE slug = ?2 AND status = 'initiated'"
  )
    .bind(now(), slug)
    .run();

  const orderId = randomToken();
  await env.DB.prepare(
    `INSERT INTO event_orders (id, member_id, slug, tier, amount_cents, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'initiated', ?6, ?6)`
  )
    .bind(orderId, member.id, slug, tier, priceRands * 100, now())
    .run();

  const site = siteBase(env, request) || url.origin;
  const label = tier === "premium" ? "Premium" : "Featured";

  return json(
    buildCheckout(env, {
      paymentId: orderId,
      email: member.email,
      itemName: `I Love Durban — ${label} event`,
      itemDescription: `${label} placement for the event "${title}" (once-off)`,
      returnUrl: `${site}/my-events/?upgraded=1`,
      cancelUrl: `${site}/my-events/?checkout=cancelled`,
      notifyUrl: `${site}/api/billing/notify`,
      customSlug: slug,
      customMemberId: member.id,
      amountRands: priceRands,
      recurring: false,
    })
  );
}

/**
 * The event half of the ITN webhook. Called by billingNotify when the
 * m_payment_id is not a subscription. Returns false when it is not an event
 * order either. The caller has already verified the signature, the merchant
 * and the validation postback.
 */
export async function handleEventItn(
  env: Env,
  request: Request,
  itn: Itn,
  paymentId: string,
  status: string,
  grossCents: number
): Promise<boolean> {
  const order = await env.DB.prepare(
    "SELECT id, member_id, slug, tier, amount_cents, status FROM event_orders WHERE id = ?1"
  )
    .bind(paymentId)
    .first<{
      id: string;
      member_id: string;
      slug: string;
      tier: string;
      amount_cents: number;
      status: string;
    }>();

  if (!order) return false;

  // Same idempotency ledger as subscriptions: the PayFast payment id is the key.
  const pfPaymentId = itn.params.get("pf_payment_id") ?? `${paymentId}:${status}:${now()}`;
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO payments (pf_payment_id, subscription_id, status, amount_cents, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(pfPaymentId, order.id, status, grossCents, now())
    .run();

  if ((meta?.changes ?? 0) === 0) return true;

  if (status === "COMPLETE") {
    if (grossCents !== order.amount_cents) {
      console.error(
        `[events] amount mismatch for ${paymentId}: got ${grossCents}, expected ${order.amount_cents}`
      );
      return true;
    }

    await env.DB.prepare(
      "UPDATE event_orders SET status = 'paid', updated_at = ?1 WHERE id = ?2"
    )
      .bind(now(), order.id)
      .run();

    // Never downgrade: a Featured payment landing after a Premium one must not
    // pull the event back down.
    await env.DB.prepare(
      `UPDATE event_submissions SET tier = ?1
        WHERE slug = ?2 AND status NOT IN ('rejected','deleted')
          AND NOT (tier = 'premium' AND ?1 = 'featured')`
    )
      .bind(order.tier, order.slug)
      .run();

    await triggerDeploy(env, `event ${order.tier} placement paid for ${order.slug}`);

    const email = await memberEmailById(env, order.member_id);
    if (email) {
      const site = siteBase(env, request);
      const dashboard = `${site}/my-events/`;
      const submission = await env.DB.prepare(
        "SELECT fields FROM event_submissions WHERE slug = ?1 ORDER BY created_at DESC LIMIT 1"
      )
        .bind(order.slug)
        .first<{ fields: string }>();
      const title = submission ? eventTitleOf(submission.fields, order.slug) : order.slug;
      const label = order.tier === "premium" ? "Premium" : "Featured";
      const amount = `R${(grossCents / 100).toFixed(2)}`;

      await sendMemberEmail(env, email, {
        subject: `Your event is now ${label}: ${title}`,
        heading: `"${title}" is ${label}!`,
        paragraphs: [
          `Your once-off payment of ${amount} was received — no subscription, nothing recurs.`,
          order.tier === "premium"
            ? "Premium placement puts your event at the very top of the events page, above Featured and free events, with the Premium badge."
            : "Featured placement lifts your event above free listings on the events page, with the Featured badge.",
          "The placement appears on the public site within a few minutes and lasts until the event has run.",
        ],
        cta: { label: "Open my events", href: dashboard },
        link: dashboard,
      });
    }
  } else if (status === "CANCELLED" || status === "FAILED") {
    await env.DB.prepare(
      "UPDATE event_orders SET status = 'failed', updated_at = ?1 WHERE id = ?2 AND status = 'initiated'"
    )
      .bind(now(), order.id)
      .run();
  }

  return true;
}

/* -------------------------------------------------------------------------
 * Admin — the WordPress side
 * ---------------------------------------------------------------------- */

/** GET /api/admin/event-tiers — paid placement, applied at build time. */
export async function adminEventTiers(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const { results } = await env.DB.prepare(
    `SELECT slug, tier FROM event_submissions
      WHERE tier != 'free' AND status NOT IN ('rejected','deleted')`
  ).all<{ slug: string; tier: string }>();

  const featured: string[] = [];
  const premium: string[] = [];
  for (const row of results ?? []) {
    (row.tier === "premium" ? premium : featured).push(row.slug);
  }

  return json({ featured, premium });
}

/** GET /api/admin/removed-events — publisher-deleted events, skipped at build. */
export async function adminRemovedEvents(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT slug FROM event_submissions WHERE status = 'deleted'"
  ).all<{ slug: string }>();

  return json({ slugs: (results ?? []).map((r) => r.slug) });
}

/**
 * POST /api/admin/event-removed — WordPress deleted (or trashed) an event.
 * One-off payments mean there is nothing to cancel at PayFast; the submission
 * is closed and the publisher told.
 */
export async function adminEventRemoved(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Not authorised" }, { status: 401 });

  const body = await readJson<{ slug: unknown }>(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG.test(slug)) return badRequest("That is not a valid event slug.");

  const owner = await env.DB.prepare(
    `SELECT member_id, fields, tier FROM event_submissions
      WHERE slug = ?1 AND status NOT IN ('rejected','deleted')
      ORDER BY created_at DESC LIMIT 1`
  )
    .bind(slug)
    .first<{ member_id: string; fields: string; tier: string }>();

  await env.DB.prepare(
    `UPDATE event_submissions SET status = 'rejected', decided_at = ?1,
        decided_note = 'This event was removed from the site.'
      WHERE slug = ?2 AND status != 'rejected'`
  )
    .bind(now(), slug)
    .run();

  await env.DB.prepare(
    "UPDATE event_orders SET status = 'failed', updated_at = ?1 WHERE slug = ?2 AND status = 'initiated'"
  )
    .bind(now(), slug)
    .run();

  if (owner) {
    const ownerEmail = await memberEmailById(env, owner.member_id);
    if (ownerEmail) {
      const title = eventTitleOf(owner.fields, slug);
      const dashboard = `${siteBase(env, request)}/my-events/`;

      await sendMemberEmail(env, ownerEmail, {
        subject: `Event removed: ${title}`,
        heading: "Your event has been removed",
        paragraphs: [
          `"${title}" has been removed from I Love Durban by our team.`,
          ...(owner.tier !== "free"
            ? [
                "You had paid placement on this event — reply to this email or reach us through the contact page and a person will sort out what is owed.",
              ]
            : []),
          "If you think this was a mistake, contact us and we are happy to take a look.",
        ],
        cta: { label: "Open my events", href: dashboard },
        link: dashboard,
      });
    }
  }

  return json({ ok: true });
}

/** Pending events, joined into the /api/admin/submissions queue. */
export async function pendingEventSubmissions(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.slug, e.fields, e.image_url, e.tier, e.created_at,
            m.email AS member_email, m.name AS member_name
       FROM event_submissions e JOIN members m ON m.id = e.member_id
      WHERE e.status = 'pending' ORDER BY e.created_at ASC`
  ).all();

  return (results ?? []).map((row) => ({
    ...row,
    fields: safeParseJson(String(row.fields)),
  }));
}

/** The "event" branch of adminDecide. */
export async function decideEvent(
  request: Request,
  env: Env,
  id: string,
  decision: "approve" | "reject",
  note: string | null
): Promise<Response> {
  const submission = await env.DB.prepare(
    `UPDATE event_submissions SET status = ?1, decided_at = ?2, decided_note = ?3
      WHERE id = ?4 AND status = 'pending'
      RETURNING member_id, slug, fields, tier`
  )
    .bind(decision === "approve" ? "approved" : "rejected", now(), note, id)
    .first<{ member_id: string; slug: string; fields: string; tier: string }>();

  if (!submission) return json({ ok: false });

  if (decision === "reject") {
    await env.DB.prepare(
      "UPDATE event_orders SET status = 'failed', updated_at = ?1 WHERE slug = ?2 AND status = 'initiated'"
    )
      .bind(now(), submission.slug)
      .run();
  }

  const ownerEmail = await memberEmailById(env, submission.member_id);
  if (ownerEmail) {
    const site = siteBase(env, request);
    const title = eventTitleOf(submission.fields, submission.slug);
    const dashboard = `${site}/my-events/`;
    const eventUrl = `${site}/events/${submission.slug}/`;
    const paid = submission.tier !== "free";

    await sendMemberEmail(
      env,
      ownerEmail,
      decision === "approve"
        ? {
            subject: `Your event is live: ${title}`,
            heading: `"${title}" is live on I Love Durban!`,
            paragraphs: [
              "Your event has been approved and published. It can take a few minutes to appear while the site republishes.",
              ...(paid
                ? [
                    `Your ${submission.tier === "premium" ? "Premium" : "Featured"} placement is active — the event sits above free listings with its badge.`,
                  ]
                : [
                    "Want more eyes on it? Boost it to Featured or Premium from your events dashboard — a once-off payment, no subscription.",
                  ]),
              "Once the event date passes it quietly comes off the site.",
            ],
            cta: { label: "See my event", href: eventUrl },
            footnote: `Manage it any time at ${dashboard}`,
            link: eventUrl,
          }
        : {
            subject: `About your event: ${title}`,
            heading: "Your event was not approved",
            paragraphs: [
              `"${title}" did not make it onto I Love Durban this time.`,
              ...(note ? [`Note from the review team: ${note}`] : []),
              ...(submission.tier !== "free"
                ? [
                    "You had paid for placement — reply to this email or reach us through the contact page and a person will sort out what is owed.",
                  ]
                : []),
              "You are welcome to update the details and submit it again from your events dashboard.",
            ],
            cta: { label: "Open my events", href: dashboard },
            link: dashboard,
          }
    );
  }

  return json({ ok: true });
}
