import type { Metadata } from "next";
import Link from "next/link";
import { Award, Gift, QrCode, Repeat } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Rewards",
  description:
    "Earn points every time you redeem a deal or check in, and spend them on the next one.",
};

const STEPS = [
  {
    icon: QrCode,
    title: "Show your code",
    body: "Open a deal in the app and show it at the till. That is the whole check-in.",
  },
  {
    icon: Award,
    title: "Earn points",
    body: "Every redemption adds points. Featured partners run double-point weekends.",
  },
  {
    icon: Gift,
    title: "Spend them",
    body: "Points come off the next offer, or unlock member-only experiences.",
  },
  {
    icon: Repeat,
    title: "Keep going",
    body: "Points do not expire while your account is active. No tiers to maintain.",
  },
];

export default function RewardsPage() {
  return (
    <div className="shell space-y-8 py-6">
      <PageHeader
        title="Rewards"
        intro="A loyalty programme that spans the whole city instead of one shop's card in your wallet."
        trail={[{ label: "Home", href: "/" }, { label: "Rewards" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="panel p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-aqua-400/10">
                <step.icon className="h-4 w-4 text-aqua-600" aria-hidden />
              </span>
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted">
                Step {i + 1}
              </span>
            </div>
            <h2 className="mt-3 text-sm font-bold text-snow">{step.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </div>

      <section className="panel p-6">
        <h2 className="section-title">The fine print, in plain words</h2>
        <ul className="mt-3 space-y-2">
          {[
            "Points are earned per redemption, not per rand spent, so a coffee counts as much as a dinner.",
            "One redemption per offer per day, unless the offer says otherwise.",
            "Points have no cash value and cannot be transferred between accounts.",
            "If a business leaves the programme, points you already earned stay on your account.",
          ].map((line) => (
            <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-aqua-400" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <Link href="/join" className="btn-primary mt-5">
          Start earning
        </Link>
      </section>
    </div>
  );
}
