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
import type {
  BottomNavItem,
  Deal,
  Event,
  FooterColumn,
  Hub,
  HubSlug,
  Listing,
  NavItem,
  Page,
  Post,
  Sponsor,
} from "./types";

/** Still code-owned: icon-backed shortcuts and home-page tab structure. */
export { QUICK_ACTIONS, SOCIALS, TOP_PICK_TABS } from "./data";

type Overrides = {
  site?: Partial<typeof defaults.SITE>;
  hubs?: Hub[];
  listings?: Listing[];
  events?: Event[];
  deals?: Deal[];
  posts?: Post[];
  sponsors?: Sponsor[];
  bottomNav?: { visibility?: string; items?: BottomNavItem[] };
  nav?: NavItem[];
  footer?: FooterColumn[];
  pages?: Page[];
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
 * The floating bottom navigation.
 *
 * Editors can hide the bar entirely, or replace the items wholesale. An item
 * needs a label and a link to be worth rendering; the icon falls back to a map
 * pin if the name is not one the site knows, so a typo degrades rather than
 * breaks. See components/ui/Icon.tsx for the list.
 */
export const BOTTOM_NAV = {
  visible: (overrides.bottomNav?.visibility ?? defaults.BOTTOM_NAV.visibility) !== "hide",
  items: use(
    overrides.bottomNav?.items?.filter((i) => present(i?.label) && present(i?.href)),
    defaults.BOTTOM_NAV.items
  ) as BottomNavItem[],
};

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

/**
 * Navigation, managed in WordPress under Appearance → Menus.
 *
 * A menu with nothing assigned to its location falls back to the structure in
 * lib/data.ts, so the site is never left without navigation — the single worst
 * thing an editor could do to it by accident.
 */
export const NAV: NavItem[] = use(
  overrides.nav?.filter((item) => present(item?.label) && present(item?.href)),
  defaults.NAV
);

export const FOOTER: FooterColumn[] = use(
  overrides.footer?.filter((c) => present(c?.heading) && present(c?.links)),
  defaults.FOOTER
);

/**
 * Top-level paths owned by the site's own route files.
 *
 * This list must stay in step with the directories in `app/`. It is the real
 * guard, not a convenience: under `output: export` a catch-all page writes the
 * same `out/<path>/index.html` as a built-in route and **silently overwrites
 * it** — a WordPress page called "Events" replaced the whole events hub in
 * testing. The plugin refuses to emit colliding paths too, but the site cannot
 * depend on the CMS behaving.
 */
const RESERVED_TOP_LEVEL = new Set([
  "about",
  "blog",
  "contact",
  "deals",
  "discover",
  "eat-drink",
  "events",
  "help",
  "join",
  "list-your-business",
  "privacy",
  "rewards",
  "saved",
  "search",
  "services",
  "shop",
  "stay",
  "terms",
  "things-to-do",
  "sitemap.xml",
  "robots.txt",
]);

/**
 * Sections whose child paths are generated from a collection, so the whole
 * namespace underneath them is off limits — /eat-drink/anything is a listing.
 *
 * Everything else is only reserved at the exact path, which is why a child page
 * like /about/our-team is perfectly fine: /about is a route file, but nothing
 * generates paths beneath it.
 */
const RESERVED_NAMESPACES = [
  "eat-drink",
  "stay",
  "things-to-do",
  "shop",
  "services",
  "events",
  "deals",
  "blog",
];

function collidesWithRoute(path: string): boolean {
  if (RESERVED_TOP_LEVEL.has(path)) return true;
  return RESERVED_NAMESPACES.some((ns) => path.startsWith(`${ns}/`));
}

/**
 * Pages authored in WordPress, served by the catch-all route.
 *
 * No defaults: an empty list simply means nobody has written any.
 */
export const PAGES: Page[] = (overrides.pages ?? [])
  // A page with no prose still earns a URL if it indexes children — several
  // imported section pages are empty because the old site's theme generated
  // their listing, and dropping them left the main menu pointing at 404s.
  .filter((p) => present(p?.path) && present(p?.title) && (present(p?.html) || present(p?.children)))
  .map((p) => ({ ...p, path: p.path.replace(/^\/+|\/+$/g, "") }))
  .filter((p) => {
    if (!collidesWithRoute(p.path)) return true;
    // Surfaces in the build log, so a shadowed page is diagnosable rather than
    // just mysteriously absent.
    console.warn(
      `[cms] skipping WordPress page "/${p.path}" — that path belongs to a built-in section of the site. Rename or move the page.`
    );
    return false;
  });

export function getPage(path: string): Page | undefined {
  return PAGES.find((p) => p.path === path.replace(/^\/+|\/+$/g, ""));
}

/**
 * The section a page belongs to, and everything else in it.
 *
 * Computed here rather than sent by the CMS: PAGES already holds every page, so
 * asking WordPress to repeat each article's 30-odd siblings would multiply the
 * payload for information the site can work out from a path.
 */
export function pageSection(path: string): { section?: Page; siblings: Page[] } {
  const clean = path.replace(/^\/+|\/+$/g, "");
  const slash = clean.indexOf("/");

  if (slash === -1) return { siblings: [] };

  const sectionPath = clean.slice(0, slash);

  return {
    section: PAGES.find((p) => p.path === sectionPath),
    siblings: PAGES.filter((p) => p.path.startsWith(`${sectionPath}/`)).sort((a, b) =>
      a.title.localeCompare(b.title)
    ),
  };
}

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
