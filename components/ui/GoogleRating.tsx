import { ArrowUpRight, Star } from "lucide-react";
import { groupNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Google rating block.
 *
 * Kept visually distinct from the site's own `Rating`, and always attributed
 * and linked back to Google — a rating sourced from somewhere else has to say
 * whose it is, and give the reader a way to check it.
 *
 * The stars fill proportionally rather than rounding, so 4.6 reads as 4.6.
 */
export function GoogleRating({
  rating,
  reviews,
  url,
  className,
}: {
  rating: number;
  reviews?: number;
  url?: string;
  className?: string;
}) {
  if (!(rating > 0)) return null;

  const percent = Math.max(0, Math.min(100, (rating / 5) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-ink-700">
        Google rating
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Outline row underneath, a clipped filled row on top. */}
        <span className="relative inline-flex" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
          <span className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-[1.1rem] w-[1.1rem] text-gold" strokeWidth={1.5} aria-hidden />
            ))}
          </span>

          <span
            className="pointer-events-none absolute inset-0 flex gap-0.5 overflow-hidden"
            style={{ width: `${percent}%` }}
            aria-hidden
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className="h-[1.1rem] w-[1.1rem] shrink-0 fill-gold text-gold"
                strokeWidth={1.5}
              />
            ))}
          </span>
        </span>

        <span className="text-base font-bold leading-none text-ink">{rating.toFixed(1)}</span>

        {typeof reviews === "number" && reviews > 0 && (
          <span className="text-sm text-muted">{groupNumber(reviews)} Google reviews</span>
        )}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
        >
          See reviews on Google
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      )}
    </div>
  );
}
