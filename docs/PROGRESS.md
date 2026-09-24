# Project Progress

## Phase 0: Monorepo Scaffolding

Status: **Complete**

- [x] pnpm workspace and Turborepo configured.
- [x] Next.js App Router web shell created on port `3000`.
- [x] NestJS API shell created on port `4000`.
- [x] Global API prefix `/api/v1` configured.
- [x] Helmet, strict CORS, and global validation pipe configured.
- [x] `GET /api/v1/health` implemented and smoke-tested.
- [x] Prisma package created with an empty PostgreSQL/PostGIS schema.
- [x] Shared package barrels created.
- [x] Shared ESLint, Prettier, TypeScript, and Tailwind configuration created.
- [x] PostgreSQL/PostGIS, Redis, and MinIO Compose services configured.
- [x] CI workflow configured for install, lint, typecheck, and build.
- [x] Husky, lint-staged, and Conventional Commits configured.

## Verified Versions

These are the versions installed or configured for Phase 0:

| Tool                                    | Version                  |
| --------------------------------------- | ------------------------ |
| Node.js                                 | `24.3.0`                 |
| pnpm                                    | `9.15.0`                 |
| Next.js                                 | `15.5.25`                |
| NestJS                                  | `11.2.5`                 |
| Prisma                                  | `6.19.3`                 |
| PostgreSQL/PostGIS image                | `postgis/postgis:16-3.4` |
| Redis image                             | `redis:7-alpine`         |
| MinIO image                             | `minio/minio:latest`     |
| next-intl (Phase 3)                     | `3.26.5`                 |
| @tanstack/react-query (Phase 3)         | `5.103.2`                |
| zustand (Phase 3)                       | `5.0.15`                 |
| tailwindcss-animate (Phase 3)           | `1.0.7`                  |
| @playwright/test (Phase 4, pinned)      | `1.48.0`                 |
| @aws-sdk/client-s3 (Phase 5)            | `3.1138.0`               |
| @aws-sdk/s3-request-presigner (Phase 5) | `3.1138.0`               |
| sharp (Phase 5)                         | `0.33.5`                 |

## Validation

