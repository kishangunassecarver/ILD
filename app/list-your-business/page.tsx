import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Eye, MessageSquare, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { STATS } from "@/lib/cms";

export const metadata: Metadata = {
  title: "List your business",
  description:
    "Get your Durban business in front of the people already searching for it. Free listings that never expire, and a Premium upgrade for R99 a month.",
};

const BENEFITS = [
  {
    icon: Eye,
    title: "Be found",
    body: "Appear in the hub, category and area searches people actually use, plus site search.",
  },
  {
    icon: MessageSquare,
    title: "Be chosen",
    body: "Photos, hours and your full story on one page, so the decision happens before the call.",
  },
  {
    icon: TrendingUp,
    title: "Stay in control",
    body: "Update your details, hours and photos yourself from your own dashboard, any time.",
  },
];

/**
 * The plans are product configuration, deliberately hardcoded rather than
 * CMS-driven: the Premium price on this page and the price PayFast charges
 * come from the same codebase, so they cannot drift apart.
 */
const PLANS = [
  {
    name: "Free Listing",
    price: "R0",
    period: "forever — it never expires",
    summary: "Everything a business needs to be found.",
    includes: [
      "Your business in the right section and area",
      "One featured photo",
      "Description, contact details and hours",
      "Edit it yourself from your dashboard",
      "Reviewed and published by a person",
    ],
    cta: "Add your free listing",
    href: "/my-business/?add=1",
    featured: false,
  },
  {
    name: "Premium",
    price: "R99",
    period: "per month, cancel anytime",
    summary: "Stand out, with more to show.",
    includes: [
      "Everything in the Free Listing",
      "A photo gallery — up to 10 photos",
      "Priority placement where people are looking",
      "Premium badge on your listing",
      "Billed monthly via PayFast, invoices in your dashboard",
    ],
    cta: "Add a Premium listing",
    href: "/my-business/?add=1&plan=premium",
    featured: true,
  },
];

export default function ListYourBusinessPage() {
  return (
    <div className="shell space-y-10 py-6">
      <PageHeader
        title="Get your business in front of Durban"
        intro="Add your listing in ten minutes — free, forever. Upgrade to Premium when you want to stand out."
        trail={[{ label: "Home", href: "/" }, { label: "List Your Business" }]}
      />

      <section className="panel grid gap-4 p-6 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="text-2xl font-extrabold tracking-tight text-snow">{stat.value}</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section id="solutions" className="scroll-mt-24">
        <h2 className="section-title mb-4">What a listing does for you</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="panel p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-aqua-400/10">
                <benefit.icon className="h-4 w-4 text-aqua-300" aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-bold text-snow">{benefit.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="scroll-mt-24">
        <h2 className="section-title mb-4">Plans</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.featured
                  ? "panel flex flex-col border-gold/40 p-6 ring-1 ring-gold/40"
                  : "panel flex flex-col p-6"
              }
            >
              {plan.featured && (
                <span className="mb-3 inline-flex items-center gap-1.5 self-start rounded-pill bg-gold/15 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-gold">
                  <Crown className="h-3 w-3" aria-hidden />
                  Stand out
                </span>
              )}

              <h3 className="text-base font-bold text-snow">{plan.name}</h3>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{plan.summary}</p>

              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-snow">
                  {plan.price}
                </span>
                <span className="text-xs text-muted">{plan.period}</span>
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.includes.map((item) => (
                  <li key={item} className="flex gap-2 text-[0.8125rem] leading-relaxed text-mist">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-aqua-400/10">
                      <Check className="h-2.5 w-2.5 text-aqua-300" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={
                  plan.featured
                    ? "btn mt-6 w-full bg-gold font-bold text-ink hover:bg-gold-600"
                    : "btn-primary mt-6 w-full"
                }
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-4 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
          Both plans are self-service: sign in, add your listing, and upgrade whenever you like
          from your dashboard. Premium is billed as a monthly PayFast subscription — the upgrade
          button appears on your listing once it is live. Questions?{" "}
          <Link href="/contact" className="font-semibold text-aqua-300 underline">
            Talk to us
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
