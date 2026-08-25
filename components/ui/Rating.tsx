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
