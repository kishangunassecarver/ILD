import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tile } from "@/components/ui/Tile";
import { POSTS } from "@/lib/cms";
import { longDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "The Durban Blog",
  description:
    "Guides, opinions and local knowledge about the city — written by people who live here.",
};

export default function BlogPage() {
  const [lead, ...rest] = POSTS;

  return (
    <div className="shell py-6">
      <PageHeader
        title="The Durban Blog"
        intro="Guides, opinions and local knowledge — written by people who live here, not people passing through."
        trail={[{ label: "Home", href: "/" }, { label: "Blog" }]}
      />

      {lead && (
        <Link
          href={`/blog/${lead.slug}`}
          className="panel card-hover group mb-6 grid overflow-hidden md:grid-cols-2"
        >
          <Tile seed={lead.slug} image={lead.image} className="h-52 md:h-full md:min-h-[16rem]" />
          <div className="flex flex-col justify-center p-6">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-aqua-600">
              {lead.category}
            </p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-snow transition group-hover:text-aqua-600 sm:text-2xl">
              {lead.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{lead.excerpt}</p>
            <p className="mt-4 text-xs text-muted">
              {lead.author} · {longDate(lead.date)}
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rest.map((post) => (
          <article key={post.slug} className="panel card-hover group flex flex-col overflow-hidden">
            <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden>
              <Tile seed={post.slug} image={post.image} className="h-36" />
            </Link>
            <div className="flex flex-1 flex-col p-4">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-aqua-600">
                {post.category}
              </p>
              <h2 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-snow">
                <Link href={`/blog/${post.slug}`} className="transition hover:text-aqua-600">
                  {post.title}
                </Link>
              </h2>
              <p className="line-clamp-3 mt-1.5 text-xs leading-relaxed text-muted">
                {post.excerpt}
              </p>
              <p className="mt-auto pt-3 text-[0.6875rem] text-muted">{longDate(post.date)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
