"use client";

import { useMemo, useState } from "react";
import { EventCard } from "@/components/cards/EventCard";
import type { Event } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Category chips over the city calendar. Filters in the browser, no requests. */
export function EventsBrowser({ events, categories }: { events: Event[]; categories: string[] }) {
  const [category, setCategory] = useState<string | null>(null);

  const results = useMemo(
    () => (category ? events.filter((e) => e.category === category) : events),
    [events, category]
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
          Everything
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
        {results.length} {results.length === 1 ? "event" : "events"}
        {category ? ` in ${category}` : " on the calendar"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((event) => (
          <EventCard key={event.slug} event={event} />
        ))}
      </div>
    </div>
  );
}
