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
    <article className={cn("panel card-hover group overflow-hidden p-2", className)}>
      <Link href={href} className="block">
        <Tile
          seed={deal.slug}
          image={deal.image}
          className={cn("rounded-[0.875rem]", layout === "wide" ? "h-40" : "h-[6.75rem]")}
        >
          {/* The discount flash is the whole point of the card. */}
          <span className="absolute left-2 top-2 rounded-pill bg-coral-500 px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wide text-white shadow-rail">
            {deal.badge}
          </span>
        </Tile>

        <div className="p-2.5 pt-3">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-snow transition group-hover:text-aqua-600">
            {deal.business}
          </h3>
          <p className="line-clamp-2 mt-0.5 text-[0.8125rem] font-semibold text-aqua-600">
            {deal.title}
          </p>
          {layout === "wide" && (
            <p className="line-clamp-2 mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
              {deal.blurb}
            </p>
          )}
          <p className="mt-2 text-[0.6875rem] font-medium text-muted">
            Valid until {longDate(deal.validUntil)}
          </p>
        </div>
      </Link>
    </article>
  );
}
