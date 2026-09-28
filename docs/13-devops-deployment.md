# DevOps & Deployment

This doc didn't exist through Phase 8 despite being referenced in the numbered doc map — deployment/env/
observability details were scattered across `docker-compose.yml`, three `.env.example` files, and
`docs/PROGRESS.md`'s environment-quirk notes. Written in Phase 9 as the single place to look. Keep it in
sync: update this doc whenever an env var, port, or external-service dependency changes.

## Local stack

`docker-compose.yml` runs three services. Host ports are remapped from every tool's defaults because this
development machine already runs other projects' Postgres/Redis/MinIO on the standard ports — a real
deployment target without that conflict can use the defaults instead.

| Service          | Image                    | Container port | Host port (this env) | Why remapped                                         |
| ---------------- | ------------------------ | -------------- | -------------------- | ---------------------------------------------------- |
| Postgres/PostGIS | `postgis/postgis:16-3.4` | 5432           | **5544**             | Host already runs another project's Postgres on 5432 |
| Redis            | `redis:7-alpine`         | 6379           | **6390**             | Host already runs another project's Redis on 6379    |
| MinIO (API)      | `minio/minio:latest`     | 9000           | **9102**             | Host already runs another project's MinIO on 9000    |
| MinIO (console)  | —                        | 9001           | **9103**             | Same                                                 |

**The recurring trap this remap has caused twice before** (Phase 4, Phase 8): a consumer of the storage
endpoint hardcodes the _default_ port (9000) instead of reading the actual remapped one, and uploads/images
work until the exact code path that hits the wrong port executes — usually first noticed via a broken
`next/image` render. Phase 9 closed this for the frontend: `apps/web/next.config.mjs`'s
`images.remotePatterns` is now built from the single `NEXT_PUBLIC_S3_PUBLIC_HOST` env var (see below)
instead of a hardcoded port. The backend's `StorageService` also gained a startup connectivity check
(`verifyStorageConnectivity`) that loudly logs and names the likely stale-port cause if the configured
`S3_ENDPOINT` is unreachable at boot, instead of failing silently on the first real upload.

