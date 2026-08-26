import { Star } from "lucide-react";
import { groupNumber } from "@/lib/utils";

/** Rating line used on every listing card and detail header. */
export function Rating({
  rating,
  reviews,
  price,
  className,
}: {
  rating: number;
  reviews?: number;
  price?: string;
  className?: string;
}) {
  // Ratings are out of five, so clamp: an editor typing 6 was showing "6.0"
  // next to a single star, which reads as broken rather than enthusiastic.
  rating = Math.min(5, rating);

  // A listing with no rating yet — a new business, or one nobody has reviewed —
  // should show nothing rather than a damning "0.0 (0)".
  if (!(rating > 0)) {
    if (!price) return null;
    return (
      <div className={className}>
        <span className="text-xs font-medium text-muted">{price}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <span className="inline-flex items-center gap-1 text-xs">
        <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
        <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
        {typeof reviews === "number" && (
          <span className="text-muted">({groupNumber(reviews)})</span>
        )}
        {price && <span className="ml-1 font-medium text-muted">{price}</span>}
      </span>
      <span className="sr-only">
        {rating.toFixed(1)} out of 5
        {typeof reviews === "number" ? ` from ${groupNumber(reviews)} reviews` : ""}
      </span>
    </div>
  );
}
