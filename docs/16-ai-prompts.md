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

To be written in full when this phase starts (Next.js App Router pages/components consuming the Phase 1–2
API surface).

## Phase 4+ (placeholders — write in full before starting each one)

- **Business write endpoints**: authenticated business creation (unclaimed by default) and owner-scoped
  editing, wired to `GeoService.geocodeAddress` on write.
- **Reviews, photos & favorites**: review CRUD with the one-review-per-user-per-business constraint, owner
  replies, photo upload via the storage integration, favorites; call `DiscoveryService.invalidateHomeCache()`
  on writes that affect the homepage blocks.
- **Claims, reports & admin moderation**: claim workflow (submit/approve/reject), report workflow, admin
  endpoints gated by `RolesGuard`/`ADMIN`, including setting `Business.featured`.

Each of these gets its own fully-specified prompt section, written just before that phase starts, following
the same structure as Phase 1/2 (goal, numbered steps, acceptance criteria) — not invented in advance.
