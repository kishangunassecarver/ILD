import type { MetadataRoute } from "next";
import { SITE } from "@/lib/cms";

/** Metadata routes are route handlers, so a static export needs this spelled out. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personal and query-driven pages: nothing for an index to hold on to.
        disallow: ["/search", "/saved"],
      },
    ],
    sitemap: `${SITE.url.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
