import type { Sponsor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The two halves of a sponsor panel that every placement shares.
 *
 * A partner supplies either a wordmark or nothing (in which case their name is
 * set in type), and optionally a background photograph. Both are optional and
 * independent, so the same three placements work for a partner with a full
 * asset pack and for one who sent through a name and a link.
 */

/** Background photograph plus scrim, layered over the panel's gradient. */
export function SponsorBackdrop({ sponsor }: { sponsor: Sponsor }) {
  if (!sponsor.image) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, images are unoptimized */}
      <img
        src={sponsor.image}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Without a scrim, white copy over an arbitrary photo is a coin toss. */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />
    </>
  );
}

/**
 * The partner's wordmark, or their name set in type.
 *
 * `height` caps the logo rather than fixing it, so tall square marks and wide
 * horizontal ones both sit correctly on the same row — the width is left to
 * the image's own aspect ratio.
 */
export function SponsorMark({
  sponsor,
  height,
  typeClassName,
  className,
}: {
  sponsor: Sponsor;
  /** Tailwind max-height classes, responsive. */
  height: string;
  /** Applied when falling back to type. */
  typeClassName: string;
  className?: string;
}) {
  if (sponsor.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, images are unoptimized
      <img
        src={sponsor.logo}
        alt={sponsor.name}
        loading="lazy"
        decoding="async"
        className={cn("w-auto max-w-full object-contain object-left", height, className)}
      />
    );
  }

  return <p className={cn(typeClassName, className)}>{sponsor.name}</p>;
}
