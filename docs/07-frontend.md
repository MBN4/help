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
      layout/                 # Header, Footer, MobileNav, LocationPicker, Breadcrumb, UserMenu
      auth/                   # AuthCard, OAuthButtons
      business/               # BusinessCard, RatingStars, PriceLevel, OpenNowBadge, FeatureList, HoursTable,
                               # FavoriteButton, StarRatingInput
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
  combination, and every `PUBLISHED` business (paginated internally through the API's 50-per-page cap). Split
  into `generateSitemaps()`-backed multiple files if the catalog ever approaches the 50,000-URL single-file
  limit — not needed at current/foreseeable scale.
- `app/robots.ts` — allows `/`, disallows `/api/`, points at `/sitemap.xml`.
- `app/api/revalidate/route.ts` — `POST`, header or query param `secret` checked against `REVALIDATE_SECRET`;
  revalidates `/`, `/business/:slug`, `/:city`, `/:city/:category` as given in the body. No caller exists yet
  (Phase 2 has no business-mutation endpoints) — this is the seam for one.

## Maps

`MapView` (`src/components/map`) renders a real Google Map when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
(lazily injecting the JS API script once per page, shared across every `MapView` instance via
`useGoogleMapsScript`), and a static "map unavailable, use directions" fallback otherwise — the search page
and business profile both work fully either way. It's always wrapped through `LazyMapView`
(`next/dynamic(..., { ssr: false })`) since Next.js forbids `ssr: false` dynamic imports directly inside a
Server Component; `LazyMapView` is the `'use client'` boundary that makes that legal. "Get directions" always
links to Google Maps (coordinates if known, else an address-text search) regardless of map availability.

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

## Known gaps carried from Phase 2 that Phase 4 needed and closed

Building the real pages surfaced three places where the Phase 2 API contract didn't cover what the frontend
needed. All three are small, additive, read-only changes (no migrations) — see the "Actually built vs. the
docs" section in [`PROGRESS.md`](PROGRESS.md) for the full rationale:

1. `isOpenNow` added to `BusinessSummary` and `BusinessProfile` (previously `openNow` was only a search
   _filter_, never a returned field).
2. `location: { lat, lng } | null` added to `BusinessSummary` (needed for the search page's map markers).
3. `GET /features` added (the search filter panel needs the full feature catalog; only per-business feature
   refs existed before).
