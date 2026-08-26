import type { Metadata } from "next";
import Link from "next/link";
import { SponsorTower } from "@/components/ads/SponsorTower";
import { EventsBrowser } from "@/components/events/EventsBrowser";
import { PageHeader } from "@/components/layout/PageHeader";
import { eventCategories, upcomingEvents } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Events in Durban",
  description:
    "The city calendar: markets, concerts, festivals, sport and everything else happening in Durban.",
};

export default function EventsPage() {
  const events = upcomingEvents();

  return (
    <div className="shell grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <PageHeader
          title="What's happening in Durban"
          intro="Markets, concerts, festivals and race days — the whole city calendar in one place."
          trail={[{ label: "Home", href: "/" }, { label: "Events" }]}
        />

        <EventsBrowser events={events} categories={eventCategories()} />
      </div>

      <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <SponsorTower />

        <section className="panel p-5">
          <h2 className="text-sm font-bold text-snow">Running an event?</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Publish it to the city calendar and reach the people already planning their weekend.
          </p>
          <Link href="/list-your-business" className="btn-primary mt-3 w-full py-2 text-xs">
            Submit an event
          </Link>
        </section>
      </aside>
    </div>
  );
}
