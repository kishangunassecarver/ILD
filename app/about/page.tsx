import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SITE, STATS } from "@/lib/cms";

export const metadata: Metadata = {
  title: "About us",
  description:
    "I Love Durban is a lifestyle and business platform built to help people find the best of the city — and to help local businesses get found.",
};

export default function AboutPage() {
  return (
    <div className="shell space-y-10 py-6">
      <PageHeader
        title="We are from here"
        intro={SITE.description}
        trail={[{ label: "Home", href: "/" }, { label: "About Us" }]}
      />

      <section className="panel grid gap-4 p-6 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="text-2xl font-extrabold tracking-tight text-snow">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="panel max-w-3xl p-6">
        <h2 className="section-title">Why we built this</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Durban is not short of good places. It is short of ways to find them. The best kitchen in
          Glenwood, the guesthouse that has been in the same family for three generations, the
          plumber everyone in your road quietly uses — none of them lose to competitors. They lose
          to being invisible.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          So we built one place that answers both halves of the question: where should I go, and who
          should I call. Locals get a city they know better. Businesses get found by the people
          already looking for them.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Editorial and advertising are kept apart. Paid placements are labelled as advertising
          everywhere they appear, and our{" "}
          <span className="font-semibold text-snow">Durban Approved</span> list can never be bought
          — it is only ever places our team has been to.
        </p>
      </section>

      <section id="careers" className="panel scroll-mt-24 p-6">
        <h2 className="section-title">Careers</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          We hire slowly and locally: editorial, sales, and the engineering behind the platform and
          the app. If you know this city and can write, sell or ship, send us something.
        </p>
        <Link href="/contact" className="btn-ghost mt-4">
          Get in touch
        </Link>
      </section>

      <section id="press" className="panel scroll-mt-24 p-6">
        <h2 className="section-title">Press</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          For interviews, audience figures or brand assets, contact us and we will send the current
          press kit. Please credit {SITE.name} and link back where you use our material.
        </p>
      </section>
    </div>
  );
}
