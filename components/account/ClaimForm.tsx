"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Search, X } from "lucide-react";
import { LISTINGS } from "@/lib/cms";
import { claimListing } from "@/lib/member";
import type { Listing } from "@/lib/types";

/**
 * The claim form, shared by the /claim page and the dashboard.
 *
 * Pick the listing, say who you are, submit — a person reviews every claim in
 * WordPress before edit access is switched on. Owner-managed listings (which
 * includes every listing with an active Premium subscription) are not on
 * offer; the Worker enforces the same rule authoritatively.
 */
export function ClaimForm({
  prefillSlug,
  alreadyClaimed,
  onClose,
  onSubmitted,
}: {
  prefillSlug: string | null;
  alreadyClaimed: Set<string>;
  onClose?: () => void;
  onSubmitted: () => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Listing | null>(
    () => LISTINGS.find((l) => l.slug === prefillSlug) ?? null
  );
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const panel = useRef<HTMLFormElement>(null);

  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    return LISTINGS.filter(
      // Owner-managed listings already have their owner; they are not on offer.
      (l) => !l.ownerManaged && !alreadyClaimed.has(l.slug) && l.name.toLowerCase().includes(q)
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
    <form ref={panel} onSubmit={onSubmit} className="panel scroll-mt-24 space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-snow">Claim your listing</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tell us which listing is yours and how to reach you. A person checks every claim before
            edit access is switched on.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-snow"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
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
            Find your business <span className="text-brand-400">*</span>
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
              No listing by that name — close this and use <strong>Add a Listing</strong> instead.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ClaimField label="Your role" id="claim-role" required>
          <input
            id="claim-role"
            name="role"
            required
            placeholder="Owner, manager, marketing…"
            className="field"
          />
        </ClaimField>
        <ClaimField label="Phone" id="claim-phone" required>
          <input
            id="claim-phone"
            name="contactPhone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="We may call to verify the claim"
            className="field"
          />
        </ClaimField>
        <ClaimField label="Your full name" id="claim-name" required wide>
          <input id="claim-name" name="contactName" required autoComplete="name" className="field" />
        </ClaimField>
        <ClaimField
          label="Anything that helps us verify it"
          id="claim-note"
          wide
          hint="An email address on the business domain, a company registration, a link that names you…"
        >
          <textarea id="claim-note" name="note" rows={3} className="field resize-y" />
        </ClaimField>
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
          <p role="alert" className="mt-2.5 text-xs font-medium text-brand-400">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function ClaimField({
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
        {label} {required && <span className="text-brand-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] text-muted">{hint}</p>}
    </div>
  );
}
