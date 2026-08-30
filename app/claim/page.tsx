import type { Metadata } from "next";
import { BadgeCheck, Pencil, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClaimPageBody } from "@/components/claim/ClaimPageBody";

export const metadata: Metadata = {
  title: "Claim your listing",
  description:
    "Already on I Love Durban? Claim your listing for free and keep your details, hours and photos up to date yourself.",
};

const STEPS = [
  {
    icon: Search,
    title: "Find your listing",
    body: "Search for your business among the listings already on the site.",
  },
  {
    icon: ShieldCheck,
    title: "We verify it's you",
    body: "Tell us your role and how to reach you. A person reviews every claim — we may call to confirm.",
  },
  {
    icon: Pencil,
    title: "You take the wheel",
    body: "Once approved, edit your details, hours and photos from your own dashboard, any time.",
  },
];

export default function ClaimPage() {
  return (
    <div className="shell space-y-10 py-6">
      <PageHeader
        title="Claim your listing"
        intro="Your business may already be on I Love Durban. Claiming it is free — and it puts you in charge of what people see."
        trail={[{ label: "Home", href: "/" }, { label: "Claim Your Listing" }]}
      />

      <section aria-label="How claiming works" className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.title} className="panel p-5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-aqua-400/10">
              <step.icon className="h-4 w-4 text-aqua-300" aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-bold text-snow">{step.title}</h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <ClaimPageBody />

      <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-muted">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-aqua-300" aria-hidden />
        <span>
          Listings managed by their owner — including every Premium listing with an active
          subscription — cannot be claimed. If you believe a listing is wrongly claimed, contact us
          and a person will look into it.
        </span>
      </p>
    </div>
  );
}
