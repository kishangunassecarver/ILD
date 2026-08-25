import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Saved places",
  description: "Your saved places, events and deals.",
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Saved places"
        intro="Everything you have tapped the heart on, in one list."
        trail={[{ label: "Home", href: "/" }, { label: "Saved" }]}
      />

      <div className="panel p-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50">
          <Heart className="h-5 w-5 text-brand-500" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-ink">Sign in to see your saved places</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Saved places are tied to your free member account so they follow you between this site and
          the app. Join once and the heart works everywhere.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/join" className="btn-primary">
            Join for free
          </Link>
          <Link href="/discover" className="btn-ghost">
            Find something to save
          </Link>
        </div>
      </div>
    </div>
  );
}
