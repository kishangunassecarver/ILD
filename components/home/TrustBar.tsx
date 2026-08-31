import { Award, BadgeCheck, Heart, ShieldCheck, Tag, type LucideIcon } from "lucide-react";

/**
 * The platform's promises, in one quiet row. Closes the first screen of the
 * home page under the sponsored placements — the last word belongs to the
 * platform, not to an advertiser.
 */
const PROMISES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BadgeCheck, title: "Local & trusted", body: "Curated for Durban" },
  { icon: Tag, title: "Best price guarantee", body: "More value, always" },
  { icon: Award, title: "Earn I Love Durban points", body: "Spend less, enjoy more" },
  { icon: ShieldCheck, title: "Secure bookings", body: "Safe, fast & reliable" },
  { icon: Heart, title: "Support local", body: "Back our community" },
];

export function TrustBar() {
  return (
    <section aria-label="Why book with I Love Durban" className="panel-raised px-5 py-4">
      <ul className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        {PROMISES.map((promise) => (
          <li key={promise.title} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-aqua-600">
              <promise.icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-snow">{promise.title}</span>
              <span className="block text-[0.8125rem] text-muted">{promise.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
