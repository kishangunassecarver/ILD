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

1. Build the plugin zip:
   ```bash
   npm run plugin:zip
   ```
   It bundles the PHP and the starter-content JSON into
   `wordpress/ilovedurban-headless-cms.zip`.
2. In WordPress: **Plugins → Add New → Upload Plugin**, choose the zip, install,
   then **Activate**. Upgrading over an existing copy is fine — choose
   *Replace current with uploaded*.
3. An **I Love Durban** menu appears in the sidebar, with a heart icon.

It needs no other plugins — not ACF, not WPGraphQL. Core WordPress only.

## Part 3 — Import the starter content (do this first)

Go to **I Love Durban → Starter Content** and click **Import starter content**.

The site ships with built-in content so it is never blank, but that content lives
in the code where you cannot touch it — and the moment you publish one listing of
your own, WordPress takes over the whole collection and the built-in ones
disappear. Importing brings it all in as ordinary posts instead: 5 hubs,
42 listings, 8 events, 6 deals, 3 sponsors, 3 business plans, and both menus.

You then start from something populated and edit or delete entries one at a time,
like anything else in WordPress. No cliff edge.

**Safe to run more than once.** Anything already present is left exactly as it
is, so a second run cannot overwrite something you have edited. It fills gaps
only.

**The ratings checkbox.** The venue names, areas, categories and descriptions in
the starter content are real. The **star ratings and review counts are
invented** — they exist so the card layouts could be designed against
realistic-looking data. Leave the box unticked and listings arrive without
ratings, ready for real numbers; a listing with no rating simply shows no stars.
Tick it only if you need the site to look populated for a demo, and replace them
before launch.

## Part 4 — Add your content

**I Love Durban → Site Copy & Deploy** holds the one-off copy: the tagline, site
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

### Images

Two ways to give a listing a picture, and the first wins if both are set:

1. **Featured Image** — the normal WordPress way. Upload once, reuse anywhere.
2. **Image URL** — for a photo hosted somewhere else, so you can paste a
   licensed URL without pulling the file into the media library.

**Landscape, around 1600×900 or wider.** Card and hero tiles are wide bands, so
a square or portrait photo gets cropped to a thin horizontal slice through the
middle. A square logo makes a poor hero.

**Photo credit** is a separate field, and it is not optional for anything you
did not shoot or receive from the business. It renders quietly in the corner of
the hero.

> **Do not take photographs from a business's own website.** They belong to that
> business or its photographer, and republishing them here is copyright
> infringement — on a platform whose pitch to those same businesses is that it
> supports them. The routes that work: ask the business (the claim-your-listing
> flow exists for this), licensed Google Places photos, Creative Commons images
> from Wikimedia for landmarks, or a commissioned shoot you own outright.

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
sponsor per placement — the first published entry wins.

What you can control per sponsor, without a developer:

| Field | Does |
|---|---|
| Logo URL | The wordmark. Blank sets their name in type instead. |
| Logo size | small / medium / large. Medium suits most; large for a square mark. |
| Featured image or Image URL | Background photograph. |
| Darkening | 0–100 over that photo. Blank means 60. Lower it for artwork already built to sit behind text. |
| Button colour / Button text colour | Any CSS colour, e.g. `#FFB800`. Blank keeps the site default. |
| Panel colour, from / to | The panel's gradient, as two CSS colours. Blank on both gives the site navy. |

Leave the panel colours blank and you get navy — never a colourless panel.

The *Gradient classes* field is a legacy escape hatch and best left alone. It
takes Tailwind syntax, which only works for values that already exist in the
code, so anything typed there that the developers have not added produces no
colour at all. That is exactly what emptied the title band. Use **Panel colour,
from / to** instead.

**Blog posts** are ordinary WordPress posts. The first category becomes the
post's label on the site, the excerpt becomes the card summary, and the content
is split into paragraphs. HTML in the body is stripped to plain text.

**Anything you leave blank keeps the wording already in the code.** You can
migrate one section at a time; there is no need to fill everything in before the
first publish.

