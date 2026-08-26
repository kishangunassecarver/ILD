import { SponsorBackdrop, SponsorMark } from "@/components/ads/SponsorArt";
import { sponsorFor } from "@/lib/cms";

/** Wide in-content banner placement. */
export function Leaderboard() {
  const sponsor = sponsorFor("leaderboard");
  if (!sponsor) return null;

  return (
    <aside
      aria-label={`Advertisement — ${sponsor.name}`}
      className={`relative overflow-hidden rounded-card bg-gradient-to-r ${sponsor.art} shadow-card`}
    >
      <SponsorBackdrop sponsor={sponsor} />

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
            height="max-h-8 sm:max-h-10"
            typeClassName="font-display text-2xl font-extrabold leading-none tracking-tight text-white"
          />
          {sponsor.eyebrow && (
            <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-white/60">
              {sponsor.eyebrow}
            </p>
          )}
        </div>

        <p className="flex-1 text-sm font-bold uppercase leading-snug tracking-wide text-white sm:text-base">
          {sponsor.headline}
        </p>

        <a
          href={sponsor.href}
          rel="noopener sponsored"
          className="btn-primary shrink-0 py-2 text-xs uppercase tracking-wide"
        >
          {sponsor.cta}
        </a>
      </div>
    </aside>
  );
}
