"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useMember } from "@/components/account/MemberProvider";
import { DealCard } from "@/components/cards/DealCard";
import { EventCard } from "@/components/cards/EventCard";
import { ListingCard } from "@/components/cards/ListingCard";
import { DEALS, EVENTS, LISTINGS, getHub } from "@/lib/cms";
import { fetchSaves, type Save } from "@/lib/member";

/**
 * A member's saved places, events and deals.
 *
 * Saves are stored as a kind and a slug, and resolved here against the
 * directory that already ships with the page — so no extra request, and a save
 * pointing at something since unpublished is simply skipped rather than
 * rendering a broken card.
 */
export function SavedList() {
  const { member, loading } = useMember();
  const [saves, setSaves] = useState<Save[] | null>(null);

  useEffect(() => {
    if (!member) {
      setSaves(null);
      return;
    }

    void fetchSaves().then(setSaves);
  }, [member]);

  if (loading) {
    return (
      <p className="panel p-10 text-center text-sm text-muted" aria-busy>
        Loading your saves…
      </p>
    );
  }

  if (!member) {
    return (
      <div className="panel p-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
          <Heart className="h-5 w-5 text-aqua-300" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-snow">Sign in to see your saved places</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Saves are tied to your free account, so they follow you between this site and the app.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/join" className="btn-primary">
            Join or sign in
          </Link>
          <Link href="/discover" className="btn-ghost">
            Find something to save
          </Link>
        </div>
      </div>
    );
  }

  if (saves === null) {
    return (
      <p className="panel p-10 text-center text-sm text-muted" aria-busy>
        Loading your saves…
      </p>
    );
  }

  const listings = saves
    .filter((s) => s.kind === "listing")
    .map((s) => LISTINGS.find((l) => l.slug === s.slug))
    .filter((l): l is (typeof LISTINGS)[number] => Boolean(l));

  const events = saves
    .filter((s) => s.kind === "event")
    .map((s) => EVENTS.find((e) => e.slug === s.slug))
    .filter((e): e is (typeof EVENTS)[number] => Boolean(e));

  const deals = saves
    .filter((s) => s.kind === "deal")
    .map((s) => DEALS.find((d) => d.slug === s.slug))
    .filter((d): d is (typeof DEALS)[number] => Boolean(d));

  const total = listings.length + events.length + deals.length;

  if (total === 0) {
    return (
      <div className="panel p-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-aqua-400/10">
          <Heart className="h-5 w-5 text-aqua-300" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-bold text-snow">Nothing saved yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Tap the heart on any place, event or deal and it will appear here.
        </p>
        <Link href="/discover" className="btn-primary mt-5">
          Start exploring
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {listings.length > 0 && (
        <section aria-labelledby="saved-places">
          <h2 id="saved-places" className="section-title mb-4">
            Places ({listings.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {listings.map((listing) => (
              <ListingCard
                key={`${listing.hub}-${listing.slug}`}
                listing={listing}
                fallbackCta={getHub(listing.hub)?.defaultCta}
              />
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section aria-labelledby="saved-events">
          <h2 id="saved-events" className="section-title mb-4">
            Events ({events.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && (
        <section aria-labelledby="saved-deals">
          <h2 id="saved-deals" className="section-title mb-4">
            Deals ({deals.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {deals.map((deal) => (
              <DealCard key={deal.slug} deal={deal} layout="wide" />
            ))}
          </div>
        </section>
      )}

      {total < saves.length && (
        <p className="text-xs text-muted">
          {saves.length - total} saved {saves.length - total === 1 ? "item is" : "items are"} no
          longer listed, so they are not shown.
        </p>
      )}
    </div>
  );
}
