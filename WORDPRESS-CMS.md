# WordPress as a headless CMS

Edit the directory in WordPress. Hit publish. The live site rebuilds itself.

Nobody ever visits the WordPress site — it is an editing dashboard only. Visitors
get the same static, fast Cloudflare-hosted site as before.

## How it fits together

```
WordPress (private admin)              GitHub + Cloudflare
┌──────────────────────────────┐            ┌───────────────────────────┐
│ Edit content → Publish       │ ──hook───▶ │ Cloudflare rebuilds       │
│                              │            │  1. prebuild fetches JSON │
│ GET /wp-json/ilovedurban/v1/ │ ◀──fetch── │  2. next build bakes it in│
│     content                  │            │  3. out/ deployed         │
└──────────────────────────────┘            └───────────────────────────┘
```

Content is fetched **once, at build time** — not by visitors' browsers. The site
stays a pure static export with no runtime dependency on WordPress, so WordPress
can be slow, or down, without affecting the live site.

**If WordPress is unreachable at build time, the build still succeeds** using the
default content in `lib/data.ts`. A broken CMS can never take the site down.

## Part 1 — Host WordPress

WordPress needs PHP and MySQL, so it cannot live on Cloudflare Pages next to the
site. Options, cheapest-effort first:

| Option | Notes |
|---|---|
| Existing hosting (cPanel, Xneelo, Afrihost) | Use a subdomain like `cms.ilovedurban.co.za`. Cheapest if you already pay for hosting. |
| Managed WP host | Simplest to maintain; roughly R100–R400/month. |
| WordPress.com | Requires the Business plan for custom plugins (~R500/month). |

Requirements: WordPress 6.0+, PHP 8.0+, and **HTTPS** (the fetch script refuses
plain HTTP for anything other than localhost).

Lock the admin down — strong passwords and two-factor. Only the
`/wp-json/ilovedurban/v1/content` endpoint needs to be publicly readable; it
returns the same content that is already visible on the website.

## Part 2 — Install the plugin

1. Zip the plugin file:
   ```bash
   cd wordpress && zip ilovedurban-headless-cms.zip ilovedurban-headless-cms.php
   ```
2. In WordPress: **Plugins → Add New → Upload Plugin**, choose the zip, install,
   then **Activate**.
3. An **ILD Content** menu appears in the sidebar.

It needs no other plugins — not ACF, not WPGraphQL. Core WordPress only.

## Part 3 — Add your content

**ILD Content → Site Copy & Deploy** holds the one-off copy: the tagline, site
description, search placeholder, popular-search chips, the app-promo panel, the
newsletter wording and the headline numbers.

Everything else is its own menu — **Hubs, Listings, Events, Deals, Sponsors,
Business Plans** — plus the ordinary **Posts** menu for the blog.

For every entry: the **post title** is its name or headline, the **featured
image** becomes the card and hero artwork, and ordering comes from the **Order**
field under *Page Attributes* (lowest first).

### The field formats

- *One per line* — e.g. a listing's opening hours:
  ```
  Mon – Sun · 12:00 – 15:00
  Mon – Sun · 18:00 – 22:00
  ```
- *Blank line between paragraphs* — the long "body" descriptions. One blank line
  starts a new paragraph.
- *Pipe-separated* — columns split by `|`. The headline numbers are
  `value|label`:
  ```
  4 200+|Local businesses listed
  310k|Monthly visitors
  ```

### Things worth knowing

**Listings** need a **Hub** (one of the five fixed hubs) and a **Category** that
matches one of that hub's filter chips — otherwise the listing is published but
no filter will show it. The hub's filter chips are listed on its Hubs entry.

**Hubs cannot be added or removed.** The five routes are files in the codebase.
A Hubs entry only retitles and re-describes an existing hub; the *Which hub is
this?* dropdown is how it is identified, not the post slug.

**Events** need a **Date** in `YYYY-MM-DD` form — it drives the date tile and the
calendar ordering. The optional *Date label* is what humans read
("24 – 26 September"); use it for ranges and recurring events.

**Sponsors** need a **Placement**: `title` (the band under the header),
`sidebar` (the tall tower) or `leaderboard` (the wide in-content banner). One
sponsor per placement — the first published entry wins. The *Gradient classes*
field is Tailwind syntax; ask the developers for the value rather than guessing.

