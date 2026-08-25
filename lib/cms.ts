/**
 * CONTENT SOURCE — WordPress (headless) layered over code defaults.
 *
 * `lib/data.ts` holds the canonical defaults. At build time
 * `scripts/fetch-wp-content.mjs` writes whatever WordPress returned into
 * `content.generated.json`, and this module layers it on top.
 *
 * Components import from here, never from data.ts directly, so a field the
 * editors have not filled in — or a WordPress that is down at build time —
 * simply keeps the default copy.
 *
 * The selectors at the bottom are the only way pages should reach for content:
 * they guarantee a stable order, so the static export is reproducible.
 */
import rawOverrides from "./content.generated.json";
import * as defaults from "./data";
import type { Deal, Event, Hub, HubSlug, Listing, Post, Sponsor } from "./types";

/** Design-coupled: nav structure, tokens and footer stay in code. */
export { NAV, QUICK_ACTIONS, FOOTER, SOCIALS, TOP_PICK_TABS } from "./data";

type Overrides = {
  site?: Partial<typeof defaults.SITE>;
  hubs?: Hub[];
  listings?: Listing[];
  events?: Event[];
  deals?: Deal[];
  posts?: Post[];
  sponsors?: Sponsor[];
  appPromo?: Partial<typeof defaults.APP_PROMO>;
  newsletter?: Partial<typeof defaults.NEWSLETTER>;
  stats?: typeof defaults.STATS;
  businessPlans?: typeof defaults.BUSINESS_PLANS;
};

const overrides = rawOverrides as unknown as Overrides;

