import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Tile } from "@/components/ui/Tile";
import { POSTS, getPost } from "@/lib/cms";
import { longDate } from "@/lib/utils";

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { type: "article", title: post.title, description: post.excerpt },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="shell py-6">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title },
        ]}
      />

      <article className="mx-auto max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-aqua-600">
          {post.category}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-snow sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-xs text-muted">
          {post.author} · {longDate(post.date)}
        </p>

        <Tile
          seed={post.slug}
          image={post.image}
          alt=""
          className="mt-6 h-56 rounded-card sm:h-72"
        />

        <div className="mt-6">
          <p className="text-base font-medium leading-relaxed text-mist">{post.excerpt}</p>
          {post.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="mt-4 text-[0.9375rem] leading-relaxed text-muted"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      {more.length > 0 && (
        <section className="mx-auto mt-10 max-w-3xl border-t border-line pt-6">
          <h2 className="section-title mb-4">Keep reading</h2>
          <ul className="space-y-3">
            {more.map((other) => (
              <li key={other.slug}>
                <Link href={`/blog/${other.slug}`} className="panel card-hover block p-4">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-aqua-600">
                    {other.category}
                  </p>
                  <p className="mt-1 text-sm font-bold text-snow">{other.title}</p>
                  <p className="line-clamp-2 mt-1 text-xs leading-relaxed text-muted">
                    {other.excerpt}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
