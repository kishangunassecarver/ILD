import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Globe, MapPin, Phone, Tag } from "lucide-react";
import { ListingCard } from "@/components/cards/ListingCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { Rating } from "@/components/ui/Rating";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import { getHub, getListing, relatedListings } from "@/lib/cms";
import type { HubSlug } from "@/lib/types";

export function ListingDetail({ hub: hubSlug, slug }: { hub: HubSlug; slug: string }) {
  const hub = getHub(hubSlug);
  const listing = getListing(hubSlug, slug);
  if (!hub || !listing) notFound();

  const related = relatedListings(listing, 3);
  const cta = listing.cta ?? hub.defaultCta;

  return (
    <article className="shell py-6">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          { label: hub.label, href: `/${hub.slug}` },
          { label: listing.name },
        ]}
      />

      <Tile
        seed={listing.slug}
        image={listing.image}
        alt={listing.name}
        className="mb-6 h-56 rounded-card sm:h-72"
      >
        <SaveButton
          label={listing.name}
          slug={listing.slug}
          variant="chip"
          className="absolute right-3 top-3"
        />
        {listing.featured && (
          <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink shadow-rail">
            Featured
          </span>
        )}
        {listing.imageCredit && (
          <p className="absolute bottom-1.5 right-3 text-[0.625rem] text-white/60">
            {listing.imageCredit}
          </p>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          {listing.category && (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/75">
              {listing.category}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {listing.name}
          </h1>
        </div>
      </Tile>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Rating rating={listing.rating} reviews={listing.reviews} price={listing.price} />
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {listing.area}
              </p>
            </div>

            <p className="mt-3 text-sm font-medium leading-relaxed text-ink-700">{listing.blurb}</p>

            {listing.body?.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-3 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}

            {listing.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {listing.tags.map((tag) => (
                  <li key={tag} className="chip pointer-events-none gap-1">
                    <Tag className="h-3 w-3" aria-hidden />
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {listing.amenities && listing.amenities.length > 0 && (
            <section className="panel p-5">
              <h2 className="text-sm font-bold text-ink">Good to know</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2 text-xs text-muted">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50">
                      <Check className="h-2.5 w-2.5 text-brand-500" aria-hidden />
                    </span>
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <h2 className="section-title mb-4">More in {hub.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((item) => (
                  <ListingCard key={item.slug} listing={item} fallbackCta={hub.defaultCta} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          {listing.googleRating ? (
            <section className="panel p-5">
              <GoogleRating
                rating={listing.googleRating}
                reviews={listing.googleReviews}
                url={listing.googleUrl}
              />
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="text-sm font-bold text-ink">Visit</h2>

            <dl className="mt-3 space-y-3 text-xs">
              {listing.address && (
                <div className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="sr-only">Address</dt>
                    <dd className="leading-relaxed text-ink-700">{listing.address}</dd>
                  </div>
                </div>
              )}

              {listing.phone && (
                <div className="flex gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="sr-only">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${listing.phone.replace(/\s/g, "")}`}
                        className="text-ink-700 hover:text-brand-500"
                      >
                        {listing.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {listing.website && (
                <div className="flex gap-2.5">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="sr-only">Website</dt>
                    <dd>
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-ink-700 hover:text-brand-500"
                      >
                        {listing.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {listing.hours && listing.hours.length > 0 && (
                <div className="flex gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="sr-only">Opening hours</dt>
                    {listing.hours.map((line) => (
                      <dd key={line} className="leading-relaxed text-ink-700">
                        {line}
                      </dd>
                    ))}
                  </div>
                </div>
              )}
            </dl>

            <button type="button" className="btn-primary mt-4 w-full">
              {cta}
            </button>
            <p className="mt-2 text-center text-[0.625rem] text-muted">
              Bookings open in the I Love Durban app.
            </p>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-bold text-ink">Is this your business?</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Claim this listing to update your details, hours and description yourself.
            </p>
            <Link
              href={`/my-business/?claim=${listing.slug}`}
              className="btn-ghost mt-3 w-full py-2 text-xs"
            >
              Claim this listing
            </Link>
          </section>
        </aside>
      </div>
    </article>
  );
}