/** Blank strings and empty lists count as "not filled in", not as "clear this". */
function present<T>(v: T | undefined | null): v is T {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function use<T>(override: T | undefined | null, fallback: T): T {
  return present(override) ? override : fallback;
}

function mergeFields<T extends object>(fallback: T, override?: Partial<T> | null): T {
  if (!override) return fallback;
  const out = { ...fallback };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const value = override[key];
    if (present(value)) out[key] = value as T[keyof T];
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Merged content
 * ---------------------------------------------------------------------- */

export const SITE = mergeFields(defaults.SITE, overrides.site);
export const APP_PROMO = mergeFields(defaults.APP_PROMO, overrides.appPromo);
export const NEWSLETTER = mergeFields(defaults.NEWSLETTER, overrides.newsletter);
export const STATS = use(overrides.stats, defaults.STATS);
export const BUSINESS_PLANS = use(overrides.businessPlans, defaults.BUSINESS_PLANS);
export const SPONSORS = use(overrides.sponsors, defaults.SPONSORS);

/**
 * Hubs are structural — the routes are files on disk, so an editor cannot add
 * or remove one. WordPress may only retitle and re-describe the hubs that exist.
 */
export const HUBS: Hub[] = defaults.HUBS.map((hub) => {
  const override = overrides.hubs?.find((h) => h.slug === hub.slug);
  return mergeFields(hub, override);
});

/*
 * Normalisation at the boundary.
 *
 * WordPress omits every field an editor left blank — deliberately, so that a
 * partly-filled entry keeps the built-in wording rather than blanking it. That
 * means an entry can arrive missing things the TypeScript types declare as
 * required, and the types would be quietly lying about the data.
 *
 * So coerce here, once: give every declared field a value of the right type,
 * and drop only entries that cannot be salvaged. Skipping this is not
 * theoretical — a single listing published without a Category crashed site
 * search on `category.toLowerCase()`.
 */

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function normaliseListing(raw: Partial<Listing> | null | undefined): Listing | null {
  // A listing with no slug, no name, or no valid hub has no page to live on.
  if (!raw || !present(raw.slug) || !present(raw.name)) return null;
  if (!HUBS.some((h) => h.slug === raw.hub)) return null;

  return {
    ...raw,
    slug: raw.slug,
    name: raw.name,
    hub: raw.hub as HubSlug,
    category: str(raw.category),
    area: str(raw.area),
    rating: num(raw.rating),
    reviews: num(raw.reviews),
    blurb: str(raw.blurb),
    tags: list(raw.tags),
  };
}

function normaliseEvent(raw: Partial<Event> | null | undefined): Event | null {
  if (!raw || !present(raw.slug) || !present(raw.title) || !present(raw.date)) return null;

  return {
    ...raw,
    slug: raw.slug,
    title: raw.title,
    date: raw.date,
    venue: str(raw.venue),
    area: str(raw.area),
    category: str(raw.category) || "Events",
    blurb: str(raw.blurb),
  };
}

function normaliseDeal(raw: Partial<Deal> | null | undefined): Deal | null {
  if (!raw || !present(raw.slug) || !present(raw.title)) return null;

  return {
    ...raw,
    slug: raw.slug,
    title: raw.title,
    business: str(raw.business) || raw.title,
    badge: str(raw.badge) || "OFFER",
    validUntil: str(raw.validUntil),
    category: str(raw.category) || "Deals",
    area: str(raw.area),
    blurb: str(raw.blurb),
  };
}

function normalisePost(raw: Partial<Post> | null | undefined): Post | null {
  if (!raw || !present(raw.slug) || !present(raw.title) || !present(raw.body)) return null;

  return {
    ...raw,
    slug: raw.slug,
    title: raw.title,
    date: str(raw.date),
    author: str(raw.author),
    category: str(raw.category) || "Durban",
    excerpt: str(raw.excerpt),
    body: list(raw.body),
  };
}

/**
 * Listings, events and deals are wholesale replacements: if WordPress returns
 * any, it owns the whole collection. Editors are told this explicitly, because
 * a half-migrated directory is worse than either extreme.
 */
export const LISTINGS: Listing[] = use(overrides.listings, defaults.LISTINGS)
  .map(normaliseListing)
  .filter((l): l is Listing => l !== null);

export const EVENTS: Event[] = use(overrides.events, defaults.EVENTS)
  .map(normaliseEvent)
  .filter((e): e is Event => e !== null)
  .sort((a, b) => a.date.localeCompare(b.date));

export const DEALS: Deal[] = use(overrides.deals, defaults.DEALS)
  .map(normaliseDeal)
  .filter((d): d is Deal => d !== null);

/** Newest first — the one collection where recency is the whole ordering. */
export const POSTS: Post[] = use(overrides.posts, defaults.POSTS)
  .map(normalisePost)
  .filter((p): p is Post => p !== null)
  .sort((a, b) => b.date.localeCompare(a.date));

/* -------------------------------------------------------------------------
 * Selectors
 * ---------------------------------------------------------------------- */

export function getHub(slug: string): Hub | undefined {
  return HUBS.find((h) => h.slug === slug);
}

/** Featured entries first, then alphabetical — stable across builds. */
function byPromise(a: Listing, b: Listing): number {
  if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export function listingsIn(hub: HubSlug, category?: string | null): Listing[] {
  return LISTINGS.filter((l) => l.hub === hub && (!category || l.category === category)).sort(
    byPromise
  );
}

export function getListing(hub: HubSlug, slug: string): Listing | undefined {
  return LISTINGS.find((l) => l.hub === hub && l.slug === slug);
}

/** Everything in the same hub and category, minus the one being viewed. */
export function relatedListings(listing: Listing, limit = 3): Listing[] {
  const sameCategory = LISTINGS.filter(
    (l) => l.hub === listing.hub && l.slug !== listing.slug && l.category === listing.category
  );
  const sameHub = LISTINGS.filter(
    (l) => l.hub === listing.hub && l.slug !== listing.slug && l.category !== listing.category
  );
  return [...sameCategory.sort(byPromise), ...sameHub.sort(byPromise)].slice(0, limit);
}

/** Which filter chips actually have listings behind them. */
export function activeFilters(hub: Hub): string[] {
  const populated = new Set(LISTINGS.filter((l) => l.hub === hub.slug).map((l) => l.category));
  return hub.filters.filter((f) => populated.has(f));
}

/**
 * Businesses for the home-page spotlight.
 *
 * Featured entries first, then the best-rated of the rest. Topping up matters:
 * this is the only place on the home page that shows businesses at all, so a
 * directory with a few listings and none of them flagged would otherwise leave
 * the page with no businesses on it — which is exactly what happened when the
 * first real listing replaced the seed data.
 */
export function spotlightListings(limit = 8): Listing[] {
  const rank = (a: Listing, b: Listing) => b.rating - a.rating || a.name.localeCompare(b.name);
  const featured = LISTINGS.filter((l) => l.featured).sort(rank);
  const rest = LISTINGS.filter((l) => !l.featured).sort(rank);
  return [...featured, ...rest].slice(0, limit);
}

export function featuredListings(limit = 8): Listing[] {
  return LISTINGS.filter((l) => l.featured)
    .sort(byPromise)
    .slice(0, limit);
}

export function getEvent(slug: string): Event | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

/**
 * Events, soonest first.
 *
 * Deliberately date-agnostic: a static export is built once and served for
 * days, so filtering against the build machine's clock would silently drop
 * events that are still ahead of the visitor. Editors unpublish past events.
 */
export function upcomingEvents(limit?: number): Event[] {
  const sorted = [...EVENTS];
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export function eventCategories(): string[] {
  return [...new Set(EVENTS.map((e) => e.category))].sort();
}

export function getDeal(slug: string): Deal | undefined {
  return DEALS.find((d) => d.slug === slug);
}

export function deals(limit?: number): Deal[] {
  const sorted = [...DEALS].sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export function dealCategories(): string[] {
  return [...new Set(DEALS.map((d) => d.category))].sort();
}

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function sponsorFor(placement: Sponsor["placement"]): Sponsor | undefined {
  return SPONSORS.find((s) => s.placement === placement);
}

/** Every area with at least one listing, for the location filters. */
export function areas(): string[] {
  return [...new Set(LISTINGS.map((l) => l.area))].sort();
}
