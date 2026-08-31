import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import { deals, getHub, listingsIn, upcomingEvents } from "@/lib/cms";
import type { SaveKind } from "@/lib/member";

/**
 * The first content the visitor meets: three tall photo cards — something to
 * do, something on this weekend, a deal nearby. Real Durban content before any
 * further advertising, per the redesign brief.
 */

interface Spotlight {
  column: string;
  href: string;
  card: {
    seed: string;
    image?: string;
    title: string;
    meta: string;
    blurb: string;
    /** Bottom-left line: a price, a discount, a date. */
    note?: string;
    noteTone: "plain" | "deal";
    cta: string;
    ctaHref: string;
    saveKind: SaveKind;
    saveSlug: string;
  };
}

function build(): Spotlight[] {
  const out: Spotlight[] = [];

  const thing = listingsIn("things-to-do")[0];
  if (thing) {
    out.push({
      column: "Things to do today",
      href: "/things-to-do",
      card: {
        seed: thing.slug,
        image: thing.image,
        title: thing.name,
        meta: `${thing.area} · Open today`,
        blurb: thing.blurb,
        note: thing.price && thing.price !== "Free" ? `From ${thing.price}` : thing.price,
        noteTone: "plain",
        cta: thing.cta ?? getHub("things-to-do")?.defaultCta ?? "Plan a visit",
        ctaHref: `/things-to-do/${thing.slug}`,
        saveKind: "listing",
        saveSlug: thing.slug,
      },
    });
  }

  const event = upcomingEvents(1)[0];
  if (event) {
    out.push({
      column: "What's on this weekend",
      href: "/events",
      card: {
        seed: event.slug,
        image: event.image,
        title: event.title,
        meta: `${event.venue} · ${event.dateLabel ?? event.date}`,
        blurb: event.blurb,
        note: event.price,
        noteTone: "plain",
        cta: "Book tickets",
        ctaHref: `/events/${event.slug}`,
        saveKind: "event",
        saveSlug: event.slug,
      },
    });
  }

  const deal = deals(1)[0];
  if (deal) {
    out.push({
      column: "Deals near you",
      href: "/deals",
      card: {
        seed: deal.slug,
        image: deal.image,
        title: deal.business,
        meta: `${deal.area} · Exclusive I Love Durban offer`,
        blurb: deal.blurb,
        note: deal.badge,
        noteTone: "deal",
        cta: "Learn more",
        ctaHref: `/deals/${deal.slug}`,
        saveKind: "deal",
        saveSlug: deal.slug,
      },
    });
  }

  return out;
}

export function Spotlights() {
  const spots = build();
  if (spots.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {spots.map((spot) => (
        <section key={spot.column} aria-label={spot.column} className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-snow">{spot.column}</h2>
            <Link
              href={spot.href}
              className="inline-flex items-center gap-0.5 text-sm font-semibold text-aqua-600 transition hover:text-aqua-500"
            >
              View all
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <article className="panel card-hover group relative overflow-hidden">
            <Tile seed={spot.card.seed} image={spot.card.image} className="h-[23rem]">
              <SaveButton
                label={spot.card.title}
                kind={spot.card.saveKind}
                slug={spot.card.saveSlug}
                variant="chip"
                className="absolute right-3 top-3 z-10"
              />

              {/* A stronger foot scrim than card tiles: this one carries three
                  lines of copy and a button. */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-ink/95 via-ink/45 to-transparent"
                aria-hidden
              />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-lg font-bold leading-snug text-white">
                  <Link href={spot.card.ctaHref} className="transition hover:text-aqua-200">
                    {spot.card.title}
                  </Link>
                </h3>
                <p className="mt-1 text-[0.8125rem] font-medium text-white/75">{spot.card.meta}</p>
                <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-white/85">
                  {spot.card.blurb}
                </p>

                <div className="mt-3.5 flex items-center justify-between gap-3">
                  {spot.card.note ? (
                    <span
                      className={
                        spot.card.noteTone === "deal"
                          ? "text-[0.9375rem] font-extrabold text-coral-400"
                          : "text-[0.9375rem] font-bold text-aqua-200"
                      }
                    >
                      {spot.card.note}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link href={spot.card.ctaHref} className="btn-primary px-5 py-2 text-[0.8125rem]">
                    {spot.card.cta}
                  </Link>
                </div>
              </div>
            </Tile>
          </article>
        </section>
      ))}
    </div>
  );
}
