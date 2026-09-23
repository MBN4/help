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

| Tool                     | Version                  |
| ------------------------ | ------------------------ |
| Node.js                  | `24.3.0`                 |
| pnpm                     | `9.15.0`                 |
| Next.js                  | `15.5.25`                |
| NestJS                   | `11.2.5`                 |
| Prisma                   | `6.19.3`                 |
| PostgreSQL/PostGIS image | `postgis/postgis:16-3.4` |
| Redis image              | `redis:7-alpine`         |
| MinIO image              | `minio/minio:latest`     |

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

## Next Phase

Phase 3 (frontend foundations) is next — the user will provide the detailed prompt. It should preserve the
conventions in [`15-conventions.md`](15-conventions.md), consume the Phase 1–2 API surface, and keep public
discovery routes SEO-friendly per [`01-product-overview.md`](01-product-overview.md).
