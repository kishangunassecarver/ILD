import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Tile } from "@/components/ui/Tile";
import type { Page } from "@/lib/types";

/**
 * Renders a page authored in WordPress.
 *
 * TRUST BOUNDARY: `page.html` is WordPress's own rendered output and is injected
 * as HTML. That is the only way an editor gets headings, lists and links out of
 * the block editor, but it means anyone who can publish a page can put arbitrary
 * markup on the site. It is baked in at build time, so it is exactly as
 * trustworthy as the people with publish rights in your WordPress — keep that
 * list short and two-factored. If you ever need to accept pages from people you
 * do not trust, sanitise in scripts/fetch-wp-content.mjs before it is written to
 * the bundle, not here.
 *
 * The prose styles are hand-written rather than pulled from a typography plugin,
 * so page content matches the rest of the site's type scale.
 */
export function CmsPage({ page }: { page: Page }) {
  const crumbs = page.path.split("/");

  return (
    <div className="shell py-6">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          ...crumbs.slice(0, -1).map((segment, i) => ({
            label: segment.replace(/-/g, " "),
            href: `/${crumbs.slice(0, i + 1).join("/")}`,
          })),
          { label: page.title },
        ]}
      />

      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          {page.title}
        </h1>

        {page.excerpt && (
          <p className="mt-3 text-base leading-relaxed text-ink-700">{page.excerpt}</p>
        )}

        {page.image && (
          <Tile
            seed={page.path}
            image={page.image}
            alt=""
            className="mt-6 h-52 rounded-card sm:h-72"
          />
        )}

        <div
          className={[
            "mt-6 text-[0.9375rem] leading-relaxed text-muted",
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
          ].join(" ")}
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      </article>
    </div>
  );
}
