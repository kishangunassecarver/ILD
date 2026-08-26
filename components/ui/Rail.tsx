"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal carousel built on native scroll-snap.
 *
 * The arrows are progressive enhancement — with JS off, or on touch, the rail
 * is still a perfectly good swipeable scroller. Arrows hide when there is
 * nothing further to scroll to in that direction.
 */
export function Rail({ children, className }: { children: React.ReactNode; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // 2px of slack absorbs sub-pixel rounding at fractional zoom levels.
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  /** Scroll by one card, inferred from the first child's width. */
  const nudge = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={track} className="rail" onScroll={measure}>
        {children}
      </div>

      <RailButton side="left" hidden={atStart} onClick={() => nudge(-1)} />
      <RailButton side="right" hidden={atEnd} onClick={() => nudge(1)} />
    </div>
  );
}

function RailButton({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  const Chevron = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      // Kept in the DOM but inert at the ends so focus order never jumps around.
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      className={cn(
        "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-night-700 text-snow shadow-rail transition hover:border-aqua-500/50 hover:text-aqua-300 sm:grid",
        side === "left" ? "-left-3" : "-right-3",
        hidden && "pointer-events-none opacity-0"
      )}
    >
      <Chevron className="h-5 w-5" aria-hidden />
    </button>
  );
}
