import type { MetadataRoute } from "next";
import { IS_PREVIEW, SITE_URL } from "@/lib/site-url";

/** Metadata routes are route handlers, so a static export needs this spelled out. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // A preview deployment must not be crawled at all: indexing it would put the
  // same content on two domains and leave the staging copy competing with the
  // real one. No sitemap is advertised either.
  if (IS_PREVIEW) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personal and query-driven pages: nothing for an index to hold on to.
        disallow: ["/search", "/saved"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
