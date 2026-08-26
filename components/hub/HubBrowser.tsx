"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ListingCard } from "@/components/cards/ListingCard";
import type { Hub, Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "recommended" | "rating" | "reviews" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "name", label: "A – Z" },
];

/**
 * The filtering surface shared by all five hub pages.
 *
 * Everything filters client-side over the listings baked into the page at build
 * time — no request, no loading state, and it still works behind a CDN with no
 * origin server.
 */
export function HubBrowser({
  hub,
  listings,
  filters,
  areas,
}: {
  hub: Hub;
  listings: Listing[];
  filters: string[];
  areas: string[];
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [area, setArea] = useState<string>("");
  const [sort, setSort] = useState<Sort>("recommended");

  /**
   * Honour ?filter= from the mega-menu links.
   *
   * Read from the URL after mount rather than through useSearchParams: the page
   * is a static export with no per-query build, so there is nothing to read on
   * the server, and this keeps the page out of Next's dynamic-bailout path.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("filter");
    if (requested && filters.includes(requested)) setCategory(requested);
  }, [filters]);

  const results = useMemo(() => {
    const filtered = listings.filter(
      (l) => (!category || l.category === category) && (!area || l.area === area)
    );

    return filtered.sort((a, b) => {
      switch (sort) {
        case "rating":
          return b.rating - a.rating || a.name.localeCompare(b.name);
        case "reviews":
          return b.reviews - a.reviews || a.name.localeCompare(b.name);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
          return b.rating - a.rating || a.name.localeCompare(b.name);
      }
    });
  }, [listings, category, area, sort]);

  const filtering = Boolean(category || area);

  return (
    <div>
      <div className="panel mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn("chip", !category && "chip-active")}
            aria-pressed={!category}
          >
            All
          </button>
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setCategory(filter === category ? null : filter)}
              className={cn("chip", filter === category && "chip-active")}
              aria-pressed={filter === category}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="hub-area">
            Filter by area
          </label>
          <select
            id="hub-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="field h-9 w-auto py-0 text-xs"
          >
            <option value="">All areas</option>
            {areas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="hub-sort">
            Sort results
          </label>
          <select
            id="hub-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="field h-9 w-auto py-0 text-xs"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {filtering && (
            <button
              type="button"
              onClick={() => {
                setCategory(null);
                setArea("");
              }}
              className="chip gap-1 border-aqua-500/40 text-aqua-300"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 flex items-center gap-2 text-xs text-muted" aria-live="polite">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        {results.length} {results.length === 1 ? "place" : "places"}
        {category ? ` in ${category}` : ""}
        {area ? ` · ${area}` : ""}
      </p>

      {results.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm font-semibold text-snow">Nothing matches that combination yet.</p>
          <p className="mt-1 text-xs text-muted">
            Try a different area, or clear the filters to see everything in {hub.label}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {results.map((listing) => (
            <ListingCard key={listing.slug} listing={listing} fallbackCta={hub.defaultCta} />
          ))}
        </div>
      )}
    </div>
  );
}
