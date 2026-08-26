import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SITE } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What data I Love Durban collects, why, and what you can ask us to do with it.",
};

/**
 * PLAIN-LANGUAGE DRAFT — NOT LEGAL ADVICE.
 *
 * POPIA requires a named Information Officer registered with the Information
 * Regulator, and the lawful basis for each processing purpose. Fill in the
 * bracketed details and have this reviewed before launch.
 */
const SECTIONS = [
  {
    heading: "The short version",
    body: [
      `We collect as little as we can get away with. ${SITE.name} does not sell your personal information, and we do not pass your details to advertisers.`,
    ],
  },
  {
    heading: "Who is responsible",
    body: [
      "[Company name] ([registration number]) is the responsible party for the personal information described here, as those terms are used in the Protection of Personal Information Act (POPIA).",
      "Our Information Officer can be reached at [privacy email].",
    ],
  },
  {
    heading: "What we collect",
    body: [
      "When you fill in a form: your name, email address, phone number if you give it, and whatever you write in the message. We use it to reply and to set up what you asked for.",
      "When you subscribe to the newsletter: your email address, until you unsubscribe.",
      "When you create a member account in the app: your name, email, and a record of the offers you redeem, so points can be calculated.",
      "When you simply browse: aggregated analytics about which pages are popular. We do not use this to build a profile of you as an individual.",
    ],
  },
  {
    heading: "Why we collect it",
    body: [
      "To answer your enquiry, to run your member account and points balance, to send you the newsletter you asked for, and to understand which parts of the site are useful so we can improve them.",
      "We do not use your personal information for automated decision-making.",
    ],
  },
  {
    heading: "Who else sees it",
    body: [
      "Service providers who process data on our behalf — hosting, email delivery, analytics — under contract and only for those purposes.",
      "A business you contact through us, where passing your enquiry on is the whole point of the form.",
      "Nobody else, unless the law requires it.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Enquiries: [retention period] after the matter is closed. Newsletter subscriptions: until you unsubscribe. Member accounts: while the account is active, and [retention period] after you close it.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can ask us what we hold about you, ask us to correct it, ask us to delete it, or object to how we are using it. Email [privacy email] and we will respond within a reasonable time.",
      "You can also complain to the Information Regulator of South Africa if you think we have handled your information badly.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use the minimum needed to make the site work, plus aggregated analytics. Where consent is required for anything beyond that, we ask first and default to declining.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Privacy policy"
        trail={[{ label: "Home", href: "/" }, { label: "Privacy Policy" }]}
      />

      <article className="panel max-w-3xl space-y-6 p-6 sm:p-8">
        <p className="text-xs font-medium text-muted">Last updated: [date]</p>

        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-bold text-snow">{section.heading}</h2>
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
