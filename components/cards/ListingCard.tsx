import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Rating } from "@/components/ui/Rating";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The workhorse card, matching the app reference: a horizontal row — photo
 * inset on the left with its own rounded corners, content on the right.
 * White title, aqua identity line with a verified check, stacked meta rows,
 * and the coral "Verified Employer" pill treatment for featured placements.
 *
 * `compact` is the rail variant: fixed width, vertical, photo on top.
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

  if (compact) {
    return (
      <article className={cn("panel card-hover group flex w-[15.5rem] flex-col p-2.5", className)}>
        <Link href={href} tabIndex={-1} aria-hidden>
          <Tile seed={listing.slug} image={listing.image} className="h-[7.5rem] rounded-2xl" />
        </Link>

        <div className="flex flex-1 flex-col gap-1.5 p-1.5 pt-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-sm font-bold leading-snug text-snow">
              <Link href={href} className="transition hover:text-aqua-300">
                {listing.name}
              </Link>
            </h3>
            <SaveButton
              label={listing.name}
              slug={listing.slug}
              className="-mr-1 -mt-0.5 shrink-0"
            />
          </div>

          <IdentityLine listing={listing} />
          <Rating rating={listing.rating} reviews={listing.reviews} price={listing.price} />

          <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-mist/90">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{listing.area}</span>
          </p>

          {cta && (
            <Link href={href} className="btn-ghost mt-1.5 w-full py-1.5 text-xs">
              {cta}
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={cn("panel card-hover group flex gap-3.5 p-3", className)}>
      <Link href={href} tabIndex={-1} aria-hidden className="shrink-0 self-stretch">
        <Tile
          seed={listing.slug}
          image={listing.image}
          className="h-full min-h-[11rem] w-[7.5rem] rounded-2xl sm:w-[8.75rem]"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[1.0625rem] font-bold leading-snug tracking-tight text-snow">
            <Link href={href} className="transition hover:text-aqua-300">
              {listing.name}
            </Link>
          </h3>
          <SaveButton label={listing.name} slug={listing.slug} className="-mr-0.5 shrink-0" />
        </div>

        <IdentityLine listing={listing} className="mt-1" />

        <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-mist/90">
          {listing.blurb}
        </p>

        {/* Stacked meta rows, one fact per line, exactly as the reference. */}
        <div className="mt-auto space-y-2 pt-3">
          <Rating
            rating={listing.rating}
            reviews={listing.reviews}
            price={listing.price}
            emphasis
          />

          <p className="flex items-center gap-2 text-xs text-mist/90">
            <MapPin className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            {/* The area alone — appending ", Durban" reads wrong for entries
                like "Durban CBD" or the North Coast towns. */}
            <span className="truncate">{listing.area}</span>
          </p>

          <div className="flex items-center justify-between gap-2">
            {cta ? (
              <Link
                href={href}
                className="shrink-0 rounded-pill border border-snow/25 px-3.5 py-1.5 text-[0.6875rem] font-semibold text-snow transition hover:border-aqua-400/70 hover:text-aqua-200"
              >
                {cta}
              </Link>
            ) : (
              <span />
            )}

            {listing.featured && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-coral-500 py-1.5 pl-2 pr-3 text-[0.6875rem] font-bold text-white shadow-rail">
                <BadgeCheck className="h-3.5 w-3.5 fill-white text-coral-500" aria-hidden />
                Featured
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** The aqua line under the title — category + verified check, as in the reference. */
function IdentityLine({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[0.8125rem] font-semibold text-aqua-300",
        className
      )}
    >
      <span className="truncate">{listing.category}</span>
      <BadgeCheck className="h-4 w-4 shrink-0 fill-aqua-400 text-white" aria-hidden />
    </p>
  );
}
