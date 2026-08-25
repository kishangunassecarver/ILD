/**
 * The canonical origin for this build, and whether this build is public.
 *
 * Set `SITE_URL` as a Cloudflare **build** variable to the live domain when the
 * site goes public. Until then — every preview deployment — the site is treated
 * as not-yet-public: `robots.txt` disallows everything and pages carry
 * `noindex`, so a `*.workers.dev` preview can never be indexed and later
 * compete with the real domain for the same content.
 *
 * Safe by default in the direction that matters: forgetting to set it costs you
 * indexing you did not want yet, rather than leaking a staging site into search
 * results. Server-only — imported by the layout, sitemap and robots routes.
 */
import { SITE } from "./cms";

function normalise(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    // Reject anything that is not a usable absolute origin.
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

const configured = normalise(process.env.SITE_URL);

/** Cloudflare and Netlify preview hosts are never the canonical site. */
function isPreviewHost(url: string): boolean {
  try {
    return /\.(workers|pages|netlify)\.(dev|app)$/i.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

/**
 * True for any build that should not be indexed: no SITE_URL set, or one that
 * names a preview host.
 */
export const IS_PREVIEW = !configured || isPreviewHost(configured);

/** Absolute origin used for metadataBase, canonical URLs and the sitemap. */
export const SITE_URL = configured ?? SITE.url;
