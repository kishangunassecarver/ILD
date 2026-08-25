import Link from "next/link";
import { MapPin } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { Tile } from "@/components/ui/Tile";
import type { Event } from "@/lib/types";
import { cn, dateTile } from "@/lib/utils";

export function EventCard({
  event,
  compact = false,
  className,
}: {
  event: Event;
  compact?: boolean;
  className?: string;
}) {
  const href = `/events/${event.slug}`;
  const { day, month } = dateTile(event.date);

  return (
    <article
      className={cn(
        "panel card-hover group flex flex-col overflow-hidden",
        compact && "w-[13.5rem]",
        className
      )}
    >
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        <Tile
          seed={event.slug}
          image={event.image}
          className={compact ? "h-[6.5rem]" : "h-40 sm:h-44"}
        >
          {/* The date tile is the card's anchor — it reads before the title. */}
          <div className="absolute left-2.5 top-2.5 overflow-hidden rounded-lg bg-white text-center shadow-rail">
            <div className="px-2 pt-1 text-base font-extrabold leading-none text-brand-500">
              {day}
            </div>
            <div className="px-2 pb-1 text-[0.5625rem] font-bold uppercase tracking-wider text-muted">
              {month}
            </div>
          </div>
        </Tile>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink">
          <Link href={href} className="transition hover:text-brand-500">
            {event.title}
          </Link>
        </h3>

        <p className="text-xs text-muted">{event.dateLabel ?? event.venue}</p>

        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">{event.dateLabel ? event.venue : event.area}</span>
        </p>

        {!compact && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{event.blurb}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="chip pointer-events-none py-1 text-[0.6875rem]">{event.category}</span>
          <SaveButton label={event.title} className="shrink-0" />
        </div>
      </div>
    </article>
  );
}
