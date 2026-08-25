import type { Metadata } from "next";
import { Check } from "lucide-react";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { APP_PROMO } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Join for free",
  description:
    "A free I Love Durban account: exclusive deals, points on every visit, saved places and one-tap bookings.",
};

export default function JoinPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Join for free"
        intro="Members get the deals that are not on the public site, plus points on every redemption."
        trail={[{ label: "Home", href: "/" }, { label: "Join" }]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-sm font-bold text-ink">What you get</h2>
          <ul className="mt-4 space-y-3">
            {APP_PROMO.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-ink-700">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50">
                  <Check className="h-2.5 w-2.5 text-brand-500" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <p className="mt-6 rounded-lg bg-paper p-4 text-xs leading-relaxed text-muted">
            Accounts are created and managed in the I Love Durban app, where redemptions and points
            live. Leave your email here and we will send the download link and set you up.
          </p>
        </section>

        <EnquiryForm
          submitLabel="Send me the app link"
          successTitle="Check your inbox."
          successBody="We have sent the download link. Your points start counting from your first redemption."
          footnote="One email with the link, plus the weekly Durban round-up if you tick it. Unsubscribe any time."
          fields={[
            { name: "name", label: "First name", required: true, half: true },
            { name: "email", label: "Email", type: "email", required: true, half: true },
            {
              name: "interests",
              label: "What are you mostly here for?",
              type: "select",
              options: [
                "Eating out",
                "Weekends and events",
                "Deals and rewards",
                "Things to do with the family",
                "A bit of everything",
              ],
            },
          ]}
        />
      </div>
    </div>
  );
}
