import type { Metadata } from "next";
import { BusinessDashboard } from "@/components/account/BusinessDashboard";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "My business",
  description: "Claim your listing and keep its details up to date.",
  robots: { index: false, follow: true },
};

export default function MyBusinessPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="My business"
        intro="Claim your listing, then keep its hours, contact details and description up to date."
        trail={[{ label: "Home", href: "/" }, { label: "My Business" }]}
      />
      <BusinessDashboard />
    </div>
  );
}
