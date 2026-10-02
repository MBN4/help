# 18 — Yelp-style UI roadmap (phase-by-phase)

Goal: make every public page of the web app look and behave like Yelp, one **phase per branch**, merged into
`main` after each phase. This file is the single source of truth for "what is done / what is next" so a new
chat can pick up without any other context. Update the status table when a phase lands.

Related: `17-design-overhaul.md` (earlier design tokens/decisions), `PROGRESS.md` (backend + build phases).

## Status

| #   | Phase                                                                                                | Branch                          | Status                   |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------ |
| 0   | Yelp-style homepage: hero slider, transparent nav, activity cards, single city dropdown, mobile hero | `feat/yelp-style-home-ui`       | **Done, merged to main** |
| 1   | Bug fixes: admin pages overflow on phones, 404 wording                                               | `fix/phase-1-bugs`              | **Done, merged to main** |
| 2   | Yelp-style stars everywhere + "Find / Near" header search                                            | `feat/phase-2-stars-search-bar` | **Done, merged to main** |
| 3   | Search results page (map column) + business page                                                     | `feat/phase-3-search-business`  | **Done, merged to main** |
| 4   | Auth pages + reviewer profile + account pages                                                        | `feat/phase-4-auth-profile`     | **Next — not started**   |
| 5   | Category/city pages + hero photos                                                                    | `feat/phase-5-browse-hero`      | Not started              |
| 6   | Final full-site verification + docs                                                                  | `chore/phase-6-verification`    | Not started              |

**3 phases remain (4–6).** Do them in order; do not start the next until the user says so.

## Workflow rules (from the user)

- One branch per phase, named as above. Commit with conventional-commit messages (husky + commitlint run on
  commit). End commit messages with the `Co-Authored-By:` trailer the session instructs.
- When a phase is done: tell the user what changed, **wait for them to ask** before merging. Merge with
  `git merge --no-ff` into `main` (history uses `chore: merge …` commits), then stay on `main`.
- Do **not** change anything outside the phase's scope. When the user says "verify only", change no code.
- Verify visually: screenshot at 1440px and 375px (Playwright is installed in `apps/web`). Also check there is
  no horizontal overflow at 375 and 320px.
- Run `npx tsc --noEmit -p tsconfig.json`, `npx eslint <changed paths>` and `npx prettier --check` in `apps/web`.

## Phase details

### Phase 2 — Stars and header search

- **Yelp stars everywhere.** `apps/web/src/components/business/rating-badge.tsx` already draws Yelp's coloured
  rounded squares with white stars (used only by `activity-card.tsx`). The old gold `rating-stars.tsx` is still
  used in: `business-card.tsx`, `business-list-item.tsx`, `explore-by-city.tsx`, `rating-summary.tsx`,
  `review/review-card.tsx`, `business-owner/reviews-editor.tsx`, and pages `business/[slug]`,
  `reviewers/[userId]`, `account/reviews`, `account/businesses`. Replace or wrap so lists/cards/profile use the
  badge style; keep the interactive star _input_ in the review form as is.
- **Header search → "Find / Near".** Today the header search (`components/search/search-bar.tsx`,
  `variant="header"`) is "Find" + a category select; the city select was removed from it on purpose (the nav has
  a `LocationPicker`). Yelp has `Find` and `Near` fields in the search bar. Decide with the user how to keep
  one city control (e.g. move the picker into the bar as the "Near" field and drop the separate nav picker).
  Remember the earlier user request: **only one city dropdown in the nav.**

### Phase 3 — Search page and business page

- **Search results (`/search`)**: Yelp shows a map on the right. The right column is currently an empty gray
  block (map not rendering — investigate; `components/map/*`, `search-map-toggle.tsx`, and the Google Maps key
  issue noted in `PROGRESS.md`; the e2e `maps-real` test is skipped for lack of a key). Fix or give a
  proper placeholder.
- **Business page (`/business/[slug]`)**: map card is a gray block; a gray block sits under the rating summary
  (likely a skeleton that never resolves — check). Move closer to Yelp: photo mosaic header, action buttons,
  sticky side card with hours/address, review list styling.

