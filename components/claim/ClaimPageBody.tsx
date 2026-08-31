"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2 } from "lucide-react";
import { ClaimForm } from "@/components/account/ClaimForm";
import { useMember } from "@/components/account/MemberProvider";
import { fetchMyBusinesses } from "@/lib/member";

/**
 * The working part of the /claim page: the sign-in gate, the shared claim
 * form (prefilled from ?slug= when a listing page sent the visitor here), and
 * the submitted state.
 */
export function ClaimPageBody() {
  const { member, loading } = useMember();
  const [prefillSlug, setPrefillSlug] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Static export: the query string is read on the client, like the dashboard.
    const params = new URLSearchParams(window.location.search);
    setPrefillSlug(params.get("slug"));
  }, []);

  useEffect(() => {
    if (!member) {
      setAlreadyClaimed(new Set());
      setReady(false);
      return;
    }

    void (async () => {
      const mine = await fetchMyBusinesses();
      setAlreadyClaimed(
        new Set((mine?.claims ?? []).filter((c) => c.status !== "rejected").map((c) => c.slug))
      );
      setReady(true);
    })();
  }, [member]);

  if (loading || (member && !ready)) {
    return (
      <p className="panel p-10 text-center text-sm text-muted" aria-busy>
        Loading…
      </p>
    );
  }

  if (!member) {
    return (
      <div className="panel p-8 text-center sm:p-12">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
          <Building2 className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-snow">Sign in to claim your listing</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Claims are tied to your free I Love Durban account, so once yours is approved the listing
          shows up on your dashboard, ready to edit.
        </p>
        <Link href="/join" className="btn-primary mt-5">
          Join or sign in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="panel p-8 text-center sm:p-12">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-aqua-400/10">
          <BadgeCheck className="h-5 w-5 text-aqua-600" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-snow">Claim submitted</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          A person reviews every claim — usually within two working days. You will get an email the
          moment it is decided, and you can watch its status on your dashboard.
        </p>
        <Link href="/my-business" className="btn-primary mt-5">
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return (
    <ClaimForm
      prefillSlug={prefillSlug}
      alreadyClaimed={alreadyClaimed}
      onSubmitted={() => setSent(true)}
    />
  );
}
