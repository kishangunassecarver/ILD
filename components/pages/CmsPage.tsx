import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Compass } from "lucide-react";
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
 * articles, with the heading aligned to that grid.
 *
 * An **article** sits in its own card, with the section's other articles down
 * the left and popular listings down the right, so a reader can move around
 * without going back to the menu.
 *
 * TRUST BOUNDARY: `page.html` is WordPress's own rendered output and is injected
 * as HTML. That is the only way an editor gets headings, lists and links out of
 * the block editor, but it means anyone who can publish a page can put arbitrary
 * markup on the site. It is baked in at build time, so it is exactly as
 * trustworthy as the people with publish rights in your WordPress.
 */

/**
 * Prose styles, hand-written so page content matches the site's type scale.
 *
 * Deliberately larger and darker than the site's supporting copy: this is the
 * one place on the site people come to *read*, and 12px grey is for card
 * captions, not four paragraphs about a museum.
 */
const PROSE = [
  "text-[1.0625rem] leading-[1.75] text-mist",
  "[&>*:first-child]:mt-0",
  "[&_p]:mt-5",
  "[&_h2]:mt-10 [&_h2]:text-[1.375rem] [&_h2]:font-extrabold [&_h2]:leading-snug [&_h2]:tracking-tight [&_h2]:text-snow",
  "[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-snow",
  "[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
  "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
  "[&_a]:font-semibold [&_a]:text-aqua-300 [&_a]:decoration-brand-200 [&_a]:decoration-2 [&_a]:underline-offset-[3px] [&_a]:underline hover:[&_a]:decoration-brand-500",
  "[&_strong]:font-bold [&_strong]:text-snow",
  "[&_blockquote]:mt-6 [&_blockquote]:border-l-[3px] [&_blockquote]:border-brand-500 [&_blockquote]:bg-paper [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-snow [&_blockquote]:rounded-r-lg [&_blockquote]:not-italic",
  "[&_img]:mt-6 [&_img]:rounded-card",
  "[&_figure]:mt-6 [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:text-muted",
  "[&_table]:mt-6 [&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-line [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-snow",
  "[&_td]:border-b [&_td]:border-line [&_td]:py-2.5",
  "[&_hr]:my-10 [&_hr]:border-line",
].join(" ");

export function CmsPage({ page }: { page: Page }) {
  const isSection = Boolean(page.children?.length);
  const { section, siblings } = pageSection(page.path);

  const crumbs = page.path.split("/");
  const trail = [
    { label: "Home", href: "/" },
    ...crumbs.slice(0, -1).map((segment, i) => ({
      // Use the section's real title where we have it, rather than its slug.
      label: i === 0 && section ? section.title : segment.replace(/-/g, " "),
      href: `/${crumbs.slice(0, i + 1).join("/")}`,
    })),
    { label: page.title },
  ];

  if (isSection) return <SectionPage page={page} trail={trail} />;

  const index = siblings.findIndex((s) => s.path === page.path);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

  return (
    <div className="shell py-6">
      <Breadcrumbs trail={trail} />

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        {siblings.length > 1 && section ? (
          <SectionNav section={section} siblings={siblings} currentPath={page.path} />
        ) : (
          <div className="hidden lg:block" />
        )}

        <div className="min-w-0">
          <article className="panel overflow-hidden">
            {/* Full-bleed to the card's edges, which reads as one object rather
                than a picture sitting inside a box inside the page. */}
            {page.image && (
              <Tile seed={page.path} image={page.image} alt="" className="h-56 sm:h-80" />
            )}

            <div className="p-6 sm:p-9">
              {section && (
                <Link
                  href={`/${section.path}`}
                  className="inline-flex items-center gap-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-aqua-300 transition hover:text-aqua-200"
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden />
                  {section.title}
                </Link>
              )}

              <h1 className="mt-3 text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-snow sm:text-[2.5rem]">
                {page.title}
              </h1>

              <div className="mt-6 h-px bg-line" aria-hidden />

              <div
                className={cn("mt-6 max-w-[68ch]", PROSE)}
                dangerouslySetInnerHTML={{ __html: page.html }}
              />
            </div>
          </article>

          {(previous || next) && <PrevNext previous={previous} next={next} />}
        </div>

        <PopularListings />
      </div>
    </div>
  );
}

function SectionPage({ page, trail }: { page: Page; trail: { label: string; href?: string }[] }) {
  return (
    <div className="shell py-6">
      <Breadcrumbs trail={trail} />

      <header className="relative mb-8 overflow-hidden rounded-card">
        <Tile seed={page.path} image={page.image} alt="" className="h-44 sm:h-60">
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.16em] text-white/75">
              Attractions
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              {page.title}
            </h1>
          </div>
        </Tile>
      </header>

      {page.html && (
        <div
          className={cn("mb-10 max-w-[68ch]", PROSE)}
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      )}

      <SectionIndex page={page} />
    </div>
  );
}

