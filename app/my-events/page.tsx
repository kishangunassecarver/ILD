import type { Metadata } from "next";
import { EventsDashboard } from "@/components/account/EventsDashboard";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "My events",
  description: "Add your event, boost it to Featured or Premium, and watch it go live.",
  robots: { index: false, follow: true },
};

export default function MyEventsPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="My events"
        intro="Add your event for free, or boost it to Featured or Premium — a once-off payment that puts it at the top of the city's calendar until it has run."
        trail={[{ label: "Home", href: "/" }, { label: "My Events" }]}
      />
      <EventsDashboard />
    </div>
  );
}
