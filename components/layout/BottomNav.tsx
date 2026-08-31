"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { BOTTOM_NAV } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * Floating bottom navigation.
 *
 * Phones only (below `md`). It is an app pattern: on a desktop window —
 * including narrow ones, where the header collapses to its drawer — a bar
 * floating over the content reads as broken, not native.
 *
 * The bar stays put the whole way down the page and only steps aside once the
 * footer block comes into view, where it would otherwise sit on top of the
 * newsletter field and the footer links. Watching the footer directly rather
 * than guessing from scroll position means it behaves the same on a short page
 * and a long one.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!BOTTOM_NAV.visible) return;

    const footer = document.getElementById("site-footer");
    // No footer on this page: stay visible. Failing towards "shown" keeps
    // navigation reachable either way.
    if (!footer) return;

    /*
     * An IntersectionObserver rather than a scroll handler: it is the API built
     * for this question, it costs nothing while the footer is far away, and it
     * keeps working when the layout shifts under you — images finishing loading,
     * a filter changing the page height — which a cached scroll measurement
     * would not.
     */
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      // The small negative margin means the bar clears out just before the
      // footer's top edge arrives, rather than overlapping it for a moment.
      { rootMargin: "0px 0px -24px 0px", threshold: 0 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  if (!BOTTOM_NAV.visible || BOTTOM_NAV.items.length === 0) return null;

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Keeps the fixed bar from covering the end of the page. */}
      <div className="h-24 md:hidden" aria-hidden />

      <nav
        aria-label="Quick navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-transform duration-300 ease-out md:hidden",
          // Clears the iOS home indicator without leaving a gap on Android.
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          hidden && "translate-y-[130%]"
        )}
      >
        <ul
          className={cn(
            "mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-2xl border border-line/80 bg-night-800/95 p-1.5",
            "shadow-[0_8px_30px_-6px_rgba(2,8,20,0.7)] backdrop-blur-xl supports-[backdrop-filter]:bg-night-800/80"
          )}
        >
          {BOTTOM_NAV.items.map((item, index) => {
            const active = isCurrent(item.href);
            // The reference raises the middle action as a floating aqua disc.
            const centred =
              BOTTOM_NAV.items.length >= 3 && index === Math.floor(BOTTOM_NAV.items.length / 2);

            if (centred) {
              return (
                <li key={item.href + item.label} className="min-w-0 flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="group -mt-6 flex flex-col items-center gap-1"
                  >
                    <span
                      className={cn(
                        "grid h-12 w-12 place-items-center rounded-full bg-aqua-500 text-white shadow-glow ring-4 ring-paper transition",
                        "group-hover:bg-aqua-400",
                        active && "bg-aqua-400"
                      )}
                    >
                      <Icon name={item.icon} strokeWidth={2} className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        "w-full truncate text-center text-[0.625rem] leading-none tracking-tight",
                        active ? "font-bold text-aqua-600" : "font-medium text-mist"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.href + item.label} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors duration-200",
                    active ? "text-aqua-600" : "text-mist hover:bg-snow/5"
                  )}
                >
                  <Icon
                    name={item.icon}
                    strokeWidth={active ? 2.25 : 1.75}
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      active ? "scale-110" : "group-hover:scale-105"
                    )}
                  />
                  <span
                    className={cn(
                      "w-full truncate text-center text-[0.625rem] leading-none tracking-tight",
                      active ? "font-bold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
