import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SponsorTower } from "@/components/ads/SponsorTower";
import { DealCard } from "@/components/cards/DealCard";
import { HubBrowser } from "@/components/hub/HubBrowser";
import { PageHeader } from "@/components/layout/PageHeader";
import { activeFilters, deals, getHub, listingsIn } from "@/lib/cms";
import type { HubSlug } from "@/lib/types";

/**
 * The template behind all five hub routes.
 *
 * The routes themselves are separate files so the URLs are explicit and never
 * shadow /events, /deals or the marketing pages.
 */
export function HubPage({ slug }: { slug: HubSlug }) {
  const hub = getHub(slug);
  if (!hub) notFound();

  const listings = listingsIn(slug);
  const filters = activeFilters(hub);
  const areas = [...new Set(listings.map((l) => l.area))].sort();
  const sidebarDeals = deals()
    .filter((d) => d.category === hub.label)
    .slice(0, 2);

  return (
    <div className="shell grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <PageHeader
          title={hub.title}
          intro={hub.intro}
          trail={[{ label: "Home", href: "/" }, { label: hub.label }]}
        />

        <HubBrowser hub={hub} listings={listings} filters={filters} areas={areas} />
      </div>

      <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <SponsorTower />

        {sidebarDeals.length > 0 && (
          <section aria-labelledby="hub-deals-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="hub-deals-title" className="text-base font-bold text-ink">
                {hub.label} deals
              </h2>
              <Link href="/deals" className="link-more text-xs">
                All deals
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="space-y-4">
              {sidebarDeals.map((deal) => (
                <DealCard key={deal.slug} deal={deal} />
              ))}
            </div>
          </section>
        )}

        <section className="panel p-5">
          <h2 className="text-sm font-bold text-ink">
            Own a business in {hub.label.toLowerCase()}?
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Claim your free listing and get found by the people already searching for you.
          </p>
          <Link href="/list-your-business" className="btn-primary mt-3 w-full py-2 text-xs">
            List Your Business
          </Link>
        </section>
      </aside>
    </div>
  );
}
