import { sponsorFor } from "@/lib/cms";

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
        className={`bg-gradient-to-r ${sponsor.art}`}
      >
        <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-white/60">
            Title partner
          </p>
          <p className="font-display text-lg leading-none tracking-wide text-white">
            {sponsor.name}
          </p>
          <p className="hidden text-xs font-medium text-white/80 sm:block">{sponsor.headline}</p>
          <a
            href={sponsor.href}
            rel="noopener sponsored"
            target="_blank"
            className="ml-auto rounded-md bg-gold px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-ink transition hover:bg-gold-600"
          >
            {sponsor.cta}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={`${sponsor.name} — title partner`}
      className={`relative overflow-hidden bg-gradient-to-br ${sponsor.art}`}
    >
      {/* Decorative city glow. */}
      <div
        className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-white/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/4 h-[22rem] w-[22rem] rounded-full bg-brand-500/25 blur-3xl"
        aria-hidden
      />

      <div className="shell relative grid items-center gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
        <div className="text-center lg:text-left">
          {sponsor.eyebrow && (
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-white/70">
              {sponsor.eyebrow}
            </p>
          )}

          <p className="mt-3 font-display text-4xl leading-none tracking-wide text-white sm:text-5xl lg:text-6xl">
            {sponsor.name}
          </p>

          <p className="mt-4 text-lg font-semibold text-white sm:text-xl">{sponsor.headline}</p>

          <a
            href={sponsor.href}
            rel="noopener sponsored"
            target="_blank"
            className="btn mt-5 bg-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-ink hover:bg-gold-600"
          >
            {sponsor.cta}
          </a>
        </div>

        {/* An abstract device panel stands in for partner artwork. */}
        <div className="hidden justify-center lg:flex">
          <div className="w-[13rem] rounded-[1.75rem] border border-white/25 bg-white/10 p-2.5 shadow-lift backdrop-blur">
            <div className="rounded-[1.35rem] bg-ink/50 px-4 py-8 text-center">
              <p className="font-display text-2xl leading-tight tracking-wide text-white">
                {sponsor.subhead ?? sponsor.headline}
              </p>
              <div className="mx-auto mt-5 h-1 w-12 rounded-full bg-gold" aria-hidden />
              <p className="mt-4 text-[0.625rem] uppercase tracking-[0.16em] text-white/60">
                {sponsor.name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
