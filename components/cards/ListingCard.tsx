import Link from "next/link";
import { MapPin } from "lucide-react";
import { Rating } from "@/components/ui/Rating";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The workhorse card — used in home-page rails, hub grids and related lists.
 *
 * `compact` is the rail variant from the mock-up: fixed width, shorter art.
 * The default variant fills its grid cell.
 */
export function ListingCard({
  listing,
  fallbackCta,
  compact = false,
  className,
}: {
  listing: Listing;
  /** Hub-level default when the listing has no CTA of its own. */
  fallbackCta?: string;
  compact?: boolean;
  className?: string;
}) {
  const href = `/${listing.hub}/${listing.slug}`;
  const cta = listing.cta ?? fallbackCta;

  return (
    <article
      className={cn(
        "panel card-hover group flex flex-col overflow-hidden",
        compact && "w-[15.5rem]",
        className
      )}
    >
      <Link href={href} className="block focus-visible:ring-inset" tabIndex={-1} aria-hidden>
        <Tile
          seed={listing.slug}
          image={listing.image}
          className={compact ? "h-[7.5rem]" : "h-44 sm:h-48"}
        >
          {listing.featured && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-white/95 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-ink shadow-rail">
              Featured
            </span>
          )}
        </Tile>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-snug text-ink">
            <Link href={href} className="transition hover:text-brand-500">
              {listing.name}
            </Link>
          </h3>
          <SaveButton label={listing.name} className="-mr-1 -mt-0.5 shrink-0" />
        </div>

        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {listing.area}
        </p>

        {!compact && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{listing.blurb}</p>
        )}

        <Rating
          rating={listing.rating}
          reviews={listing.reviews}
          price={listing.price}
          className="mt-auto"
        />

        {cta && (
          <Link
            href={href}
            className="btn-ghost mt-1 w-full py-2 text-xs group-hover:border-brand-200 group-hover:text-brand-600"
          >
            {cta}
          </Link>
        )}
      </div>
    </article>
  );
}
