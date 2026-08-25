"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { BOTTOM_NAV } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * Floating bottom navigation.
 *
 * Below `lg` only — the desktop header already carries the full mega menu, and
 * a second persistent nav there would duplicate it and cover content.
 *
 * It hides itself while the page is scrolling down and comes back on the way
 * up, which is the convention people expect from a bar that sits over content:
 * it stays out of the way while you are reading and is there the moment you
 * look for it.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (!BOTTOM_NAV.visible) return;

    lastY.current = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      // Coalesce to one measurement per frame; scroll fires far more often.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY.current;

        // Ignore small jitter, and never hide near the top of the page.
        if (Math.abs(delta) > 6 && y > 120) setHidden(delta > 0);
        else if (y <= 120) setHidden(false);

        lastY.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!BOTTOM_NAV.visible || BOTTOM_NAV.items.length === 0) return null;

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Keeps the fixed bar from covering the end of the page. */}
      <div className="h-24 lg:hidden" aria-hidden />

      <nav
        aria-label="Quick navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-transform duration-300 ease-out lg:hidden",
          // Clears the iOS home indicator without leaving a gap on Android.
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          hidden && "translate-y-[130%]"
        )}
      >
        <ul
          className={cn(
            "mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-2xl border border-line/80 bg-white/90 p-1.5",
            "shadow-[0_8px_30px_-6px_rgba(10,26,51,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
          )}
        >
          {BOTTOM_NAV.items.map((item) => {
            const active = isCurrent(item.href);

            return (
              <li key={item.href + item.label} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors duration-200",
                    active ? "bg-brand-50 text-brand-600" : "text-ink-600 hover:bg-paper"
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
