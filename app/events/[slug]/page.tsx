import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { EventCard } from "@/components/cards/EventCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import { EVENTS, getEvent } from "@/lib/cms";
import { longDate } from "@/lib/utils";

export function generateStaticParams() {
  return EVENTS.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return {};
  return { title: `${event.title} · ${event.venue}`, description: event.blurb };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const alsoOn = EVENTS.filter((e) => e.slug !== event.slug).slice(0, 3);

  return (
    <article className="shell py-6">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          { label: "Events", href: "/events" },
          { label: event.title },
        ]}
      />

      <Tile
        seed={event.slug}
        image={event.image}
        alt={event.title}
        className="mb-6 h-56 rounded-card sm:h-72"
      >
        <SaveButton
          label={event.title}
          kind="event"
          slug={event.slug}
          variant="chip"
          className="absolute right-3 top-3"
        />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/75">
            {event.category}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {event.title}
          </h1>
        </div>
      </Tile>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <div className="panel p-5">
            <p className="text-sm font-medium leading-relaxed text-mist">{event.blurb}</p>
            {event.body?.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-3 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>

          {alsoOn.length > 0 && (
            <section>
              <h2 className="section-title mb-4">Also on in Durban</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {alsoOn.map((other) => (
                  <EventCard key={other.slug} event={other} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <section className="panel p-5">
            <h2 className="text-sm font-bold text-snow">Details</h2>

            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd className="font-semibold text-snow">
                    {event.dateLabel ?? longDate(event.date)}
                  </dd>
                  {event.dateLabel && <dd className="text-muted">{longDate(event.date)}</dd>}
                </div>
              </div>

              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <dt className="sr-only">Venue</dt>
                  <dd className="text-mist">{event.venue}</dd>
                  <dd className="text-muted">{event.area}</dd>
                </div>
              </div>

              {event.price && (
                <div className="flex gap-2.5">
                  <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt className="sr-only">Price</dt>
                    <dd className="text-mist">{event.price}</dd>
                  </div>
                </div>
              )}
            </dl>

            {event.ticketUrl ? (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full"
              >
                Get tickets
              </a>
            ) : (
              <p className="mt-4 rounded-lg bg-paper p-3 text-center text-xs text-muted">
                Ticket details are announced closer to the date.
              </p>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-bold text-snow">Never miss a weekend</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Get the week&apos;s events in your inbox every Thursday.
            </p>
            <Link href="/join" className="btn-ghost mt-3 w-full py-2 text-xs">
              Join for free
            </Link>
          </section>
        </aside>
      </div>
    </article>
  );
}
