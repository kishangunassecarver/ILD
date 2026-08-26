import type { CSSProperties } from "react";
import type { Sponsor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The pieces of a sponsor panel that every placement shares.
 *
 * A partner supplies either a wordmark or nothing (in which case their name is
 * set in type), optionally a background photograph, and optionally their own
 * button colours. All independent, so the same three placements work for a
 * partner with a full asset pack and for one who sent a name and a link.
 */

/** Background photograph plus scrim, layered over the panel's gradient. */
export function SponsorBackdrop({ sponsor }: { sponsor: Sponsor }) {
  if (!sponsor.image) return null;

  // Without a scrim, white copy over an arbitrary photo is a coin toss — but a
  // partner who has supplied artwork built for this may want less of it.
  const opacity = typeof sponsor.overlay === "number" ? Math.min(100, Math.max(0, sponsor.overlay)) : 60;

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
      <div
        className="absolute inset-0 bg-ink"
        style={{ opacity: opacity / 100 }}
        aria-hidden
      />
    </>
  );
}

/**
 * How tall a wordmark may sit, per placement.
 *
 * Written as literal classes so Tailwind generates them — a value coming from
 * the CMS could not produce a utility, since Tailwind scans source rather than
 * data.
 */
const LOGO_HEIGHTS = {
  title: {
    small: "max-h-16 sm:max-h-20 lg:max-h-24",
    medium: "max-h-28 sm:max-h-36 lg:max-h-40",
    large: "max-h-36 sm:max-h-44 lg:max-h-52",
  },
  band: {
    small: "max-h-5",
    medium: "max-h-7",
    large: "max-h-9",
  },
  sidebar: {
    small: "max-h-8",
    medium: "max-h-12",
    large: "max-h-16",
  },
  leaderboard: {
    small: "max-h-8 sm:max-h-10",
    medium: "max-h-12 sm:max-h-14",
    large: "max-h-16 sm:max-h-20",
  },
} as const;

export type LogoSlot = keyof typeof LOGO_HEIGHTS;

/**
 * The partner's wordmark, or their name set in type.
 *
 * Height is capped rather than fixed, and width left to the image's own aspect
 * ratio, so tall square marks and wide horizontal ones both sit correctly.
 */
export function SponsorMark({
  sponsor,
  slot,
  typeClassName,
  className,
}: {
  sponsor: Sponsor;
  slot: LogoSlot;
  /** Applied when falling back to type. */
  typeClassName: string;
  className?: string;
}) {
  if (sponsor.logo) {
    const size = sponsor.logoSize ?? "medium";

    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, images are unoptimized
      <img
        src={sponsor.logo}
        alt={sponsor.name}
        loading="eager"
        decoding="async"
        className={cn("w-auto max-w-full object-contain object-left", LOGO_HEIGHTS[slot][size], className)}
      />
    );
  }

  return <p className={cn(typeClassName, className)}>{sponsor.name}</p>;
}

/**
 * The partner's button colours, or nothing so the placement's default stands.
 *
 * Inline styles because the values come from the CMS; see the note on the
 * Sponsor type.
 */
export function sponsorCtaStyle(sponsor: Sponsor): CSSProperties | undefined {
  const style: CSSProperties = {};

  if (sponsor.ctaBg) style.backgroundColor = sponsor.ctaBg;
  if (sponsor.ctaText) style.color = sponsor.ctaText;

  return Object.keys(style).length ? style : undefined;
}
