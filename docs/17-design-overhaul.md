# 17 — Design Overhaul (Yelp-style layout, Buisnez brand)

A **presentation-only** redesign. It rebuilds the visual layer and key page layouts to feel like a modern, photo-forward discovery site (the patterns that make Yelp work) while keeping Buisnez's own brand, and **without changing any feature, API, route, schema, or business logic.**

## Brand boundary (non-negotiable)

- **Adopt (patterns — fine to use):** dual-field search, sticky header, category bar, photo hero, activity-card feed, category tiles, city→searches block, list+map results, tabbed profile, hover/loading motion.
- **Never copy (trade dress — do not use):** Yelp's logo/wordmark, its red (`#FF1A1A`/`#D32323`), its proprietary fonts, its illustrations, or its exact wording. Use Buisnez colors, fonts, icons (lucide), and original copy.

---

## Design tokens

Define these as CSS variables + Tailwind theme in `@buisnez/config`. Replace the Phase 3 tokens.

### Color

```
/* Brand */
--emerald-900: #06392B;   /* header bg, deepest */
--emerald-700: #0B5D45;   /* primary */
--emerald-500: #12886A;   /* primary hover / accents */
--emerald-100: #E3F2EC;   /* tint / selected chips */
--saffron-500: #E9A227;   /* secondary accent (CTAs, highlights) */
--saffron-600: #C77D0A;   /* saffron text on light */

/* Rating */
--star-gold:   #F5A623;   /* gold stars — NOT red */

/* Neutrals */
--ink:      #16201C;      /* headings */
--body:     #333B37;      /* body text */
--muted:    #6B7280;      /* secondary text */
--border:   #E5E7EB;
--surface:  #FFFFFF;      /* cards */
--canvas:   #F7F8F7;      /* page bg / section bands */

/* Status */
--open:   #12886A;        /* "Open now" */
--closed: #B42318;        /* "Closed" — sparingly */
```

- **Primary buttons:** emerald-700 → emerald-500 on hover. **Accent/CTA pills:** saffron. **Header:** emerald-900 with white text (Buisnez's answer to Yelp's charcoal bar).

### Typography

- **Display / headings:** "Plus Jakarta Sans" (or "Sora"). **Body:** "Inter". Both via `next/font` (self-hosted, no external CSS). Urdu later: "Noto Nastaliq Urdu" (i18n seam already in place).
- Scale (rem): display 2.75 / h1 2.0 / h2 1.5 / h3 1.25 / lg 1.125 / base 1.0 / sm 0.875 / xs 0.75. Headings weight 700–800, body 400–500. Line-height 1.2 headings / 1.55 body.

### Shape, elevation, motion

- Radius: cards 12px, inputs 10px, **primary CTAs pill (9999px)**, chips pill.
- Shadow: `sm` (subtle border-shadow on cards), `md` (hover), `lg` (dropdowns/modals).
- Motion: 160ms `ease-out` default. Card hover = `translateY(-2px)` + shadow `md`. Card image hover = `scale(1.03)` inside `overflow-hidden`. Dropdowns fade+slide 120ms. Skeleton shimmer for loading. Sticky header gains a shadow after scroll. **Respect `prefers-reduced-motion`** (disable transforms).

---

## Global chrome

### Header (sticky, emerald-900)

- Left: Buisnez logo (wordmark; commission/replace the placeholder).
- Center: **dual-field search** — “Find” (business/category) + “Near” (city/area, defaults to Lahore) + a round saffron/emerald search button. Collapses to a single tap-to-open search on mobile.
- Right: “For Business”, “Write a Review”, “Log In”, and a filled **“Sign Up”** button.
- Second row: **category bar** with dropdown menus (Restaurants, Health, Beauty, Automotive, Home Services, Entertainment, More) → each links into `/[city]/[category]`.

### Footer (light `--canvas`)

- Multi-column: About · Discover · For Business · Cities · Languages (English now; Urdu/Roman Urdu listed as “coming soon”). Buisnez copyright + “Made in Pakistan”.

---

## Homepage sections (map to existing data)

Rebuild `/` with these bands, top to bottom. Each names the data source — **use existing endpoints; compose, don't invent.**

