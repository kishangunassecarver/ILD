import type { Metadata } from "next";
import Link from "next/link";
import { SponsorTower } from "@/components/ads/SponsorTower";
import { DealsBrowser } from "@/components/deals/DealsBrowser";
import { PageHeader } from "@/components/layout/PageHeader";
import { dealCategories, deals } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Deals & offers in Durban",
  description:
    "Exclusive discounts from Durban restaurants, spas, attractions and services — free to claim.",
};

export default function DealsPage() {
  return (
    <div className="shell grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <PageHeader
          title="Deals worth leaving the house for"
          intro="Offers negotiated with local businesses. Free to browse; members get the app-only extras."
          trail={[{ label: "Home", href: "/" }, { label: "Deals" }]}
        />

        <DealsBrowser deals={deals()} categories={dealCategories()} />
      </div>

      <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <SponsorTower />

        <section className="panel p-5">
          <h2 className="text-sm font-bold text-ink">How deals work</h2>
          <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-ink">1. Find an offer.</span> Everything here is
              live and dated.
            </li>
            <li>
              <span className="font-semibold text-ink">2. Show it in the app.</span> One tap at the
              till or the till point.
            </li>
            <li>
              <span className="font-semibold text-ink">3. Earn points.</span> Every redemption adds
              to your rewards balance.
            </li>
          </ol>
          <Link href="/join" className="btn-primary mt-4 w-full py-2 text-xs">
            Join for free
          </Link>
        </section>
      </aside>
    </div>
  );
}
