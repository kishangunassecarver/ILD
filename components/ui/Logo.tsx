import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Typographic lockup standing in for the supplied logo artwork.
 *
 * Swap the inner markup for an <Image> when the brand SVG lands — every
 * placement in the site goes through this component, so it is a one-file change.
 */
export function Logo({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const onDark = tone === "dark";

  return (
    <Link
      href="/"
      className={cn("group inline-flex flex-col leading-none", className)}
      aria-label="I Love Durban — home"
    >
      <span className="flex items-baseline gap-[0.15em] font-display text-[1.75rem] tracking-[0.01em] sm:text-[2rem]">
        <span className={onDark ? "text-white" : "text-ink"}>I</span>
        <Heart
          className="h-[0.85em] w-[0.85em] translate-y-[0.06em] fill-brand-500 text-brand-500 transition-transform duration-300 group-hover:scale-110"
          aria-hidden
        />
        <span className={onDark ? "text-white" : "text-ink"}>DURBAN</span>
      </span>
      <span
        className={cn(
          "mt-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.18em]",
          onDark ? "text-white/60" : "text-muted"
        )}
      >
        The Heartbeat of Our City
      </span>
    </Link>
  );
}
