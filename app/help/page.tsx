import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Answers about listings, deals, points and the I Love Durban app.",
};

const FAQS = [
  {
    group: "Using the site",
    items: [
      {
        q: "Is I Love Durban free to use?",
        a: "Yes. Browsing places, events and deals is free and always will be. A free member account adds saved places, points and app-only offers.",
      },
      {
        q: "How do you decide what appears first?",
        a: "Hub pages sort by recommendation by default, which puts featured businesses first and then orders by rating. You can change it to top rated, most reviewed or A–Z at any time, and paid placements are labelled as advertising wherever they appear.",
      },
      {
        q: "Are the reviews and ratings yours?",
        a: "Ratings shown on listings are aggregated from public review sources and our own members. Where a business has too few reviews to be meaningful, we show the count so you can judge it yourself.",
      },
    ],
  },
  {
    group: "Deals & points",
    items: [
      {
        q: "How do I redeem a deal?",
        a: "Open the deal in the app and show it before the bill is printed or the payment is taken. Each deal lists its own conditions — days, times and whether it can be combined with anything else.",
      },
      {
        q: "How do points work?",
        a: "You earn points when you redeem an offer or check in at a participating business. Points are redeemed against future offers. They do not expire while your account is active.",
      },
      {
        q: "A business would not honour a deal. What now?",
        a: "Tell us through the contact form with the date and the branch. We follow it up with the business directly, and we remove offers that are not being honoured.",
      },
    ],
  },
  {
    group: "For businesses",
    items: [
      {
        q: "How do I claim or fix my listing?",
        a: "Use the claim link on your listing page, or the business form. We verify ownership by phone or email against the details already published, then hand over the keys.",
      },
      {
        q: "How long does a new listing take to appear?",
        a: "Listings are reviewed by a person and usually go live within one working day. The site rebuilds automatically when content is published, so changes appear within a few minutes of approval.",
      },
      {
        q: "Can I remove my business?",
        a: "Yes. Ask us and we will take it down. We would rather you claimed it and made it accurate, but it is your business and your call.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Help centre"
        intro="The questions we get asked most. If yours is not here, the contact form reaches a person."
        trail={[{ label: "Home", href: "/" }, { label: "Help Centre" }]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {FAQS.map((section) => (
            <section key={section.group}>
              <h2 className="section-title mb-3">{section.group}</h2>
              <div className="panel divide-y divide-line">
                {section.items.map((item) => (
                  /* Native disclosure — no JavaScript, keyboard-accessible for free. */
                  <details key={item.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink marker:content-none">
                      {item.q}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <p className="mt-2.5 text-xs leading-relaxed text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="panel p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <h2 className="text-sm font-bold text-ink">Still stuck?</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Send us the details and we will come back within one working day.
          </p>
          <Link href="/contact" className="btn-primary mt-3 w-full py-2 text-xs">
            Contact us
          </Link>
          <Link href="/list-your-business" className="btn-ghost mt-2 w-full py-2 text-xs">
            Business enquiries
          </Link>
        </aside>
      </div>
    </div>
  );
}
