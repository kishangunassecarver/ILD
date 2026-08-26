"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { QUICK_ACTIONS, SITE } from "@/lib/cms";

/**
 * The platform's primary action: one raised panel holding search, the AI
 * prompt, and the six shortcut cards. This is the bridge from the sponsor
 * hero into the I Love Durban experience, so it sits directly in the hero's
 * fade and outranks everything below it.
 */
export function SearchHub() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(term: string) {
    const trimmed = term.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <section aria-label="Search Durban" className="panel-raised p-4 shadow-lift sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        role="search"
        className="flex flex-wrap gap-3"
      >
        <label htmlFor="site-search" className="sr-only">
          {SITE.searchPlaceholder}
        </label>

        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist"
            strokeWidth={2}
            aria-hidden
          />
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SITE.searchPlaceholder}
            className="field h-14 rounded-2xl bg-paper/60 pl-12 text-[0.9375rem]"
          />
        </div>

        <button type="submit" className="btn-primary h-14 rounded-2xl px-7 text-[0.9375rem]">
          Search
        </button>

        {/* The AI door. Same destination as search today; the label sets the
            expectation the app experience delivers on. */}
        <Link
          href="/search"
          className="btn hidden h-14 items-center rounded-2xl border border-aqua-400/50 bg-aqua-400/10 px-5 text-[0.9375rem] font-semibold text-aqua-200 transition hover:border-aqua-300 hover:text-aqua-100 sm:inline-flex"
        >
          <Sparkles className="h-[1.1rem] w-[1.1rem]" aria-hidden />
          Ask I Love Durban
        </Link>
      </form>

      {/* The six shortcuts: a scrollable row on phones, a grid from sm up. */}
      <ul className="mt-4 flex gap-3 overflow-x-auto no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map((action) => (
          <li key={action.label} className="w-[11.5rem] shrink-0 sm:w-auto">
            <Link
              href={action.href}
              className="group flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-night p-4 transition hover:-translate-y-0.5 hover:border-aqua-400/60"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/5 text-snow transition group-hover:border-aqua-400/70 group-hover:text-aqua-300">
                <Icon name={action.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[0.9375rem] font-semibold leading-snug text-snow">
                  {action.label}
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">
                  {action.tagline}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
