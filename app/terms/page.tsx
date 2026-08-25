import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SITE } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms that apply to using I Love Durban.",
};

/**
 * PLAIN-LANGUAGE DRAFT — NOT LEGAL ADVICE.
 *
 * The square-bracket placeholders are deliberate: they must be filled in, and
 * the whole document reviewed by the client's attorney, before launch. South
 * African trading terms also need CPA and ECTA disclosures that belong in a
 * lawyer's draft, not this one.
 */
const SECTIONS = [
  {
    heading: "Who we are",
    body: [
      `${SITE.name} is operated by [Company name] ([registration number]), a company registered in South Africa, with its address at [registered address].`,
      "You can reach us through the contact form on this site or at [contact email].",
    ],
  },
  {
    heading: "Using the site",
    body: [
      "You may browse, search and share our pages freely for personal use. You may not scrape the directory, copy substantial parts of it, or republish our listings, photography or editorial without written permission.",
      "You may not use the site to harass a business, publish false reviews, or attempt to interfere with how it runs.",
    ],
  },
  {
    heading: "Listings and directory information",
    body: [
      "We work hard to keep listings accurate, but details change: opening hours move, kitchens close, prices go up. Business information is supplied by the businesses themselves or gathered from public sources, and we cannot guarantee that every field is current.",
      "Always confirm anything you are relying on — a booking, a price, an accessibility requirement — directly with the business.",
      "A listing is not an endorsement, and its position in a list is not a ranking of quality unless we say so.",
    ],
  },
  {
    heading: "Advertising and paid placement",
    body: [
      "Some placements on this site are paid for. Sponsored banners, featured listings and partner placements are labelled as advertising where they appear.",
      "Editorial selections — including Durban Approved — are not for sale and cannot be influenced by advertising spend.",
    ],
  },
  {
    heading: "Deals and rewards",
    body: [
      "Deals are offered by the businesses named on them, not by us. Each offer carries its own terms, dates and limits, and the business is responsible for honouring it.",
      "If an offer is not honoured, tell us and we will take it up with the business, but our liability is limited to removing the offer.",
      "Points have no cash value, are not transferable, and may be adjusted if they were earned in error or through misuse.",
    ],
  },
  {
    heading: "Third-party links",
    body: [
      "We link out to booking systems, ticketing platforms and business websites. What happens on those sites is governed by their terms and their privacy policies, not ours.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "We provide this site as it stands. To the extent the law allows, we are not liable for loss arising from your use of it, from information that turned out to be out of date, or from your dealings with a business you found here.",
      "Nothing here limits rights you have under the Consumer Protection Act that cannot lawfully be limited.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update these terms. The date below tells you when they last changed, and continuing to use the site after a change means you accept the updated version.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Terms & conditions"
        trail={[{ label: "Home", href: "/" }, { label: "Terms & Conditions" }]}
      />

      <article className="panel max-w-3xl space-y-6 p-6 sm:p-8">
        <p className="text-xs font-medium text-muted">Last updated: [date]</p>

        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-bold text-ink">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-2 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
