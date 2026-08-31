import { cn, artStyle } from "@/lib/utils";

/**
 * Card artwork. Uses the CMS image when there is one, and otherwise a stable
 * gradient derived from the slug so a half-populated directory still looks
 * deliberate rather than broken.
 */
export function Tile({
  seed,
  image,
  alt,
  className,
  children,
}: {
  seed: string;
  image?: string;
  alt?: string;
  className?: string;
  /** Overlays: date tiles, discount flashes, save buttons. */
  children?: React.ReactNode;
}) {
  return (
    // The gradient is painted even when there IS an image: a slow or broken
    // photo URL (demo content, a dead link) then degrades to the deliberate
    // slug-derived art instead of a flat empty tile.
    <div className={cn("tile-art", className)} style={artStyle(seed)}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, images are unoptimized
        <img
          src={image}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* A light scrim only when something is overlaid — bare photos stay
          clean, as in the reference. */}
      {children != null && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent"
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}