**Within a collection, publishing *any* entry replaces the whole collection.**
Publish one Listing and WordPress owns all of them, so the built-in ones stop
being used. That is deliberate — a directory that is half real and half sample
data is worse than either — and it is exactly why Part 3 exists. Once the
starter content is imported there is nothing left in the code to lose, and this
rule stops mattering.

## Part 5 — Connect the two services

**a. Tell the site where WordPress lives.** In the Cloudflare dashboard, open
your project → **Settings → Build → Build variables and secrets** → add:

```
WORDPRESS_URL = https://cms.ilovedurban.co.za
```

(no trailing slash, and `https://`).

> This is a *build* variable, not a runtime one. The site reads it during
> `npm run build` and bakes the result in; nothing reads it once the site is
> live. Adding it under **Settings → Variables & Secrets** instead will be
> rejected with *"Variables cannot be added to a Worker that only has static
> assets"* — that Worker has no script, so it has nowhere to read runtime
> variables from. Correct behaviour, wrong menu.

Redeploy. The build log will show:

```
[cms] loaded from cms.ilovedurban.co.za: site, listings (48), events (12), ...
```

That line is your confirmation, and the counts tell you how much came through.
If it instead says *using default content*, the site built from code defaults —
the reason is printed on the same line.

**b. Let WordPress trigger rebuilds.** In Cloudflare, create a **Deploy hook**
for the project (Settings → Builds → Deploy hooks), copy the URL, and paste it
into **I Love Durban → Site Copy & Deploy → Cloudflare deploy hook URL**.

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

## Owner Submissions — claims, edits and enquiries

Business owners can create a free account on the website and, from
**My business** (`/my-business/`), claim their listing and submit changes to it.
Nothing they submit goes live on its own — it all lands in
**I Love Durban → Owner Submissions**, and this screen is where you decide.

One-time connection: enter the deployed site's URL and the admin token. The
token has to match the Worker's `ADMIN_TOKEN` secret
(`npx wrangler secret put ADMIN_TOKEN` in the site repo) — it is what stops
anyone else reading the queue.

Three queues appear:

- **Claims.** Someone says a listing is theirs. *Verify before approving* —
  call the business on a number you find independently, or ask for an email
  from the business's own domain. Approving hands them edit access to that
  listing; rejecting (with an optional reason) shows them the reason on their
  dashboard.
- **Edits.** A field-by-field table of what the listing says now against what
  the owner wants it to say. **Apply & publish** writes the change into the
  listing post — exactly as if you had typed it into the meta box yourself —
  and triggers a rebuild. Owners can only touch contact details, hours,
  descriptions and the like; ratings, featuring and URLs are not editable
  from outside, whatever the queue claims.
- **Enquiries.** Everything sent through the List Your Business form. Marking
  one handled just clears it from the list.

## Migrating from the old ilovedurban.co.za

**I Love Durban → Import from Live Site** copies the attraction articles and the
blog across from the old site over its public API.

**Link structure is preserved.** Slugs and section structure come across as they
are, so `/durban/golden-mile/` stays `/durban/golden-mile/`. Existing links and
search rankings keep working, and nothing needs redirecting.

The four sections holding the attraction articles:

| Section | Articles |
|---|---|
| `/durban/` | 23 |
| `/south-coast/` | 33 |
| `/north-coast/` | 34 |
| `/kzn-and-midlands/` | 34 |

That is 124 articles, plus 20 blog posts. The old site has 183 pages in total,
but the rest are theme demo pages ("Grid With Sidebar 1", "Masonry Filtering")
and shop scaffolding ("Cart", "Checkout", "My account", "Lost Password") that a
directory plugin created for itself. Importing those would produce 100-odd junk
URLs, which is why the importer takes named sections rather than everything.

### What gets cleaned up on the way in

The old pages are built with Elementor, so each one is around 25KB of widget
markup — roughly 58 links and 50 list items of which are the theme's sidebar
navigation rendered inline, plus several advertiser panels. Imported verbatim you
would get 124 pages of duplicated navigation with the article buried inside.

