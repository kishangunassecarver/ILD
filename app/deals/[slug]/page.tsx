import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, Store } from "lucide-react";
import { DealCard } from "@/components/cards/DealCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Tile } from "@/components/ui/Tile";
import { DEALS, getDeal } from "@/lib/cms";
import { longDate } from "@/lib/utils";

export function generateStaticParams() {
  return DEALS.map((deal) => ({ slug: deal.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const deal = getDeal(slug);
  if (!deal) return {};
  return { title: `${deal.title} · ${deal.business}`, description: deal.blurb };
}

export default async function DealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deal = getDeal(slug);
  if (!deal) notFound();

  const more = DEALS.filter((d) => d.slug !== deal.slug).slice(0, 3);

  return (
    <article className="shell py-6">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          { label: "Deals", href: "/deals" },
          { label: deal.business },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <Tile
            seed={deal.slug}
            image={deal.image}
            alt={deal.business}
            className="h-52 rounded-card sm:h-64"
          >
            <span className="absolute left-3 top-3 rounded-pill bg-coral-500 px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-rail">
              {deal.badge}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/75">
                {deal.category}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {deal.title}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/85">{deal.business}</p>
            </div>
          </Tile>

          <div className="panel p-5">
            <p className="text-sm font-medium leading-relaxed text-mist">{deal.blurb}</p>

            {deal.terms && deal.terms.length > 0 && (
              <>
                <h2 className="mt-5 text-sm font-bold text-snow">Terms</h2>
                <ul className="mt-2 space-y-1.5">
                  {deal.terms.map((term) => (
                    <li key={term} className="flex gap-2 text-xs leading-relaxed text-muted">
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-aqua-400"
                        aria-hidden
                      />
                      {term}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {more.length > 0 && (
            <section>
              <h2 className="section-title mb-4">More deals in Durban</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {more.map((other) => (
                  <DealCard key={other.slug} deal={other} layout="wide" />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <section className="panel p-5">
            <h2 className="text-sm font-bold text-snow">Claim this offer</h2>

            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex gap-2.5">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <dt className="sr-only">Business</dt>
                  <dd className="text-mist">{deal.business}</dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <dt className="sr-only">Area</dt>
                  <dd className="text-mist">{deal.area}</dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <dt className="sr-only">Valid until</dt>
                  <dd className="text-mist">Valid until {longDate(deal.validUntil)}</dd>
                </div>
              </div>
            </dl>

            <Link href="/join" className="btn-primary mt-4 w-full">
              Get this deal
            </Link>
            <p className="mt-2 text-center text-[0.625rem] text-muted">
              Offers are redeemed in the I Love Durban app.
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
