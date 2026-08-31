import Link from "next/link";
import { Check, QrCode } from "lucide-react";
import { APP_PROMO, SITE } from "@/lib/cms";

export function AppPromo() {
  return (
    <section
      aria-labelledby="app-promo-title"
      className="relative overflow-hidden rounded-card bg-gradient-to-br from-[#2A1A5E] via-[#3D2C8D] to-[#0E4C92] shadow-card"
    >
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#12B5CB]/20 blur-3xl"
        aria-hidden
      />

      <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_auto_auto] lg:items-center lg:gap-8">
        <div>
          <h2 id="app-promo-title" className="text-xl font-bold text-white sm:text-2xl">
            {APP_PROMO.title}
          </h2>

          <ul className="mt-4 space-y-2">
            {APP_PROMO.points.map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm text-white/85">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-aqua-500">
                  <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <Link href={APP_PROMO.ctaHref} className="btn-primary mt-5">
            {APP_PROMO.cta}
          </Link>
        </div>

        {/* Device mock — abstract rather than a screenshot, so it never dates. */}
        <div className="hidden justify-center lg:flex">
          <div className="w-[11rem] rounded-[1.5rem] border border-white/25 bg-white/10 p-2 shadow-lift backdrop-blur">
            {/* The phone screen shows the app in its own night theme. */}
            <div className="space-y-2 rounded-[1.15rem] bg-paper p-3">
              <div className="h-1.5 w-10 rounded-full bg-line" aria-hidden />
              <p className="text-[0.6875rem] font-bold text-snow">Good morning, Sam!</p>
              <div className="rounded-lg bg-aqua-400/10 px-2.5 py-2">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-wider text-aqua-600">
                  Your points
                </p>
                <p className="text-sm font-extrabold text-snow">2 430</p>
              </div>
              <p className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted">
                Nearby deals
              </p>
              {["20% off · Umhlanga", "2 for 1 · Ballito"].map((row) => (
                <div
                  key={row}
                  className="rounded-md border border-line px-2 py-1.5 text-[0.5625rem] text-mist"
                >
                  {row}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:w-[13rem]">
          <p className="text-xs font-semibold text-white">{APP_PROMO.storeNote}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <StoreBadge store="App Store" note="Download on the" />
            <StoreBadge store="Google Play" note="Get it on" />
          </div>

          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-white/20 bg-white/10 p-2.5">
            <QrCode className="h-9 w-9 shrink-0 text-white" strokeWidth={1.5} aria-hidden />
            <p className="text-[0.625rem] leading-snug text-white/75">
              Scan to download, or visit{" "}
              <span className="font-semibold text-white">
                {SITE.url.replace("https://", "")}/app
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ store, note }: { store: string; note: string }) {
  return (
    <a
      href="#"
      className="flex flex-col rounded-lg bg-ink px-3 py-1.5 leading-tight ring-1 ring-white/15 transition hover:bg-black"
    >
      <span className="text-[0.5rem] uppercase tracking-wide text-white/60">{note}</span>
      <span className="text-xs font-bold text-white">{store}</span>
    </a>
  );
}
