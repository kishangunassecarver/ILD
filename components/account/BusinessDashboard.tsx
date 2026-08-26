"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2, Clock, Pencil, Search, X } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import { LISTINGS } from "@/lib/cms";
import {
  claimListing,
  fetchMyBusinesses,
  submitListingEdit,
  type Claim,
  type MyBusinesses,
} from "@/lib/member";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The business owner's dashboard: claim your listing, then keep it up to date.
 *
 * Everything submitted here lands in a review queue — the page is explicit
 * about that, because "why isn't my change live yet?" is the support email this
 * paragraph exists to prevent.
 */
export function BusinessDashboard() {
  const { member, loading } = useMember();
  const [data, setData] = useState<MyBusinesses | null>(null);
  const [fetched, setFetched] = useState(false);
  const [editing, setEditing] = useState<Claim | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [prefillSlug, setPrefillSlug] = useState<string | null>(null);

  // A listing page can deep-link here with ?claim=<slug> to start a claim.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("claim");
    if (slug) {
      setPrefillSlug(slug);
      setClaiming(true);
    }
  }, []);

  async function refresh() {
    setData(await fetchMyBusinesses());
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
          <Building2 className="h-5 w-5 text-aqua-300" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-snow">Sign in to manage your listing</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Managing a business starts with a free account — sign in, claim your listing, and once we
          approve the claim you can edit it here.
        </p>
        <Link href="/join" className="btn-primary mt-5">
          Join or sign in
        </Link>
      </div>
    );
  }

  const claims = data?.claims ?? [];
  const edits = data?.edits ?? [];

  return (
    <div className="space-y-8">
      {claims.length > 0 && (
        <section aria-labelledby="your-listings">
          <h2 id="your-listings" className="section-title mb-4">
            Your listings
          </h2>
          <div className="space-y-3">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} onEdit={() => setEditing(claim)} />
            ))}
          </div>
        </section>
      )}

      {editing && (
        <ListingEditor
          claim={editing}
          onClose={() => setEditing(null)}
          onSubmitted={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}

      {claiming ? (
        <ClaimForm
          prefillSlug={prefillSlug}
          alreadyClaimed={new Set(claims.map((c) => c.slug))}
          onClose={() => setClaiming(false)}
          onSubmitted={() => {
            setClaiming(false);
            setPrefillSlug(null);
            void refresh();
          }}
        />
      ) : (
        <div className="panel p-6 sm:p-8">
          <h2 className="text-sm font-bold text-snow">
            {claims.length > 0 ? "Manage another business?" : "Is your business listed here?"}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Claim the listing and, once we have checked the claim, you can update its details, hours
            and description yourself. Not listed at all yet?{" "}
            <Link href="/list-your-business" className="font-semibold text-aqua-300 underline">
              Get listed first
            </Link>
            .
          </p>
          <button type="button" onClick={() => setClaiming(true)} className="btn-primary mt-4">
            Claim a listing
          </button>
        </div>
      )}

      {edits.length > 0 && (
        <section aria-labelledby="your-changes">
          <h2 id="your-changes" className="section-title mb-4">
            Changes you have submitted
          </h2>
          <ul className="panel divide-y divide-line">
            {edits.map((edit) => (
              <li key={edit.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5">
                <span className="text-sm font-semibold text-snow">{nameFor(edit.slug)}</span>
                <span className="text-xs text-muted">
                  {Object.keys(edit.fields).length}{" "}
                  {Object.keys(edit.fields).length === 1 ? "field" : "fields"} ·{" "}
                  {new Date(edit.created_at * 1000).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <StatusChip status={edit.status} className="ml-auto" />
                {edit.decided_note && (
                  <p className="w-full text-xs italic text-muted">“{edit.decided_note}”</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function nameFor(slug: string): string {
  return LISTINGS.find((l) => l.slug === slug)?.name ?? slug;
}

function StatusChip({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-300",
    approved: "bg-emerald-400/15 text-emerald-300",
    applied: "bg-emerald-400/15 text-emerald-300",
    rejected: "bg-red-50 text-red-700",
    superseded: "bg-paper text-muted",
  };
  const labels: Record<string, string> = {
    pending: "Awaiting review",
    approved: "Approved",
    applied: "Live",
    rejected: "Declined",
    superseded: "Replaced by a newer change",
  };

  return (
    <span
      className={cn(
        "rounded-pill px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider",
        styles[status] ?? "bg-paper text-muted",
        className
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ClaimRow({ claim, onEdit }: { claim: Claim; onEdit: () => void }) {
  const listing = LISTINGS.find((l) => l.slug === claim.slug);

  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-snow">
          {listing?.name ?? claim.business_name ?? claim.slug}
        </p>
        <p className="text-xs text-muted">{listing?.area ?? claim.hub}</p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <StatusChip status={claim.status} />

        {claim.status === "approved" && (
          <button type="button" onClick={onEdit} className="btn-primary px-3 py-2 text-xs">
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Edit listing
          </button>
        )}
      </div>

      {claim.status === "pending" && (
        <p className="flex w-full items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          We check every claim by hand — usually within two working days. You will be able to edit
          the listing as soon as it is approved.
        </p>
      )}

      {claim.status === "rejected" && claim.decided_note && (
        <p className="w-full text-xs italic text-muted">“{claim.decided_note}”</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Claiming
 * ---------------------------------------------------------------------- */

function ClaimForm({
  prefillSlug,
  alreadyClaimed,
  onClose,
  onSubmitted,
}: {
  prefillSlug: string | null;
  alreadyClaimed: Set<string>;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Listing | null>(
    () => LISTINGS.find((l) => l.slug === prefillSlug) ?? null
  );
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    return LISTINGS.filter(
      (l) => !alreadyClaimed.has(l.slug) && l.name.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, alreadyClaimed]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;

    const form = new FormData(event.currentTarget);
    setState("sending");

    const result = await claimListing({
      slug: chosen.slug,
      hub: chosen.hub,
      businessName: chosen.name,
      contactName: String(form.get("contactName") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      role: String(form.get("role") ?? ""),
      note: String(form.get("note") ?? ""),
    });

    if (!result.ok) {
      setError(result.error ?? "That did not go through. Please try again.");
      setState("error");
      return;
    }

    onSubmitted();
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-snow">Claim your listing</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tell us which listing is yours and how to reach you. A person checks every claim before
            edit access is switched on.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-snow"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {chosen ? (
        <div className="flex items-center gap-3 rounded-lg bg-paper p-4">
          <BadgeCheck className="h-5 w-5 shrink-0 text-aqua-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-snow">{chosen.name}</p>
            <p className="text-xs text-muted">
              {chosen.area} · {chosen.category}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="ml-auto text-xs font-semibold text-aqua-300 underline"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor="claim-search" className="mb-1.5 block text-xs font-semibold text-snow">
            Find your business <span className="text-aqua-300">*</span>
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              id="claim-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing the business name…"
              className="field pl-9"
            />
          </div>

          {matches.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-lg border border-line">
              {matches.map((listing) => (
                <li key={`${listing.hub}-${listing.slug}`}>
                  <button
                    type="button"
                    onClick={() => setChosen(listing)}
                    className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left transition hover:bg-white/5"
                  >
                    <span className="text-sm font-semibold text-snow">{listing.name}</span>
                    <span className="text-xs text-muted">
                      {listing.area} · {listing.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.trim().length >= 2 && matches.length === 0 && (
            <p className="mt-2 text-xs text-muted">
              No listing by that name.{" "}
              <Link href="/list-your-business" className="font-semibold text-aqua-300 underline">
                Get listed
              </Link>{" "}
              and it will appear here once it is live.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="claim-role" className="mb-1.5 block text-xs font-semibold text-snow">
            Your role <span className="text-aqua-300">*</span>
          </label>
          <input
            id="claim-role"
            name="role"
            required
            placeholder="Owner, manager, marketing…"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="claim-phone" className="mb-1.5 block text-xs font-semibold text-snow">
            Phone <span className="text-aqua-300">*</span>
          </label>
          <input
            id="claim-phone"
            name="contactPhone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="We may call to verify the claim"
            className="field"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="claim-name" className="mb-1.5 block text-xs font-semibold text-snow">
            Your full name <span className="text-aqua-300">*</span>
          </label>
          <input
            id="claim-name"
            name="contactName"
            required
            autoComplete="name"
            className="field"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="claim-note" className="mb-1.5 block text-xs font-semibold text-snow">
            Anything that helps us verify it{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="claim-note"
            name="note"
            rows={3}
            placeholder="An email address on the business domain, a company registration, a link that names you…"
            className="field resize-y"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={!chosen || state === "sending"}
          className="btn-primary w-full sm:w-auto"
        >
          {state === "sending" ? "Sending…" : "Submit claim"}
        </button>
        {state === "error" && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-aqua-300">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
 * Editing
 * ---------------------------------------------------------------------- */

/**
 * The editor works on a flat map of strings so every field can be one
 * controlled input; list fields are one-entry-per-line and split on submit.
 */
function toDraft(listing: Listing | undefined): Record<string, string> {
  return {
    name: listing?.name ?? "",
    blurb: listing?.blurb ?? "",
    body: (listing?.body ?? []).join("\n\n"),
    category: listing?.category ?? "",
    area: listing?.area ?? "",
    price: listing?.price ?? "",
    cta: listing?.cta ?? "",
    address: listing?.address ?? "",
    phone: listing?.phone ?? "",
    website: listing?.website ?? "",
    hours: (listing?.hours ?? []).join("\n"),
    amenities: (listing?.amenities ?? []).join("\n"),
    tags: (listing?.tags ?? []).join(", "),
  };
}

/** Which draft keys are multi-entry, and how they split back into arrays. */
const LIST_FIELDS: Record<string, RegExp> = {
  body: /\n\s*\n/,
  hours: /\n/,
  amenities: /\n/,
  tags: /,/,
};

function draftToFields(
  draft: Record<string, string>,
  original: Record<string, string>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(draft)) {
    // Only what actually changed. The reviewer sees a diff, not a full copy.
    if (value === original[key]) continue;

    if (LIST_FIELDS[key]) {
      fields[key] = value
        .split(LIST_FIELDS[key])
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else {
      fields[key] = value.trim() || null;
    }
  }

  return fields;
}

function ListingEditor({
  claim,
  onClose,
  onSubmitted,
}: {
  claim: Claim;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const listing = LISTINGS.find((l) => l.slug === claim.slug);
  const [original] = useState(() => toDraft(listing));
  const [draft, setDraft] = useState(original);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const changedCount = Object.keys(draftToFields(draft, original)).length;

  function set(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: event.target.value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const fields = draftToFields(draft, original);
    if (Object.keys(fields).length === 0) {
      setError("Nothing has changed yet.");
      setState("error");
      return;
    }

    setState("sending");
    const result = await submitListingEdit(claim.slug, fields);

    if (!result.ok) {
      setError(result.error ?? "That did not go through. Please try again.");
      setState("error");
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
          <BadgeCheck className="h-5 w-5 text-aqua-300" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-snow">Changes submitted</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          We review every change before it goes live — usually within two working days. You can see
          its status on this page.
        </p>
        <button type="button" onClick={onSubmitted} className="btn-primary mt-5">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-snow">Edit {listing?.name ?? claim.slug}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Change what you need and submit. Changes are reviewed before they appear on the site.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-snow"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" id="edit-name">
          <input id="edit-name" value={draft.name} onChange={set("name")} className="field" />
        </Field>
        <Field label="Category" id="edit-category">
          <input
            id="edit-category"
            value={draft.category}
            onChange={set("category")}
            className="field"
          />
        </Field>

        <Field
          label="One-line summary"
          id="edit-blurb"
          wide
          hint="Shown on cards across the site. Keep it under 200 characters."
        >
          <input id="edit-blurb" value={draft.blurb} onChange={set("blurb")} className="field" />
        </Field>

        <Field label="Description" id="edit-body" wide hint="Blank line between paragraphs.">
          <textarea
            id="edit-body"
            value={draft.body}
            onChange={set("body")}
            rows={6}
            className="field resize-y"
          />
        </Field>

        <Field label="Area" id="edit-area">
          <input id="edit-area" value={draft.area} onChange={set("area")} className="field" />
        </Field>
        <Field label="Price band" id="edit-price" hint='e.g. "$$" or "R850+"'>
          <input id="edit-price" value={draft.price} onChange={set("price")} className="field" />
        </Field>

        <Field label="Address" id="edit-address" wide>
          <input
            id="edit-address"
            value={draft.address}
            onChange={set("address")}
            autoComplete="street-address"
            className="field"
          />
        </Field>

        <Field label="Phone" id="edit-phone">
          <input
            id="edit-phone"
            type="tel"
            value={draft.phone}
            onChange={set("phone")}
            className="field"
          />
        </Field>
        <Field label="Website" id="edit-website">
          <input
            id="edit-website"
            type="url"
            value={draft.website}
            onChange={set("website")}
            placeholder="https://…"
            className="field"
          />
        </Field>

        <Field label="Opening hours" id="edit-hours" hint="One line per entry.">
          <textarea
            id="edit-hours"
            value={draft.hours}
            onChange={set("hours")}
            rows={4}
            placeholder={"Mon – Fri · 09:00 – 17:00\nSat · 09:00 – 13:00"}
            className="field resize-y"
          />
        </Field>
        <Field label="Amenities" id="edit-amenities" hint="One per line.">
          <textarea
            id="edit-amenities"
            value={draft.amenities}
            onChange={set("amenities")}
            rows={4}
            placeholder={"Free Wi-Fi\nWheelchair accessible"}
            className="field resize-y"
          />
        </Field>

        <Field label="Tags" id="edit-tags" wide hint="Comma-separated.">
          <input id="edit-tags" value={draft.tags} onChange={set("tags")} className="field" />
        </Field>

        <Field label="Button label" id="edit-cta" hint='The card action, e.g. "Book a Table".'>
          <input id="edit-cta" value={draft.cta} onChange={set("cta")} className="field" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="btn-primary">
          {state === "sending"
            ? "Sending…"
            : changedCount > 0
              ? `Submit ${changedCount} ${changedCount === 1 ? "change" : "changes"} for review`
              : "Submit for review"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        {state === "error" && (
          <p role="alert" className="text-xs font-medium text-aqua-300">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  hint,
  wide,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-snow">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] text-muted">{hint}</p>}
    </div>
  );
}
