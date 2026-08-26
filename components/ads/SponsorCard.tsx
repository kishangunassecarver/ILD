import { SponsorMark, sponsorCtaStyle } from "@/components/ads/SponsorArt";
import { sponsorFor } from "@/lib/cms";

/**
 * The sidebar partner as a native, labelled card inside the content grid —
 * a horizontal row rather than a second billboard, so the page stops reading
 * as an advertising portal. The tall tower remains for pages with a sidebar.
 */
export function SponsorCard() {
  const sponsor = sponsorFor("sidebar");
  if (!sponsor) return null;

  return (
    <aside aria-label={`Advertisement — ${sponsor.name}`} className="panel flex h-full flex-col p-5">
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted">
        Featured Partner
      </p>

      <div className="mt-3 flex flex-1 items-center gap-4">
        <SponsorMark
          sponsor={sponsor}
          slot="sidebar"
          typeClassName="font-display text-xl font-extrabold leading-tight tracking-tight text-white"
          className="max-h-16 shrink-0"
        />

        <div className="min-w-0">
          <p className="text-[0.9375rem] font-bold leading-snug text-snow">{sponsor.headline}</p>
          {(sponsor.body ?? sponsor.subhead) && (
            <p className="mt-1 text-[0.8125rem] leading-snug text-mist">
              {sponsor.body ?? sponsor.subhead}
            </p>
          )}
        </div>
      </div>

      <a
        href={sponsor.href}
        rel="noopener sponsored"
        style={sponsorCtaStyle(sponsor)}
        className="btn-primary mt-4 self-start px-5 py-2 text-[0.8125rem]"
      >
        {sponsor.cta}
      </a>
    </aside>
  );
}
