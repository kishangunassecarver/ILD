import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SignInPanel } from "@/components/account/SignInPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { APP_PROMO } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Join for free",
  description:
    "A free I Love Durban account: exclusive deals, points on every visit, saved places and one-tap bookings.",
  robots: { index: true, follow: true },
};

export default function JoinPage() {
  return (
    <div className="shell py-6">
      <PageHeader
        title="Join for free"
        intro="Save the places you like, and get the deals that are not on the public site."
        trail={[{ label: "Home", href: "/" }, { label: "Join" }]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6 sm:p-8">
          <h2 className="text-sm font-bold text-snow">What you get</h2>
          <ul className="mt-4 space-y-3">
            {APP_PROMO.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-mist">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-aqua-400/10">
                  <Check className="h-2.5 w-2.5 text-aqua-600" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg bg-paper p-4">
            <p className="text-xs font-bold text-snow">Why no password?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Because we would rather not hold one. Your email address is the account: we send you a
              link, you tap it, you are in. Nothing to remember, nothing to reset, and nothing of
              yours to lose if we are ever breached.
            </p>
          </div>
        </section>

        <SignInPanel />
      </div>
    </div>
  );
}
