import type { Metadata } from "next";
import "./globals.css";
import { MemberProvider } from "@/components/account/MemberProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Newsletter } from "@/components/layout/Newsletter";
import { QuickActions } from "@/components/layout/QuickActions";
import { SiteBanner } from "@/components/layout/SiteBanner";
import { SITE } from "@/lib/cms";
import { IS_PREVIEW, SITE_URL } from "@/lib/site-url";

/**
 * Metadata is deliberately not editable from WordPress — it is SEO
 * configuration rather than page copy. See WORDPRESS-CMS.md.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    locale: "en_ZA",
  },
  twitter: { card: "summary_large_image" },
  // Preview builds carry noindex as well as the robots.txt block, so a crawler
  // that reached a page directly still will not index it.
  robots: IS_PREVIEW ? { index: false, follow: false } : { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lift"
        >
          Skip to content
        </a>

        <MemberProvider>
          <Header />
          <SiteBanner />
          <QuickActions />

        <main id="main" className="flex-1">
          {children}
        </main>

        {/* Wrapped so the floating bottom nav can watch for this whole block
            and step aside once any of it is on screen — the newsletter's email
            field sits right where the bar would otherwise cover it. */}
        <div id="site-footer">
          <Newsletter />
          <Footer />
        </div>

          <BottomNav />
        </MemberProvider>
      </body>
    </html>
  );
}