### Phase 4 — Auth, reviewer profile, account

- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`: currently a centred generic
  card. Yelp uses a split layout (form + illustration). Keep the recent behaviour: password show/hide toggle,
  "Forgot password?" link under the field, back-to-login links (commit `a77fa5f`).
- `/reviewers/[userId]`: plain text today; Yelp has avatar, stats, photos, review list with photos.
- `/account/*` (profile, reviews, favourites, photos, businesses): functional but plain. Admin (`/admin/*`) has
  no Yelp equivalent — leave its look alone, just keep it responsive.

### Phase 5 — Browse pages and hero photos

- `/[city]` and `/[city]/[category]`: sparse. Make listing pages look like Yelp's category pages (filters,
  list, map).
- Hero slides currently use dark red gradients because `apps/web/public/` has **no images**. Each slide in
  `components/home/hero-carousel.tsx` accepts an optional `image` path; add licensed photos (ask the user for
  assets — do not invent photo credits) and a caption line like Yelp's.
- The homepage "Popular categories", "Explore by city", "Featured", "Highly rated" blocks may need Yelp-style
  polish too.

### Phase 6 — Final verification

- Re-run the full-site crawl (see "How to audit"), compare against Yelp references the user provides, fix
  leftovers, update `docs/PROGRESS.md` with a short entry, run lint/typecheck/build and the e2e suite (see the
  known failures listed at the bottom of `PROGRESS.md`).

## What the homepage looks like now (Phase 0 result)

- **Hero** (`components/home/hero-carousel.tsx`): 3 full-bleed slides, left-aligned headline + red pill link, no
  side arrows. Vertical timer bars on the left (one per slide); the active bar fills over 7s
  (`animate-hero-progress`, defined in `packages/config/tailwind/preset.ts`) and its `animationend` advances
  the slide. Pause button under the bars is the only thing that pauses (hover/focus pause was removed — it got
  stuck). No autoplay under `prefers-reduced-motion`. On phones slide 1 also shows the big `SearchBar`.
- **Header** (`components/layout/header-shell.tsx`): on `/` it is `fixed` + transparent with white text and
  turns solid white on scroll; elsewhere it is `sticky` white. Children opt in with
  `group-data-[overlay=true]/hdr:` Tailwind variants (logo, links, `LocationPicker`, `UserMenu`, `CategoryBar`).
- **Recent Activity cards** (`components/business/activity-card.tsx`): Yelp layout — avatar + "Name wrote a
  review" + relative time, divider, full-width photo, bold business name, `RatingBadge`, text + teal "Read
  more". There are no "added photos" cards because the API (`GET /discovery/recent-activity`) returns one
  business thumbnail per review.
- Header search no longer has its own city select; it scopes to the city in the URL.

## How to run and test locally

- `docker compose up -d` (Postgres 5544, Redis 6390, MinIO 9102/9103 — remapped ports). Containers stop on
  reboot.
- API: `cd apps/api && pnpm dev` (port 4000, health: `/api/v1/health`). Web: `cd apps/web && pnpm dev` (3000).
- Seed logins, all with password `Password123!`: `admin@buisnez.pk`, `owner@buisnez.pk`,
  `customer@buisnez.pk` (Ayesha Raza, id `40568f11-67c4-4e97-9208-a294fa8fee03`; ids can change on reseed).
  Demo business slug: `peshawar-heritage-restaurant`; demo city slug: `lahore`; category `food-dining`.
- Changing `packages/config/tailwind/preset.ts` needs `rm -rf apps/web/.next` and a dev-server restart,
  otherwise new utilities are silently missing.

## How to audit (all pages, desktop + phone)

Use a throwaway Playwright script in `apps/web` (delete it afterwards, put screenshots in the scratchpad):
load each route as visitor / customer / owner / admin at 1440px and 375px, record HTTP status, console
errors, broken images, and horizontal overflow (wait ~1.5s for client data; list elements whose
`getBoundingClientRect().right` exceeds the viewport). Log in through the real form: scope the selector to the
form containing `input[type=password]` (the first `button[type=submit]` on the page is the header search and is
hidden on phones). Routes: `/`, `/lahore`, `/lahore/food-dining`, `/business/<slug>`, `/search`, `/login`,
`/register`, `/forgot-password`, `/reset-password?token=x`, `/verify-email?token=x`, `/reviewers/<id>`,
`/account`, `/account/{reviews,favorites,photos,businesses}`, `/admin` and its sub-pages.

## Gotchas learned

- **Never `pkill -f` / `pgrep -f` with a pattern that also appears in your own command** (e.g. `next dev`) —
  it kills the shell (exit 144). Kill by PID.
- The Next dev server can balloon to several GB of RAM after heavy crawling and stop responding; restart it.
- A React "hydration mismatch" console warning appeared only right after clearing `.next` (mid-compile); it did
  not reproduce on a warm server. Treat as dev-mode noise unless it reproduces.
- Full-page screenshots miss lazy-loaded images below the fold and show gray blocks; scroll or use element
  screenshots before concluding an image is broken.
- Fixed-width inputs (`w-48`) in a flex row overflow on phones — use `min-w-0 flex-1 sm:w-48 sm:flex-none`.

## Phase 2 result (what changed)

- `components/business/rating-stars.tsx` was deleted. Every rating now uses `RatingBadge`
  (`rating-badge.tsx`, sizes `sm` / `md`, exported `ratingColour`): cards, lists, business page header and
  rating summary, review cards, reviewer profile, account pages, owner reviews editor. The rating-summary bars
  use the same red. The review-form input (`star-rating-input.tsx`) is unchanged and still gold.
- Header search (`search-bar.tsx`, `variant="header"`) is now **Find + Near**: the category select was removed
  from the header variant (the category bar covers it) and a city select with a pin icon was added. It starts
  on the city in the URL (`/lahore`) and submits `/search?q=&city=`. The desktop nav no longer renders the
  separate `LocationPicker` (still shown in the mobile row because the mobile header has no search bar).
- Gotcha: Radix `Select` fires `onValueChange("")` when its value goes undefined → set; use `||` not `??`
  when merging with a fallback, and pass the label explicitly as `SelectValue` children.
- Known limitation: on `/search?city=karachi` the header Near field still shows "All cities", because the
  header cannot read `?city=` without `useSearchParams` (forces a Suspense/CSR bailout in the layout).

## Phase 3 result (what changed)

- **Maps are now OpenStreetMap via Leaflet** (user's choice — the project has no Google Maps API key). Added
  `leaflet` + `@types/leaflet` to `apps/web`. `components/map/map-view.tsx` was rewritten (same
  `MapViewProps`, plus an optional marker `label`): red Yelp-style pins built as `L.divIcon` (no image assets),
  the search page numbers the pins to match the result list, popups link to the business, scroll-wheel zoom is
  off, `fitBounds` when there are several markers. Tiles come from `tile.openstreetmap.org` (keep the
  attribution; light-use policy — switch tile provider if traffic grows).
- The search page's desktop split-view map only mounts at `>= lg` (a hidden Leaflet map on phones wasted tile
  requests); phones use the "Show map" toggle. Markers are memoized so panning is not reset on re-render.
- Still on Google (out of scope, unchanged): the owner dashboard's `components/business-owner/pin-drop-map.tsx`
  and `components/map/use-google-maps-script.ts`; it falls back to manual coordinates without a key.
- The "gray blocks" seen in the Phase-1 audit were not bugs: they were the old map fallback panel and the
  "Log in to write a review" prompt, seen in full-page screenshots.
- **pnpm gotcha:** `pnpm add` here re-resolved the whole lockfile (~7,400 changed lines, eslint `jiti` variant)
  and broke the ESLint links. The lockfile was restored from git and only the leaflet entries were added by
  hand; `pnpm install --frozen-lockfile` then verified it. Prefer that approach for future dependency adds.
