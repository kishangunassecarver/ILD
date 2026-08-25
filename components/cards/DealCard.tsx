import Link from "next/link";
import { Tile } from "@/components/ui/Tile";
import type { Deal } from "@/lib/types";
import { cn, longDate } from "@/lib/utils";

export function DealCard({
  deal,
  layout = "stacked",
  className,
}: {
  deal: Deal;
  /** "stacked" for the sidebar tower, "wide" for the deals grid. */
  layout?: "stacked" | "wide";
  className?: string;
}) {
  const href = `/deals/${deal.slug}`;

  return (
    <article className={cn("panel card-hover group overflow-hidden", className)}>
      <Link href={href} className="block">
        <Tile
          seed={deal.slug}
          image={deal.image}
          className={layout === "wide" ? "h-40" : "h-[6.75rem]"}
        >
          {/* The discount flash is the whole point of the card. */}
          <span className="absolute left-0 top-2.5 rounded-r-md bg-brand-500 px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wide text-white shadow-rail">
            {deal.badge}
          </span>
        </Tile>

        <div className="p-3.5">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink transition group-hover:text-brand-500">
            {deal.business}
          </h3>
          <p className="line-clamp-2 mt-0.5 text-xs text-muted">{deal.title}</p>
          {layout === "wide" && (
            <p className="line-clamp-2 mt-1.5 text-xs leading-relaxed text-muted">{deal.blurb}</p>
          )}
          <p className="mt-2 text-[0.6875rem] font-medium text-muted">
            Valid until {longDate(deal.validUntil)}
          </p>
        </div>
      </Link>
    </article>
  );
}
