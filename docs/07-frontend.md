# Frontend Architecture

Covers `apps/web`: App Router structure, the design system, data layers, i18n, the public discovery pages, and
(as of Phase 5) auth + the account/contributions UI. Reflects what actually shipped across Phase 3
(foundations), Phase 4 (public discovery), and Phase 5 (accounts & contributions) — see
[`PROGRESS.md`](PROGRESS.md) for the full deviation log.

## Folder map

```
apps/web/
  app/
    [locale]/
      layout.tsx               # root <html>/<body>: NextIntlClientProvider, QueryProvider, Header/Footer/MobileNav
      page.tsx                 # homepage (ISR, revalidate 600s)
      search/page.tsx          # search results (force-dynamic SSR — filters/sort live in the URL)
      [city]/page.tsx          # city hub (ISR, revalidate 600s)
      [city]/[category]/page.tsx  # city+category — the primary organic-traffic page (ISR)
      business/[slug]/page.tsx    # business profile (ISR, revalidate 600s)
      register/, login/, verify-email/, forgot-password/, reset-password/  # auth (CSR, no ISR/SEO value)
      auth/oauth-stub/page.tsx    # simulated provider consent screen (only reachable when OAuth is unconfigured)
      account/
        layout.tsx              # CSR, client-side auth gate (redirects to /login?returnTo=... if signed out)
        page.tsx                 # profile edit (name, bio, avatar)
        reviews/, photos/, favorites/page.tsx
    api/
      revalidate/route.ts      # on-demand ISR revalidation, protected by REVALIDATE_SECRET
    sitemap.ts                 # single sitemap.xml (all cities × categories + every PUBLISHED business)
    robots.ts
  middleware.ts                 # next-intl routing (app/[locale] with localePrefix: 'as-needed')
  src/
    components/
      ui/                     # shadcn/ui primitives (Button, Card, Input, Select, Sheet, Checkbox, Textarea, ...)
      layout/                 # Header, Footer, MobileNav, LocationPicker, Breadcrumb, UserMenu, CategoryBar (Phase 11)
      auth/                   # AuthCard, OAuthButtons
      business/               # BusinessCard (+BusinessCardSkeleton), RatingStars, PriceLevel, OpenNowBadge,
                               # FeatureList, HoursTable, FavoriteButton, StarRatingInput, ActivityCard (Phase 11,
                               # homepage feed), ExploreByCity (Phase 11), ServicesMenu (Phase 11),
                               # BusinessProfileActions (Phase 11, sticky sub-header CTAs)
      search/                 # SearchBar, FilterPanel, MobileFilterSheet, SortSelect, SearchMapToggle, UseMyLocationButton
      map/                    # MapView, LazyMapView (client-only wrapper), useGoogleMapsScript
      review/                 # ReviewCard, ReviewList, ReviewForm, ReviewSection, PhotoAttachments, AvatarUploadButton
      photo/                  # PhotoGallery
      report/                 # ReportButton (generic — business/review/photo/user)
      seo/                    # JsonLd script component
      providers/              # QueryProvider
    lib/
      api/                    # typed API client (fetch wrapper + endpoint functions), auth.ts, contributions.ts
      hooks/                  # TanStack Query hooks: useCities, useCategoryTree, useAreas, useFeatures,
                               # useSession/useInvalidateSession, usePhotoUpload
      stores/                 # Zustand: useUIStore (mobile filter sheet), useMapViewportStore
      seo/                    # buildMetadata helper, JSON-LD builders
      utils/                  # cn(), search-params helpers, maps directions-URL helpers, api-error-message,
                               # sub-rating-dimensions
      constants.ts            # DEFAULT_CITY_SLUG ('lahore'), SITE_NAME
    i18n/
      routing.ts, navigation.ts, request.ts
      messages/en.json        # message catalog — all UI copy lives here
    styles/globals.css
```

## Routing & i18n (final decision, Phase 4)

`app/[locale]` with `next-intl`, `localePrefix: 'as-needed'`, `defaultLocale: 'en'` — English URLs stay
prefix-free (`/lahore/restaurants`, not `/en/lahore/restaurants`). `hreflang` alternates are emitted by
`buildMetadata()` for every locale in `routing.locales` (currently just `en`); adding Urdu later is a routing
config change (`locales: ['en', 'ur']`) plus a second message catalog, not a URL restructure. `middleware.ts`
excludes `/api`, `/_next`, and any path with a file extension (so `/sitemap.xml`/`/robots.txt` are never
locale-routed).

