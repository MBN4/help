# AI Build Prompts

This is the canonical prompt library for building Buisnez phase by phase with an AI coding agent. Each phase
section is written to be pasted (or referenced) as-is as the task prompt for that phase. Keep it in sync with
reality: when a phase ships, update [`PROGRESS.md`](PROGRESS.md) and amend the doc(s) that phase touched if
what actually shipped deviates from the prompt below.

## Universal Rules

Apply these on every phase, regardless of what the phase-specific prompt says:

1. Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), and every doc a phase prompt
   names, before writing code.
2. Don't build beyond the named phase's scope. If a later phase's concern shows up while working (e.g. an
   admin endpoint while doing auth), leave a `// TODO(phase-n):` note at most — don't implement it early.
3. Money is integer paisa. Phone numbers, provinces, cities, and areas use Pakistan formats/terminology.
   Persisted timestamps are UTC in the DB; presentation layer converts to `Asia/Karachi`.
4. Treat verification, moderation, claims, reports, and anti-spam as trust boundaries: default-deny, admin
   approval required, log who approved what.
5. Shared request/response contracts are Zod schemas in `@buisnez/shared`, imported by both `apps/api` and
   `apps/web` — never redefine the same shape twice.
6. Every new migration must run clean against a fresh database (`pnpm --filter @buisnez/database db:migrate
&& pnpm --filter @buisnez/database db:seed` from empty). Never hand-edit a migration that has already been
   applied anywhere outside local dev.
7. New non-trivial logic (auth, geo queries, moderation state machines) ships with tests in the same phase,
   not deferred.
8. If a requirement is ambiguous or a referenced doc is missing/contradictory, stop and ask rather than
   inventing product/schema decisions silently.
9. When a phase is done: update `PROGRESS.md` (tick it, fill in "Actually built", note deviations), update
   any doc that the shipped code deviates from, run `pnpm lint && pnpm typecheck && pnpm build && pnpm test`,
   and list which docs changed.

## Phase 0 — Monorepo scaffolding (complete)

Delivered: pnpm/Turborepo workspace, Next.js web shell, NestJS API shell with `/api/v1` prefix and
`GET /api/v1/health`, empty Prisma/PostGIS package, shared package barrels, shared lint/TS/Tailwind config,
Postgres/PostGIS + Redis + MinIO compose services, CI (install/lint/typecheck/build), Husky + Conventional
Commits. See [`PROGRESS.md`](PROGRESS.md).

## Phase 1 — Database & core backend

Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), [`04-database.md`](04-database.md),
[`05-backend.md`](05-backend.md), and [`10-auth-roles.md`](10-auth-roles.md) first. Also read
[`01-product-overview.md`](01-product-overview.md) for the category tree, feature list, and geography model
the seed data must reflect.

**Goal:** full Prisma schema in Postgres with PostGIS working, plus authentication.

1. Full Prisma schema from `04-database.md` (in `@buisnez/database`); first migration.
2. Raw SQL migration `0001_postgis_and_indexes`: enable `postgis` + `pg_trgm`; add `Business.location` +
   `City.centroid` as `geography(Point,4326)`; GIST index on both; generated `searchVector` `tsvector` + GIN
   index on `Business`; trigram index on `Business.name` — exactly as specified in `04-database.md`.
3. `seed.ts`: real Pakistan provinces + major cities (with centroids) + common areas; the full category tree
   and feature list from `01-product-overview.md`; a few demo businesses **with coordinates**; demo users
   (one per role); a few demo reviews/photos.
4. In `@buisnez/api`: `PrismaModule`/`PrismaService`, global `AllExceptionsFilter`, `ZodValidationPipe`,
   response transform interceptor, standard success/error shapes, `helmet` + strict CORS — all per
   `05-backend.md`.
5. Auth module per `10-auth-roles.md`: register, login, refresh (rotation + server-side refresh store in
   Redis), logout, `GET /auth/me`, email verification, forgot/reset. `argon2` for hashing. `JwtAuthGuard`,
   `RolesGuard`, `@CurrentUser`, `@Roles`, `@Public`.
6. Redis + `@nestjs/throttler` rate limiting on auth routes.
7. All auth request/response Zod schemas in `@buisnez/shared`, used on both sides.
8. Tests: unit (auth service), integration (register/login/refresh), and a PostGIS `ST_DWithin` query test
   against seeded data.

**Acceptance:** migrate + seed run clean from scratch; register/login/refresh/logout/me work with token
rotation and rate limits; `ST_DWithin` returns seeded businesses near a point; `RolesGuard` blocks a
non-admin on a test admin route.

