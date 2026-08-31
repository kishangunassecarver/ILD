import {
  SponsorBackdrop,
  SponsorMark,
  sponsorBackground,
  sponsorCtaStyle,
} from "@/components/ads/SponsorArt";
import { sponsorFor } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * The title-partner strip that opens every page.
 *
 * Entirely data-driven from SPONSORS so sales can rotate the partner without a
 * code change. The artwork is generated from the sponsor's gradient rather than
 * supplied as a flat image, so it stays crisp at every width.
 */
export function TitlePartner({ slim = false }: { slim?: boolean }) {
  const sponsor = sponsorFor("title");
  if (!sponsor) return null;

  /**
   * Inner pages get a single-row band instead of the full billboard: the title
   * partner keeps site-wide presence without pushing every page's content
   * below the fold.
   */
  if (slim) {
    return (
      <section
        aria-label={`${sponsor.name} — title partner`}
        className={sponsorBackground(sponsor, "to-r").className}
        style={sponsorBackground(sponsor, "to-r").style}
      >
        <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-white/60">
            Title partner
          </p>
          <SponsorMark
            sponsor={sponsor}
            slot="band"
            typeClassName="font-display text-lg font-extrabold leading-none tracking-tight text-white"
          />
          <p className="hidden text-xs font-medium text-white/80 sm:block">{sponsor.headline}</p>
          <a
            href={sponsor.href}
            rel="noopener sponsored"
            target="_blank"
            style={sponsorCtaStyle(sponsor)}
            className="ml-auto rounded-md bg-gold px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-ink transition hover:opacity-90"
          >
            {sponsor.cta}
          </a>
        </div>
      </section>
    );
  }

  /*
   * One centred content column, clearly labelled, and roughly 20% shorter than
   * the old billboard. The partner's creative stays the backdrop; the floating
   * device panel is gone — it was a second focal point that added nothing the
   * headline had not already said.
   */
  return (
    <section
      aria-label={`${sponsor.name} — featured partner`}
      className={cn("relative overflow-hidden", sponsorBackground(sponsor, "to-br").className)}
      style={sponsorBackground(sponsor, "to-br").style}
    >
      <SponsorBackdrop sponsor={sponsor} />

      {/* A light touch of shade behind the copy. The heavy lifting is the
          sponsor's own configurable darkening (the CMS "Darkening" field) —
          stacking a second strong scrim here was muting partner artwork. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/15 via-transparent to-ink/25"
        aria-hidden
      />

      {/* Gentle fade into the page below, so the search hub reads as sitting in
          the hero's tail rather than under a hard edge. A plain two-stop
          gradient into the light page produced a visible milky band over dark
          artwork; these smoothstep-eased stops make the fade read as natural. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36"
        style={{
          backgroundImage: `linear-gradient(to bottom,
            rgba(242, 246, 250, 0)     0%,
            rgba(242, 246, 250, 0.013) 8.1%,
            rgba(242, 246, 250, 0.049) 15.5%,
            rgba(242, 246, 250, 0.104) 22.5%,
            rgba(242, 246, 250, 0.175) 29%,
            rgba(242, 246, 250, 0.259) 35.3%,
            rgba(242, 246, 250, 0.352) 41.2%,
            rgba(242, 246, 250, 0.45)  47.1%,
            rgba(242, 246, 250, 0.55)  52.9%,
            rgba(242, 246, 250, 0.648) 58.8%,
            rgba(242, 246, 250, 0.741) 64.7%,
            rgba(242, 246, 250, 0.825) 71%,
            rgba(242, 246, 250, 0.896) 77.5%,
            rgba(242, 246, 250, 0.951) 84.5%,
            rgba(242, 246, 250, 0.987) 91.9%,
            rgba(242, 246, 250, 1)     100%)`,
        }}
        aria-hidden
      />

      <div className="shell relative flex min-h-[16rem] flex-col items-center justify-center gap-4 py-8 text-center lg:min-h-[18rem]">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-white/75">
          Featured Partner
        </p>

        <SponsorMark
          sponsor={sponsor}
          slot="title"
          typeClassName="font-display text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl"
          className="mx-auto"
        />

        <p className="text-lg font-semibold text-white sm:text-xl">{sponsor.headline}</p>

        <a
          href={sponsor.href}
          rel="noopener sponsored"
          target="_blank"
          style={sponsorCtaStyle(sponsor)}
          className="btn bg-gold px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-ink transition hover:opacity-90"
        >
          {sponsor.cta}
        </a>

        {sponsor.eyebrow && (
          <p className="flex items-center gap-3 text-[0.5625rem] font-semibold uppercase tracking-[0.2em] text-white/55">
            <span className="h-px w-8 bg-white/30" aria-hidden />
            {sponsor.eyebrow}
            <span className="h-px w-8 bg-white/30" aria-hidden />
          </p>
        )}
      </div>
    </section>
  );
}
