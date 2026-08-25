import type { Metadata } from "next";
import Link from "next/link";
import { Building2, LifeBuoy, Megaphone } from "lucide-react";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Get in touch with the I Love Durban team — listings, advertising, editorial or support.",
};

const ROUTES = [
  {
    icon: Building2,
    title: "List or update a business",
    body: "Claiming a listing, fixing your details, or asking about featured placement.",
    href: "/list-your-business",
    cta: "Business listings",
  },
  {
    icon: Megaphone,
    title: "Advertising & partnerships",
    body: "Banner placements, newsletter inclusion, title partnerships and campaign flights.",
    href: "/list-your-business#advertising",
    cta: "See the plans",
  },
  {
    icon: LifeBuoy,
    title: "App or account help",
    body: "Points, redemptions, saved places and anything that is not behaving itself.",
    href: "/help",
    cta: "Help centre",
  },
];

export default function ContactPage() {
  return (
    <div className="shell space-y-8 py-6">
      <PageHeader
        title="Talk to us"
        intro="Pick the fastest route below, or send the form and we will get it to the right person."
        trail={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {ROUTES.map((route) => (
          <div key={route.title} className="panel flex flex-col p-5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50">
              <route.icon className="h-4 w-4 text-brand-500" aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-bold text-ink">{route.title}</h2>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{route.body}</p>
            <Link href={route.href} className="link-more mt-3 text-xs">
              {route.cta} →
            </Link>
          </div>
        ))}
      </div>

      <section>
        <h2 className="section-title mb-4">Send us a message</h2>
        <EnquiryForm
          submitLabel="Send message"
          successTitle="Message sent."
          successBody="We answer most things within one working day. Urgent listing problems go to the top of the pile."
          footnote="We only use your details to reply. Nothing is passed on to advertisers."
          fields={[
            { name: "name", label: "Your name", required: true, half: true },
            { name: "email", label: "Email", type: "email", required: true, half: true },
            {
              name: "topic",
              label: "What's this about?",
              type: "select",
              required: true,
              options: [
                "A business listing",
                "Advertising & partnerships",
                "An event submission",
                "App or account help",
                "Editorial or a story tip",
                "Something else",
              ],
            },
            { name: "message", label: "Message", type: "textarea", required: true },
          ]}
        />
      </section>
    </div>
  );
}