## Phase 2 — Core public APIs

Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), [`06-api-endpoints.md`](06-api-endpoints.md),
[`09-search-discovery.md`](09-search-discovery.md), [`08-maps-location.md`](08-maps-location.md),
[`04-database.md`](04-database.md), and [`05-backend.md`](05-backend.md) first. Builds on the Phase 1
schema/seed/auth — do not recreate them.

**Goal:** every read the public website needs.

1. Locations module: provinces; cities (filter by province); city detail (+ centroid); areas (filter by
   city). Per `06-api-endpoints.md`.
2. Categories module: full category tree; category detail by slug, resolving descendant ids for filtering.
3. Businesses module: `GET /businesses/:slug` (full profile with hours, features, aggregates);
   `/businesses/:id/reviews`; `/businesses/:id/photos`; `/businesses/:slug/similar`. Only `PUBLISHED`
   businesses in public reads.
4. `GeoService` (`08-maps-location.md`): geocode-on-write via the Google server key (`region=pk`,
   Redis-cached by normalized address, stubbed since no key is issued yet); `ST_DWithin`/`ST_Distance`
   helpers as parameterized `Prisma.sql` fragments — raw SQL isolated in `GeoService`.
5. `SearchService` + `GET /businesses` (`09-search-discovery.md`): keyword (`searchVector` + trigram),
   category incl. descendants, city/area, `minRating`, `priceLevel`, features (AND), `openNow`
   (Asia/Karachi, handling past-midnight), lat/lng/radius distance, sort
   (relevance/rating/distance/reviews/newest), pagination (default 20, max 50). Relevance scoring per the
   doc; Bayesian weighted rating for "highly rated".
6. `Business.featured` migration (small, additive — see `06-api-endpoints.md`) + homepage discovery blocks
   (`GET /discovery/home`: trending, highly-rated, featured, recent) with Redis caching + a
   `invalidateHomeCache()` hook for later write phases.
7. Integration tests: search + each filter, profile, similar, and a geo radius query against seeded data.

**Constraints:** all query params validated by one shared Zod schema in `@buisnez/shared`; standard
success/error + pagination meta shapes from `05-backend.md`; raw SQL only inside `GeoService`/`SearchService`.

**Acceptance:** `GET /businesses` returns correct filtered/sorted/paginated results including a working
"near me" radius query; full profile + similar + cached homepage blocks return correctly; tests green.

## Phase 3 — Frontend foundations

Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), [`07-frontend.md`](07-frontend.md),
[`03-tech-stack.md`](03-tech-stack.md), and [`06-api-endpoints.md`](06-api-endpoints.md) first (the real
endpoint shapes shipped in Phase 2). Shell + design system + data layer only — no public feature pages yet
(Phase 4).

**Goal:** a runnable, responsive web shell with a design system, a typed API client wired to the Phase 2 API,
and i18n seams — mobile-first.

1. Tailwind theme via the `@buisnez/config` preset + shadcn/ui in `components/ui`. Brand tokens (color,
   type, spacing, radius); distinct, trustworthy, modern Pakistani-local feel; design at 360px first.
2. Layout: Header (`LocationPicker` via `GET /locations/cities`), Footer, root layout with providers,
   MobileNav. Logical CSS (`start`/`end`, `ms`/`me`) for future RTL/Urdu.
3. Typed API client in `src/lib/api` wrapping `fetch`, parsing through `@buisnez/shared` Zod schemas.
   Centralized base URL (`NEXT_PUBLIC_API_URL`), error handling, auth-token-attach/silent-refresh seam.
   Endpoint functions for every Phase 2 public read.
4. TanStack Query provider for client data + Zustand stores (filters, map viewport, UI state). Server data
   never lives in Zustand.