/** The list of a section's articles, shared by both presentations below. */
function SectionLinks({
  siblings,
  currentPath,
  className,
}: {
  siblings: Page[];
  currentPath: string;
  className?: string;
}) {
  return (
    <ul className={cn("overflow-y-auto p-2", className)}>
      {siblings.map((item) => {
        const current = item.path === currentPath;

        return (
          <li key={item.path}>
            <Link
              href={`/${item.path}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2 text-xs leading-snug transition",
                current
                  ? "bg-aqua-500 font-bold text-white"
                  : "font-medium text-mist hover:bg-white/5 hover:text-snow"
              )}
            >
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The section's other articles.
 *
 * Two presentations of the same list. On a wide screen it is a sticky card
 * beside the article. On a phone there is no column to put it in, so it becomes
 * a collapsed disclosure above the article — one line closed, so it costs almost
 * nothing before you read, and no JavaScript to open.
 *
 * The markup is duplicated rather than switched at runtime: a couple of
 * kilobytes of links is a cheaper trade than shipping a media-query listener to
 * decide which to render.
 */
function SectionNav({
  section,
  siblings,
  currentPath,
}: {
  section: Page;
  siblings: Page[];
  currentPath: string;
}) {
  const heading = (
    <Link
      href={`/${section.path}`}
      className="group flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-3 transition hover:bg-aqua-400/10"
    >
      <span className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-snow">
        {section.title}
      </span>
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover:text-aqua-300"
        aria-hidden
      />
    </Link>
  );

  return (
    <>
      <details className="panel group overflow-hidden lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none">
          <span className="text-xs font-bold text-snow">
            More in {section.title}
            <span className="ml-1.5 font-medium text-muted">({siblings.length})</span>
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <nav aria-label={`${section.title} articles`} className="border-t border-line">
          {heading}
          <SectionLinks siblings={siblings} currentPath={currentPath} className="max-h-[60vh]" />
        </nav>
      </details>

      <nav
        aria-label={`${section.title} articles`}
        className="panel hidden overflow-hidden lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:block"
      >
        {heading}
        {/* Capped so a 34-article section cannot run past the viewport; the
            section page itself carries the complete list. */}
        <SectionLinks siblings={siblings} currentPath={currentPath} className="max-h-[60vh]" />
      </nav>
    </>
  );
}

/** Where to go next within the section, rather than dead-ending the article. */
function PrevNext({ previous, next }: { previous?: Page; next?: Page }) {
  return (
    <nav aria-label="More in this section" className="mt-4 grid gap-4 sm:grid-cols-2">
      {previous ? (
        <Link
          href={`/${previous.path}`}
          className="panel card-hover group flex items-center gap-3 p-4"
        >
          <ArrowLeft
            className="h-4 w-4 shrink-0 text-muted transition group-hover:text-aqua-300"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-muted">
              Previous
            </span>
            <span className="mt-0.5 block truncate text-sm font-bold text-snow transition group-hover:text-aqua-300">
              {previous.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}

      {next && (
        <Link
          href={`/${next.path}`}
          className="panel card-hover group flex items-center justify-end gap-3 p-4 text-right"
        >
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-muted">
              Next
            </span>
            <span className="mt-0.5 block truncate text-sm font-bold text-snow transition group-hover:text-aqua-300">
              {next.title}
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted transition group-hover:text-aqua-300"
            aria-hidden
          />
        </Link>
      )}
    </nav>
  );
}

/** Directory listings alongside an article, so the page leads somewhere. */
function PopularListings() {
  const listings = spotlightListings(5);
  if (listings.length === 0) return null;

  return (
    /*
     * The grid only has a third column from xl. Between lg and xl this aside
     * was wrapping into the narrow section-nav column on the LEFT — a right
     * sidebar rendering on the wrong side of the page — so in exactly that
     * window it is not shown. Below lg it stacks under the article as before.
     */
    <aside
      aria-labelledby="popular-listings"
      className="panel overflow-hidden lg:hidden xl:sticky xl:top-[calc(var(--header-h)+1.5rem)] xl:block"
    >
      <h2
        id="popular-listings"
        className="border-b border-line bg-paper px-4 py-3 text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-snow"
      >
        Popular in Durban
      </h2>

      <ul className="divide-y divide-line">
        {listings.map((listing) => (
          <li key={`${listing.hub}-${listing.slug}`}>
            <Link
              href={`/${listing.hub}/${listing.slug}`}
              className="group flex items-center gap-3 p-3 transition hover:bg-white/5"
            >
              <Tile
                seed={listing.slug}
                image={listing.image}
                className="h-14 w-14 shrink-0 rounded-lg"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-bold text-snow transition group-hover:text-aqua-300">
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

      <Link
        href="/discover"
        className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs font-semibold text-mist transition hover:bg-white/5 hover:text-aqua-300"
      >
        Explore Durban
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
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
            <Tile seed={child.path} image={child.image} className="h-36" />
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-sm font-bold leading-snug text-snow transition group-hover:text-aqua-300">
                {child.title}
              </h3>
              {child.excerpt && (
                <p className="line-clamp-2 mt-1.5 text-xs leading-relaxed text-muted">
                  {child.excerpt}
                </p>
              )}
              <span className="mt-auto pt-3 text-[0.6875rem] font-bold uppercase tracking-wider text-aqua-300 opacity-0 transition group-hover:opacity-100">
                Read more →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
