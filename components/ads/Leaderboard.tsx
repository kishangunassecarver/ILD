import {
  SponsorBackdrop,
  SponsorMark,
  sponsorBackground,
  sponsorCtaStyle,
} from "@/components/ads/SponsorArt";
import { sponsorFor } from "@/lib/cms";
import { cn } from "@/lib/utils";

/** Wide in-content banner placement. */
export function Leaderboard() {
  const sponsor = sponsorFor("leaderboard");
  if (!sponsor) return null;

  return (
    <aside
      aria-label={`Advertisement — ${sponsor.name}`}
      className={cn(
        "relative overflow-hidden rounded-card shadow-card",
        sponsorBackground(sponsor, "to-r").className
      )}
      style={sponsorBackground(sponsor, "to-r").style}
    >
      <SponsorBackdrop sponsor={sponsor} />

      {/* Advertising declares itself — the label is part of the placement. */}
      <span className="absolute left-4 top-0 z-10 rounded-b-lg bg-coral-500 px-3 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-white">
        Sponsored Partner
      </span>

      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />

      {/*
       * A min-height rather than more padding: the band keeps its depth
       * whatever length of headline a partner sends, and short of this a
       * background photograph has no room to read as anything.
       *
       * 128px at desktop, up from a measured 83px.
       */}
      <div className="relative flex min-h-[7rem] flex-wrap items-center gap-x-6 gap-y-4 px-5 py-6 sm:min-h-[8rem] sm:px-6">
        <div className="min-w-[8rem]">
          <SponsorMark
            sponsor={sponsor}
            slot="leaderboard"
            typeClassName="font-display text-2xl font-extrabold leading-none tracking-tight text-white"
          />
          {sponsor.eyebrow && (
            <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-white/60">
              {sponsor.eyebrow}
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-snug text-white sm:text-lg">
            {sponsor.headline}
          </p>
          {sponsor.body && (
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-white/75">{sponsor.body}</p>
          )}
        </div>

        <a
          href={sponsor.href}
          rel="noopener sponsored"
          style={sponsorCtaStyle(sponsor)}
          className="btn-primary shrink-0 py-2 text-xs uppercase tracking-wide transition hover:opacity-90"
        >
          {sponsor.cta}
        </a>
      </div>
    </aside>
  );
}
