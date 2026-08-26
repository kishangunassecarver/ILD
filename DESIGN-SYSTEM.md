# Design system

Tokens live in `tailwind.config.ts`; the component classes they compose into live
in `app/globals.css`. Nothing here is editable from WordPress — it is brand, not
content.

## Colour — the night theme

A deep-blue night theme in four layered surfaces — all four blues specified by
the client (2026-08-26 redesign). Sections separate by tone, not by outline:
page < header < raised section < card.

| Token | Value | Used for |
|---|---|---|
| `paper` | `#01122C` | The page itself — the darkest layer. |
| `night-900` | `#021734` | The header bar. |
| `night-800` | `#041D3B` | Raised sections: the search hub, menus, the trust bar. |
| `night` | `#011F3B` | Cards and panels — the lightest content surface. |
| `night-700` | `#06294B` | Hover tint, one step above cards (derived, not client-specified). |
| `aqua-500` / `-400` / `-300` | `#04A4B4` / `#16C2D2` / `#4DD7E3` | **Every action**: buttons, links, active chips, verified checks, the raised nav disc. 500 is the client's specified accent. |
| `coral-500` | `#F6514D` | Featured pills, deal flashes and the "Sponsored Partner" label — the client's specified red. |
| `brand-500` | `#F6514D` | The heart: logo, save buttons, and error states (`brand-400` on dark). Same family as coral so the site carries one red. |
| `snow` / `mist` / `muted` | `#FFFFFF` / `#B8C9D7` / `#8CA3B8` | Headings / secondary text / supporting text. |
| `line` | `rgba(184,201,215,0.16)` | Every border — soft blue-white, translucent so it reads evenly on all four surfaces. |
| `ink` | `#0A1A33` | Legacy navy — sponsor overlays, store badges, scrims. |
| `gold` | `#F5A623` | Star ratings and the title partner's default CTA. |

The rules: **aqua is for action, coral is for badges, red is only for love and
errors**. Cards are `night` on `paper`, separated by tone rather than outline.
Photos are inset inside cards with their own rounded corners — never full-bleed.
Sponsor panels are the only place other colours appear, from the sponsor's own
`art` gradient, and the hero fades into `paper` at its foot so the search and
quick actions sit in the blend.

## Type

**Plus Jakarta Sans Variable**, throughout. One family, self-hosted via
Fontsource — geometric-humanist, and legible at the small sizes a directory
full of dense cards actually runs at.

`font-display` is still a separate token in `tailwind.config.ts` even though it
points at the same face. It marks the places where type is doing a branding job
rather than a reading one — the logo lockup, sponsor names, hub tile labels,
the 404 — so those can be moved to a distinct display face later by editing one
line rather than hunting through eight components.

Those places need `font-extrabold` and negative tracking to carry weight. They
previously used Bebas Neue, a condensed caps-only face at a single weight, which
supplied both for free — and silently upper-cased anything passed to it.
Sponsor names now render as they are typed, which is what you want for a
wordmark like "Hollywoodbets".

Sizes stay small and dense, as a directory should: `text-xs` for supporting
detail, `text-sm` for card titles and body, `section-title` (`text-xl`/`1.375rem`
bold) for section headings, `text-2xl`/`3xl` extrabold for page titles.

## Shape and depth

- `rounded-card` (14px) for panels and cards; `rounded-lg` for inputs and
  buttons; `rounded-pill` for chips and badges.
- `shadow-card` at rest, `shadow-lift` on hover and for overlays, `shadow-rail`
  for small floating controls.
- Cards lift 2px on hover (`card-hover`). Nothing else moves.

## Component classes

Defined in `globals.css` so a variant is changed in one place:

| Class | What it is |
|---|---|
| `.shell` | The page container: `max-w-shell` (78rem) with responsive gutters. |
| `.panel` | The white card every surface is built from. |
| `.card-hover` | The 2px lift plus shadow change. |
| `.rail` | Horizontal scroll-snap carousel. Native scrolling; arrows are enhancement. |
| `.chip` / `.chip-active` | Filter and tag pills. |
| `.btn-primary` / `.btn-ghost` / `.btn-dark` | The three button weights. |
| `.field` | Every input, select and textarea. |
| `.section-title` | Section headings. |
| `.link-more` | The "View all →" links. |

## Layout

The recurring page shape is a two-column shell: `minmax(0,1fr)` of content and a
`19rem` sidebar that goes sticky below `lg`, collapsing to one column on mobile.
The `minmax(0,…)` matters — without it, a wide rail refuses to shrink and the
grid overflows.

Card grids are `sm:grid-cols-2 xl:grid-cols-3`. Rails use fixed-width cards
(`w-[15.5rem]` for listings, `w-[13.5rem]` for events).

## Placeholder artwork

`Tile` uses the CMS image when there is one and otherwise a gradient chosen from
an eight-colour palette by hashing the entry's slug (`artFor` in `lib/utils.ts`).
Deterministic, so cards never change colour between builds. Every tile carries a
bottom scrim so overlaid white text stays legible on any artwork.

## Accessibility

- Focus rings are `:focus-visible` only — keyboard users see them, pointer users
  do not.
- A skip link precedes the header.
- Icon-only controls carry `aria-label`; decorative icons carry `aria-hidden`.
- Filter chips are buttons with `aria-pressed`; result counts sit in an
  `aria-live="polite"` region.
- The FAQ uses native `<details>` — keyboard-accessible with no JavaScript.
- Section headings are real `h2`s referenced by `aria-labelledby`, never
  duplicated as visually-hidden copies.
- Everything collapses under `prefers-reduced-motion`.

## Two gotchas worth remembering

**Do not hand-roll line clamping.** Autoprefixer strips `-webkit-box-orient`, so
a custom `.clamp-2` clips text mid-line instead of ellipsising it. Use Tailwind's
built-in `line-clamp-*`.

**Never put padding on a clamped element.** `line-clamp-*` works via
`display: -webkit-box`, and on a padded box the line after the clamp bleeds into
the padding and is sliced in half rather than hidden. Put the padding on a
wrapper and the clamp on the text itself.

**`backdrop-filter` creates a containing block for `position: fixed`
descendants.** The header uses `backdrop-blur`, so the mobile drawer is rendered
as a *sibling* of the header, not a child — inside it, `fixed inset-0` would
clip to the height of the header bar.
