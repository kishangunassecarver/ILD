import type { Metadata } from "next";
import { ListingDetail } from "@/components/hub/ListingDetail";
import { getListing, listingsIn } from "@/lib/cms";

const HUB = "eat-drink" as const;

/** One static page per listing — the export has no server to resolve slugs. */
export function generateStaticParams() {
  return listingsIn(HUB).map((listing) => ({ slug: listing.slug }));
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
  return <ListingDetail hub={HUB} slug={slug} />;
}
