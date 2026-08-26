import Link from "next/link";
import { Leaderboard } from "@/components/ads/Leaderboard";
import { SponsorCard } from "@/components/ads/SponsorCard";
import { EventCard } from "@/components/cards/EventCard";
import { AppPromo } from "@/components/home/AppPromo";
import { FeaturedBusinesses } from "@/components/home/FeaturedBusinesses";
import { SearchHub } from "@/components/home/SearchHub";
import { Spotlights } from "@/components/home/Spotlights";
import { TopPicks, type PickGroup } from "@/components/home/TopPicks";
import { TrustBar } from "@/components/home/TrustBar";
import { Icon } from "@/components/ui/Icon";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tile } from "@/components/ui/Tile";
import { getHub, HUBS, listingsIn, STATS, TOP_PICK_TABS, upcomingEvents } from "@/lib/cms";
import type { IconName } from "@/lib/types";

/** Which icon fronts each hub tile. Presentation, so it stays in code. */
const HUB_ICONS: Record<string, IconName> = {
  "eat-drink": "utensils",
  stay: "bed",
  "things-to-do": "ticket",
  shop: "shopping-bag",
  services: "wrench",
};

/*
 * The first viewport, in order: the featured-partner hero (in the layout),
 * search and the AI door, the shortcut cards, then real Durban content —
 * things to do, this weekend, deals. Advertising returns only after that,
 * clearly labelled, and the platform's own promises close the screen.
 */
export default function HomePage() {
  const events = upcomingEvents(8);

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
    <div className="shell space-y-10 py-6">
      {/* Pulled up into the hero's fade. */}
      <div className="relative z-10 -mt-2 space-y-10">
        <SearchHub />

        <Spotlights />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Leaderboard />
        <SponsorCard />
      </div>

      <TrustBar />

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
              <Tile seed={`hub-${hub.slug}`} image={hub.image} className="h-28">
                <div className="absolute inset-0 flex items-end justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                      {hub.label}
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {listingsIn(hub.slug).length} listings
                    </p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition group-hover:bg-aqua-500 group-hover:text-white group-hover:ring-aqua-500">
                    <Icon name={HUB_ICONS[hub.slug] ?? "map-pin"} className="h-4 w-4" />
                  </span>
                </div>
              </Tile>
              {/* Padding lives on the wrapper, never on the clamped element:
                  line-clamp uses display:-webkit-box, and a padded box lets
                  the line after the clamp bleed into the padding and get
                  sliced in half instead of being hidden. */}
              <div className="p-4">
                <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
                  {hub.intro}
                </p>
              </div>
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
            <p className="text-2xl font-extrabold tracking-tight text-snow">{stat.value}</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted">{stat.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
