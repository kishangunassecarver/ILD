"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { QUICK_ACTIONS, SITE } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * One tint per shortcut, cycling in order: the brand aqua and coral first,
 * then gold, harbour blue, botanic green and night-market purple from the
 * placeholder-art palette, so the row shares the cards' colour world.
 */
const ACTION_TINTS = [
  "bg-aqua-500/12 text-aqua-600",
  "bg-[#5B2AA8]/10 text-[#5B2AA8]",
  "bg-coral-500/12 text-coral-500",
  "bg-gold/15 text-gold-600",
  "bg-[#1F6F4A]/10 text-[#1F6F4A]",
  "bg-[#0E4C92]/10 text-[#0E4C92]",
];

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
        // One row, always: the input shrinks rather than the button wrapping
        // out of the pill onto its own line, which read as broken on phones.
        className="flex gap-2.5 sm:gap-3"
      >
        <label htmlFor="site-search" className="sr-only">
          {SITE.searchPlaceholder}
        </label>

        <div className="relative min-w-0 flex-1">
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

        <button
          type="submit"
          className="btn-primary h-14 shrink-0 rounded-2xl px-5 text-[0.9375rem] sm:px-7"
        >
          {/* An icon on phones, the word from sm up — the label is the
              placeholder's job on a narrow screen. */}
          <Search className="h-5 w-5 sm:hidden" strokeWidth={2.25} aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>

        {/* The AI door. Same destination as search today; the label sets the
            expectation the app experience delivers on. */}
        <Link
          href="/search"
          className="btn hidden h-14 shrink-0 items-center rounded-2xl border border-aqua-400/50 bg-aqua-400/10 px-5 text-[0.9375rem] font-semibold text-aqua-600 transition hover:border-aqua-300 hover:text-aqua-100 lg:inline-flex"
        >
          <Sparkles className="h-[1.1rem] w-[1.1rem]" aria-hidden />
          Ask I Love Durban
        </Link>
      </form>

      {/* The AI prompt keeps a place on smaller screens as a quiet row under
          the search bar rather than crowding the input row. */}
      <Link
        href="/search"
        className="mt-2.5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-aqua-600 transition hover:text-aqua-500 lg:hidden"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Ask I Love Durban — &ldquo;What can I do with kids this weekend?&rdquo;
      </Link>

      {/* The six shortcuts: a scrollable row on phones, three across on
          tablets, and always one row of six on desktop. Each gets its own
          tinted icon disc — on the light theme, colour is what keeps this row
          from reading as six grey boxes. */}
      <ul className="mt-4 flex gap-3 overflow-x-auto no-scrollbar sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {QUICK_ACTIONS.map((action, index) => (
          <li key={action.label} className="w-[11.5rem] shrink-0 sm:w-auto">
            <Link
              href={action.href}
              className="group flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-night p-4 transition hover:-translate-y-0.5 hover:border-aqua-400/60"
            >
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full transition group-hover:scale-105",
                  ACTION_TINTS[index % ACTION_TINTS.length]
                )}
              >
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
