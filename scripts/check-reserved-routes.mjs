/**
 * Guards the reserved-route list in lib/cms.ts against drift.
 *
 * Why this exists: under `output: export`, a WordPress page served by the
 * catch-all route writes the same out/<path>/index.html as a built-in route,
 * and silently overwrites it. A page titled "Events" replaced the entire events
 * hub in testing, with no warning anywhere in the build.
 *
 * So if someone adds app/jobs/ and forgets to add "jobs" to RESERVED_TOP_LEVEL,
 * an editor can quietly delete that section by naming a page after it. This
 * fails the build instead. Runs as part of `prebuild`.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const entries = await readdir(path.join(root, "app"), { withFileTypes: true });
const routes = entries
  .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("_"))
  .map((e) => e.name)
  .sort();

const source = await readFile(path.join(root, "lib", "cms.ts"), "utf8");
const start = source.indexOf("RESERVED_TOP_LEVEL = new Set([");

if (start === -1) {
  console.error("[routes] could not find RESERVED_TOP_LEVEL in lib/cms.ts");
  process.exit(1);
}

const block = source.slice(start, source.indexOf("]);", start));
const listed = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// Entries with a dot are files served at the root (sitemap.xml, robots.txt),
// which have no directory in app/ to compare against.
const listedDirs = listed.filter((name) => !name.includes("."));

const unguarded = routes.filter((r) => !listedDirs.includes(r));
const stale = listedDirs.filter((l) => !routes.includes(l));

if (unguarded.length || stale.length) {
  console.error("[routes] RESERVED_TOP_LEVEL in lib/cms.ts is out of step with app/:");
  if (unguarded.length) {
    console.error(`  routes with no guard (a CMS page could overwrite these): ${unguarded.join(", ")}`);
  }
  if (stale.length) {
    console.error(`  guarded but no longer a route: ${stale.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[routes] ${routes.length} routes, all guarded against CMS page collisions`);
