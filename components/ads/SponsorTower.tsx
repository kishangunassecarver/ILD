import { sponsorFor } from "@/lib/cms";
import { cn } from "@/lib/utils";

/** The tall sidebar placement that runs alongside the main column. */
export function SponsorTower({ className }: { className?: string }) {
  const sponsor = sponsorFor("sidebar");
  if (!sponsor) return null;

  return (
    <aside
      aria-label={`Advertisement — ${sponsor.name}`}
      className={cn(
        `relative overflow-hidden rounded-card bg-gradient-to-b ${sponsor.art} shadow-card`,
        className
      )}
    >
      <div
        className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#12B5CB]/25 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 p-5 text-center">
        <div>
          <p className="font-display text-2xl leading-none tracking-wide text-white">
            {sponsor.name}
          </p>
          {sponsor.subhead && (
            <p className="mt-1.5 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-white/60">
              {sponsor.subhead}
            </p>
          )}
        </div>

        <div className="h-px bg-white/15" aria-hidden />

        <p className="text-xl font-extrabold uppercase leading-tight tracking-tight text-white">
          {sponsor.headline.split(". ").map((line) => (
            <span key={line} className="block">
              {line.replace(/\.$/, "")}
            </span>
          ))}
        </p>

        {sponsor.body && <p className="text-xs leading-relaxed text-white/70">{sponsor.body}</p>}

        <a
          href={sponsor.href}
          rel="noopener sponsored"
          className="btn mx-auto bg-white py-2 text-xs font-bold uppercase tracking-wide text-ink hover:bg-white/90"
        >
          {sponsor.cta}
        </a>

        {/* Abstract skyline anchoring the panel. */}
        <div className="mt-2 flex items-end justify-center gap-1" aria-hidden>
          {[10, 18, 14, 26, 20, 32, 16, 22, 12].map((height, i) => (
            <span
              key={i}
              style={{ height: `${height * 3}px` }}
              className="w-2.5 rounded-t-sm bg-white/12"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
