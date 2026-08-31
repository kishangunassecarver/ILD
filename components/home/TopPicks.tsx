"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "@/components/cards/ListingCard";
import { Rail } from "@/components/ui/Rail";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PickGroup {
  label: string;
  href: string;
  cta: string;
  listings: Listing[];
}

/**
 * "Top picks for you" — tabbed rails.
 *
 * Every group is rendered from data resolved on the server at build time, so
 * switching tabs is instant and needs no fetch.
 */
export function TopPicks({ groups }: { groups: PickGroup[] }) {
  const [active, setActive] = useState(0);
  const current = groups[active];

  if (!current) return null;

  return (
    <section aria-labelledby="top-picks-title">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 id="top-picks-title" className="section-title">
          Top picks for you
        </h2>

        <div role="tablist" aria-label="Top pick categories" className="flex flex-wrap gap-1">
          {groups.map((group, i) => (
            <button
              key={group.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "relative px-2.5 py-1.5 text-[0.8125rem] font-semibold transition",
                i === active ? "text-aqua-600" : "text-muted hover:text-snow"
              )}
            >
              {group.label}
              {i === active && (
                <span
                  className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-aqua-400"
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>

        <Link href={current.href} className="link-more ml-auto">
          View all
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <Rail>
        {current.listings.map((listing) => (
          <ListingCard key={listing.slug} listing={listing} fallbackCta={current.cta} compact />
        ))}
      </Rail>
    </section>
  );
}
