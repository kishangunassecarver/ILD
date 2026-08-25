import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchResults } from "@/components/search/SearchResults";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every place, event and deal on I Love Durban.",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Search Durban"
        intro="One box for places, events and deals across the whole city."
        trail={[{ label: "Home", href: "/" }, { label: "Search" }]}
      />
      <SearchResults />
    </div>
  );
}
