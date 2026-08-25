/**
 * Pulls site content from WordPress and writes lib/content.generated.json,
 * which lib/cms.ts layers over the defaults in lib/data.ts.
 *
 * Runs automatically before `next build` (see the "prebuild" script).
 *
 * Configure with WORDPRESS_URL, e.g.
 *   WORDPRESS_URL=https://cms.ilovedurban.co.za
 *
 * This never fails the build. If WordPress is unset, unreachable, slow or
 * returns junk, it writes {} and the site ships its default content.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "lib",
  "content.generated.json"
);
const ENDPOINT = "/wp-json/ilovedurban/v1/content";
const TIMEOUT_MS = 20_000;

/** Keys lib/cms.ts understands. Anything else WordPress sends is ignored. */
const ALLOWED = new Set([
  "site",
  "hubs",
  "listings",
  "events",
  "deals",
  "posts",
  "sponsors",
  "bottomNav",
  "appPromo",
  "newsletter",
  "stats",
  "businessPlans",
]);

async function write(content, note) {
  await writeFile(OUT, JSON.stringify(content, null, 2) + "\n", "utf8");
  console.log(`[cms] ${note}`);
}

/** Collections are the bulk of the payload; report their size, not their contents. */
function describe(content) {
  return Object.entries(content)
    .map(([key, value]) => (Array.isArray(value) ? `${key} (${value.length})` : key))
    .join(", ");
}

async function main() {
  const base = process.env.WORDPRESS_URL?.trim().replace(/\/+$/, "");

  if (!base) {
    await write({}, "WORDPRESS_URL not set — building with default content from lib/data.ts");
    return;
  }

  let url;
  try {
    url = new URL(base + ENDPOINT);
  } catch {
    await write({}, `WORDPRESS_URL is not a valid URL (${base}) — using default content`);
    return;
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    await write(
      {},
      `refusing to fetch content over ${url.protocol} — use https. Using default content`
    );
    return;
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let payload;
  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      await write({}, `WordPress replied ${res.status} ${res.statusText} — using default content`);
      return;
    }
    payload = await res.json();
  } catch (err) {
    await write({}, `could not reach WordPress (${err.message}) — using default content`);
    return;
  }

  // A CMS with nothing published in it is a normal state, not a fault. PHP
  // encodes an empty map as "[]", so accept an empty array as "no content"
  // rather than reporting a malformed response and alarming whoever reads the
  // build log. A *populated* array is still wrong — the payload is a map.
  if (Array.isArray(payload) && payload.length === 0) {
    await write({}, `${url.host} has no published content yet — using default content`);
    return;
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    await write({}, "WordPress returned an unexpected shape — using default content");
    return;
  }

  const content = {};
  const skipped = [];
  for (const [key, value] of Object.entries(payload)) {
    if (ALLOWED.has(key)) content[key] = value;
    else skipped.push(key);
  }

  const filled = Object.keys(content);
  await write(
    content,
    filled.length
      ? `loaded from ${url.host}: ${describe(content)}` +
          (skipped.length ? ` (ignored unknown: ${skipped.join(", ")})` : "")
      : `${url.host} returned no recognised fields — using default content`
  );
}

main().catch(async (err) => {
  // Belt and braces: an unexpected crash must still leave a valid file behind.
  console.warn(`[cms] unexpected error: ${err?.message ?? err}`);
  await write({}, "wrote empty overrides after error — using default content");
});
