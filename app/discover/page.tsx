import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EventCard } from "@/components/cards/EventCard";
import { ListingCard } from "@/components/cards/ListingCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Rail } from "@/components/ui/Rail";
import { getHub, LISTINGS, featuredListings, upcomingEvents } from "@/lib/cms";
import type { Listing } from "@/lib/types";

export const metadata: Metadata = {
  title: "Discover Durban",
  description:
    "Where to start in Durban: this weekend's picks, first-time essentials, hidden gems, free things to do and the neighbourhoods worth your afternoon.",
};

/** The editorial shortlist for a first visit — curated, not computed. */
const FIRST_TIME = [
  "ushaka-marine-world",
  "golden-mile-promenade",
  "moses-mabhida-skycar",
  "little-gujarat",
  "victoria-street-market",
  "durban-botanic-gardens",
];

/** Neighbourhood guides, each pulling in the listings filed under its areas. */
const NEIGHBOURHOODS = [
  {
    id: "umhlanga",
    name: "Umhlanga & Ballito",
    blurb:
      "The coastal strip north of the city: the lighthouse, the promenade, and most of Durban's best hotels.",
    areas: ["Umhlanga", "Umhlanga Rocks", "Umhlanga Ridge", "Ballito"],
  },
  {
    id: "florida-road",
    name: "Florida Road & Morningside",
    blurb:
      "Restaurant row. Pavement tables, late kitchens, and everything within a walk of everything.",
    areas: ["Florida Road", "Morningside"],
  },
  {
    id: "point",
    name: "Point Waterfront",
    blurb:
      "The old harbour edge, now the address for uShaka, the promenade's south end and the jazz room.",
    areas: ["Point Waterfront", "Point"],
  },
  {
    id: "glenwood",
    name: "Glenwood & Berea",
    blurb:
      "Leafy, studenty and unhurried — coffee, ceramics, the botanic gardens and a museum in a house.",
    areas: ["Glenwood", "Berea"],
  },
];

export default function DiscoverPage() {
  const weekend = upcomingEvents(4);
  const approved = featuredListings(8);

  const firstTime = FIRST_TIME.map((slug) => LISTINGS.find((l) => l.slug === slug)).filter(
    (l): l is Listing => Boolean(l)
  );

  // Well-reviewed but not yet crowded — the definition of a gem, in data terms.
  const gems = LISTINGS.filter((l) => l.rating >= 4.5 && l.reviews < 700)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8);

  const free = LISTINGS.filter((l) => l.price === "Free").slice(0, 8);

  return (
    <div className="shell space-y-10 py-6">
      <PageHeader
        title="Discover Durban"
        intro="Start here. The weekend, the essentials, the quiet finds and the four neighbourhoods that will fill an afternoon each."
        trail={[{ label: "Home", href: "/" }, { label: "Discover" }]}
      />

      <Section id="weekend" title="This weekend in Durban" href="/events" linkLabel="Full calendar">
        <Rail>
          {weekend.map((event) => (
            <EventCard key={event.slug} event={event} compact />
          ))}
        </Rail>
      </Section>

      <Section
        id="approved"
        title="Durban Approved"
        blurb="Places our team has visited, eaten at and vouched for. No paid placements in this list."
      >
        <Cards listings={approved} />
      </Section>

      <Section
        id="first-time"
        title="First time in Durban"
        blurb="Six things that explain the city faster than anything else on this site."
      >
        <Cards listings={firstTime} />
      </Section>

      <Section
        id="gems"
        title="Hidden gems"
        blurb="Rated highly by the few hundred people who have found them so far."
      >
        <Cards listings={gems} />
      </Section>

      <Section id="free" title="Free things to do" blurb="No ticket, no booking, no excuse.">
        <Cards listings={free} />
      </Section>

      <section id="legends" className="panel p-6">
        <h2 className="section-title">Local legends</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Every month we profile a Durban business that has been quietly getting it right for years
          — the counter that never changed its recipe, the guesthouse run by the same family for
          three generations. Nominations come from readers.
        </p>
        <Link href="/contact" className="link-more mt-4">
          Nominate a local legend
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      <div className="space-y-8">
        <h2 className="section-title">Neighbourhood guides</h2>
        {NEIGHBOURHOODS.map((hood) => {
          const listings = LISTINGS.filter((l) => hood.areas.includes(l.area)).slice(0, 8);
          if (listings.length === 0) return null;

          return (
            <section key={hood.id} id={hood.id} className="scroll-mt-24">
              <h3 className="text-base font-bold text-snow">{hood.name}</h3>
              <p className="mb-4 mt-1 max-w-2xl text-sm leading-relaxed text-muted">{hood.blurb}</p>
              <Cards listings={listings} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  blurb,
  href,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  blurb?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="max-w-2xl">
          <h2 className="section-title">{title}</h2>
          {blurb && <p className="mt-1 text-sm leading-relaxed text-muted">{blurb}</p>}
        </div>
        {href && (
          <Link href={href} className="link-more ml-auto">
            {linkLabel ?? "View all"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Cards({ listings }: { listings: Listing[] }) {
  return (
    <Rail>
      {listings.map((listing) => (
        <ListingCard
          key={`${listing.hub}-${listing.slug}`}
          listing={listing}
          fallbackCta={getHub(listing.hub)?.defaultCta}
          compact
        />
      ))}
    </Rail>
  );
}
