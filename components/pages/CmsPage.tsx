import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Rating } from "@/components/ui/Rating";
import { Tile } from "@/components/ui/Tile";
import { getHub, pageSection, spotlightListings } from "@/lib/cms";
import type { Page } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renders a page authored in WordPress, in one of two shapes.
 *
 * A **section page** — one with children — is an index: a full-width grid of its
 * articles, with the heading aligned to that grid. It previously used the narrow
 * centred prose column, which left the title floating in from the left edge
 * while the grid beneath it ran full width.
 *
 * An **article** gets its section's other articles down the left and popular
 * listings down the right, so a reader can move around the section without
 * going back to the menu.
 *
 * TRUST BOUNDARY: `page.html` is WordPress's own rendered output and is injected
 * as HTML. That is the only way an editor gets headings, lists and links out of
 * the block editor, but it means anyone who can publish a page can put arbitrary
 * markup on the site. It is baked in at build time, so it is exactly as
 * trustworthy as the people with publish rights in your WordPress — keep that
 * list short and two-factored.
 */

/** Prose styles, hand-written so page content matches the site's type scale. */
const PROSE = [
  "text-[0.9375rem] leading-relaxed text-muted",
  "[&_p]:mt-4",
  "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink",
  "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
  "[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline [&_a]:decoration-brand-200 [&_a]:underline-offset-2 hover:[&_a]:text-brand-700",
  "[&_strong]:font-bold [&_strong]:text-ink",
  "[&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-200 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_img]:mt-6 [&_img]:rounded-card",
  "[&_figure]:mt-6 [&_figcaption]:mt-2 [&_figcaption]:text-xs",
  "[&_table]:mt-4 [&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-line [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-ink",
  "[&_td]:border-b [&_td]:border-line [&_td]:py-2",
  "[&_hr]:my-8 [&_hr]:border-line",
].join(" ");

export function CmsPage({ page }: { page: Page }) {
  const crumbs = page.path.split("/");
  const isSection = Boolean(page.children?.length);
  const { section, siblings } = pageSection(page.path);

  const trail = [
    { label: "Home", href: "/" },
    ...crumbs.slice(0, -1).map((segment, i) => ({
      // Use the section's real title where we have it, rather than its slug.
      label: i === 0 && section ? section.title : segment.replace(/-/g, " "),
      href: `/${crumbs.slice(0, i + 1).join("/")}`,
    })),
    { label: page.title },
  ];

  return (
    <div className="shell py-6">
      <Breadcrumbs trail={trail} />

      {isSection ? (
        <>
          <header className="mb-6 max-w-3xl">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              {page.title}
            </h1>
          </header>

          {page.image && (
            <Tile seed={page.path} image={page.image} alt="" className="mb-8 h-48 rounded-card sm:h-64" />
          )}

          {page.html && <div className={cn("mb-10 max-w-3xl", PROSE)} dangerouslySetInnerHTML={{ __html: page.html }} />}

          <SectionIndex page={page} />
        </>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
          {siblings.length > 1 && section ? (
            <SectionNav section={section} siblings={siblings} currentPath={page.path} />
          ) : (
            <div className="hidden lg:block" />
          )}

          <article className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              {page.title}
            </h1>

            {page.image && (
              <Tile seed={page.path} image={page.image} alt="" className="mt-6 h-56 rounded-card sm:h-72" />
            )}

            <div className={cn("mt-6", PROSE)} dangerouslySetInnerHTML={{ __html: page.html }} />
          </article>

          <PopularListings />
        </div>
      )}
    </div>
  );
}

/** The section's other articles, as a nested menu down the side. */
function SectionNav({
  section,
  siblings,
  currentPath,
}: {
  section: Page;
  siblings: Page[];
  currentPath: string;
}) {
  return (
    <nav
      aria-label={`${section.title} articles`}
      className="hidden lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:block"
    >
      <Link
        href={`/${section.path}`}
        className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-brand-500 transition hover:text-brand-600"
      >
        <MapPin className="h-3 w-3" aria-hidden />
        {section.title}
      </Link>

      {/* Capped so a 34-article section does not run past the viewport; the
          section page itself carries the complete list. */}
      <ul className="mt-3 max-h-[70vh] space-y-0.5 overflow-y-auto border-l border-line pl-3">
        {siblings.map((item) => {
          const current = item.path === currentPath;

          return (
            <li key={item.path}>
              <Link
                href={`/${item.path}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-ml-3 block border-l-2 py-1.5 pl-3 pr-1 text-xs leading-snug transition",
                  current
                    ? "border-brand-500 font-bold text-brand-600"
                    : "border-transparent text-muted hover:border-line hover:text-ink"
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Directory listings alongside an article, so the page leads somewhere. */
function PopularListings() {
  const listings = spotlightListings(5);
  if (listings.length === 0) return null;

  return (
    <aside
      aria-labelledby="popular-listings"
      className="xl:sticky xl:top-[calc(var(--header-h)+1.5rem)]"
    >
      <div className="panel p-4">
        <h2 id="popular-listings" className="text-sm font-bold text-ink">
          Popular in Durban
        </h2>

        <ul className="mt-3 space-y-3">
          {listings.map((listing) => (
            <li key={`${listing.hub}-${listing.slug}`}>
              <Link
                href={`/${listing.hub}/${listing.slug}`}
                className="group flex items-start gap-3"
              >
                <Tile
                  seed={listing.slug}
                  image={listing.image}
                  className="h-14 w-16 shrink-0 rounded-lg"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-ink transition group-hover:text-brand-500">
                    {listing.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">
                    {getHub(listing.hub)?.label}
                    {listing.area ? ` · ${listing.area}` : ""}
                  </span>
                  <Rating rating={listing.rating} reviews={listing.reviews} className="mt-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/discover" className="link-more mt-4 text-xs">
          Explore Durban
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

/** The grid of articles on a section page. */
function SectionIndex({ page }: { page: Page }) {
  if (!page.children?.length) return null;

  return (
    <section aria-labelledby="section-index">
      <h2 id="section-index" className="section-title mb-4">
        {page.children.length} to explore in {page.title}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {page.children.map((child) => (
          <Link
            key={child.path}
            href={`/${child.path}`}
            className="panel card-hover group flex flex-col overflow-hidden"
          >
            <Tile seed={child.path} image={child.image} className="h-32" />
            <div className="flex flex-1 flex-col p-3.5">
              <h3 className="text-sm font-bold leading-snug text-ink transition group-hover:text-brand-500">
                {child.title}
              </h3>
              {child.excerpt && (
                <p className="line-clamp-2 mt-1.5 text-xs leading-relaxed text-muted">
                  {child.excerpt}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
