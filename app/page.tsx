import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Leaderboard } from "@/components/ads/Leaderboard";
import { SponsorTower } from "@/components/ads/SponsorTower";
import { DealCard } from "@/components/cards/DealCard";
import { EventCard } from "@/components/cards/EventCard";
import { AppPromo } from "@/components/home/AppPromo";
import { FeaturedBusinesses } from "@/components/home/FeaturedBusinesses";
import { TopPicks, type PickGroup } from "@/components/home/TopPicks";
import { SearchPanel } from "@/components/layout/SearchPanel";
import { Icon } from "@/components/ui/Icon";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tile } from "@/components/ui/Tile";
import { deals, getHub, HUBS, listingsIn, STATS, TOP_PICK_TABS, upcomingEvents } from "@/lib/cms";
import type { IconName } from "@/lib/types";

/** Which icon fronts each hub tile. Presentation, so it stays in code. */
const HUB_ICONS: Record<string, IconName> = {
  "eat-drink": "utensils",
  stay: "bed",
  "things-to-do": "ticket",
  shop: "shopping-bag",
  services: "wrench",
};

export default function HomePage() {
  const events = upcomingEvents(8);
  const dealsOfTheDay = deals(3);

  // Each tab's rail is resolved here, at build time, so the client component
  // only has to switch between arrays it already holds.
  const groups: PickGroup[] = TOP_PICK_TABS.map((tab) => {
    const hub = getHub(tab.hub);
    return {
      label: tab.label,
      href: `/${tab.hub}`,
      cta: hub?.defaultCta ?? "View",
      listings: listingsIn(tab.hub, tab.filter).slice(0, 8),
    };
  }).filter((group) => group.listings.length > 0);

  return (
    <div className="shell grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-8">
        <SearchPanel />

        <Leaderboard />

        <section aria-labelledby="whats-happening">
          <SectionHeader
            id="whats-happening"
            title="What's happening in Durban"
            href="/events"
            linkLabel="View all events"
          />
          <Rail>
            {events.map((event) => (
              <EventCard key={event.slug} event={event} compact />
            ))}
          </Rail>
        </section>

        <FeaturedBusinesses />

        {groups.length > 0 && <TopPicks groups={groups} />}

        <section aria-labelledby="explore-title">
          <SectionHeader id="explore-title" title="Explore Durban" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HUBS.map((hub) => (
              <Link
                key={hub.slug}
                href={`/${hub.slug}`}
                className="panel card-hover group relative overflow-hidden"
              >
                <Tile seed={`hub-${hub.slug}`} className="h-28">
                  <div className="absolute inset-0 flex items-end justify-between gap-3 p-4">
                    <div>
                      <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                        {hub.label}
                      </p>
                      <p className="mt-1 text-[0.6875rem] text-white/75">
                        {listingsIn(hub.slug).length} listings
                      </p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition group-hover:bg-brand-500 group-hover:ring-brand-500">
                      <Icon name={HUB_ICONS[hub.slug] ?? "map-pin"} className="h-4 w-4" />
                    </span>
                  </div>
                </Tile>
                <p className="line-clamp-2 p-3.5 text-xs leading-relaxed text-muted">{hub.intro}</p>
              </Link>
            ))}
          </div>
        </section>

        <AppPromo />

        <section
          aria-label="I Love Durban in numbers"
          className="panel grid gap-4 p-6 sm:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-extrabold tracking-tight text-ink">{stat.value}</p>
              <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
            </div>
          ))}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <SponsorTower />

        <section aria-labelledby="deals-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="deals-title" className="text-base font-bold text-ink">
              Deals of the day
            </h2>
            <Link href="/deals" className="link-more text-xs">
              View all deals
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="space-y-4">
            {dealsOfTheDay.map((deal) => (
              <DealCard key={deal.slug} deal={deal} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
