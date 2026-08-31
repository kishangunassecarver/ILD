"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Crown,
  ImagePlus,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import {
  createEvent,
  deleteEvent,
  fetchMyEvents,
  startEventCheckout,
  uploadListingImage,
  type EventSubmission,
  type MyEvents,
} from "@/lib/member";
import { cn } from "@/lib/utils";

/**
 * The publisher's events dashboard.
 *
 * Add an event, pick its placement tier, watch its review status, boost or
 * remove it. Everything lands in the WordPress review queue first — nothing a
 * publisher submits reaches the site without a person approving it. Paid
 * tiers are once-off payments: an event ends, so nothing recurs.
 */
export function EventsDashboard() {
  const { member, loading } = useMember();
  const [data, setData] = useState<MyEvents | null>(null);
  const [fetched, setFetched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addTier, setAddTier] = useState<"free" | "featured" | "premium">("free");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("add")) {
      setAdding(true);
      const tier = params.get("tier");
      if (tier === "featured" || tier === "premium") setAddTier(tier);
    }

    if (params.get("upgraded")) {
      setBanner(
        "Thank you! Your payment is being confirmed by PayFast — the placement switches on automatically, usually within a minute. Refresh this page to see it."
      );
    } else if (params.get("checkout") === "cancelled") {
      setBanner("Checkout was cancelled — nothing has been charged.");
    }
  }, []);

  async function refresh() {
    setData(await fetchMyEvents());
    setFetched(true);
  }

  useEffect(() => {
    if (!member) {
      setData(null);
      setFetched(false);
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  if (loading || (member && !fetched)) {
    return (
      <p className="panel p-10 text-center text-sm text-muted" aria-busy>
        Loading…
      </p>
    );
  }

  if (!member) {
    return (
      <div className="panel p-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
          <CalendarDays className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-snow">Sign in to manage your events</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          It starts with a free account — sign in, add your event, and once we approve it your
          event is live on the city&apos;s calendar.
        </p>
        <Link href="/join" className="btn-primary mt-5">
          Join or sign in
        </Link>
      </div>
    );
  }

  const events = (data?.events ?? []).filter((e) => e.status !== "deleted");
  const prices = data?.prices ?? { featured: 999, premium: 1999 };

  return (
    <div className="space-y-8">
      {banner && (
        <p className="panel-raised flex items-start gap-2.5 p-4 text-sm leading-relaxed text-snow">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-aqua-600" aria-hidden />
          {banner}
        </p>
      )}

      {events.length > 0 && (
        <section aria-labelledby="your-events">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id="your-events" className="section-title">
              Your events
            </h2>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-primary ml-auto px-4 py-2 text-[0.8125rem]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add an Event
            </button>
          </div>

          <div className="space-y-3">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                prices={prices}
                onChanged={() => void refresh()}
              />
            ))}
          </div>
        </section>
      )}

      {adding && (
        <AddEventForm
          initialTier={addTier}
          prices={prices}
          onClose={() => setAdding(false)}
          onSubmitted={() => {
            setAdding(false);
            void refresh();
          }}
        />
      )}

      {!adding && events.length === 0 && (
        <div className="panel p-8 text-center sm:p-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
            <CalendarDays className="h-5 w-5 text-aqua-600" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-bold text-snow">Put your event on Durban&apos;s calendar</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Add it free with a photo and ticket link, or boost it to Featured (R{prices.featured})
            or Premium (R{prices.premium}) — a once-off payment for top placement until it has run.
            We review every event before it goes live.
          </p>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-5">
            <Plus className="h-4 w-4" aria-hidden />
            Add an Event
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * One event row
 * ---------------------------------------------------------------------- */

function eventEnded(event: EventSubmission): boolean {
  const date = event.fields.date;
  if (!date) return false;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return date < today;
}

function EventRow({
  event,
  prices,
  onChanged,
}: {
  event: EventSubmission;
  prices: { featured: number; premium: number };
  onChanged: () => void;
}) {
  const ended = eventEnded(event);
  const title = event.fields.title ?? event.slug;

  return (
    <article className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div
        className="h-16 w-full shrink-0 rounded-lg bg-cover bg-center sm:w-24"
        style={{
          backgroundImage: event.image_url ? `url(${event.image_url})` : undefined,
          backgroundColor: event.image_url ? undefined : "rgba(184,201,215,0.08)",
        }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold text-snow">{title}</span>
          <TierBadge tier={event.tier} />
          <StatusChip event={event} ended={ended} />
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {event.fields.dateLabel || event.fields.date} · {event.fields.venue}
        </p>
        {event.status === "rejected" && event.decided_note && (
          <p className="mt-1 text-xs text-brand-600">{event.decided_note}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!ended && event.status !== "rejected" && event.tier !== "premium" && (
          <BoostButtons event={event} prices={prices} />
        )}
        {event.status !== "rejected" && (
          <RemoveEventButton slug={event.slug} title={title} onChanged={onChanged} />
        )}
      </div>
    </article>
  );
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "premium") {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-gold/15 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-gold">
        <Crown className="h-3 w-3" aria-hidden />
        Premium
      </span>
    );
  }
  if (tier === "featured") {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-500/15 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-brand-600">
        <Star className="h-3 w-3" aria-hidden />
        Featured
      </span>
    );
  }
  return null;
}

function StatusChip({ event, ended }: { event: EventSubmission; ended: boolean }) {
  const label =
    event.status === "pending"
      ? "In review"
      : event.status === "rejected"
        ? "Not approved"
        : ended
          ? "Ended"
          : "Live";

  const tone =
    event.status === "pending"
      ? "bg-aqua-400/10 text-aqua-600"
      : event.status === "rejected"
        ? "bg-brand-500/15 text-brand-600"
        : ended
          ? "bg-snow/5 text-muted"
          : "bg-aqua-400/15 text-aqua-600";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
        tone
      )}
    >
      {event.status === "pending" && <Clock className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}

function BoostButtons({
  event,
  prices,
}: {
  event: EventSubmission;
  prices: { featured: number; premium: number };
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function boost(tier: "featured" | "premium") {
    setBusy(tier);
    setError("");
    const result = await startEventCheckout(event.slug, tier);
    if (!result.ok) {
      setError(result.error ?? "That did not go through.");
      setBusy(null);
    }
    // On success the browser is leaving for PayFast.
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-2">
        {event.tier === "free" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void boost("featured")}
            className="btn px-3 py-1.5 text-xs font-bold text-white"
            style={{ backgroundColor: "#F6514D" }}
          >
            {busy === "featured" ? "Taking you to PayFast…" : `Feature it — R${prices.featured}`}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void boost("premium")}
          className="btn bg-gold px-3 py-1.5 text-xs font-bold text-ink hover:bg-gold-600"
        >
          {busy === "premium" ? "Taking you to PayFast…" : `Go Premium — R${prices.premium}`}
        </button>
      </span>
      {error && (
        <span role="alert" className="text-[0.6875rem] font-medium text-brand-600">
          {error}
        </span>
      )}
    </span>
  );
}

function RemoveEventButton({
  slug,
  title,
  onChanged,
}: {
  slug: string;
  title: string;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    const result = await deleteEvent(slug);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "That did not go through.");
      return;
    }

    onChanged();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${title}`}
        className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-snow/5 hover:text-brand-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="btn px-3 py-1.5 text-xs font-bold text-white"
          style={{ backgroundColor: "#F6514D" }}
        >
          {busy ? "Removing…" : "Yes, remove it"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          Keep it
        </button>
      </span>
      {error && (
        <span role="alert" className="text-[0.6875rem] font-medium text-brand-600">
          {error}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Add an event
 * ---------------------------------------------------------------------- */

function AddEventForm({
  initialTier = "free",
  prices,
  onClose,
  onSubmitted,
}: {
  initialTier?: "free" | "featured" | "premium";
  prices: { featured: number; premium: number };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [tier, setTier] = useState<"free" | "featured" | "premium">(initialTier);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "redirecting" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLFormElement>(null);

  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Keep the photo under 5 MB.");
      return;
    }

    setUploading(true);
    setError("");
    const result = await uploadListingImage(file);
    setUploading(false);

    if (!result.ok || !result.url) {
      setError(result.error ?? "The upload did not go through.");
      return;
    }

    setImage(result.url);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    setState("sending");
    setError("");

    const created = await createEvent({
      image,
      fields: {
        title: text("title"),
        date: text("date"),
        dateLabel: text("dateLabel") || null,
        venue: text("venue"),
        area: text("area"),
        category: text("category"),
        blurb: text("blurb"),
        body: text("body") || null,
        price: text("price") || null,
        ticketUrl: text("ticketUrl") || null,
      },
    });

    if (!created.ok) {
      setError(created.error ?? "That did not go through. Please try again.");
      setState("error");
      return;
    }

    if (tier !== "free") {
      setState("redirecting");
      const slug = String(created.data?.slug ?? "");
      const checkout = await startEventCheckout(slug, tier);
      if (checkout.ok) return; // The browser is leaving for PayFast.
      setError(checkout.error ?? "The payment could not be started — the event was saved as free.");
      setState("error");
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
          <BadgeCheck className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-snow">Event submitted</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          We review every event before it goes live — usually within two working days. You can
          watch its status on this page, and boost it to Featured or Premium any time.
        </p>
        <button type="button" onClick={onSubmitted} className="btn-primary mt-5">
          Done
        </button>
      </div>
    );
  }

  if (state === "redirecting") {
    return (
      <div className="panel p-8 text-center" aria-busy>
        <h2 className="text-base font-bold text-snow">Taking you to PayFast…</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          Your event is saved. Complete the once-off R
          {tier === "premium" ? prices.premium : prices.featured} payment and you will land back
          here.
        </p>
      </div>
    );
  }

  const TIERS: { value: "free" | "featured" | "premium"; name: string; price: string; blurb: string }[] = [
    { value: "free", name: "Free", price: "R0", blurb: "On the calendar, in its category." },
    {
      value: "featured",
      name: "Featured",
      price: `R${prices.featured} once-off`,
      blurb: "Above free events, with the Featured badge.",
    },
    {
      value: "premium",
      name: "Premium",
      price: `R${prices.premium} once-off`,
      blurb: "The very top of the events page, with the Premium badge.",
    },
  ];

  return (
    <form ref={panel} onSubmit={onSubmit} className="panel scroll-mt-24 space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-snow">Add your event</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            A person reviews every event before it appears on the site. Once the event date passes
            it quietly comes off the calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-snow/5 hover:text-snow"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Placement, chosen up front. */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-snow">Placement</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTier(option.value)}
              aria-pressed={tier === option.value}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                tier === option.value
                  ? option.value === "premium"
                    ? "border-gold/60 bg-gold/5 ring-1 ring-gold/60"
                    : option.value === "featured"
                      ? "border-brand-500/60 bg-brand-500/5 ring-1 ring-brand-500/60"
                      : "border-aqua-400/60 bg-aqua-400/5 ring-1 ring-aqua-400/60"
                  : "border-line hover:border-aqua-400/40"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-snow">
                {option.value === "premium" && <Crown className="h-3.5 w-3.5 text-gold" aria-hidden />}
                {option.value === "featured" && (
                  <Star className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                )}
                {option.name}
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-aqua-600">{option.price}</span>
              <span className="mt-1 block text-[0.75rem] leading-snug text-muted">
                {option.blurb}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[0.6875rem] text-muted">
          Paid placement is a once-off payment — no subscription — and lasts until the event has run.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EventField label="Event name" id="ev-title" required wide>
          <input id="ev-title" name="title" required maxLength={120} className="field" />
        </EventField>
        <EventField label="Date" id="ev-date" required hint="The event's (last) day.">
          <input id="ev-date" name="date" type="date" required className="field" />
        </EventField>
        <EventField label="Date label" id="ev-datelabel" hint='Shown to visitors, e.g. "24 – 26 September".'>
          <input id="ev-datelabel" name="dateLabel" maxLength={60} className="field" />
        </EventField>
        <EventField label="Venue" id="ev-venue" required>
          <input id="ev-venue" name="venue" required maxLength={120} className="field" />
        </EventField>
        <EventField label="Area" id="ev-area" required>
          <input id="ev-area" name="area" required maxLength={80} placeholder="e.g. Umhlanga" className="field" />
        </EventField>
        <EventField label="Category" id="ev-category" required>
          <input
            id="ev-category"
            name="category"
            required
            maxLength={60}
            placeholder="Music, Markets, Sport…"
            className="field"
          />
        </EventField>
        <EventField label="Price" id="ev-price" hint='e.g. "From R350" or "Free entry".'>
          <input id="ev-price" name="price" maxLength={60} className="field" />
        </EventField>
        <EventField label="One-line summary" id="ev-blurb" required wide>
          <input id="ev-blurb" name="blurb" required maxLength={240} className="field" />
        </EventField>
        <EventField
          label="Full description"
          id="ev-body"
          wide
          hint="Blank line between paragraphs."
        >
          <textarea id="ev-body" name="body" rows={5} className="field resize-y" />
        </EventField>
        <EventField label="Ticket link" id="ev-ticket" wide>
          <input
            id="ev-ticket"
            name="ticketUrl"
            type="url"
            placeholder="https://…"
            maxLength={300}
            className="field"
          />
        </EventField>
      </div>

      {/* The photo. */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-snow">Photo</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onPickImage(e)}
          className="sr-only"
          id="ev-photo"
        />
        {image ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setImage(null)}
              className="text-xs font-semibold text-muted underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-ghost px-4 py-2 text-xs"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {uploading ? "Uploading…" : "Upload a photo (JPG/PNG/WebP, up to 5 MB)"}
          </button>
        )}
      </div>

      <div>
        <button type="submit" disabled={state === "sending"} className="btn-primary w-full sm:w-auto">
          {state === "sending"
            ? "Sending…"
            : tier === "free"
              ? "Submit event"
              : `Submit & pay R${tier === "premium" ? prices.premium : prices.featured} once-off`}
        </button>
        {state === "error" && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-brand-600">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function EventField({
  label,
  id,
  hint,
  wide,
  required,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  wide?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-snow">
        {label} {required && <span className="text-brand-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] text-muted">{hint}</p>}
    </div>
  );
}