1. **Hero** — full-width Lahore cityscape/food photo, dark gradient overlay, big headline + the dual-field search centered on it. (Static asset; no new API.)
2. **Recent Activity feed** — responsive **3-col grid (1 col mobile, 2 tablet)** of photo-led cards: reviewer avatar + name + timestamp, business photo, business name, gold stars + count, review snippet with “Read more”, and a row of action icons (helpful, etc.). Source: recent reviews + recent photos (the Phase 2 “recent” discovery data). _If a combined public activity feed isn’t already exposed, a single read-only endpoint may be added — see the guardrail below._
3. **Popular categories** — tile grid (2×4), each an icon (lucide) + label + subtle hover. Source: categories.
4. **Explore by city** — selectable **city chips** (lead with Lahore), and under the active city, columns of **“Popular in {city}”** and **“Trending in {city}”**. Source: categories + the existing trending discovery block. **Do NOT fabricate “Top/Seasonal Searches”** — Buisnez doesn’t track search terms; use categories/trending instead (or omit).
5. **Featured & Highly-rated** — horizontal scroll rows of `BusinessCard`s. Source: featured + highly-rated (Bayesian) discovery blocks.
6. **Recently reviewed** — compact link list of business names. Source: recent.

---

## Key components

### BusinessCard (the workhorse — used on search, city, category, home)

Photo-forward: 16:9 image (hover zoom), name (h3), gold stars + numeric rating + review count, `category · area`, price level (₨ PKR), **Open now / Closed** badge (server-computed `isOpenNow`), one-line snippet. Whole card hover-lifts and links to the profile. Skeleton variant for loading.

### Search results page (Yelp's signature)

Desktop: **list on the left, sticky map on the right** (split view). Mobile: list with a “Map” toggle. Filters as a left rail / top sheet: category, city/area, rating, price, features, open-now, sort. Filters live in the URL (already true — keep it). Hovering a result highlights its map marker.

### Business profile page

Sticky sub-header (name + rating + primary CTAs: Directions, Call, Save, Write a Review). **Photo gallery hero.** Sectioned/tabbed body: Overview, Reviews, Photos, Services/Menu. **Sticky right sidebar**: hours (with open-now), contact, map, features. Reviews list with sub-ratings + owner replies. All this content already exists — this is layout + styling only.

### Rating stars

Gold (`--star-gold`), half-star support, always paired with the numeric value + count.

---

## Guardrails (read before coding)

- **Presentation only.** Do not change existing API contracts, request/response shapes, database schema (no writes/migrations), auth, guards, moderation, or any business logic. Do not rename routes.
- **The one bounded exception:** if a homepage section genuinely can’t be composed from existing endpoints (e.g. a unified recent-activity feed), you may add a **single read-only** endpoint that only reads existing data. No new tables, no writes, no auth changes. Log it in PROGRESS. Prefer composing from what exists.
- **Reuse, don’t rebuild, the data layer:** the typed API client, TanStack Query, Zustand, next-intl, shared Zod schemas all stay. Swap the _visual_ layer (tokens, components, layouts) underneath them.
- Read the **frontend-design** skill first; keep it distinct and intentional, not templated, no stereotypes.
- All new strings via next-intl (English). `next/image` for all images. Strict TS. Logical CSS for future RTL.
- **Accessibility must not regress** — the Phase 9 a11y fixes (labeled comboboxes, labeled links) must survive; every new interactive element has an accessible name.

---

## Acceptance

- Homepage, search results (list+map), city/category pages, and business profile are visually rebuilt to this spec; the app looks like a designed, photo-forward discovery product with Buisnez’s emerald/saffron identity — clearly not a Yelp brand copy.
- Zero feature/API/route/schema/logic changes (except an optional single read-only endpoint, if unavoidable, logged).
- Motion is tasteful and respects reduced-motion; loading uses skeletons.
- `pnpm lint && typecheck && build` clean; full backend + Playwright suites still green (fix only selectors that legitimately moved); a11y checks still pass.
- Browser-verified on desktop and 375px mobile (screenshots in PROGRESS).
