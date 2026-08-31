import Link from "next/link";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { Rating } from "@/components/ui/Rating";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import { getHub, spotlightListings } from "@/lib/cms";

/**
 * The home page's directory shopfront.
 *
 * Deliberately not another rail: this is the section that answers "what
 * businesses are on this site", so it gets a grid and larger cards than the
 * events and top-picks carousels.
 *
 * The cards carry their hub label, because unlike every other listing grid on
 * the site these span all five hubs at once and "Umhlanga" alone does not tell
 * you whether you are looking at a restaurant or a plumber.
 */
export function FeaturedBusinesses() {
  // Six, not eight: the grid is three across, and a ragged final row of two
  // reads as a mistake rather than a selection.
  const listings = spotlightListings(6);
  if (listings.length === 0) return null;

  const anyFeatured = listings.some((l) => l.featured);

  return (
    <section aria-labelledby="featured-businesses">
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="max-w-2xl">
          <h2 id="featured-businesses" className="section-title">
            Businesses to know in Durban
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {anyFeatured
              ? "Featured placements from businesses that partner with us, alongside the best-rated of everything else on the platform."
              : "The best-rated businesses across every category on the platform."}
          </p>
        </div>

        <Link href="/services" className="link-more ml-auto">
          Browse all businesses
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => {
          const hub = getHub(listing.hub);
          const href = `/${listing.hub}/${listing.slug}`;

          return (
            <article
              key={`${listing.hub}-${listing.slug}`}
              className="panel card-hover group flex flex-col overflow-hidden p-2.5"
            >
              <Link href={href} tabIndex={-1} aria-hidden className="block">
                <Tile
                  seed={listing.slug}
                  image={listing.image}
                  className="h-52 rounded-2xl sm:h-56"
                >
                  {listing.featured && (
                    <span className="absolute left-2.5 top-2.5 rounded-pill bg-coral-500 px-2.5 py-1 text-[0.625rem] font-bold text-white shadow-rail">
                      Featured
                    </span>
                  )}
                </Tile>
              </Link>

              <div className="flex flex-1 flex-col gap-2 p-2.5 pt-3.5">
                {/* One line, always. The hub label is the part that must survive,
                    so the category truncates rather than wrapping and making
                    card heights ragged across a row. */}
                <p className="flex items-center gap-1.5 overflow-hidden text-[0.625rem] font-bold uppercase tracking-[0.12em] text-aqua-600">
                  <Store className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="shrink-0">{hub?.label ?? "Durban"}</span>
                  {listing.category && (
                    <span className="truncate text-muted">· {listing.category}</span>
                  )}
                </p>

                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold leading-snug text-snow">
                    <Link href={href} className="transition hover:text-aqua-600">
                      {listing.name}
                    </Link>
                  </h3>
                  <SaveButton
                    label={listing.name}
                    slug={listing.slug}
                    className="-mr-1 -mt-0.5 shrink-0"
                  />
                </div>

                {listing.area && (
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {listing.area}
                  </p>
                )}

                {listing.blurb && (
                  <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
                    {listing.blurb}
                  </p>
                )}

                <Rating
                  rating={listing.rating}
                  reviews={listing.reviews}
                  price={listing.price}
                  className="mt-auto pt-1"
                />

                <Link
                  href={href}
                  className="btn-ghost w-full py-2 text-xs group-hover:border-aqua-500/40 group-hover:text-aqua-500"
                >
                  {listing.cta ?? hub?.defaultCta ?? "View"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