**Blog posts** are ordinary WordPress posts. The first category becomes the
post's label on the site, the excerpt becomes the card summary, and the content
is split into paragraphs. HTML in the body is stripped to plain text.

**Anything you leave blank keeps the wording already in the code.** You can
migrate one section at a time; there is no need to fill everything in before the
first publish.

**But within a collection, publishing *any* entry replaces the whole
collection.** Publish one Listing and you become responsible for all of them —
the built-in seed listings disappear. That is deliberate: a directory that is
half real data and half sample data is worse than either.

## Part 4 — Connect the two services

**a. Tell the site where WordPress lives.** In the Cloudflare dashboard, open
your project → **Settings → Variables and Secrets** → add:

```
WORDPRESS_URL = https://cms.ilovedurban.co.za
```

(no trailing slash, and `https://`). Redeploy. The build log will show:

```
[cms] loaded from cms.ilovedurban.co.za: site, listings (48), events (12), ...
```

That line is your confirmation, and the counts tell you how much came through.
If it instead says *using default content*, the site built from code defaults —
the reason is printed on the same line.

**b. Let WordPress trigger rebuilds.** In Cloudflare, create a **Deploy hook**
for the project (Settings → Builds → Deploy hooks), copy the URL, and paste it
into **ILD Content → Site Copy & Deploy → Cloudflare deploy hook URL**.

Treat that URL as a secret: anyone holding it can trigger builds. Leave the
field blank and nothing breaks — you just rebuild manually from the dashboard
instead.

Publishing now rebuilds the site automatically, roughly 2–4 minutes to go live.
Rebuilds are throttled to one a minute, so a burst of edits does not queue up a
dozen builds.

## Day-to-day

Edit in WordPress → **Publish** → wait a few minutes → refresh the live site.
No code, no GitHub, no terminal.

Unpublishing and deleting published entries also trigger a rebuild, so taking a
listing down is the same two clicks as putting one up.

## What is *not* editable from WordPress

Deliberately left in code, because it is design or structure rather than content:

- **Navigation and the mega menus** (`NAV` in `lib/data.ts`) — the link
  structure has to match the routes that exist.
- **The footer columns** (`FOOTER`) — same reason.
- **Quick-action shortcuts** (`QUICK_ACTIONS`) — icons are components, not data.
- **Brand colours, spacing and type** (`tailwind.config.ts`).
- **Browser tab titles and search-engine descriptions** — SEO configuration,
  set in `app/layout.tsx` and each page's `generateMetadata`.
- **Which categories appear as home-page tabs** (`TOP_PICK_TABS`).

## Troubleshooting

**Build log says "using default content".** The same line gives the reason.
`WORDPRESS_URL not set` means the variable is missing in Cloudflare.
`replied 404` usually means the plugin is not activated. `could not reach` means
DNS, TLS or a firewall — check the endpoint in a browser:
`https://your-wp-site/wp-json/ilovedurban/v1/content` should return JSON.

**An edit didn't appear.** Confirm the post is **Published**, not a draft, then
check Cloudflare's **Deployments** tab for a build after your edit. No build
means the deploy hook is missing or wrong. Remember the one-per-minute throttle:
if you saved twice in quick succession, only the first triggered a build — save
again a minute later.

**A listing is published but doesn't show on its hub page.** Its **Category**
does not match one of that hub's filter chips. Filters only appear when at least
one listing sits behind them, so a typo makes the listing effectively invisible.

**All my seed content vanished.** You published an entry in that collection, so
it now owns the whole collection. Either finish migrating it, or unpublish
everything in that collection to fall back to the built-in content.

**A section vanished.** You published entries missing required fields — a
Listing with no hub, an Event with no date. Complete or unpublish them.

## Files involved

| File | Role |
|---|---|
| `wordpress/ilovedurban-headless-cms.php` | The plugin: post types, admin screens, REST endpoint, deploy hook |
| `scripts/fetch-wp-content.mjs` | Build-time fetch; always writes valid JSON, never fails the build |
| `lib/content.generated.json` | Build artifact — whatever WordPress returned |
| `lib/cms.ts` | Layers WordPress content over the defaults; components import from here |
| `lib/data.ts` | The default content. Still the source of truth for anything WordPress omits |
