"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SITE } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * The primary search entry point.
 *
 * There is no search server — the site is a static export — so this hands the
 * query to /search, which filters the baked-in directory in the browser.
 */
export function SearchPanel({
  className,
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(term: string) {
    const trimmed = term.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    // No panel box — the bar and its chips float on the hero's fade, as in
    // the reference. The pill itself is translucent with a light border.
    <section className={cn("space-y-3", className)} aria-label="Search Durban">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="relative"
        role="search"
      >
        <label htmlFor="site-search" className="sr-only">
          {SITE.searchPlaceholder}
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 z-10 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-mist"
          aria-hidden
        />
        <input
          id="site-search"
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SITE.searchPlaceholder}
          className="field h-12 bg-night-700/70 pl-11 pr-[6.5rem] backdrop-blur"
        />
        <button
          type="submit"
          className="btn-primary absolute right-1.5 top-1/2 h-9 -translate-y-1/2 px-4 text-xs sm:px-5"
        >
          Search
        </button>
      </form>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
        {SITE.popularSearches.map((term, i) => (
          <button
            key={term}
            type="button"
            onClick={() => submit(term)}
            className={cn("chip shrink-0", i === 0 && "chip-active")}
          >
            {term}
          </button>
        ))}
      </div>
    </section>
  );
}
