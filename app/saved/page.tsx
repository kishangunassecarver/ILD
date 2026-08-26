import type { Metadata } from "next";
import { SavedList } from "@/components/account/SavedList";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Saved places",
  description: "Your saved places, events and deals.",
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Saved places"
        intro="Everything you have tapped the heart on, in one list."
        trail={[{ label: "Home", href: "/" }, { label: "Saved" }]}
      />
      <SavedList />
    </div>
  );
}
