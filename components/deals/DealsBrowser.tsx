"use client";

import { useMemo, useState } from "react";
import { DealCard } from "@/components/cards/DealCard";
import type { Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DealsBrowser({ deals, categories }: { deals: Deal[]; categories: string[] }) {
  const [category, setCategory] = useState<string | null>(null);

  const results = useMemo(
    () => (category ? deals.filter((d) => d.category === category) : deals),
    [deals, category]
  );

  return (
    <div>
      <div className="panel mb-5 flex flex-wrap items-center gap-1.5 p-3.5">
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={!category}
          className={cn("chip", !category && "chip-active")}
        >
          All deals
        </button>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory(name === category ? null : name)}
            aria-pressed={name === category}
            className={cn("chip", name === category && "chip-active")}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "offer" : "offers"} live right now
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((deal) => (
          <DealCard key={deal.slug} deal={deal} layout="wide" />
        ))}
      </div>
    </div>
  );
}