So the importer takes the prose out of the first text widget and leaves the rest
behind. In testing across ten pages that turned ~25KB of markup into ~1.9KB of
clean article — about 1,400 words of prose, correct headings, and the article's
own photograph rather than an advertiser's. If the markup ever stops matching,
the page is imported whole rather than empty, so nothing is silently lost.

### Copying the media across

The content importer links images back to the old site rather than copying them,
so the new site depends on the old one staying up. **I Love Durban → Copy Media**
fixes that: it pulls every one of those files into this media library, promotes
them to real featured images, and rewrites every reference.

Roughly 144 files — one per article, since the article prose itself carries no
images. It works in batches of eight and continues on its own, so leave the page
open for a couple of minutes. Safe to stop and resume; anything already copied is
skipped, and it counts what is left every time you open it.

The old site has to stay online until this finishes. When the page reports that
nothing points at it any more, it is safe to switch off.

### Putting the articles in the menu

**I Love Durban → Attractions Menu** builds it for you. It adds an
**Attractions** item to the main menu, placed immediately after Things to Do,
with a mega-menu flyout: each imported section becomes a column, listing a few of
its attractions and ending in a link through to the full section page.

**Things to Do keeps its own dropdown** — the hub filters (Beaches, Adventure,
Culture & Heritage and so on). The two are separate: Things to Do is for
browsing the directory by category, Attractions is the editorial article tree.
The same screen has a tickbox to restore Things to Do's built-in columns, in case
an earlier run of this tool replaced them.

All 124 cannot go in the dropdown — 34 links in one column is a wall of text
nobody reads — so it shows eight per column by default, which keeps four columns
readable. The section pages carry the complete lists. Change the count on that
screen if you want more or fewer.

It **rebuilds** the branch rather than adding to it, so running it twice is safe.
The flip side is that anything you added under Things to Do by hand gets
replaced. Fine-tune the result in Appearance → Menus afterwards; nothing stops
you reordering or removing individual links there.

## Menus

Both menus are managed in the ordinary **Appearance → Menus** screen, with
drag-and-drop and nesting. Two menu locations are registered:

**I Love Durban — main menu.** Nesting depth carries meaning:

| Level | Becomes |
|---|---|
| Top level | A item in the header bar |
| Second level | A column heading inside that item's dropdown |
| Third level | The links under that heading |

A second-level item with no children of its own is treated as a plain link and
collected into a column headed "Explore". An item with no children at all is
just a link in the bar, with no dropdown.

**I Love Durban — footer.** Simpler: top level are the column headings, their
children are the links. A heading with no children is skipped.

Use **Custom Links** for anything that is not a page — `/eat-drink`, `/deals`,
`/events` and so on. Links to your own WordPress site are rewritten to be
relative automatically, so the CMS hostname never ends up in the front end.

**If a menu location has nothing assigned, the site falls back to the built-in
navigation.** Deleting a menu cannot leave the site without navigation.

Editing a menu triggers a rebuild, the same as publishing content.

## Pages

Write them in the ordinary **Pages** screen. Publishing a page called
"Durban July Guide" puts it at `/durban-july-guide`; a page nested under a
parent lands at `/parent/child`. The full block editor works — headings, lists,
links, images, tables, quotes — and the site styles it to match.

Add the page to a menu (Appearance → Menus → Pages) for it to be linked from
anywhere.

**Some paths are taken by the site's own sections** and a page cannot use them:
the five hubs, `events`, `deals`, `blog`, `discover`, `search`, `saved`, `join`,
`rewards`, `list-your-business`, `about`, `contact`, `help`, `terms` and
`privacy`. Anything *underneath* a hub is taken too — `/eat-drink/anything` is
always a listing.

A page on a taken path is skipped, and the build log says which and why:

```
[cms] skipping WordPress page "/events" — that path belongs to a built-in
section of the site. Rename or move the page.
```

Child pages elsewhere are fine: `/about/our-team` works, because nothing else
generates paths under `/about`.

> One caution worth knowing: page content is published as HTML, so anyone who
> can publish a page can put arbitrary markup on the live site. Keep publish
> rights to people you trust, with two-factor on their accounts.

## What is *not* editable from WordPress

Deliberately left in code, because it is design or structure rather than content:

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
