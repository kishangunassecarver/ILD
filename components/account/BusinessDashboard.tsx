"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Clock,
  Crown,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import { LISTINGS } from "@/lib/cms";
import {
  cancelPremium,
  claimListing,
  createListing,
  fetchMyBusinesses,
  startPremiumCheckout,
  submitListingEdit,
  uploadListingImage,
  type Claim,
  type ListingSubmission,
  type MyBusinesses,
  type Subscription,
} from "@/lib/member";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

const HUB_OPTIONS = [
  { value: "eat-drink", label: "Eat & Drink" },
  { value: "stay", label: "Stay" },
  { value: "things-to-do", label: "Things to Do" },
  { value: "shop", label: "Shop" },
  { value: "services", label: "Services" },
];

/**
 * The business owner's dashboard.
 *
 * Add a listing, watch its review status, edit it once it is live, and manage
 * the Premium subscription. Everything submitted here lands in a review queue
 * in WordPress — nothing an owner types or uploads reaches the site without a
 * person approving it.
 */
export function BusinessDashboard() {
  const { member, loading } = useMember();
  const [data, setData] = useState<MyBusinesses | null>(null);
  const [fetched, setFetched] = useState(false);
  const [editing, setEditing] = useState<Claim | null>(null);
  const [adding, setAdding] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [prefillSlug, setPrefillSlug] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // A listing page can deep-link here with ?claim=<slug> to start a claim,
    // and the pricing page with ?add=1 to open the add-a-listing form.
    const slug = params.get("claim");
    if (slug) {
      setPrefillSlug(slug);
      setClaiming(true);
    }
    if (params.get("add")) {
      setAdding(true);
    }

    // PayFast sends people back here after checkout.
    if (params.get("upgraded")) {
      setBanner(
        "Thank you! Your payment is being confirmed by PayFast — Premium switches on automatically, usually within a minute. Refresh this page to see it."
      );
    } else if (params.get("checkout") === "cancelled") {
      setBanner("Checkout was cancelled — nothing has been charged.");
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
        <h2 className="mt-4 text-base font-bold text-snow">Sign in to manage your listings</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          It starts with a free account — sign in, add your business, and once we approve it your
          listing is live on I Love Durban.
        </p>
        <Link href="/join" className="btn-primary mt-5">
          Join or sign in
        </Link>
      </div>
    );
  }

  const claims = data?.claims ?? [];
  const submissions = data?.submissions ?? [];
  const edits = data?.edits ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const price = data?.premiumPrice ?? 199;

  // A submission and its post-approval claim describe the same listing; the
  // submission row is the richer one, so claims it covers are not repeated.
  const submissionSlugs = new Set(submissions.map((s) => s.slug));
  const standaloneClaims = claims.filter((c) => !submissionSlugs.has(c.slug));

  const claimFor = (slug: string) =>
    claims.find((c) => c.slug === slug && c.status === "approved") ?? null;

  // An active subscription always wins; a newer abandoned checkout must not
  // hide it, and failed attempts are never worth showing.
  const subscriptionFor = (slug: string) => {
    const mine = subscriptions.filter((s) => s.slug === slug);
    return (
      mine.find((s) => s.status === "active") ??
      mine.find((s) => s.status === "initiated") ??
      null
    );
  };

  const hasAnything = submissions.length > 0 || standaloneClaims.length > 0;

  return (
    <div className="space-y-8">
      {banner && (
        <p className="panel-raised flex items-start gap-2.5 p-4 text-sm leading-relaxed text-snow">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-aqua-300" aria-hidden />
          {banner}
        </p>
      )}

      {hasAnything && (
        <section aria-labelledby="your-listings">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id="your-listings" className="section-title">
              Your listings
            </h2>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-primary ml-auto px-4 py-2 text-[0.8125rem]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add a Listing
            </button>
          </div>

          <div className="space-y-3">
            {submissions.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                subscription={subscriptionFor(submission.slug)}
                price={price}
                onEdit={() => {
                  const claim = claimFor(submission.slug);
                  if (claim) setEditing(claim);
                }}
                canEdit={Boolean(claimFor(submission.slug))}
                onChanged={() => void refresh()}
              />
            ))}
            {standaloneClaims.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                subscription={subscriptionFor(claim.slug)}
                price={price}
                onEdit={() => setEditing(claim)}
                onChanged={() => void refresh()}
              />
            ))}
          </div>
        </section>
      )}

      {editing && (
        <ListingEditor
          claim={editing}
          submission={submissions.find((s) => s.slug === editing.slug) ?? null}
          premium={subscriptionFor(editing.slug)?.status === "active"}
          onClose={() => setEditing(null)}
          onSubmitted={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}

      {adding && (
        <AddListingForm
          onClose={() => setAdding(false)}
          onSubmitted={() => {
            setAdding(false);
            void refresh();
          }}
        />
      )}

      {!adding && !hasAnything && (
        <div className="panel p-8 text-center sm:p-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
            <Building2 className="h-5 w-5 text-aqua-300" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-bold text-snow">Put your business on I Love Durban</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Add your listing with a photo, a description and your contact details — free, and it
            never expires. We review every listing before it goes live.
          </p>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-5">
            <Plus className="h-4 w-4" aria-hidden />
            Add a Listing
          </button>
        </div>
      )}

      {!adding && !claiming && (
        <p className="text-center text-[0.8125rem] text-muted">
          Is your business already on the site?{" "}
          <button
            type="button"
            onClick={() => setClaiming(true)}
            className="font-semibold text-aqua-300 underline"
          >
            Claim the existing listing
          </button>{" "}
          instead of adding a duplicate.
        </p>
      )}

      {claiming && (
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
      )}

      {(subscriptions.some((s) => s.status !== "failed") || (data?.invoices.length ?? 0) > 0) && (
        <section aria-labelledby="your-billing">
          <h2 id="your-billing" className="section-title mb-4">
            Subscriptions & invoices
          </h2>

          <div className="panel divide-y divide-line">
            {subscriptions
              .filter((s) => s.status !== "failed")
              .map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5"
                >
                  <Crown className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <span className="text-sm font-semibold text-snow">
                    Premium — {submissions.find((s) => s.slug === sub.slug)?.fields.name
                      ? String(submissions.find((s) => s.slug === sub.slug)?.fields.name)
                      : nameFor(sub.slug)}
                  </span>
                  <span className="text-xs text-muted">
                    R{(sub.amount_cents / 100).toFixed(0)}/month · started{" "}
                    {new Date(sub.created_at * 1000).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <StatusChip status={sub.status} className="ml-auto" />
                </div>
              ))}

            {(data?.invoices ?? []).map((invoice) => (
              <div
                key={invoice.pf_payment_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3"
              >
                <span className="text-[0.8125rem] text-mist">
                  {new Date(invoice.created_at * 1000).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-[0.8125rem] text-muted">{invoice.slug}</span>
                <span className="text-[0.8125rem] font-semibold text-snow">
                  R{(invoice.amount_cents / 100).toFixed(2)}
                </span>
                <a
                  href={`/api/billing/invoice?id=${encodeURIComponent(invoice.pf_payment_id)}`}
                  target="_blank"
                  rel="noopener"
                  className="ml-auto text-xs font-semibold text-aqua-300 underline transition hover:text-aqua-200"
                >
                  View invoice
                </a>
              </div>
            ))}
          </div>
        </section>
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
    initiated: "bg-amber-400/15 text-amber-300",
    approved: "bg-emerald-400/15 text-emerald-300",
    applied: "bg-emerald-400/15 text-emerald-300",
    active: "bg-emerald-400/15 text-emerald-300",
    rejected: "bg-brand-500/15 text-brand-400",
    cancelled: "bg-paper text-muted",
    superseded: "bg-paper text-muted",
  };
  const labels: Record<string, string> = {
    pending: "Awaiting review",
    initiated: "Payment pending",
    approved: "Live",
    applied: "Live",
    active: "Active",
    rejected: "Declined",
    cancelled: "Cancelled",
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

/* -------------------------------------------------------------------------
 * Premium
 * ---------------------------------------------------------------------- */

function PremiumControls({
  slug,
  live,
  subscription,
  price,
  onChanged,
}: {
  slug: string;
  /** Premium is offered once the listing is live. */
  live: boolean;
  subscription: Subscription | null;
  price: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (subscription?.status === "active") {
    return (
      <div className="flex w-full flex-wrap items-center gap-2.5 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-gold/15 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-gold">
          <Crown className="h-3 w-3" aria-hidden />
          Premium active
        </span>
        <span className="text-xs text-muted">R{price}/month via PayFast</span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            const result = await cancelPremium(slug);
            if (!result.ok) setError(result.error ?? "Could not cancel. Try again.");
            setBusy(false);
            onChanged();
          }}
          className="ml-auto text-xs font-semibold text-muted underline transition hover:text-snow"
        >
          {busy ? "Cancelling…" : "Cancel subscription"}
        </button>
        {error && <p className="w-full text-xs text-brand-400">{error}</p>}
      </div>
    );
  }

  if (subscription?.status === "initiated") {
    return (
      <p className="flex w-full items-start gap-1.5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Waiting for PayFast to confirm your Premium payment. This is automatic — refresh in a
        minute.
      </p>
    );
  }

  if (!live) return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-2.5 border-t border-line pt-3">
      <p className="text-xs leading-relaxed text-muted">
        <span className="font-semibold text-snow">Go Premium — R{price}/month.</span> A photo
        gallery (up to 10 photos), priority placement and more, billed monthly via PayFast. Cancel
        anytime.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const result = await startPremiumCheckout(slug);
          // On success the browser is leaving for PayFast; nothing more to do.
          if (!result.ok) {
            setError(result.error ?? "Could not start the checkout. Try again.");
            setBusy(false);
          }
        }}
        className="btn ml-auto shrink-0 bg-gold px-4 py-2 text-xs font-bold text-ink hover:bg-gold-600"
      >
        <Crown className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Opening PayFast…" : "Upgrade to Premium"}
      </button>
      {error && <p className="w-full text-xs text-brand-400">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Rows
 * ---------------------------------------------------------------------- */

function SubmissionRow({
  submission,
  subscription,
  price,
  canEdit,
  onEdit,
  onChanged,
}: {
  submission: ListingSubmission;
  subscription: Subscription | null;
  price: number;
  canEdit: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const name = String(submission.fields.name ?? submission.slug);
  const area = String(submission.fields.area ?? "");

  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
      {submission.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export
        <img
          src={submission.image_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/5 text-muted">
          <Building2 className="h-5 w-5" aria-hidden />
        </span>
      )}

      <div className="min-w-0">
        <p className="text-sm font-bold text-snow">{name}</p>
        <p className="text-xs text-muted">
          {area && `${area} · `}
          {HUB_OPTIONS.find((h) => h.value === submission.hub)?.label ?? submission.hub}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {submission.plan === "premium" && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-gold/15 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-gold">
            <Crown className="h-3 w-3" aria-hidden />
            Premium
          </span>
        )}
        <StatusChip status={submission.status} />

        {submission.status === "approved" && canEdit && (
          <button type="button" onClick={onEdit} className="btn-primary px-3 py-2 text-xs">
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        )}
      </div>

      {submission.status === "pending" && (
        <p className="flex w-full items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          We review every new listing by hand — usually within two working days. It appears on the
          site the moment it is approved, and free listings never expire.
        </p>
      )}

      {submission.status === "rejected" && submission.decided_note && (
        <p className="w-full text-xs italic text-muted">“{submission.decided_note}”</p>
      )}

      <PremiumControls
        slug={submission.slug}
        live={submission.status === "approved"}
        subscription={subscription}
        price={price}
        onChanged={onChanged}
      />
    </div>
  );
}

function ClaimRow({
  claim,
  subscription,
  price,
  onEdit,
  onChanged,
}: {
  claim: Claim;
  subscription: Subscription | null;
  price: number;
  onEdit: () => void;
  onChanged: () => void;
}) {
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
        <StatusChip status={claim.status === "approved" ? "applied" : claim.status} />

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

      <PremiumControls
        slug={claim.slug}
        live={claim.status === "approved"}
        subscription={subscription}
        price={price}
        onChanged={onChanged}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Adding a listing
 * ---------------------------------------------------------------------- */

function AddListingForm({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

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
    const lines = (key: string) =>
      text(key)
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const paragraphs = (key: string) =>
      text(key)
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    setState("sending");
    setError("");

    const result = await createListing({
      hub: text("hub"),
      image,
      fields: {
        name: text("name"),
        category: text("category"),
        area: text("area"),
        blurb: text("blurb"),
        body: paragraphs("body"),
        address: text("address") || null,
        phone: text("phone") || null,
        website: text("website") || null,
        hours: lines("hours"),
      },
    });

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
        <h2 className="mt-3 text-base font-bold text-snow">Listing submitted</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          We review every new listing before it goes live — usually within two working days. You
          can watch its status on this page, and we will not charge you anything: free listings
          stay free, forever.
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
          <h2 className="text-base font-bold text-snow">Add your listing</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Free, with one photo, and it never expires. A person reviews every listing before it
            appears on the site.
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

      {/* The photo — one on the free plan. */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-snow">
          Featured photo <span className="font-normal text-muted">(1 photo on the free plan)</span>
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPickImage}
          className="sr-only"
          id="add-image"
        />

        {image ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
            <img src={image} alt="Your listing photo" className="h-24 w-36 rounded-xl object-cover" />
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="block text-xs font-semibold text-aqua-300 underline"
              >
                Replace photo
              </button>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="block text-xs font-semibold text-muted underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex h-24 w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-snow/25 text-sm font-semibold text-mist transition hover:border-aqua-400/70 hover:text-aqua-200"
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            {uploading ? "Uploading…" : "Upload a photo (JPEG, PNG or WebP, up to 5 MB)"}
          </button>
        )}
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">
          Landscape photos work best. Only upload a photo you own or have permission to use.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" id="add-name" required>
          <input id="add-name" name="name" required maxLength={120} className="field" />
        </Field>

        <Field label="Section" id="add-hub" required>
          <select id="add-hub" name="hub" required defaultValue="" className="field">
            <option value="" disabled>
              Where does it belong?
            </option>
            {HUB_OPTIONS.map((hub) => (
              <option key={hub.value} value={hub.value}>
                {hub.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category" id="add-category" required hint='e.g. "Restaurants", "Security"'>
          <input id="add-category" name="category" required maxLength={60} className="field" />
        </Field>

        <Field label="Area" id="add-area" required hint='Suburb or town, e.g. "Umhlanga"'>
          <input id="add-area" name="area" required maxLength={60} className="field" />
        </Field>

        <Field
          label="One-line summary"
          id="add-blurb"
          required
          wide
          hint="Shown on your card across the site. Under 200 characters."
        >
          <input id="add-blurb" name="blurb" required maxLength={200} className="field" />
        </Field>

        <Field label="Description" id="add-body" wide hint="Blank line between paragraphs.">
          <textarea id="add-body" name="body" rows={5} className="field resize-y" />
        </Field>

        <Field label="Address" id="add-address" wide>
          <input
            id="add-address"
            name="address"
            maxLength={200}
            autoComplete="street-address"
            className="field"
          />
        </Field>

        <Field label="Phone" id="add-phone">
          <input id="add-phone" name="phone" type="tel" maxLength={40} className="field" />
        </Field>

        <Field label="Website" id="add-website">
          <input
            id="add-website"
            name="website"
            type="url"
            placeholder="https://…"
            maxLength={300}
            className="field"
          />
        </Field>

        <Field label="Opening hours" id="add-hours" wide hint="One line per entry.">
          <textarea
            id="add-hours"
            name="hours"
            rows={3}
            placeholder={"Mon – Fri · 09:00 – 17:00\nSat · 09:00 – 13:00"}
            className="field resize-y"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending" || uploading} className="btn-primary">
          {state === "sending" ? "Submitting…" : "Submit for review"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        {error && (
          <p role="alert" className="text-xs font-medium text-brand-400">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
 * Claiming (secondary path, for listings already on the site)
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
        <Field label="Your role" id="claim-role" required>
          <input
            id="claim-role"
            name="role"
            required
            placeholder="Owner, manager, marketing…"
            className="field"
          />
        </Field>
        <Field label="Phone" id="claim-phone" required>
          <input
            id="claim-phone"
            name="contactPhone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="We may call to verify the claim"
            className="field"
          />
        </Field>
        <Field label="Your full name" id="claim-name" required wide>
          <input id="claim-name" name="contactName" required autoComplete="name" className="field" />
        </Field>
        <Field
          label="Anything that helps us verify it"
          id="claim-note"
          wide
          hint="An email address on the business domain, a company registration, a link that names you…"
        >
          <textarea id="claim-note" name="note" rows={3} className="field resize-y" />
        </Field>
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

/* -------------------------------------------------------------------------
 * Editing
 * ---------------------------------------------------------------------- */

/**
 * The editor works on a flat map of strings so every field can be one
 * controlled input; list fields are one-entry-per-line and split on submit.
 *
 * Values come from the published listing when it is in the site bundle, and
 * otherwise from the owner's own submission — a freshly approved listing is
 * editable before the next site rebuild ships it.
 */
function toDraft(
  listing: Listing | undefined,
  submission: ListingSubmission | null
): Record<string, string> {
  const f = (submission?.fields ?? {}) as Record<string, unknown>;
  const fromSubmission = {
    name: String(f.name ?? ""),
    blurb: String(f.blurb ?? ""),
    body: Array.isArray(f.body) ? (f.body as string[]).join("\n\n") : "",
    category: String(f.category ?? ""),
    area: String(f.area ?? ""),
    price: String(f.price ?? ""),
    cta: String(f.cta ?? ""),
    address: String(f.address ?? ""),
    phone: String(f.phone ?? ""),
    website: String(f.website ?? ""),
    hours: Array.isArray(f.hours) ? (f.hours as string[]).join("\n") : "",
    amenities: Array.isArray(f.amenities) ? (f.amenities as string[]).join("\n") : "",
    tags: Array.isArray(f.tags) ? (f.tags as string[]).join(", ") : "",
  };

  if (!listing) return fromSubmission;

  return {
    name: listing.name ?? fromSubmission.name,
    blurb: listing.blurb ?? fromSubmission.blurb,
    body: (listing.body ?? []).join("\n\n") || fromSubmission.body,
    category: listing.category ?? fromSubmission.category,
    area: listing.area ?? fromSubmission.area,
    price: listing.price ?? fromSubmission.price,
    cta: listing.cta ?? fromSubmission.cta,
    address: listing.address ?? fromSubmission.address,
    phone: listing.phone ?? fromSubmission.phone,
    website: listing.website ?? fromSubmission.website,
    hours: (listing.hours ?? []).join("\n") || fromSubmission.hours,
    amenities: (listing.amenities ?? []).join("\n") || fromSubmission.amenities,
    tags: (listing.tags ?? []).join(", ") || fromSubmission.tags,
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
  submission,
  premium,
  onClose,
  onSubmitted,
}: {
  claim: Claim;
  submission: ListingSubmission | null;
  premium: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const listing = LISTINGS.find((l) => l.slug === claim.slug);
  const [original] = useState(() => toDraft(listing, submission));
  const [draft, setDraft] = useState(original);
  const [originalGallery] = useState<string[]>(() => listing?.gallery ?? []);
  const [gallery, setGallery] = useState<string[]>(originalGallery);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const galleryInput = useRef<HTMLInputElement>(null);

  const galleryChanged = gallery.join("\n") !== originalGallery.join("\n");
  const changedCount = Object.keys(draftToFields(draft, original)).length + (galleryChanged ? 1 : 0);

  function set(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: event.target.value }));
  }

  async function onAddGalleryPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (gallery.length >= 10) {
      setError("The gallery holds up to 10 photos.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Keep each photo under 5 MB.");
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

    setGallery((g) => [...g, result.url as string]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const fields = draftToFields(draft, original);
    if (galleryChanged) fields.gallery = gallery;

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
          <h2 className="text-base font-bold text-snow">
            Edit {listing?.name ?? original.name ?? claim.slug}
          </h2>
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

      {/* The Premium gallery. */}
      <div className="border-t border-line pt-5">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-snow">
          <Crown className="h-3.5 w-3.5 text-gold" aria-hidden />
          Photo gallery
          <span className="font-normal text-muted">
            {premium ? `(${gallery.length}/10 photos — Premium)` : "(Premium feature)"}
          </span>
        </p>

        {premium ? (
          <>
            <input
              ref={galleryInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onAddGalleryPhoto}
              className="sr-only"
              id="edit-gallery-file"
            />

            <div className="flex flex-wrap gap-3">
              {gallery.map((photo) => (
                <div key={photo} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                  <img src={photo} alt="" className="h-20 w-28 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setGallery((g) => g.filter((p) => p !== photo))}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-night-700 text-snow shadow-rail transition hover:bg-brand-500"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}

              {gallery.length < 10 && (
                <button
                  type="button"
                  onClick={() => galleryInput.current?.click()}
                  disabled={uploading}
                  className="grid h-20 w-28 place-items-center rounded-lg border border-dashed border-snow/25 text-muted transition hover:border-aqua-400/70 hover:text-aqua-200"
                >
                  {uploading ? (
                    <span className="text-[0.625rem] font-semibold">Uploading…</span>
                  ) : (
                    <ImagePlus className="h-5 w-5" aria-hidden />
                  )}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">
              Gallery changes are reviewed like every other edit before they appear on the site.
            </p>
          </>
        ) : (
          <p className="rounded-lg bg-paper p-3.5 text-xs leading-relaxed text-muted">
            Premium listings can show a gallery of up to 10 photos. Upgrade from your listing card
            on this page to unlock it.
          </p>
        )}
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
          <p role="alert" className="text-xs font-medium text-brand-400">
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
