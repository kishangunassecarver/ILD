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
    <section className={cn("panel p-4 sm:p-5", className)} aria-label="Search Durban">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex gap-2"
        role="search"
      >
        <label htmlFor="site-search" className="sr-only">
          {SITE.searchPlaceholder}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            id="site-search"
            type="search"
            value={query}
            autoFocus={autoFocus}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SITE.searchPlaceholder}
            className="field h-11 pl-10"
          />
        </div>
        <button type="submit" className="btn-primary h-11 px-5 sm:px-7">
          <Search className="h-4 w-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-muted">Popular:</span>
        {SITE.popularSearches.map((term) => (
          <button key={term} type="button" onClick={() => submit(term)} className="chip">
            {term}
          </button>
        ))}
      </div>
    </section>
  );
}