Bring the stack up: `docker compose up -d`. Reset it to a clean, freshly-seeded state:
`bash scripts/reset-test-env.sh` (see [Test isolation](#test-isolation) below).

## Environment variables

There's one root `.env.example` covering both apps' shared concerns, plus `apps/api/.env.example` and
`apps/web/.env.example` for each app's own process. All three must stay in sync for any var used by both
processes (e.g. `REVALIDATE_SECRET`, the `S3_*` vars).

| Var                                                                                                                              | Used by                        | Notes                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                                                                   | api, database package          | Points at the remapped Postgres port locally                                                                                                     |
| `REDIS_URL`                                                                                                                      | api                            | Points at the remapped Redis port locally                                                                                                        |
| `JWT_SECRET` / `JWT_REFRESH_SECRET`                                                                                              | api                            | Long random secrets in any real environment                                                                                                      |
| `WEB_ORIGIN`                                                                                                                     | api                            | CORS allow-origin                                                                                                                                |
| `NEXT_PUBLIC_API_URL`                                                                                                            | web                            | Base URL the browser calls                                                                                                                       |
| `NEXT_PUBLIC_SITE_URL`                                                                                                           | web                            | Used for canonical URLs, JSON-LD, sitemap                                                                                                        |
| `REVALIDATE_SECRET` / `WEB_REVALIDATE_URL`                                                                                       | api, web                       | On-demand ISR — api calls web's `/api/revalidate` with this secret                                                                               |
| `GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                        | api (geocoding), web (Maps JS) | **Empty in every environment so far** — see [Google Maps](#google-maps) below                                                                    |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `FACEBOOK_OAUTH_CLIENT_ID/SECRET`, `OAUTH_CALLBACK_BASE_URL`                                    | api                            | Empty → stubbed provider handshake (`STUB_DISABLED` gate hard-disables the stub the moment a real client ID is set)                              |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL_BASE` | api                            | MinIO locally, R2 (or any S3-compatible store) in prod                                                                                           |
| `NEXT_PUBLIC_S3_PUBLIC_HOST`                                                                                                     | web                            | `host:port` of the public storage endpoint — builds `next.config.mjs`'s `images.remotePatterns`. **Must match `S3_PUBLIC_URL_BASE`'s host:port** |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`                                                                                        | docker-compose only            | Local MinIO admin credentials                                                                                                                    |
| `SENTRY_DSN`                                                                                                                     | api                            | Error tracking — empty means `@sentry/node` never initializes, zero network calls                                                                |
| `NEXT_PUBLIC_SENTRY_DSN`                                                                                                         | web                            | Same, for `@sentry/nextjs`                                                                                                                       |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`                                                                            | web build                      | Only needed for source-map upload at build time; the build stays green without them                                                              |
| `POSTHOG_KEY`                                                                                                                    | api                            | Product analytics — empty means `posthog-node` never initializes                                                                                 |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`                                                                           | web                            | Same, for `posthog-js`                                                                                                                           |

Every optional integration above (Maps, OAuth, Sentry, PostHog) follows the same rule: **empty/unset means
fully inert, never a crash, never a network call.** This has been verified for each one specifically (not
assumed) — see the relevant phase's entry in `docs/PROGRESS.md`.

## Google Maps

No API key has ever been provisioned in this development environment. `GeoService.geocodeAddress` (api) and
`MapView`/`PinDropMap`/`useGoogleMapsScript` (web) are fully built, typechecked, and their no-key fallback
paths (static "get directions" links, manual lat/lng entry) are real and tested — but the actual Google Maps
JS SDK integration (marker rendering, drag-to-reposition, search-map markers) has never executed anywhere in
this codebase's history. `apps/web/e2e/maps-real.spec.ts` exercises the real paths and is written to run the
moment a key is set; it currently skips (`test.skip(!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, ...)`).

**To provision one for real testing or launch**: create a project in Google Cloud Console, enable the "Maps
JavaScript API" and "Geocoding API", create a browser-restricted API key (restrict to this app's domain(s)),
set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for the browser-facing key and `GOOGLE_MAPS_API_KEY` for the
server-side geocoding key (can be the same key with looser restrictions, or two separate keys — a separate
server-side key with an IP restriction instead of a domain restriction is the more defensible setup).
**Set a billing budget alert** in Google Cloud Console (Billing → Budgets & alerts) before going live — Maps
JS API billing is usage-based and has no built-in hard cap.

## Storage billing/quota

Local dev uses MinIO (self-hosted, no billing). A real deployment should point `S3_*` at a managed
S3-compatible store (Cloudflare R2 is the one referenced throughout this codebase's comments/docs, chosen
for its free egress). Whichever provider is used, set a usage/billing alert in that provider's dashboard
before launch — the app itself has no upload-volume alerting of its own (only the per-upload 10MB size limit
already enforced in `PhotosService`).

## Observability

- **Error tracking**: Sentry, wired for both api (`@sentry/node`) and web (`@sentry/nextjs`) — see the env
  var table above. To activate: create a Sentry project per app (or one project, two environments), set the
  DSNs. Unexpected (non-mapped) API errors are captured via `AllExceptionsFilter`; web captures unhandled
  client/server exceptions per the Next.js App Router SDK's defaults.
- **Product analytics**: PostHog, wired for both api (`posthog-node`) and web (`posthog-js`) — same
  activate-by-setting-the-key pattern. Tracks: review submitted, claim submitted/approved, business created
  via admin (api-side); search performed, business viewed (web-side).
- **Health check**: `GET /api/v1/health` — real liveness/readiness via `@nestjs/terminus`, checking Postgres
  (`SELECT 1`), Redis (`ping`), and storage (`headBucket`). Returns terminus's standard
  `{status, info, error, details}` shape; `status: 'ok'`/200 only when all three are up.
- **Uptime monitoring**: not code — point an external monitor (UptimeRobot, BetterStack, Pingdom, or
  equivalent) at two URLs once a real deployment exists: `GET /api/v1/health` (backend) and `GET /` (the
  homepage, as an end-to-end "is the whole stack actually serving pages" check — `/health` alone can be
  green while the frontend is broken). No account was available to configure this from the development
  environment; this is the setup instruction for whoever deploys.

## Test isolation

Backend Jest e2e (`apps/api/test`) and frontend Playwright (`apps/web/e2e`) run against the same live
Postgres/Redis — there's no per-suite database. `scripts/reset-test-env.sh` (`prisma migrate reset --force`

- reseed + `redis-cli FLUSHALL`) is wired as `globalSetup` in both `apps/api/test/jest-e2e.json` and
  `apps/web/playwright.config.ts`, so every `pnpm test`/`pnpm test:e2e` run starts from a known-clean state
  automatically — no manual ordering or cleanup required between a Jest pass and a Playwright pass.

* `E2E_SKIP_RESET=1` skips the reset for fast local iteration on a single spec when the DB is already in a
  known-good state.
* Root scripts: `pnpm test:e2e:reset` (just the reset), `pnpm test:e2e:all` (API e2e then Playwright,
  back-to-back).
* **`prisma migrate reset --force` is destructive** — it drops and recreates the entire configured database.
  It has a built-in guard that refuses to run when it detects it's being invoked by an AI coding agent
  without explicit human confirmation (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); a human running these
  scripts directly in a terminal never sees this prompt. Never point `DATABASE_URL` at a real/production
  database while these scripts (or the test suites that call them) can run.
* **Residual, non-isolation-related constraint**: Phase 1's `/auth/login`/`/auth/register` throttle
  (5 req/min/IP) can still be exhausted by one long Playwright run's own _cumulative_ auth traffic across
  its ~15 spec files (each registers/logs in several users). This is separate from the DB-contamination
  problem the reset script fixes — confirmed by running the affected spec files in isolation (they pass
  100%) versus as part of the full suite (they can intermittently fail on login). Not fixed in Phase 9 since
  it would mean loosening a deliberate Phase 1 security control; `--workers=1` plus, if needed, splitting a
  very large full-suite run into batches with a pause between them is the current workaround (same as
  documented in Phase 7).
