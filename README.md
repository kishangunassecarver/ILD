# I Love Durban — The Heartbeat of Our City

Durban's lifestyle and business platform: a multi-page directory of places, events
and deals, built as a static site with WordPress as a headless editing dashboard.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS** — design tokens in `tailwind.config.ts`
- **lucide-react** for icons; self-hosted fonts via Fontsource (Inter Variable, Bebas Neue)
- **Static export** (`output: "export"`) deployed to Cloudflare
- **WordPress** as a build-time-only CMS — see [WORDPRESS-CMS.md](WORDPRESS-CMS.md)

No client-side data fetching, no runtime dependency on WordPress, no database in
front of visitors. Every page in `out/` is a plain HTML file.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export into out/
```

To preview WordPress content locally before publishing:

```bash
WORDPRESS_URL=https://cms.ilovedurban.co.za npm run content && npm run dev
```

## Pages

| Route | What it is |
|---|---|
| `/` | Home — title partner, search, city calendar, top picks, hub tiles, app promo |
| `/discover` | Editorial hub: this weekend, first-time essentials, hidden gems, free things, neighbourhood guides |
| `/eat-drink`, `/stay`, `/things-to-do`, `/shop`, `/services` | The five directory hubs, each with filter chips, area and sort controls |
| `/<hub>/<slug>` | Listing detail — gallery, description, good-to-know, contact card, related places |
| `/events`, `/events/<slug>` | City calendar and event pages |
| `/deals`, `/deals/<slug>` | Offers and their terms |
| `/blog`, `/blog/<slug>` | Editorial, sourced from WordPress's native posts |
| `/search` | Client-side search across places, events and deals |
| `/list-your-business` | Sales page: benefits, the three plans, enquiry form |
| `/about`, `/contact`, `/help`, `/join`, `/rewards`, `/saved` | Marketing, support and member pages |
| `/terms`, `/privacy` | Legal — **drafts, see the warning below** |

`sitemap.xml` and `robots.txt` are generated from the same content as the pages,
so they cannot drift.

## Architecture

```
app/
  layout.tsx            header, title-partner band, quick actions, newsletter, footer
  page.tsx              home
  <hub>/page.tsx        five thin routes → components/hub/HubPage.tsx
  <hub>/[slug]/         five thin routes → components/hub/ListingDetail.tsx
  sitemap.ts robots.ts  generated from lib/cms.ts
components/
  layout/               Header (mega menu + drawer), TitlePartner, QuickActions,
                        SearchPanel, Newsletter, Footer, PageHeader
  hub/                  HubPage, HubBrowser (filters), ListingDetail
  cards/                ListingCard, EventCard, DealCard
  ads/                  Leaderboard, SponsorTower — data-driven placements
  forms/EnquiryForm     the only form primitive
  search/SearchResults  client-side ranking over the baked-in directory
  ui/                   Logo, Tile, Rail, Rating, SaveButton, Breadcrumbs, …
lib/
  types.ts              the content model
  data.ts               DEFAULT content — the fallback for everything
  cms.ts                WordPress layered over data.ts + all content selectors
  content.generated.json build artifact — whatever WordPress returned
  utils.ts              class names, placeholder artwork, date formatting
scripts/fetch-wp-content.mjs   build-time fetch; never fails the build
wordpress/                     the WordPress plugin
```

**Components import from `lib/cms.ts`, never from `lib/data.ts`.** That is what
makes a field the editors have not filled in fall back to the built-in copy.

The five hubs are separate route files rather than one `[hub]` dynamic route, so
the URLs are explicit and can never shadow `/events`, `/deals` or the marketing
pages.

## Before this goes live

Three things in this repo are deliberately unfinished, because they need real
input rather than a developer's guess:

1. **Seed content is placeholder.** The venues and events in `lib/data.ts` are
   real Durban places, but the **ratings, review counts, prices and offer terms
   are invented** so the layouts could be reviewed with realistic-looking
   content. Replace them with verified data — ideally by publishing the real
   directory from WordPress, which overrides all of it.
2. **`/terms` and `/privacy` are plain-language drafts, not legal documents.**
   They contain `[bracketed placeholders]` for company details and are marked
   with a warning in the source. POPIA requires a registered Information
   Officer, and trading terms need CPA and ECTA disclosures. Have an attorney
   review both before launch.
3. **Forms and the newsletter acknowledge locally and send nothing.** A static
   export has nowhere to POST to. Set `ENDPOINT` in
   `components/forms/EnquiryForm.tsx` and `components/layout/Newsletter.tsx` to
   a form handler (a Cloudflare Worker, Formspree, or the WordPress REST API).

Also worth doing before launch: drop the real logo artwork into
`components/ui/Logo.tsx` (one file, every placement goes through it), add real
photography through the CMS media library so `Tile` stops falling back to
generated gradients, and add brand SVGs for the social networks lucide does not
ship (TikTok, X).

## Deploy — GitHub → Cloudflare

The site is a static export, so it deploys anywhere static files are served.

1. **Push to GitHub**

   ```bash
   git init && git add -A && git commit -m "I Love Durban — initial build"
   git remote add origin https://github.com/YOUR-USERNAME/ilovedurban.git
   git branch -M main && git push -u origin main
   ```

2. **Connect Cloudflare Pages**

   Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to
   Git** → pick the repo, then:

   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npm run build`
   - Build output directory: `out`

   Add `WORDPRESS_URL` under **Settings → Variables and Secrets** once the CMS
   is up. Every `git push` redeploys; so does publishing in WordPress, via the
   deploy hook.

`wrangler.jsonc` is here as an alternative if you would rather deploy the
`out/` directory directly with `npm run deploy`.

## Notes

- **Placeholder artwork.** Until real photography is loaded, `Tile` renders a
  gradient derived from a hash of the entry's slug — stable across builds, so
  cards never reshuffle colours between deploys.
- **Search ships with the page.** The whole directory is in the bundle, so
  search is instant with no origin server. Past a few thousand listings, move to
  a prebuilt index rather than scanning arrays on every keystroke.
- **Paid placements are data.** `SPONSORS` in the CMS drives the title band, the
  sidebar tower and the in-content leaderboard, so sales can rotate partners
  without a code change. Every placement is labelled as advertising.
- **Reduced motion** is respected: transitions and smooth scrolling collapse
  under `prefers-reduced-motion`.
