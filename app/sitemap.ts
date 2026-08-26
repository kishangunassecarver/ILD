import type { MetadataRoute } from "next";
import { DEALS, EVENTS, HUBS, LISTINGS, PAGES, POSTS } from "@/lib/cms";
import { SITE_URL } from "@/lib/site-url";

/**
 * Emitted as sitemap.xml at build time.
 *
 * Every URL here is a real static file in out/, so the sitemap and the export
 * cannot drift apart — both are generated from the same content.
 */
/** Metadata routes are route handlers, so a static export needs this spelled out. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => `${SITE_URL}${path}`;

  const marketing = [
    { path: "/", priority: 1 },
    { path: "/discover", priority: 0.9 },
    { path: "/events", priority: 0.9 },
    { path: "/deals", priority: 0.9 },
    { path: "/blog", priority: 0.7 },
    { path: "/list-your-business", priority: 0.8 },
    { path: "/about", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
    { path: "/help", priority: 0.4 },
    { path: "/join", priority: 0.6 },
    { path: "/rewards", priority: 0.5 },
    { path: "/terms", priority: 0.2 },
    { path: "/privacy", priority: 0.2 },
  ];

  return [
    ...marketing.map((page) => ({ url: at(page.path), priority: page.priority })),
    ...HUBS.map((hub) => ({ url: at(`/${hub.slug}`), priority: 0.9 })),
    ...LISTINGS.map((l) => ({ url: at(`/${l.hub}/${l.slug}`), priority: l.featured ? 0.8 : 0.7 })),
    ...EVENTS.map((e) => ({ url: at(`/events/${e.slug}`), priority: 0.7 })),
    ...DEALS.map((d) => ({ url: at(`/deals/${d.slug}`), priority: 0.6 })),
    ...POSTS.map((p) => ({ url: at(`/blog/${p.slug}`), lastModified: p.date, priority: 0.6 })),
    ...PAGES.map((p) => ({ url: at(`/${p.path}`), priority: 0.5 })),
  ];
}
