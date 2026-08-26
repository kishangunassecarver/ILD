/**
 * Exports the built-in content from lib/data.ts into the plugin as JSON, so the
 * WordPress "Starter content" importer can create it as real, editable posts.
 *
 * Run with `npm run seed:export` after changing lib/data.ts. The output is
 * committed so the plugin zip is self-contained.
 *
 * lib/data.ts stays the source of truth. Once the importer has run, WordPress
 * owns the content and lib/data.ts is only the fallback for a CMS that has
 * nothing published in it.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  BOTTOM_NAV,
  BUSINESS_PLANS,
  DEALS,
  EVENTS,
  FOOTER,
  HUBS,
  LISTINGS,
  NAV,
  POSTS,
  SPONSORS,
} from "../lib/data";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "wordpress", "seed-content.json");

/**
 * The invented numbers, separated out so the importer can offer them as an
 * explicit opt-in. Venue names, areas and descriptions are real; these are not,
 * and they should not arrive in a CMS looking like verified data.
 */
const PLACEHOLDER_FIELDS = ["rating", "reviews"] as const;

function splitListing(listing: (typeof LISTINGS)[number]) {
  const placeholders: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(listing)) {
    if ((PLACEHOLDER_FIELDS as readonly string[]).includes(key)) placeholders[key] = value;
    else rest[key] = value;
  }

  return { ...rest, __placeholders: placeholders };
}

const seed = {
  /** Bumped when the shape changes, so the importer can refuse a stale file. */
  version: 1,
  generated: "run npm run seed:export to refresh",
  hubs: HUBS,
  listings: LISTINGS.map(splitListing),
  events: EVENTS,
  deals: DEALS,
  posts: POSTS,
  sponsors: SPONSORS,
  plans: BUSINESS_PLANS,
  menus: {
    primary: NAV,
    footer: FOOTER,
    bottom: BOTTOM_NAV.items,
  },
};

const counts = [
  `${seed.hubs.length} hubs`,
  `${seed.listings.length} listings`,
  `${seed.events.length} events`,
  `${seed.deals.length} deals`,
  `${seed.posts.length} posts`,
  `${seed.sponsors.length} sponsors`,
  `${seed.plans.length} plans`,
  `${seed.menus.primary.length} main menu items`,
  `${seed.menus.footer.length} footer columns`,
];

// Wrapped rather than using top-level await: tsx transpiles this to CJS, which
// does not support it.
async function main() {
  await writeFile(out, JSON.stringify(seed, null, 2) + "\n", "utf8");
  console.log(`[seed] wrote wordpress/seed-content.json — ${counts.join(", ")}`);
}

main().catch((err) => {
  console.error(`[seed] ${err?.message ?? err}`);
  process.exit(1);
});