5. next-intl wired, English catalog (`i18n/messages/en.json`) — no hardcoded copy in JSX.
6. Core presentational components (pure, prop-driven): `BusinessCard`, `RatingStars`, `PriceLevel`,
   `OpenNowBadge`, `FeatureList`, `Breadcrumb`. Add `formatPKR`/`formatPhonePK`/`isOpenNow` to
   `@buisnez/shared` (didn't exist before this phase).
7. SEO plumbing for Phase 4: `generateMetadata` helper, JSON-LD builders (`LocalBusiness`, `BreadcrumbList`,
   `ItemList`, `AggregateRating`), `sitemap.ts`, `robots.ts`.
8. A single smoke-test home page that server-fetches `GET /discovery/home` and renders `BusinessCard`s in the
   shell.

**Constraints:** strict TypeScript, no `any`; server components for anything public/SEO, `"use client"` only
where interactivity is needed; `next/image` for images.

**Acceptance:** `pnpm dev` runs; shell responsive at 360px and desktop; smoke home page renders real seeded
businesses from `/discovery/home` with a working location switch; no hardcoded JSX strings; basic mobile
Lighthouse passes with valid metadata; `pnpm lint && pnpm typecheck && pnpm build` clean.

_Actually built together with Phase 4_ (see [`PROGRESS.md`](PROGRESS.md)): item 8's throwaway smoke page was
skipped in favor of building the real Phase 4 homepage directly, since both phases shipped in the same pass.

## Phase 4 — Public discovery experience

Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), [`07-frontend.md`](07-frontend.md),
[`09-search-discovery.md`](09-search-discovery.md), [`08-maps-location.md`](08-maps-location.md), and
[`06-api-endpoints.md`](06-api-endpoints.md) first. Reuses the Phase 3 shell, design system, typed API client,
and shared utils — does not rebuild them. This is the SEO engine: server-rendering and structured data are
non-negotiable.

**i18n/routing (final):** `app/[locale]` with `next-intl` `localePrefix: 'as-needed'`, default locale `en`
(prefix-free). hreflang alternates scaffolded for every locale in `routing.locales` (`en` only, for now).

**Pakistan/Lahore defaults:** default city = Lahore when none is selected; default map center = Lahore's
centroid from `GET /locations/cities/lahore`. Prices in PKR via `formatPKR`; `tel:+92…` call links; distances
in km. `isOpenNow` is the **server-computed** field from the API payload — never derived client-side for a
badge.

**Goal:** the public pages that bring organic traffic — home, search, city hub, city+category, business
profile — all server-rendered and indexable.

1. Homepage (ISR, revalidate 600s) at `/`: `SearchBar`, popular categories/cities (Lahore first), and the
   `GET /discovery/home` blocks (trending, highly-rated, featured, recent).
