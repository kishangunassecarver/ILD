"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DealCard } from "@/components/cards/DealCard";
import { EventCard } from "@/components/cards/EventCard";
import { ListingCard } from "@/components/cards/ListingCard";
import { DEALS, EVENTS, LISTINGS, getHub } from "@/lib/cms";
import type { Deal, Event, Listing } from "@/lib/types";

/**
 * Site search over the directory baked into the bundle.
 *
 * The whole catalogue ships with the page, so search is instant and works with
 * no origin server. If the directory grows past a few thousand entries this
 * should move to a prebuilt index (or a real search service) rather than
 * scanning arrays on every keystroke.
 */

interface Match {
  /** Sum of the weights of the fields each term was found in. */
  score: number;
  /** How many of the search terms matched at all. */
  hits: number;
}

/** Weighted so a name match always outranks a mention in the body copy. */
function score(haystacks: { text: string; weight: number }[], terms: string[]): Match {
  let total = 0;
  let hits = 0;

  for (const term of terms) {
    for (const { text, weight } of haystacks) {
      if (text.includes(term)) {
        total += weight;
        hits += 1;
        break;
      }
    }
  }

  return { score: total, hits };
}

function listingScore(listing: Listing, terms: string[]) {
  return score(
    [
      { text: listing.name.toLowerCase(), weight: 10 },
      { text: listing.category.toLowerCase(), weight: 6 },
      { text: listing.area.toLowerCase(), weight: 5 },
      { text: listing.tags.join(" ").toLowerCase(), weight: 4 },
      { text: listing.blurb.toLowerCase(), weight: 2 },
    ],
    terms
  );
}

function eventScore(event: Event, terms: string[]) {
  return score(
    [
      { text: event.title.toLowerCase(), weight: 10 },
      { text: event.category.toLowerCase(), weight: 6 },
      { text: `${event.venue} ${event.area}`.toLowerCase(), weight: 5 },
      { text: event.blurb.toLowerCase(), weight: 2 },
    ],
    terms
  );
}

function dealScore(deal: Deal, terms: string[]) {
  return score(
    [
      { text: deal.business.toLowerCase(), weight: 10 },
      { text: deal.title.toLowerCase(), weight: 8 },
      { text: `${deal.category} ${deal.area}`.toLowerCase(), weight: 5 },
      { text: deal.blurb.toLowerCase(), weight: 2 },
    ],
    terms
  );
}

export function SearchResults() {
  const [query, setQuery] = useState("");

  // The query arrives as ?q= from the header and home-page search boxes.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQuery(initial);
  }, []);

  const terms = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean),
    [query]
  );

  const results = useMemo(() => {
    if (terms.length === 0) return null;

    /**
     * Two passes. The first requires every term to match, which is what people
     * mean by a multi-word query. If that finds nothing we relax to "any term",
     * because an empty page is less useful than near-misses — and we say so.
     */
    const rank = <T,>(
      items: T[],
      scorer: (item: T, terms: string[]) => Match,
      minimumHits: number
    ) =>
      items
        .map((item) => ({ item, match: scorer(item, terms) }))
        .filter((entry) => entry.match.hits >= minimumHits && entry.match.score > 0)
        .sort((a, b) => b.match.hits - a.match.hits || b.match.score - a.match.score)
        .map((entry) => entry.item);

    const collect = (minimumHits: number) => ({
      listings: rank(LISTINGS, listingScore, minimumHits),
      events: rank(EVENTS, eventScore, minimumHits),
      deals: rank(DEALS, dealScore, minimumHits),
    });

    const strict = collect(terms.length);
    const found = strict.listings.length + strict.events.length + strict.deals.length;

    if (found > 0 || terms.length === 1) return { ...strict, relaxed: false };

    return { ...collect(1), relaxed: true };
  }, [terms]);

  const total = results
    ? results.listings.length + results.events.length + results.deals.length
    : 0;

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="panel mb-6 flex gap-2 p-4"
      >
        <label htmlFor="search-input" className="sr-only">
          Search Durban
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            id="search-input"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “seafood Umhlanga”, “free things to do”, “spa deal”"
            className="field h-11 pl-10"
          />
        </div>
      </form>

      {!results && (
        <div className="panel p-10 text-center">
          <p className="text-sm font-semibold text-snow">Search the whole city</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
            Places, events and deals — all at once. Search by name, suburb, category or the thing
            you actually feel like doing.
          </p>
        </div>
      )}

      {results && (
        <>
          <p className="mb-5 text-xs text-muted" aria-live="polite">
            {results.relaxed && total > 0
              ? `No exact match for “${query.trim()}” — showing ${total} close ${
                  total === 1 ? "result" : "results"
                }`
              : `${total} ${total === 1 ? "result" : "results"} for “${query.trim()}”`}
          </p>

          {total === 0 && (
            <div className="panel p-10 text-center">
              <p className="text-sm font-semibold text-snow">Nothing found for that.</p>
              <p className="mt-1.5 text-xs text-muted">
                Try fewer words, or a suburb name like “Umhlanga” or “Glenwood”.
              </p>
            </div>
          )}

          {results.listings.length > 0 && (
            <section className="mb-8">
              <h2 className="section-title mb-4">Places ({results.listings.length})</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {results.listings.slice(0, 12).map((listing) => (
                  <ListingCard
                    key={`${listing.hub}-${listing.slug}`}
                    listing={listing}
                    fallbackCta={getHub(listing.hub)?.defaultCta}
                  />
                ))}
              </div>
            </section>
          )}

          {results.events.length > 0 && (
            <section className="mb-8">
              <h2 className="section-title mb-4">Events ({results.events.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.events.slice(0, 6).map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            </section>
          )}

          {results.deals.length > 0 && (
            <section>
              <h2 className="section-title mb-4">Deals ({results.deals.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.deals.slice(0, 6).map((deal) => (
                  <DealCard key={deal.slug} deal={deal} layout="wide" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
