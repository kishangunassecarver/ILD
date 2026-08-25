import type { Metadata } from "next";
import { ListingDetail } from "@/components/hub/ListingDetail";
import { getListing, listingsIn } from "@/lib/cms";

const HUB = "services" as const;

/**
 * Sentinel slug for a hub with nothing published in it.
 *
 * Under `output: export` a dynamic route whose generateStaticParams returns an
 * empty array fails the build outright — "missing generateStaticParams()". So a
 * hub the editors have not populated yet would take down the entire site rather
 * than simply showing an empty hub page. Emitting one throwaway param keeps the
 * route valid; the page 404s for it and nothing ever links to it.
 */
const NONE = "__no-listings";

/** One static page per listing — the export has no server to resolve slugs. */
export function generateStaticParams() {
  const listings = listingsIn(HUB);
  return listings.length ? listings.map((listing) => ({ slug: listing.slug })) : [{ slug: NONE }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = getListing(HUB, slug);
  if (!listing) return {};
  return {
    title: `${listing.name} · ${listing.area}`,
    description: listing.blurb,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // ListingDetail calls notFound() for anything it cannot resolve, which covers
  // the sentinel above without needing a special case here.
  return <ListingDetail hub={HUB} slug={slug} />;
}
