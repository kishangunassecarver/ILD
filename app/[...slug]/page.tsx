import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPage } from "@/components/pages/CmsPage";
import { PAGES, getPage } from "@/lib/cms";

/**
 * Catch-all for pages authored in WordPress.
 *
 * Next gives file-based routes priority over dynamic ones, so /events and
 * /eat-drink/the-cargo-hold still resolve to their own components — this only
 * ever handles paths nothing else claims. The plugin additionally refuses to
 * emit a page whose first path segment collides with a built-in route, so a
 * page called "Events" cannot quietly shadow the events hub.
 *
 * When no pages exist yet a sentinel param keeps the route valid: under
 * `output: export` a dynamic route that generates nothing fails the build.
 */
const NONE = "__no-pages";

export function generateStaticParams() {
  if (PAGES.length === 0) return [{ slug: [NONE] }];
  return PAGES.map((page) => ({ slug: page.path.split("/") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug.join("/"));
  if (!page) return {};
  return { title: page.title, description: page.excerpt };
}

export default async function CatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = getPage(slug.join("/"));
  if (!page) notFound();

  return <CmsPage page={page} />;
}
