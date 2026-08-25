import type { Metadata } from "next";
import { Check, Eye, MessageSquare, TrendingUp } from "lucide-react";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BUSINESS_PLANS, HUBS, STATS } from "@/lib/cms";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "List your business",
  description:
    "Get your Durban business in front of the people already searching for it. Free listings, featured placement and full partner campaigns.",
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
    body: "Photos, hours, offers and reviews on one page, so the decision happens before the call.",
  },
  {
    icon: TrendingUp,
    title: "Be measured",
    body: "A monthly report on views, clicks to call, direction requests and deal redemptions.",
  },
];

export default function ListYourBusinessPage() {
  return (
    <div className="shell space-y-10 py-6">
      <PageHeader
        title="Get your business in front of Durban"
        intro="Four thousand local businesses are already listed. A free listing takes ten minutes; the paid tiers put you where people are already looking."
        trail={[{ label: "Home", href: "/" }, { label: "List Your Business" }]}
      />

      <section className="panel grid gap-4 p-6 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="text-2xl font-extrabold tracking-tight text-ink">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section id="solutions" className="scroll-mt-24">
        <h2 className="section-title mb-4">What a listing does for you</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="panel p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50">
                <benefit.icon className="h-4 w-4 text-brand-500" aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-bold text-ink">{benefit.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="advertising" className="scroll-mt-24">
        <h2 className="section-title mb-4">Plans</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {BUSINESS_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "panel flex flex-col p-6",
                plan.featured && "border-brand-200 ring-1 ring-brand-200"
              )}
            >
              {plan.featured && (
                <span className="mb-3 self-start rounded-pill bg-brand-50 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-brand-600">
                  Most popular
                </span>
              )}

              <h3 className="text-base font-bold text-ink">{plan.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{plan.summary}</p>

              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-ink">
                  {plan.price}
                </span>
                <span className="text-xs text-muted">{plan.period}</span>
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.includes.map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-relaxed text-ink-700">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50">
                      <Check className="h-2.5 w-2.5 text-brand-500" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="#enquire"
                className={cn("mt-6 w-full", plan.featured ? "btn-primary" : "btn-ghost")}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.6875rem] text-muted">
          Prices exclude VAT. Partner campaigns are quoted per flight — talk to us about what you
          need.
        </p>
      </section>

      <section id="stories" className="panel scroll-mt-24 p-6">
        <h2 className="section-title">Success stories</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          We publish quarterly write-ups with the businesses who let us share their numbers — what
          they listed, what changed, and what it cost. Ask your account manager for the current set,
          or get in touch and we will send it through.
        </p>
      </section>

      <section id="enquire" className="scroll-mt-24">
        <h2 className="section-title mb-1">Get listed</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Tell us about the business and we will come back within one working day.
        </p>

        <EnquiryForm
          submitLabel="Send my details"
          successTitle="Thanks — that's with us."
          successBody="Our team will be in touch within one working day to get your listing live."
          footnote="We use these details to set up your listing and nothing else. See our Privacy Policy."
          fields={[
            { name: "business", label: "Business name", required: true, half: true },
            {
              name: "category",
              label: "Category",
              type: "select",
              required: true,
              half: true,
              options: HUBS.map((hub) => hub.label),
            },
            { name: "name", label: "Your name", required: true, half: true },
            { name: "email", label: "Email", type: "email", required: true, half: true },
            { name: "phone", label: "Phone", type: "tel", half: true },
            { name: "area", label: "Suburb or area", half: true },
            {
              name: "plan",
              label: "Interested in",
              type: "select",
              options: BUSINESS_PLANS.map((plan) => plan.name),
            },
            {
              name: "message",
              label: "Anything else we should know?",
              type: "textarea",
              placeholder: "Opening hours, what makes the place worth a visit, links to photos…",
            },
          ]}
        />
      </section>
    </div>
  );
}
