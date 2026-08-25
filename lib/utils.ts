/** Small helpers with no content or layout opinions of their own. */
import type { CSSProperties } from "react";

/** Join class names, dropping anything falsy. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Deterministic placeholder artwork.
 *
 * Every listing, event and deal gets a stable gradient derived from its slug, so
 * cards look intentional before real photography is loaded through the CMS and
 * never reshuffle between builds.
 */
const PALETTE: [string, string][] = [
  ["#0E4C92", "#12B5CB"], // harbour
  ["#0B7A75", "#4FC3A1"], // sea glass
  ["#B23A48", "#E8734A"], // sunset
  ["#5B2AA8", "#C2409B"], // night market
  ["#1F6F4A", "#8CC63F"], // botanic
  ["#123B63", "#3E7CB1"], // deep water
  ["#8A4B08", "#E3A008"], // spice
  ["#3D2C8D", "#6D5DD3"], // stadium lights
];

export function artFor(seed: string): { from: string; to: string; angle: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  const [from, to] = PALETTE[hash % PALETTE.length];
  // Four fixed angles rather than a free rotation — keeps the grid calm.
  const angle = [135, 160, 200, 115][hash % 4];
  return { from, to, angle };
}

export function artStyle(seed: string): CSSProperties {
  const { from, to, angle } = artFor(seed);
  return { backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})` };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-09-24" → { day: "24", month: "SEP" } for the event date tile. */
export function dateTile(iso: string): { day: string; month: string } {
  const [, month, day] = iso.split("-");
  const index = Number(month) - 1;
  return { day: day ?? "--", month: MONTHS[index] ?? "" };
}

/** "2026-09-24" → "24 September 2026". Locale-free so server and client agree. */
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = LONG_MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${Number(day)} ${name} ${year}`;
}

/** Thousands separated with a space, the South African convention: 1 209. */
export function groupNumber(value: number): string {
  return value.toLocaleString("en-ZA").replace(/,/g, " ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
