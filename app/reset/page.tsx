import type { Metadata } from "next";
import { ResetPanel } from "@/components/account/ResetPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Choose a new password for your I Love Durban account.",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Reset your password"
        trail={[{ label: "Home", href: "/" }, { label: "Reset password" }]}
      />

      <div className="mx-auto max-w-md">
        <ResetPanel />
      </div>
    </div>
  );
}