2. Search results (force-dynamic SSR) at `/search`: `SearchBar` + `FilterPanel` (category, city/area,
   minRating, priceLevel, features, openNow) + `SortSelect` + `BusinessCard` results + a lazy `SearchMapToggle`
   (markers from `BusinessSummary.location`, no client geocoding) + `UseMyLocationButton` (browser
   Geolocation → lat/lng/radius, falls back to Lahore's centroid on denial/error). All filters/sort/geo state
   lives in the URL query string — never in Zustand — so results stay shareable and crawlable.
3. City hub (ISR) at `/[city]`: intro, category links, top-rated businesses, `BreadcrumbList` JSON-LD.
4. City + category (ISR) at `/[city]/[category]`: the primary organic-traffic page. `GET /businesses` scoped
   to city+category, paginated; `BreadcrumbList` + `ItemList` JSON-LD; SEO title/description/canonical.
5. Business profile (ISR) at `/business/[slug]`: header (name, category breadcrumb, rating+count, server
   `isOpenNow` badge), `PhotoGallery`, address/phone(`tel:`)/website, `HoursTable`, `FeatureList`, single-marker
   map (or graceful fallback) + "Get directions" (always works, map or not), reviews (`ReviewCard`, API's
   default newest-first order — no "helpfulness" signal exists in the schema, so "most helpful first" wasn't
   literal), similar businesses. `LocalBusiness` (with nested `AggregateRating`) + `BreadcrumbList` + `Review`
   JSON-LD.
6. `POST /api/revalidate` (Next.js route handler, not `apps/api`) protected by `REVALIDATE_SECRET`, for the
   API to call after future business/review writes.
7. `app/sitemap.ts` (every `PUBLISHED` business + every city + every city×category page) and `app/robots.ts`.

**Constraints:** public pages are server components (ISR/SSR as specified); Google Maps script loads only on
pages that render a map, lazily; `next/image` everywhere with `alt` text; no hardcoded strings; strict
TypeScript.

**Acceptance:** search/filter/sort, `/lahore`, `/lahore/restaurants`, and a full business profile all
server-render correctly; structured data is valid; filters/sort/openNow badges never drift from the server;
`sitemap.xml`/`robots.txt` served correctly; `pnpm lint && pnpm typecheck && pnpm build` clean; Playwright e2e
covers the five key pages.

## Phase 5 — Accounts & contributions

Read [`README.md`](README.md), [`15-conventions.md`](15-conventions.md), [`10-auth-roles.md`](10-auth-roles.md),
[`11-reviews-trust-safety.md`](11-reviews-trust-safety.md), [`05-backend.md`](05-backend.md), and
[`07-frontend.md`](07-frontend.md) first. Builds on the Phase 1 auth backend (rotation + Redis reuse
detection) — does not rebuild it, but **does** change its transport (below).

**Auth transport (confirmed before building, changed from Phase 1):** Phase 1 returned the access token in
the JSON response body for the caller to store — incompatible with "the web client must never hold a
JS-readable token." Fixed first: both access and refresh tokens are now httpOnly cookies; `JwtAuthGuard`
checks the cookie first and falls back to `Authorization: Bearer` only for a future mobile client; a new
`CsrfGuard` requires `X-Requested-With: buisnez-web` on every mutation now that cookies ride along
automatically. See [`10-auth-roles.md`](10-auth-roles.md).

**Goal:** users can register, sign in, and contribute (reviews with photos, favourites, helpful votes,
reports).

1. Auth UI: register/login/verify-email/forgot/reset-password + Google/Facebook OAuth (real redirect flow,
   falling back to a stub consent page when no provider credentials are configured — never fakeable when they
   _are_ configured). Session via `useSession()` (TanStack Query around `GET /auth/me`); the API client
   silently refreshes once on `401` and retries.
2. Write-a-review: overall rating + category-specific sub-ratings (JSON column, category → dimension mapping
   is frontend-only) + photo attachments. One review per user/business — upsert, never a duplicate.
3. Photo upload: presign → direct upload to S3-compatible storage (MinIO locally, remapped port — see
   `PROGRESS.md`) → confirm, which runs `sharp` **synchronously in the request** (resize to thumb/card/full,
   strip EXIF) — no job queue exists in this stack, and standing one up for a single job type wasn't worth it
   (confirmed with the user).
4. Favourites (toggle + `/account/favorites`), helpful votes (toggle), reports (business/review/photo/user +
   reason).
5. `/account` (CSR, client-side auth gate + server-side guards as the real boundary): profile edit, my
   reviews, my photos, favourites.

**Moderation posture (confirmed before building):** reviews/photos publish immediately — there was no
admin-approval endpoint anywhere in the codebase to move a `PENDING` row to `PUBLISHED`, so holding content
for approval would have made it permanently invisible. "Moderation job enqueue" is a `TODO(phase-6)` marker
for a future automated flagging pass, not a pre-publish gate.

**Constraints:** verified email required for writing reviews/uploading photos (`VerifiedEmailGuard`, re-reads
the DB, never trusts the JWT); frontend surfaces `429`s as a friendly rate-limit message; auth-gated routes
are guarded client-side _and_ server-side (client-side is UX only, never the real boundary); strict TypeScript;
`next-intl` for every string; `next/image` for upload previews.

**Acceptance:** register → verify → login → stay logged in across a refresh, with zero tokens in
`localStorage`/`sessionStorage`; write a review with photos and see the profile's aggregates update;
save/unsave, vote helpful, report content; unauthenticated `/account` redirects to login; unverified users see
a clear block message instead of the review form; `pnpm lint && pnpm typecheck && pnpm build` clean; API unit

- e2e green (46 tests across auth + contributions).

## Phase 6 — Business owner experience

Ownership model: `Business.ownerId` is the sole authorization source (never `Role`). Claims module
(submit/approve/reject), business-owner write endpoints (info/hours/features/location/services/photos/
review replies), `GeoService.setBusinessLocation`, pin-drop map editor with a manual lat/lng fallback. Full
detail: `docs/PROGRESS.md`'s Phase 6 entry.

## Phase 7 — Admin & moderation

`MODERATOR` role, ban/unban with immediate token revocation, full `/admin/*` surface (dashboard, claims,
reports, content moderation, businesses, users, taxonomy, moderation log), soft-delete. See
[`12-admin-panel.md`](12-admin-panel.md) and `docs/PROGRESS.md`'s Phase 7 entry.

## Phase 8 — Trust, safety & anti-spam

Rule-based content moderation scoring (replaces the Phase 5/7 no-op auto-approve), verified-reviewer badges,
report priority/rate-limiting, "suggest an edit," appeal path (reuses the `Report` model). See
[`11-reviews-trust-safety.md`](11-reviews-trust-safety.md) and `docs/PROGRESS.md`'s Phase 8 entry.

## Phase 9 — Hardening, performance, SEO, a11y, observability

Read every doc a prior phase named, plus [`13-devops-deployment.md`](13-devops-deployment.md) (new this
phase). Last phase before launch prep — **no new product features**; this phase hardens and finishes what's
already built. Full detail, real numbers, and every deviation: `docs/PROGRESS.md`'s Phase 9 entry.

**Goal:** launch-quality — fast, indexable, accessible, monitored, deferred backlog resolved, test suites
self-isolating.

1. **Deferred backlog** (5 items carried from Phases 4–8): Google Maps real-path verification (re-defer with
   written risk if no key), admin edit forms (wire the existing read-only viewers to the already-working
   APIs), areas taxonomy UI, test-suite shared-DB isolation, storage/MinIO config centralization. Resolve or
   consciously re-defer each — never silently drop one.
2. **Performance**: Core Web Vitals pass (real Lighthouse numbers, not estimates) on a mobile profile; lazy-
   load heavy client components; verify/add caching on hot public queries; add DB indexes from real
   `EXPLAIN ANALYZE` output, not guesses.
3. **SEO**: paginated (or justified single-file) sitemaps, structured-data verification, canonical/metadata
   confirmation.
4. **Accessibility & resilience**: automated a11y testing (not just manual review — this phase found real
   bugs manual review missed), loading/empty/error states on every list/detail view, friendly error copy,
   i18n coverage.
5. **Observability**: error tracking + product analytics (env-gated, inert without credentials — same
   pattern as every other optional integration in this codebase), real health checks, uptime-check and
   billing-alert setup documented.

**Constraints:** no new product features; strict TypeScript; follow [`15-conventions.md`](15-conventions.md);
every suite must run back-to-back green with zero manual DB cleanup; anything that can't be completed gets
re-logged in `PROGRESS.md` with its real launch urgency, not dropped.

**Acceptance:** `pnpm lint && pnpm typecheck && pnpm build` clean; deferred backlog items each resolved or
consciously re-deferred in writing; CWV/a11y/SEO verified with real tool output; backend suite green and
self-resetting; docs updated and listed.

## Phase 10 — Lahore launch (deployment & go-live)

Read [`13-devops-deployment.md`](13-devops-deployment.md) and [`14-build-roadmap.md`](14-build-roadmap.md)
(both current), plus `PROGRESS.md`'s remaining deferred/known items. Ops phase, not feature work — **no new
product features**. Full detail and real status: `docs/PROGRESS.md`'s Phase 10 entry.

**Goal:** Buisnez live in Lahore — deployed, monitored, backed up, with real content, and the last
unverified surface (Google Maps SDK) exercised for real, or formally escalated as a launch blocker if a key
still can't be obtained.

1. **Maps verification**: provision a restricted key, run `apps/web/e2e/maps-real.spec.ts` for real, manually
   click through display markers/search map/owner pin-drop. Escalate as a blocker with options if no key is
   obtainable — never silently ship unverified and call it done.
2. **Real credentials**: Maps, Sentry (web+API), PostHog, OAuth (Google/Facebook), email, storage/CDN — each
   confirmed _live_ (a real test error/event/email observed), not just present as an env var.
3. **Real launch-city data**: real business listings across core categories with correct areas/coordinates/
   hours, imported via `scripts/import-businesses.ts`, published through existing admin moderation (never a
   bypass of it).
4. **Staging regression + load test**: full suite against staging; smoke-test search → profile → review →
   claim → owner edit → moderation → appeal end-to-end; load-test search/profile.
5. **Production infrastructure**: CDN/DNS/SSL, secrets in the host's secret manager (never committed),
   automated DB backups with a _tested_ restore, billing/quota alerts on Maps and storage.
6. **Production config sanity**: rate limits/caching/ISR tuned for real traffic (not test-tuned), storage
   startup check passes in prod.
7. **Runbook**: deploy, rollback, DB restore, secret rotation, outage response — written into
   `13-devops-deployment.md`, not left as tribal knowledge.
8. **Soft launch**: go live for Lahore only, monitor closely, rollback ready, confirm stability before
   expanding cities/categories.

**Constraints:** an AI agent cannot create third-party accounts, provide payment methods, or fabricate real
business data — every one of those is a real launch blocker to escalate, not something to work around
silently. Everything achievable without external account access (deploy tooling, runbook, config review,
import scripts) should still be done in full.

**Acceptance:** Maps paths verified in a real browser (or the missing-key blocker formally escalated); every
real credential confirmed live; production live behind Cloudflare with SSL, monitored, backed up (restore
tested), with real listings; critical journeys pass in production; runbook written; `PROGRESS.md` updated
with launch date/city, credential status, Maps result, load-test numbers, and known issues at launch.