Every string rendered in JSX comes from a message key — no hardcoded copy, including `alt` text, `aria-*`
labels, and metadata strings.

## Design system

- Tailwind theme extension lives in `@buisnez/config/tailwind/preset.ts` (shared) — brand color scale
  (`--primary-50..900`, a deep emerald), a warm saffron `--accent`, type scale, spacing, and radius tokens,
  consumed by `apps/web/tailwind.config.ts`. CSS variables defined in `src/styles/globals.css`.
- **shadcn/ui** primitives live in `apps/web/src/components/ui` and are copied-in code (not a dependency).
- Logical CSS properties (`ms-*`, `me-*`, `start-*`, `end-*`) throughout instead of `ml-*`/`mr-*`/`left-*`, so
  flipping `dir="rtl"` for Urdu later doesn't require rewriting layouts.

### Design overhaul (Phase 11)

Presentation-only rebuild per [`17-design-overhaul.md`](17-design-overhaul.md) — layout _patterns_ from
Yelp, Buisnez's own emerald/saffron identity. Full rationale, deviations, and real bugs found/fixed are in
`PROGRESS.md`'s Phase 11 entry; this section covers what the design system itself now looks like.

- **Tokens**: `emerald-900/700/500/100`, `saffron-500/600`, `star-gold`, `ink`, `canvas`, `surface`, and
  `status-open`/`status-closed` colors, a `pill` border-radius, a 3-step shadow scale, and `display`/`h1`/
  `h2`/`h3` named font sizes — all added alongside (not replacing) the existing xs–4xl scale and shadcn
  color slots. `--primary` now resolves to `emerald-700` (was a plain deep-emerald with no named relation to
  the header's own color); `--muted`/`--muted-foreground` now carry the spec's exact `canvas`/`muted-text`
  hex values.
- **Fonts**: Plus Jakarta Sans (`--font-display`, headings) + Inter (`--font-sans`, body), self-hosted via
  `next/font/google` in the root `[locale]/layout.tsx`. Phase 3's system-font-stack decision is superseded —
  this environment now has network access to Google Fonts (confirmed before switching), so the original
  build-time-dependency concern no longer applies.
- **Motion**: `.card-hover`/`.card-hover-image` and `.skeleton-shimmer` utility classes in `globals.css`,
  each with an explicit `@media (prefers-reduced-motion: reduce)` override that disables the transform/
  animation — not left to each component to remember.
- **Global chrome**: `Header` is now sticky `emerald-900` with a dual-field `SearchBar` (`variant="header"`)
  and a `CategoryBar` second row (flat scrollable links, not a dropdown mega-menu — see PROGRESS's
  deviations). `Footer` is a rich multi-column layout. Both fetch `getCities()`/`getCategoryTree()`
  server-side, same as before, just render more with the results.
- **`BusinessCard`** is the one component reused across home/search/city/category/similar-businesses — now
  16:9 photo-forward with hover-lift + image-zoom, gold `RatingStars`, and a `BusinessCardSkeleton` loading
  variant. Its `OpenNowBadge`/`FavoriteButton` overlay icons are siblings of the image `<Link>`, not
  children — nesting them inside caused a real `<a>`-in-`<a>` hydration bug, found and fixed this phase (see
  PROGRESS).
- **Search results** split into list + sticky map at `lg+` (`SearchMapToggle`'s `alwaysVisible` prop), and
  keeps the original toggle-button behavior below `lg`. No changes to filter/sort/URL logic.
- **Business profile** gained a sticky `BusinessProfileActions` sub-header (Directions/Call/Save/Write-a-
  review) and a `ServicesMenu` section — the latter renders `BusinessProfile.services`, which the API has
  returned since Phase 6 but no public page ever displayed.

## Data layers — server data vs. client state

1. **Server data**: server components fetch directly via the typed API client (`src/lib/api`); client
   components (filters, sort, map, location) use TanStack Query hooks wrapping the same client functions.
2. **Client/UI state**: Zustand — `useUIStore` (mobile filter sheet open/closed), `useMapViewportStore` (the
   map's current center/zoom, updated whenever the search page's resolved center changes and read by
   `MapView`). Filters and sort themselves are **not** duplicated into Zustand — the URL query string is the
   single source of truth, so results stay shareable/crawlable and a page load never disagrees with its URL.

## API client (`src/lib/api`)

Wraps `fetch` against `NEXT_PUBLIC_API_URL`. One shared `apiRequest()` unwraps the backend's
`{ success, data, meta }` / `{ success: false, error }` envelope, throws a typed `ApiError`
(`code`/`message`/`status`) on failure, and parses `data` through the matching Zod schema from
`@buisnez/shared` — a shape drift between API and client fails fast. `searchBusinesses()` takes
`Partial<BusinessSearchQuery>` directly (the same Zod-inferred type the API validates against) rather than a
redefined param type.

Endpoint functions: `getProvinces`, `getCities`, `getCity`, `getAreas`, `getCategoryTree`, `getCategory`,
`getBusiness`, `getBusinessReviews`, `getBusinessPhotos`, `getSimilarBusinesses`, `searchBusinesses`,
`getHomeDiscovery`, `getFeatures`, plus Phase 5's `auth.ts` and `contributions.ts` (below).

**Auth (Phase 5, final)**: every request sets `credentials: 'include'` (httpOnly cookies — see
[`10-auth-roles.md`](10-auth-roles.md)) and an `X-Requested-With: buisnez-web` header (required by the API's
`CsrfGuard` on every mutation). On a `401`, `apiRequest()` calls `POST /auth/refresh` once (concurrent 401s
share a single in-flight refresh via a module-level promise, so a burst of requests never fires N refreshes)
and retries the original request; if the refresh itself fails, the error surfaces normally. A `429` is
translated to a typed `RATE_LIMITED` `ApiError` so callers can show a friendly "slow down" message instead of
a generic failure. The old Bearer-token seam (`setAuthTokenGetter`/`setUnauthorizedHandler`) from the Phase 3
draft was removed — there's no token for the web client to hold, by design.

## SEO plumbing

- `src/lib/seo/metadata.ts` — `buildMetadata()`: title/description/canonical/hreflang-alternates/OpenGraph.
- `src/lib/seo/json-ld.ts` — `localBusinessJsonLd` (with nested `AggregateRating`), `breadcrumbListJsonLd`,
  `itemListJsonLd`, `reviewsJsonLd`. Rendered via the `<JsonLd>` component (`src/components/seo/json-ld.tsx`).
- `app/sitemap.ts` — one sitemap covering the homepage, `/search`, every city, every city×category
  combination, and every `PUBLISHED` business (paginated internally through the API's 50-per-page cap).
  ~986 URLs at current seed scale (16 cities × ~60 categories + statics + businesses), well under the
  50,000-URL single-file limit. Revisit `generateSitemaps()`-backed multiple files once published business
  count approaches ~30,000 (Phase 9).
- `app/robots.ts` — allows `/`, disallows `/api/`, points at `/sitemap.xml`.
- `app/api/revalidate/route.ts` — `POST`, header or query param `secret` checked against `REVALIDATE_SECRET`;
  revalidates `/`, `/business/:slug`, `/:city`, `/:city/:category` as given in the body. **Has real callers**
  (Phase 9 correction — this was stale): `RevalidateService.revalidate()`
  (`apps/api/src/integrations/revalidate/revalidate.service.ts`) is called from every business-owner mutation
  (info/hours/features/location/services/photos/replies, via a shared `revalidateAfterWrite()` helper in
  `business-owner.service.ts`) and from `reviews.service.ts`'s create/update path.
- Homepage (`app/[locale]/page.tsx`) emits `WebSite` (with a `SearchAction`) + `ItemList` JSON-LD of its
  featured/trending businesses (Phase 9) — it previously emitted none, unlike every other major page.

## Maps

`MapView` (`src/components/map`) renders a real Google Map when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
(lazily injecting the JS API script once per page, shared across every `MapView` instance via
`useGoogleMapsScript`), and a static "map unavailable, use directions" fallback otherwise — the search page
and business profile both work fully either way. It's always wrapped through `LazyMapView`
(`next/dynamic(..., { ssr: false })`) since Next.js forbids `ssr: false` dynamic imports directly inside a
Server Component; `LazyMapView` is the `'use client'` boundary that makes that legal. "Get directions" always
links to Google Maps (coordinates if known, else an address-text search) regardless of map availability.

## Hardening (Phase 9)

- **Loading/error/not-found boundaries**: `search`, `business/[slug]`, `[city]`, `[city]/[category]`, and
  `account` each have an `error.tsx` (client component, friendly translated copy via the `errors` i18n
  namespace) and a `not-found.tsx` where the segment calls `notFound()`. **`business/[slug]`, `[city]`, and
  `[city]/[category]` deliberately have no `loading.tsx`**: Next.js auto-wraps a route with `loading.tsx` in
  a Suspense boundary, which sends the loading shell with HTTP `200` before an inner `notFound()` resolves —
  the response status is already committed by the time the real 404 renders, so a genuinely-missing business/
  city/category would incorrectly report `200` to crawlers. Confirmed via a real production build, not just
  dev mode. `search` and `account` don't call `notFound()`, so they keep their `loading.tsx`.
- **Accessibility — Radix `Select`/`role="combobox"` requires `aria-label`, not just visible text.** Per the
  ARIA spec, `combobox` is "Name from: author" — an element's own rendered text does not contribute to its
  accessible name the way it does for most roles. Every `SelectTrigger` in this codebase (SearchBar,
  FilterPanel, SortSelect, admin forms, report reason picker, user role-change) now sets an explicit
  `aria-label`; add one on every new `SelectTrigger` going forward, even though the trigger visibly shows its
  selected value/placeholder. Caught by `@axe-core/playwright`'s `button-name` rule (critical), not by
  manual review. `apps/web/e2e/a11y.spec.ts` runs axe against homepage/search/business profile/account/admin
  pre-auth — CI-relevant: keep serious/critical violations at zero.
- **Lazy loading**: `PinDropMap` (business-owner editor) is now `next/dynamic(..., { ssr: false })` via
  `LazyPinDropMap`, same pattern as `LazyMapView`.
- **Images**: `next.config.mjs` enables `formats: ['image/avif', 'image/webp']` and sets `deviceSizes`/
  `imageSizes` matched to this app's actual rendered widths (`BusinessCard`'s grid `sizes`, `PhotoGallery`'s
  thumbnails). `images.remotePatterns`' MinIO/R2 entry is now built from one env var,
  `NEXT_PUBLIC_S3_PUBLIC_HOST` (`host:port`), instead of a hardcoded port — see
  [`13-devops-deployment.md`](13-devops-deployment.md).
- **Web observability**: `@sentry/nextjs` (`sentry.{client,server,edge}.config.ts`, `instrumentation.ts`)
  and `posthog-js` (`src/lib/analytics/posthog.ts`, `PostHogProvider` in the root `[locale]` layout), both
  fully inert without `NEXT_PUBLIC_SENTRY_DSN`/`NEXT_PUBLIC_POSTHOG_KEY` — same "stub until credentialed" bar
  as OAuth/Maps. `next.config.mjs` is wrapped with `withSentryConfig` from `@sentry/nextjs/config` (the
  top-level `@sentry/nextjs` package export is the runtime SDK only, not the build-time config wrapper — an
  easy mistake, note it here).

## Core presentational components

Pure, prop-driven, no data fetching: `BusinessCard`, `RatingStars`, `PriceLevel`, `OpenNowBadge`,
`FeatureList`, `Breadcrumb`, `HoursTable`, `ReviewCard`, `PhotoGallery`. `OpenNowBadge` takes the
server-computed `isOpenNow` boolean as a prop — see [`06-api-endpoints.md`](06-api-endpoints.md) and
[`09-search-discovery.md`](09-search-discovery.md) for where that field comes from. `formatPKR`,
`formatPhonePK`, `toTelHref`, and `isOpenNow` (display-only, e.g. for an hours table — never a badge's source
of truth) live in `@buisnez/shared/src/utils`.

## Layout

- **Header** (server component) — brand mark, `LocationPicker` (client; backed by `GET /locations/cities`,
  detects the current city from the pathname), nav links, `UserMenu` (client — login/signup links or the
  signed-in user's name + logout, backed by `useSession`).
- **MobileNav** — fixed bottom tab bar (Home / Search / current-or-default-city / Account-or-Login) under the
  mobile breakpoint.
- **Footer** — static links.
- **Root layout** (`app/[locale]/layout.tsx`) — `NextIntlClientProvider`, `QueryProvider`
  (`@tanstack/react-query`), skip-to-content link, Header/main/Footer/MobileNav composition.

## Auth & session (Phase 5)

- `useSession()` (`src/lib/hooks/use-session.ts`) — a TanStack Query wrapper around `GET /auth/me`, keyed
  `['session']`. A `401`/`403` resolves to `user: null` rather than throwing (an unauthenticated visitor isn't
  an error state). `useInvalidateSession()` invalidates that query — called after register/login/logout/OAuth
  callback/profile update so every consumer (Header's `UserMenu`, `MobileNav`, account gating) re-renders from
  one source of truth instead of each doing its own fetch.
- Auth pages (`register`, `login`, `verify-email`, `forgot-password`, `reset-password`,
  `auth/oauth-stub`) are plain client components, not server components — they're forms with no SEO value, so
  they skip `generateMetadata` (client components can't export it) and inherit the root layout's default
  title. `login` and the auth-gate redirect both support `?returnTo=<path>`. `login`, `reset-password`,
  `verify-email`, and `auth/oauth-stub` each read `useSearchParams()` for that query param/token and must wrap
  the component that calls it in `<Suspense>` — Next.js 15 requires this for static prerendering and fails
  `next build` outright without it (`missing-suspense-with-csr-bailout`), found during the Phase 5
  verification pass since `pnpm build` had never previously been run with the API live enough to get past the
  sitemap fetch that gates it (see [`PROGRESS.md`](PROGRESS.md)).
- OAuth buttons (`src/components/auth/oauth-buttons.tsx`) are plain `<a href>` tags pointing at
  `${NEXT_PUBLIC_API_URL}/auth/google` / `/facebook` — a full top-level navigation, not a `fetch()`, since
  OAuth is a redirect-based handshake the API owns end-to-end (see
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md)). The stub consent page
  (`app/[locale]/auth/oauth-stub`) is a plain `<form method="GET">` posting straight to the API's stub-callback
  route — no JS needed for the navigation itself.
- **Account area** (`app/[locale]/account`) is intentionally CSR, per the phase brief: `layout.tsx` is a
  client component that calls `useSession()` and `router.replace('/login?returnTo=...')` once loading settles
  with no session. This client-side gate is a UX convenience only — every account-scoped API call is also
  independently guarded server-side by `JwtAuthGuard` (global) and, where relevant, `VerifiedEmailGuard`; the
  frontend gate is never the actual security boundary.

## Contributions (Phase 5)

- **Reviews**: `ReviewSection` (business profile) branches on session state — logged out → login prompt with
  `returnTo`; logged in but unverified (`user.emailVerifiedAt` falsy) → a "verify your email" message; verified
  → `ReviewForm`, pre-filled from `GET .../review/mine` if the user already reviewed this business (edits
  in-place, never shows a second form). Sub-rating dimensions shown per category come from
  `subRatingDimensionsForCategory()` (`src/lib/utils/sub-rating-dimensions.ts`) — see
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md) for the mapping and why it's frontend-only.
- **Photo upload**: `usePhotoUpload()` drives presign → direct `PUT` to storage → confirm, exposing a coarse
  `stage` (`idle`/`uploading`/`processing`/`error`) rather than a byte-level progress percentage (`fetch` has
  no native upload-progress event without switching to `XMLHttpRequest`, which wasn't worth the complexity for
  a same-request-synchronous backend pipeline — see 11-reviews-trust-safety.md). `PhotoAttachments` (multi,
  used by `ReviewForm`) and `AvatarUploadButton` (single, used by the profile page) both build on it.
- **Favourites**: `FavoriteButton` (icon variant on `BusinessCard`, full variant on the profile header) does
  an optimistic toggle against `POST /favorites/toggle`, reverting on failure. Logged-out renders as a link to
  `/login?returnTo=...` instead of firing the API call. Its initial saved/unsaved state is hydrated from
  `useFavoriteIds()` (`src/lib/hooks/use-favorites.ts`) — one shared, React Query-deduped `GET
/favorites/mine/ids` fetch per page consumed by every `FavoriteButton` instance on it, since the business
  detail/card pages are server-rendered (ISR) with no per-user data to pass down as a prop. Found and fixed
  during the Phase 5 verification pass (see [`PROGRESS.md`](PROGRESS.md)): the button previously always
  started `favorited = false` regardless of the caller's real state, so a saved business showed as unsaved
  after any reload, and clicking it there would silently unfavourite it.
- **Helpful votes**: `ReviewList` fetches the caller's voted review ids once per business
  (`GET /reviews/helpful-votes/mine`) and passes per-review state down to `ReviewCard`, so an optimistic toggle
  only needs to flip one review's local state, not refetch the whole list.
- **Reports**: `ReportButton` is generic over `targetType` (`BUSINESS`/`REVIEW`/`PHOTO`/`USER`) and renders
  nothing when logged out (reports require auth server-side; no point showing a button that always 401s).
  Reuses the `Sheet` primitive rather than introducing a new dialog component.
- **Account pages** (`/account`, `/account/reviews`, `/account/photos`, `/account/favorites`) are thin CSR
  pages, each a `useQuery` over the corresponding `GET /users/me/...` or `GET /favorites/mine` endpoint.

## Business owner experience (Phase 6)

- **`/account/businesses`** — owner dashboard (CSR, gated by the existing `account/layout.tsx`, no new auth
  gate needed). Fetches `GET /businesses/owned/mine`; empty state links to `/search` rather than redirecting
  (owning zero businesses isn't an auth failure). Non-empty renders a card per business (name, status badge,
  rating, review count) linking to `/account/businesses/[businessId]`.
- **`/account/businesses/[businessId]`** — single-page listing editor (sections, not sub-routes): core info
  form (mirrors `account/page.tsx`'s pattern), hours editor (7 rows, past-midnight-aware per
  `09-search-discovery.md`'s existing `computeIsOpenNow` semantics — write side just collects the same shape),
  features checklist, services/menu CRUD (PKR entered by the owner is converted to `priceInPaisa` client-side,
  display uses `formatPKR`), photo management (adapted from `photo-attachments.tsx`'s presign→PUT→confirm
  pattern), and a reviews section listing all the business's reviews with a reply box per unreplied review.
  Every section calls its own `BusinessOwnerGuard`-protected endpoint independently and handles a 403
  gracefully (visible error, not silent) — see [`06-api-endpoints.md`](06-api-endpoints.md).
- **Pin-drop map**: `src/components/business-owner/pin-drop-map.tsx`, built on the existing
  `useGoogleMapsScript` hook, renders a draggable `google.maps.Marker` with a `dragend` listener. Unlike
  `map-view.tsx`'s read-only "map unavailable" fallback, this component falls back to plain
  `<Input type="number">` lat/lng fields when no Maps key is configured, since an editor must stay usable
  either way. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is still empty in this environment (same gap noted for Phase
  4's `map-view.tsx`), so the manual-input path is what's actually exercised today — see
  [`PROGRESS.md`](PROGRESS.md).
- **Claim CTA**: `ClaimBusinessButton` on the business profile header renders when `!business.isClaimed`.
  Logged out → prompt to log in first. Logged in → inline expand/collapse form (message + optional
  `documentUrl`, mirroring `ReviewForm`/`ReportButton`'s existing inline-expand convention rather than
  introducing a `Dialog` primitive that doesn't exist in `src/components/ui/`) calling `POST /claims`, then
  polls `GET /claims/mine?businessId=` to show "claim pending review" / hide entirely once claimed by someone
  else / allow re-claiming after a `REJECTED` status.
- **Owner replies**: `ReviewCard` already rendered `review.ownerReply`/`ownerReplyAt` as a "Response from the
  owner" block for all visitors (Phase 5 shipped the read side); Phase 6 only added the reply _composer_,
  which lives exclusively on the owner's management page reviews section, never inline on the public page.

## Known gaps carried from Phase 2 that Phase 4 needed and closed

Building the real pages surfaced three places where the Phase 2 API contract didn't cover what the frontend
needed. All three are small, additive, read-only changes (no migrations) — see the "Actually built vs. the
docs" section in [`PROGRESS.md`](PROGRESS.md) for the full rationale:

1. `isOpenNow` added to `BusinessSummary` and `BusinessProfile` (previously `openNow` was only a search
   _filter_, never a returned field).
2. `location: { lat, lng } | null` added to `BusinessSummary` (needed for the search page's map markers).
3. `GET /features` added (the search filter panel needs the full feature catalog; only per-business feature
   refs existed before).
