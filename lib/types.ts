/**
 * The content model. Every shape here is what WordPress is allowed to fill in,
 * so keep it flat and editor-friendly — no nested unions, no functions.
 */

/** Top-level navigation, rendered as a mega menu on desktop. */
export interface NavColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface NavItem {
  label: string;
  href: string;
  /** Present on hubs that open a mega menu. */
  columns?: NavColumn[];
  /** Optional promo panel on the right of the mega menu. */
  feature?: { title: string; body: string; href: string; cta: string };
}

/** The coloured pills directly under the title-partner banner. */
export interface QuickAction {
  label: string;
  tagline: string;
  href: string;
  icon: IconName;
}

export type IconName =
  | "sparkles"
  | "compass"
  | "heart"
  | "calendar"
  | "tag"
  | "award"
  | "utensils"
  | "bed"
  | "ticket"
  | "shopping-bag"
  | "wrench"
  | "map-pin";

/**
 * A business, venue or attraction. One shape serves every hub — a restaurant,
 * a hotel and a plumber differ only in `hub`, `category` and which optional
 * fields are filled in.
 */
export interface Listing {
  slug: string;
  name: string;
  /** Which hub page it belongs to, e.g. "eat-drink". */
  hub: HubSlug;
  /** Sub-category within the hub, matching one of the hub's filters. */
  category: string;
  /** Suburb or precinct, e.g. "Umhlanga Rocks". */
  area: string;
  /** 0–5, one decimal. Placeholder until real review data is wired in. */
  rating: number;
  reviews: number;
  /** "$" to "$$$$" for food, or "R" bands elsewhere. Optional. */
  price?: string;
  /** One-line summary shown on cards. */
  blurb: string;
  /** Longer copy for the detail page. Paragraphs, one per array entry. */
  body?: string[];
  tags: string[];
  /** Label on the card's primary action, e.g. "Book a Table". */
  cta?: string;
  featured?: boolean;
  /** Contact block on the detail page. All optional. */
  address?: string;
  phone?: string;
  website?: string;
  hours?: string[];
  amenities?: string[];
  /** Absolute image URL from the CMS media library. Falls back to generated art. */
  image?: string;
}

export type HubSlug = "eat-drink" | "stay" | "things-to-do" | "shop" | "services";

/** A hub page: the landing page for a whole category of listings. */
export interface Hub {
  slug: HubSlug;
  label: string;
  /** Page headline, which may differ from the nav label. */
  title: string;
  intro: string;
  /** Filter chips across the top of the hub page. */
  filters: string[];
  /** Which listing CTA verb this hub uses by default. */
  defaultCta: string;
}

export interface Event {
  slug: string;
  title: string;
  /** ISO date, e.g. "2026-09-24". Drives the day/month tile and sorting. */
  date: string;
  /** Shown under the title, e.g. "24 – 26 September". Optional. */
  dateLabel?: string;
  venue: string;
  area: string;
  category: string;
  blurb: string;
  body?: string[];
  price?: string;
  ticketUrl?: string;
  featured?: boolean;
  image?: string;
}

export interface Deal {
  slug: string;
  title: string;
  business: string;
  /** The flash on the corner of the card, e.g. "20% OFF". */
  badge: string;
  /** ISO date the offer expires. */
  validUntil: string;
  category: string;
  area: string;
  blurb: string;
  terms?: string[];
  image?: string;
}

/** Paid placements. Deliberately data-driven so sales can rotate them. */
export interface Sponsor {
  name: string;
  /** Where it renders: the purple hero strip, the sidebar tower, the leaderboard. */
  placement: "title" | "sidebar" | "leaderboard";
  headline: string;
  subhead?: string;
  body?: string;
  cta: string;
  href: string;
  /** Tailwind gradient classes for the panel background. */
  art: string;
  /** Small print above the headline, e.g. "Proudly brought to you by". */
  eyebrow?: string;
}

/**
 * An editorial article. Maps onto WordPress's native `post` type rather than a
 * custom one, so editors write these in the place they already expect to.
 */
export interface Post {
  slug: string;
  title: string;
  /** ISO date published. */
  date: string;
  author: string;
  category: string;
  excerpt: string;
  body: string[];
  image?: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}