The following checks passed during Phase 0:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
docker compose config --quiet
curl http://localhost:4000/api/v1/health
```

The health endpoint returned `{ "status": "ok" }`.

## Phase 1: Database & Core Backend

Status: **Complete**

- [x] Full Prisma schema from [`04-database.md`](04-database.md): `User`, email verification/password reset
      tokens, `Province`/`City`/`Area`, `Category` (self-referencing tree), `Feature`, `Business` (+
      `BusinessHours`, `BusinessFeature`), `Photo`, `Review`, `Favorite`, `Claim`, `Report`.
- [x] Initial Prisma migration + a second raw-SQL migration enabling `postgis`/`pg_trgm`, adding GIST
      indexes on `Business.location`/`City.centroid`, a generated `searchVector` `tsvector` + GIN index, and
      a trigram index on `Business.name`.
- [x] `seed.ts`: 7 provinces/territories, 16 major cities (with real centroids), 31 common areas, the full
      10-category/61-node category tree, 12 features, 4 demo users (one per role, plus a second customer), 6
      demo businesses with real coordinates, 6 demo reviews with photos. Idempotent (safe to re-run via
      `upsert`).
- [x] `@buisnez/api`: `PrismaModule`/`PrismaService`, global `AllExceptionsFilter` (HTTP + Prisma error
      mapping), `ZodValidationPipe`, `ResponseTransformInterceptor` (`{ success, data, meta }` /
      `{ success: false, error }`), `helmet` + strict CORS with credentials.
- [x] Auth module: register, login, refresh (rotation + Redis-backed refresh store with reuse detection),
      logout, `GET /auth/me`, email verification, forgot/reset password. `JwtAuthGuard`, `RolesGuard`,
      `@CurrentUser`, `@Roles`, `@Public`.
- [x] Redis-backed `@nestjs/throttler` rate limiting, global default plus strict per-route overrides on
      `register`/`login`/`forgot-password` (5/min) and `refresh` (20/min).
- [x] Auth Zod schemas in `@buisnez/shared` (`registerRequestSchema`, `loginRequestSchema`,
      `authResponseSchema`, etc.), imported by the API; not yet consumed by the web app (Phase 6).
- [x] Tests: `AuthService` unit tests (9, mocked Prisma/Redis/argon2), e2e/integration tests against the
      real dockerized Postgres/Redis (register/login/refresh rotation+reuse/logout, RolesGuard 401/403/200,
      PostGIS `ST_DWithin` nearest/multi-result/exclusion) — 12 tests, all passing from a freshly reset and
      reseeded database.

### Actually built vs. the docs

- **Password hashing library swapped**: [`10-auth-roles.md`](10-auth-roles.md) originally specified the
  `argon2` package; this environment's g++ (9.4.0) can't compile its native addon (`-std=gnu++20`
  unsupported), so the API and seed script use `@node-rs/argon2` instead — same Argon2id algorithm, prebuilt
  binary, no compiler required. Doc updated.
- **Pinned `@nestjs/config` to `4.0.4` and `@nestjs/jwt` to `11.0.2`**: their latest majors (`12.x`) ship
  `"type": "module"` with no CommonJS build. This repo's Nest apps compile to CommonJS (no `"type": "module"`
  anywhere in the workspace), so requiring those packages from compiled/Jest-run CJS code fails outright
  (`Must use import to load ES Module`). The pinned versions are the latest majors that still ship CJS and
  support `@nestjs/common@^11`. Not called out in a doc since no doc pinned exact dependency versions;
  noting it here so a future upgrade attempt knows why they're pinned.
- **`packages/database` `main`/`types` fixed**: Phase 0 set them to `dist/index.js`/`dist/index.d.ts`, but
  `tsconfig.json`'s `rootDir: "."` (needed so `prisma/seed.ts` typechecks alongside `src/`) actually emits to
  `dist/src/index.js`. Nothing imported the package yet in Phase 0, so the mismatch was latent; fixed to
  `dist/src/index.js`/`dist/src/index.d.ts` now that `@buisnez/api` depends on it.
- **`apps/api` typecheck split into two tsconfigs**: `tsconfig.json` (used by `nest build`) stays scoped to
  `src/**/*.ts` so `dist/main.js` lands at the expected top-level path; a new `tsconfig.typecheck.json`
  additionally includes `test/**/*.ts` for the `pnpm typecheck` script only. Not mentioned in
  [`05-backend.md`](05-backend.md); it's a toolchain detail, not an architecture decision.
- **Migration folder naming**: see the note already in [`04-database.md`](04-database.md) — Prisma requires
  `<timestamp>_<name>` folders, so the second migration is `<timestamp>_postgis_and_indexes`, not the
  literal `0001_postgis_and_indexes` named in the original prompt.
- **Docker Compose host ports remapped**: this machine already runs native Postgres (`5432`) and Redis
  (`6379`) services for other projects. `docker-compose.yml` now maps the `postgres`/`redis` services to host
  ports `5544`/`6390` instead. `.env.example` (root and `apps/api`) updated to match. Anyone running this repo
  on a machine without that conflict can safely remap back to the standard ports.
- **No real mail provider**: `MailService` (`apps/api/src/integrations/mail`) logs the verification/reset
  link instead of sending an email — there's no SMTP credential configured in this phase. Email
  verification/reset are fully testable end-to-end locally by reading the logged link.
- **RolesGuard acceptance route**: added a minimal `GET /admin/ping` (`@Roles(Role.ADMIN)`) in a new
  `AdminModule` purely to give the RolesGuard something concrete to guard and test against; it is not a real
  admin endpoint and later phases will replace it with actual moderation routes.

## Phase 2: Core Public APIs

Status: **Complete**

- [x] Locations module: `GET /locations/provinces`, `/locations/cities` (optional `?province=`),
      `/locations/cities/:slug` (+ centroid), `/locations/areas` (`?city=`, required).
- [x] Categories module: `GET /categories` (full nested tree), `/categories/:slug` (detail +
      `descendantCategoryIds`, reused by search's `category` filter — one implementation).
- [x] Businesses module: `GET /businesses/:slug` (full profile: hours, features, category breadcrumb,
      aggregates incl. rating breakdown), `/businesses/:id/reviews`, `/businesses/:id/photos`,
      `/businesses/:slug/similar` (same category+city first, broadens to category siblings). All scoped to
      `status = PUBLISHED`.
- [x] `GeoService` extended: `withinRadiusCondition`/`distanceMetersExpr` (parameterized `Prisma.sql`
      fragments), `getCityCentroid`/`getBusinessLocation`, `geocodeAddress` (Redis-cached, stubbed — no
      Google Maps key issued yet).
- [x] `SearchService` + `GET /businesses`: keyword (full-text + trigram fallback), category (incl.
      descendants), province/city/area, `minRating`, `priceLevel`, `features` (AND), `openNow`
      (Asia/Karachi, past-midnight handled), `lat`/`lng`/`radius` ("near me"), 5 sort modes, pagination
      (default 20, hard max 50). Relevance scoring and the Bayesian weighted rating exactly per
      [`09-search-discovery.md`](09-search-discovery.md).
- [x] `Business.featured` migration + `GET /discovery/home` (trending/highly-rated/featured/recent),
      Redis-cached (10 min TTL) with an `invalidateHomeCache()` hook for later write phases.
- [x] Tests: 37 e2e/integration tests (search + every filter, profile, reviews/photos pagination, similar,
      discovery blocks + cache behavior, PostGIS radius query) plus the 9 Phase 1 auth unit tests — all
      passing from a freshly reset and reseeded database.
- [x] Seed data expanded: 5 customers (was 2, to give reviews real variance), 2 new demo businesses
      (`Round The Clock Pharmacy` — always open, `Grand Wedding Hall` — always closed) as deterministic
      `openNow` fixtures, varied review counts/ratings per business so `minRating`/rating-sort/Bayesian
      weighting all have something real to distinguish, 2 businesses flipped `featured`.

### Actually built vs. the docs

- **`Business.featured` schema addition**: the schema had no editorial-curation flag (`isVerified` means
  moderation trust, not "show on homepage"). Added via a plain Prisma migration
  (`20260918104246_add_business_featured`) — see [`04-database.md`](04-database.md) and
  [`06-api-endpoints.md`](06-api-endpoints.md). No admin endpoint sets it yet; the seed script flips it on 2
  demo businesses.
- **Prisma migration gotcha (new, documented in `04-database.md`)**: `prisma migrate dev --create-only`
  for the `featured` migration generated `DROP INDEX`/`ALTER COLUMN ... DROP DEFAULT` statements against the
  Phase 1 raw-SQL-managed GIST/GIN/trigram indexes and the generated `searchVector` column, because Prisma
  diffs against the bare `Unsupported` declaration, not the actual raw-SQL-augmented schema. Had to strip
  the generated migration down to just the one `ADD COLUMN` before applying it. Anyone adding a future
  migration touching `Business`/`City` needs to repeat this inspection step.
- **`@UsePipes` param-pipe gotcha (new, documented in `05-backend.md`)**: a method-level
  `@UsePipes(new ZodValidationPipe(schema))` runs against _every_ pipelined parameter of that handler, not
  just the one the schema was written for. `getReviews`/`getPhotos` (both `@Param('id')` + `@Query()`) broke
  this way during manual smoke testing — fixed by moving the pipe onto the `@Query()` decorator itself
  everywhere a handler has more than one pipelined param.
- **`perPage` above 50 is a hard 400, not a silent clamp** — worth calling out since "hard max" in the
  original doc draft could be read either way; `09-search-discovery.md` now says so explicitly.
- **"Services" in the original task phrasing** → mapped to the existing `features` (amenities) list, per the
  call already made and documented in `06-api-endpoints.md` before implementation started.
- **Scope not built**: `GeoService.geocodeAddress` exists and is unit-testable but has no caller yet — Phase
  2 has no business-mutation endpoints to trigger "geocode on write" from. Also not built: an admin endpoint
  to set `Business.featured` (still a later-phase, admin-moderation concern).

## Phase 3: Frontend Foundations

Status: **Complete** (built in the same pass as Phase 4 — see that section)

- [x] Tailwind theme via `@buisnez/config/tailwind/preset.ts`: brand tokens (deep emerald primary scale,
      warm saffron accent, type scale, spacing, radius) as CSS variables in `src/styles/globals.css`.
      `tailwindcss-animate` plugin. shadcn/ui primitives copied into `apps/web/src/components/ui`: Button,
      Card, Badge, Input, Label, Separator, Skeleton, Checkbox, Select, Sheet.
- [x] Layout: `Header` (server component; `LocationPicker` client sub-component backed by
      `GET /locations/cities`, detects current city from the URL pathname), `Footer`, `MobileNav` (fixed
      bottom tab bar), root layout wiring `NextIntlClientProvider` + `QueryProvider`. Logical CSS
      (`ms`/`me`/`start`/`end`) throughout.
- [x] Typed API client (`src/lib/api`): one `apiRequest()` unwrapping the `{success,data,meta}` envelope,
      parsing every response through `@buisnez/shared` Zod schemas, typed `ApiError`, and an
      auth-token-attach/silent-refresh-on-401 seam (`setAuthTokenGetter`/`setUnauthorizedHandler`) — unused
      until Phase 6's real auth UI. Endpoint functions for every Phase 2 read plus Phase 4's new `/features`.
- [x] `QueryProvider` (`@tanstack/react-query`) + Zustand `useUIStore` (mobile filter sheet) and
      `useMapViewportStore` (map center/zoom). Filters/sort are **not** duplicated into Zustand — the URL is
      the single source of truth (see Phase 4).
- [x] `next-intl` wired with `src/i18n/messages/en.json` — every UI string externalized.
- [x] Core presentational components: `BusinessCard`, `RatingStars`, `PriceLevel`, `OpenNowBadge`,
      `FeatureList`, `Breadcrumb`. `formatPKR`, `formatPhonePK`, `toTelHref`, `isOpenNow` added to
      `@buisnez/shared/src/utils` (didn't exist before — were empty stub files).
- [x] SEO plumbing: `buildMetadata()` helper, JSON-LD builders (`localBusinessJsonLd`, `breadcrumbListJsonLd`,
      `itemListJsonLd`, `reviewsJsonLd`), `<JsonLd>` render component.

### Actually built vs. the docs

- **i18n routing decided immediately as `app/[locale]`**, not deferred: the original Phase 3 doc draft said
  "no locale segment yet" (reading `15-conventions.md`'s "structure future Urdu support through the message
  layer" as meaning no routing concern at all). The user's Phase 4 prompt then gave the final decision
  (`app/[locale]`, `next-intl` `localePrefix: 'as-needed'`) before any Phase 3 code existed, so it was built
  directly per that final shape instead of a plain `app/` structure that would've needed migrating. See
  [`07-frontend.md`](07-frontend.md).
- **Smoke-test homepage skipped**: since Phase 3 and Phase 4 shipped together in one session, the "single
  smoke-test home page" from the Phase 3 prompt was skipped in favor of building the real Phase 4 homepage
  directly — no throwaway page was written and then replaced.
- **Font**: system font stack (no `next/font/google`), to avoid a build-time network dependency for
  self-hosted fonts in this sandboxed environment. Revisit once a real deploy target is confirmed.

## Phase 4: Public Discovery Experience

Status: **Complete**

- [x] Homepage (`/`, ISR 600s): `SearchBar`, popular categories/cities (Lahore first), `GET /discovery/home`
      blocks.
- [x] Search (`/search`, `export const dynamic = 'force-dynamic'`): `SearchBar`, `FilterPanel` (category,
      city, area, minRating, priceLevel, features, openNow — desktop sidebar + `MobileFilterSheet` on
      mobile), `SortSelect`, `UseMyLocationButton` (Geolocation → lat/lng/radius in the URL; falls back to
      Lahore's centroid on denial/error/no-geolocation), lazy `SearchMapToggle` (markers from
      `BusinessSummary.location`). All filter/sort/geo state lives in the URL query string.
- [x] City hub (`/[city]`, ISR 600s): intro, category links, top-rated businesses, `BreadcrumbList` JSON-LD.
- [x] City + category (`/[city]/[category]`, ISR 600s): paginated `GET /businesses` scoped to city+category;
      `BreadcrumbList` + `ItemList` JSON-LD; per-page SEO title/description/canonical.
- [x] Business profile (`/business/[slug]`, ISR 600s): header with server `isOpenNow` badge, `PhotoGallery`,
      address/`tel:`/website/WhatsApp, `HoursTable`, `FeatureList`, single-marker `MapView` (or graceful
      fallback) + always-working "Get directions", reviews (`ReviewCard`), similar businesses. `LocalBusiness`
      (nested `AggregateRating`) + `BreadcrumbList` + `Review` JSON-LD.
- [x] `POST /api/revalidate` (Next.js route handler) protected by `REVALIDATE_SECRET`; revalidates the
      affected business/city/city+category/home paths. No caller yet — Phase 2 has no business-mutation
      endpoints (same "exists, no caller yet" situation as `GeoService.geocodeAddress`).
- [x] `app/sitemap.ts` (homepage, `/search`, every city, every city×category combination, every `PUBLISHED`
      business — paginated internally through the API's 50-per-page cap) and `app/robots.ts`.
- [x] `MapView`/`LazyMapView`/`useGoogleMapsScript`: real Google Map when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
      is set, static fallback otherwise (no key issued yet, same as `GeoService.geocodeAddress`) — verified
      both the fallback rendering and that "Get directions" works regardless.
- [x] Playwright e2e (`apps/web/e2e/`): homepage discovery blocks, city hub + city/category JSON-LD, business
      profile (header/directions/JSON-LD/404), search (city filter via URL, sort-changes-URL, map toggle) — 8
      tests, all passing against a live dev server backed by the real seeded database.
- [x] Verified end-to-end in a real headless browser (screenshots + DOM inspection) against the live API,
      Postgres, and Redis — not just `curl`/typecheck: homepage, search (desktop layout, filters, sort,
      map toggle), city hub, city+category, and business profile (photos, hours, map fallback, directions,
      reviews) all confirmed rendering correctly.

### Actually built vs. the docs

- **Three additive Phase 2 API gaps closed** (all read-only, no migrations — user confirmed the approach
  before each): the real Phase 2 contract was checked against the actual Phase 4 requirements and came up
  short in three places:
  1. **`isOpenNow` added to `BusinessSummary` and `BusinessProfile`**. Phase 2 only had `openNow` as a search
     _filter_ (`SearchService.openNowExpr()` existed only as a `WHERE` condition); nothing returned a
     per-business boolean, but the task required server-computed open/closed badges everywhere, never
     client-derived. `openNowExpr()` is now reused as both the filter and a `SELECT` column;
     `BusinessesService.getProfileBySlug` computes the same boolean in application code from its own `hours`.
     See [`09-search-discovery.md`](09-search-discovery.md).
  2. **`location: {lat,lng} | null` added to `BusinessSummary`**. The search results map needs marker
     coordinates and none were exposed on summaries (only on the full profile). Added via
     `ST_Y`/`ST_X` on the already-joined `Business.location` column — no new query needed.
  3. **`GET /features` added** (new `FeaturesModule`, mirrors `CategoriesModule`'s shape). The search filter
     panel needs the full feature catalog to render amenity checkboxes; Phase 2 only ever returned
     per-business feature refs, never a standalone list. The `Feature` table already existed from Phase 1.
- **Pre-existing schema bug found and fixed**: `businessPhotoSchema.id` was declared `z.string().uuid()`,
  but `seed.ts` intentionally uses deterministic string ids (`photo-<slug>-gallery`, `photo-<slug>-review`)
  for idempotent upserts — never actual UUIDs. This silently broke `GET /businesses/:id/photos` parsing on
  the frontend (Zod rejected the response, caught, and swallowed into an empty gallery) and had been latent
  since Phase 1/2 since neither ever validated its own output against the shared schema at runtime. Fixed by
  relaxing the field to `z.string()` — found via real browser testing, not just typecheck/build.
- **"Most helpful first" reviews wasn't literal**: the schema has no helpfulness/vote signal on `Review`
  (per the Phase 2 API, reviews are always newest-first). Rendered in the API's existing default order rather
  than inventing a new backend ranking feature outside Phase 4's frontend scope.
- **`/search`'s zero-query variant is build-time static-optimized** despite `export const dynamic =
'force-dynamic'` (Next.js build summary still marks `/en/search` "SSG") — verified this doesn't affect
  correctness: every query-string variant (`?city=`, `?sort=`, etc.) is confirmed dynamic per request via
  both `curl` and the e2e suite. Cosmetic build-label quirk, not a functional one; not chased further.
- **Sitemap ships as a single `app/sitemap.ts`** (not `generateSitemaps()`-paginated): tried the
  `generateSitemaps()` API first, but it serves at `/sitemap/[id].xml` rather than `/sitemap.xml` (no
  auto-generated index route in this Next.js version), which doesn't match `robots.txt`'s conventional
  `Sitemap:` reference. A single file comfortably covers current and realistically-foreseeable scale (well
  under the 50,000-URL limit even at full Pakistan-wide city×category coverage); switch to
  `generateSitemaps()` if that changes.
- **Playwright can't run its browser on this machine as configured**: `@playwright/test`'s current major
  (would have resolved to ~1.6x via the `^1.50.1` range) dropped support for this machine's OS
  (Ubuntu 20.04.6 LTS — `ERROR: Playwright does not support chromium on ubuntu20.04-x64`). Pinned to `1.48.0`
  (last version confirmed to install and launch chromium here) instead of the newer range. `apps/web`'s
  `pnpm test` runs the real suite; on a newer OS or in CI, the version pin can likely be lifted.
- **MinIO port conflict recurs** (see Phase 0/1 note on Postgres/Redis remapping): this machine's `9000` is
  already bound by another process, so `docker compose up` starts Postgres/Redis fine but MinIO fails.
  Doesn't block anything in Phase 3/4 — all seeded photo URLs are `picsum.photos`, not MinIO. Not remapped in
  `docker-compose.yml` since no code in this phase touches object storage; flagging for whoever hits it next.

## Phase 5: Accounts & Contributions

Status: **Complete and browser-verified**

- [x] **Auth transport fixed before anything else was built** (per the user's explicit stop-and-confirm
      instruction): Phase 1 returned the access token in the JSON body for any caller to store. Now both
      access (`access_token`, path `/`) and refresh (`refresh_token`, path `/api/v1/auth`) tokens are httpOnly,
      `SameSite=Lax` cookies; `register`/`login` return `{ user }` only, `refresh` returns
      `{ refreshed: true }` — no token ever appears in a JSON body. `JwtAuthGuard` checks the `access_token`
      cookie first, falling back to `Authorization: Bearer` only (reserved for a future mobile app). New
      `CsrfGuard` (global, runs before `JwtAuthGuard`) requires `X-Requested-With: buisnez-web` on every
      non-`GET`/`HEAD`/`OPTIONS` request. See [`10-auth-roles.md`](10-auth-roles.md).
- [x] Migration `phase5_accounts_and_contributions`: `User.bio` (new), `User.passwordHash` now nullable
      (OAuth-only accounts), new `OAuthAccount` model, `Review.subRatings` (`Json?`), new
      `ReviewHelpfulVote` model, `Report.photoId`/`reportedUserId` + `ReportTargetType` gained `PHOTO`/`USER`,
      `Photo.thumbUrl`/`cardUrl` (nullable — null for pre-Phase-5 seed photos).
- [x] Auth: register/login/verify-email/forgot-reset-password UI, `useSession()` (TanStack Query around
      `GET /auth/me`), silent refresh-on-401 + retry built into the API client, Google/Facebook OAuth (real
      redirect flow + a stub consent page that's server-side disabled whenever real credentials are
      configured — see below).
- [x] Reviews: `PUT /businesses/:businessId/review` (upsert, one per user/business), category-specific
      sub-ratings, photo attachments, `GET .../review/mine` for the edit-in-place UX, helpful-vote toggle.
- [x] Photos: presign → direct upload (MinIO locally / R2 in prod, same S3 API) → confirm, running `sharp`
      **synchronously** in the confirm request (thumb/card/full variants, EXIF stripped via `.rotate()` +
      no `.withMetadata()`).
- [x] Favourites (toggle + list + ids), Reports (business/review/photo/user + reason, rate-limited).
- [x] `/account` (CSR, client-side gate + independent server-side guards): profile edit (name/bio/avatar),
      my reviews, my photos, favourites.
- [x] New backend Jest e2e suite (`contributions.e2e-spec.ts`, 8 tests: CSRF rejection, create-then-edit
      upsert, unverified-email 403, helpful-vote toggle, favourite toggle, report creation, full photo
      pipeline against real MinIO with EXIF/size assertions, profile update) plus a rewritten
      `auth.e2e-spec.ts` (cookie assertions, Bearer-fallback, CSRF). **39 → 46 total e2e tests, all green**;
      9 unit tests still green.
- [x] `pnpm lint && pnpm typecheck` clean across `@buisnez/api`, `@buisnez/web`, and `@buisnez/shared`.

### Verification pass (2026-09-24)

Phase 5's code had shipped unverified (no tests run, no browser pass). This pass ran the full existing suite
and then browser-verified the actual frontend against a live Postgres/Redis/MinIO/API + web stack, per the
acceptance list below.

- [x] **Full suite green**: `pnpm lint && pnpm typecheck && pnpm build` clean across all 5 workspace packages;
      9 API unit tests + 37 API e2e tests (46 total, unchanged count from the Phase 5 entry above) all
      passing from a freshly reset and reseeded database; the new Playwright e2e (below) passing alongside
      the existing 8 discovery-flow Playwright tests (12/12 total).
- [x] **Build bug found and fixed**: `pnpm build` failed outright — `login`, `reset-password`, `verify-email`,
      and `auth/oauth-stub` all call `useSearchParams()` directly in a page component with no `<Suspense>`
      boundary, which Next.js 15 requires for static prerendering (`missing-suspense-with-csr-bailout`). This
      had never been caught because `pnpm build` had never been run with the API live enough to get past the
      sitemap fetch that gates it. Fixed by splitting each page into a thin default export wrapping a
      `<Suspense fallback={null}>`-wrapped inner component that calls the hook.
- [x] **Auth transport, browser-verified**: registered a real user, read the verification link from the
      API's mail-stub log, verified, logged in via the real `/login` form. Confirmed via the Playwright
      cookie jar (`context.cookies()`) that `access_token`/`refresh_token` are `httpOnly: true`,
      `sameSite: 'Lax'`, `secure: false` (correct for local plain-HTTP dev — gated on `NODE_ENV=production`
      per [`10-auth-roles.md`](10-auth-roles.md)), and `refresh_token` is scoped to `/api/v1/auth`. Dumped
      `window.localStorage`/`sessionStorage` and confirmed neither contains `access_token`, `refresh_token`,
      or any raw JWT substring. Session survived a hard page reload.
- [x] **Silent refresh + rotation + reuse-detection, browser-verified**: overwrote the `access_token` cookie
      with a bogus value to force a `401`, reloaded, and confirmed the client transparently refreshed and
      retried (`GET /auth/me` succeeded, UI stayed logged in) with no visible error. Confirmed the
      `refresh_token` cookie value changed after that refresh (rotation). Replayed the **pre-rotation**
      refresh token directly against `POST /auth/refresh` and confirmed it's rejected with `401` (Redis
      reuse-detection).
- [x] **CSRF, browser-verified**: a `POST /favorites/toggle` from the page's own origin without
      `X-Requested-With: buisnez-web` is rejected `403`; the identical request with the header reaches the
      handler (`404` for a nonexistent business id, proving the guard let it through).
- [x] **Contribution flows, browser-verified**: unverified user sees the "verify your email" message and no
      review-submit button on a business page; a verified user wrote a review with a photo attachment (real
      upload through presign → MinIO → confirm → sharp), saw it rendered, edited it (title changed, no
      duplicate row — confirms the upsert), favourited the business (persisted across a reload and visible on
      `/account/favorites`), toggled a helpful vote, and submitted a report — all via the real UI, not curl.
      `/account` redirects an unauthenticated visitor to `/login?returnTo=...`.
- [x] **New Playwright e2e** written: `apps/web/e2e/account-contributions.spec.ts` — the full
      register→verify→login→review+photo→favourite→vote→report flow plus the auth-transport/CSRF checks
      above, run against a live dev server. Structured as one consolidated "auth transport" test and one
      consolidated "contribution flows" test (rather than one test per assertion) specifically to minimize
      real calls to the rate-limited `/auth/login`/`/auth/register` endpoints — see the rate-limit note below.
- [x] **Real bug found and fixed via browser testing (not caught by any existing test)**: `FavoriteButton`
      always initialized `favorited = false` and never checked the caller's actual saved state — `GET
  /favorites/mine/ids` existed in the API client but nothing called it. A user who favourited a business
      would see it as un-favourited again after any reload of the business page, and clicking the button in
      that state would toggle it back **off** while showing it turning "on". Fixed by adding
      `useFavoriteIds()`/`useInvalidateFavoriteIds()` (`apps/web/src/lib/hooks/use-favorites.ts`) — one shared
      React Query-deduped fetch of the caller's favourite ids per page, consumed by `FavoriteButton` to
      hydrate its initial state and invalidated after every toggle. See
      [`07-frontend.md`](07-frontend.md).

#### Moderation and photo-pipeline deviations, resolved

- **Moderation enqueue seam re-added**: the Phase 5 entry above described "Moderation job enqueue" as a bare
  `TODO(phase-6)` comment with no actual function call. Per the verification brief, this needed to be a real
  seam so Phase 8 has an integration point even though it currently auto-approves. Added
  `ModerationService.enqueue(targetType, targetId)` (`apps/api/src/integrations/moderation`), called from both
  `ReviewsService.createOrUpdate` and `PhotosService.confirm`. It's a no-op today (always returns
  `{ status: 'APPROVED' }`) — **moderation hold is still deferred to Phase 8**; this only guarantees the call
  site exists. See [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md).
- **Photo upload guards added**: `PhotosService.confirm` had no size limit, no re-check of the uploaded
  object's actual content type, and no timeout around the synchronous `sharp` pipeline — a large or malformed
  upload could hang the API process indefinitely. Added a `HeadObjectCommand`-based check
  (`StorageService.headObject`) rejecting uploads over 10MB or not `image/jpeg`/`png`/`webp` before download,
  plus a 15s timeout around `ImageProcessingService.processVariants()`. **Still tech debt**: this protects the
  current synchronous pipeline but the real fix is moving photo processing to a BullMQ image queue (no such
  queue exists in this stack yet — see the Phase 5 entry above); tracked there, not solved here. See
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md).

#### Environment quirk: browser (Playwright) and jest e2e tests share live state

Running the Playwright browser verification against the live dev stack and then immediately re-running the
jest e2e suite against the _same_ Postgres/Redis produced 3 failures that were **test cross-contamination, not
regressions**: two `business-profile.e2e-spec.ts` assertions hardcode the seeded business's review
count/photo-URL scheme, which the Playwright run had changed by writing a real review/photo to that business;
several `auth.e2e-spec.ts`/`contributions.e2e-spec.ts` calls got `429`s from the shared Redis-backed
`@nestjs/throttler` login/register buckets, already partly consumed by the browser session's own
register/login calls. Resolved by deleting the Playwright-created test users (cascades to their
reviews/photos/favourites/reports via the schema's `onDelete: Cascade` FKs, restoring the seeded business's
counts) and `FLUSHALL`-ing Redis before the final jest e2e run. **Anyone doing a browser pass and an
automated-suite pass in the same session should do the automated suite first, or reset the DB/Redis in
between** — the two are not isolated from each other on this stack.

### Actually built vs. the docs

- **Sub-ratings modeled as `Review.subRatings: Json?`**, not fixed columns — confirmed with the user before
  the migration. The category → dimension mapping (`food`/`service`/`ambience`/`value`, which ones show for
  which top-level category) lives entirely in the frontend
  (`apps/web/src/lib/utils/sub-rating-dimensions.ts`); the API accepts any string-keyed rating object. See
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md).
- **Photo processing is synchronous, not a queued job** — confirmed with the user. No BullMQ/worker process
  exists in this stack; `sharp` runs inline inside `POST /photos/confirm`. The phase brief's "sharp job"
  phrasing was interpreted as "the sharp processing step," not literally an async queue.
- **Reviews/photos publish immediately, no admin-approval gate** — confirmed with the user. There was (and
  still is) no admin-moderation endpoint anywhere in the codebase to move a `PENDING` row to `PUBLISHED`, so a
  pre-publish hold would have made new content permanently invisible. "Moderation job enqueue" from the phase
  brief is now a `TODO(phase-6)` comment in `ReviewsService.createOrUpdate` marking where an automated
  flag-for-review pass would hook in, once there's an admin surface to consume its output.
- **A second, broader instance of the already-documented pipe-scoping gotcha** (see Phase 2's note below):
  it turns out `@UsePipes` at the method level applies to _every_ framework-tracked parameter, not just
  `@Param`/`@Query` combinations — `@CurrentUser()` (a custom `createParamDecorator`) is affected too, while
  `@Req()`/`@Res()` are not (Nest treats those as special host objects). Every new Phase 5 controller method
  that combined `@CurrentUser()` with `@Body()`/`@Query()` hit this (discovered via a live "expected object,
  received string" error against `reviews`/`favorites`/`reports`/`photos`/`users` controllers) and was fixed
  by moving the `ZodValidationPipe` onto the specific `@Body()`/`@Query()` decorator instead of the method.
  `05-backend.md`'s existing note about this gotcha should be read as covering `@CurrentUser()` too, not just
  `@Param`/`@Query`.
- **MinIO port conflict recurs a second time**: port `9000` is taken by another project's MinIO on this
  machine (same root cause as the Phase 4 note), so `docker-compose.yml` now remaps Buisnez's MinIO to
  `9102`/`9103` (was already going to conflict with the default even after the Phase 4 flag, since that phase
  never actually started MinIO). `S3_ENDPOINT`/`S3_PUBLIC_URL_BASE` in `.env.example` point at `9102`.
  `StorageService` also best-effort auto-creates the bucket + a public-read policy on boot, since a fresh
  MinIO volume starts with neither and Phase 5 was the first phase to actually need object storage.
- **`GET /businesses/:businessId/review/mine` added** beyond the phase brief's literal endpoint list — needed
  so the frontend's "edit your review" flow can pre-fill the form instead of always showing a blank one; the
  brief's "edit existing instead of duplicate" was otherwise only enforced backend-side (via the upsert),
  which is correct but an incomplete UX without this read.
- **OAuth verified without real provider credentials**: `docs/16-ai-prompts.md`'s Phase 5 prompt allowed
  building against the stubbed provider handshake when credentials aren't available locally — no
  Google/Facebook app was registered for this environment. The stub path
  (`GET /auth/oauth-stub/:provider/callback`) is hard-disabled server-side (`STUB_DISABLED`) whenever that
  provider's client id _is_ configured, so it can never activate in a real deployment. Verified end-to-end via
  the redirect chain and a resulting authenticated session with `hasPassword: false`.
- **`AuthUser` gained `bio`, `avatarUrl`, and `hasPassword`** (previously just `id`/`email`/`name`/`role`/
  `emailVerifiedAt`) — needed for the profile page and to show OAuth-only users a "set a password" hint.
- **`authResponseSchema` in `@buisnez/shared` was already stale before this phase** (declared `accessToken:
z.string()` but nothing had ever consumed the type) — corrected to match the new `{ user }`-only shape as
  part of the transport fix; added `refreshResponseSchema` alongside it.

## Next Phase

Phase 5 is now fully verified (see its "Verification pass" section above). Phase 6 (per
[`16-ai-prompts.md`](16-ai-prompts.md): business write endpoints, or claims/reports admin-moderation) is next
— whichever the user prioritizes; each needs its own fully-specified prompt written just before it starts, per
Universal Rule 2. Phase 6's admin-moderation surface is also where `ModerationService`'s no-op-approve seam
(see Phase 5's deviation log above) would first get a real consumer.
