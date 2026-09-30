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

## Production deploy (Phase 10)

**Stack**: Vercel (`apps/web`) + Railway (`apps/api`, managed Postgres, managed Redis) + Cloudflare R2
(storage/CDN) + Cloudflare (DNS/SSL/CDN in front of both) + GitHub Actions (CI gate + Railway deploy trigger).
Chosen over a single self-managed VPS for lower ops burden (managed backups/TLS/scaling) at this stage — see
[`14-build-roadmap.md`](14-build-roadmap.md) for the decision record.

### One-time setup

1. **Domain + Cloudflare**: register/point a domain at Cloudflare (orange-cloud proxy on). Add a CNAME for the
   apex/`www` to Vercel's target and a CNAME (or Railway's provided domain) for `api.<domain>` to Railway's
   service. Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites".
2. **Vercel**: import this repo, set the project's **Root Directory to `apps/web`**, framework preset
   Next.js. Connect the custom domain. Vercel auto-deploys on every push to `main` once connected — no GitHub
   Action needed for the frontend.
3. **Railway**: create a project with three services — the API (deployed from `apps/api/Dockerfile`, build
   context = repo root), a managed Postgres (PostGIS: use Railway's Postgres template or point
   `DATABASE_URL` at any Postgres 16 instance with the `postgis`/`pg_trgm` extensions enabled), and a managed
   Redis. Generate a Railway API token (`railway_token`) and store it as the `RAILWAY_TOKEN` GitHub Actions
   secret — `.github/workflows/deploy.yml` uses it to trigger a deploy on every push to `main` (after the
   same lint/typecheck/build gate as CI).
4. **Cloudflare R2**: create a bucket, an R2 API token (S3-compatible), enable public access (or a custom
   domain) for the bucket. Set `S3_ENDPOINT`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_BUCKET`/
   `S3_PUBLIC_URL_BASE`/`NEXT_PUBLIC_S3_PUBLIC_HOST` accordingly (`S3_FORCE_PATH_STYLE=false` for R2).
5. **Run migrations against the real database once, before first deploy**:
   `DATABASE_URL=<railway-postgres-url> pnpm --filter @buisnez/database exec prisma migrate deploy --schema packages/database/prisma/schema.prisma`,
   then seed taxonomy/demo data or skip straight to the real-data import below.
6. **Set every secret** (Railway service variables + Vercel project env vars — never committed, never in
   `.env` files in the repo) per the table in [Environment variables](#environment-variables) above, using
   real values once each provider account exists (Maps, Sentry, PostHog, OAuth, email, R2). See
   `PROGRESS.md`'s Phase 10 entry for exactly which of these are live in this deployment.

### Importing real launch-city listings

`scripts/import-businesses.ts` (`pnpm --filter @buisnez/database run db:import-businesses -- <path-to-csv>`)
upserts businesses from a CSV (see the script's header comment for the exact column list) — creates them as
`PENDING`/unverified, same as any other new listing, so an admin still reviews and publishes each one through
the existing `/admin/businesses` moderation surface rather than this script silently going live. Idempotent
per `(name, city)` slug — safe to re-run against a corrected file. Requires the target city's areas to
already exist in `/admin/taxonomy` (Lahore ships with 4 seeded areas — Gulberg, DHA Lahore, Johar Town, Model
Town — add more there first if the real data references areas not yet in the system).

### Production config sanity (confirmed at code-review time, re-verify against real traffic post-launch)

- **Rate limits**: global default `100 req/min/IP` (`app.module.ts`), auth
  `register`/`login`/`forgot-password` `5/min/IP`, `refresh` `20/min/IP`, reports `10/min/IP` (+`8/min/user`),
  photos `30/min/IP`. These are deliberate Phase 1/8 security decisions, not values relaxed for local testing
  — reviewed at Phase 10 kickoff and judged reasonable for real human traffic as-is (5 login attempts/min is
  generous for a real user, tight enough to slow credential stuffing). Only the `/auth` throttle's _test-suite_
  interaction (documented in [Test isolation](#test-isolation)) is testing-specific, not the limit itself.
- **Caching**: `SearchService` 60s Redis cache on search/discovery reads, `DiscoveryService` 10min cache on
  homepage blocks, ISR `revalidate = 600` (10min) on city/city+category/business/reviewer pages. Reasonable
  defaults for a launch-scale catalog; the values are cheap to retune (single constants) if real traffic
  patterns post-launch suggest otherwise. On-demand revalidation via `POST /api/revalidate` already fires from
  every owner/admin write path (see the Phase 9 correction above), so 600s is a ceiling, not the typical
  staleness window for content that just changed.
- **Storage startup check**: `StorageService.verifyStorageConnectivity()` will do its real job for the first
  time against a live R2 endpoint at first prod boot — loudly logs and names the likely cause if `S3_ENDPOINT`
  is unreachable, exactly the failure mode this check exists for (see the note above about the two prior
  MinIO-port incidents). Confirm the boot log shows a successful connectivity check on first deploy.

## Operational runbook

### Deploy

Push to `main` after CI (`.github/workflows/ci.yml`, gates PRs) and the deploy workflow
(`.github/workflows/deploy.yml`, gates pushes to `main`) both pass. Vercel deploys `apps/web` automatically;
`deploy-api` triggers Railway to rebuild `apps/api/Dockerfile` and roll out the new container. If a migration
is part of the change, run `prisma migrate deploy` against the production `DATABASE_URL` **before** merging
the code that depends on it (never let the API boot against a schema it doesn't expect).

### Roll back a bad deploy

- **Vercel**: Project → Deployments → find the last known-good deployment → "Promote to Production". Instant,
  no rebuild.
- **Railway**: Service → Deployments → select the previous successful deployment → "Redeploy". If the bad
  deploy included a migration that's incompatible with the previous code, do not roll back the code alone —
  restore the database first (below), then roll back the code.

### Restore the database

1. Railway's managed Postgres takes automated daily backups (confirm retention window in the Railway
   dashboard's Backups tab for the actual plan in use).
2. To restore: Railway dashboard → Postgres service → Backups → select a snapshot → Restore (creates a new
   instance or restores in place, per Railway's current UI — confirm which before relying on it in an
   incident, since destructive-vs-new-instance matters for whether the API can keep serving during restore).
3. **Test the restore path before relying on it in an emergency**: restore a backup into a throwaway Railway
   Postgres instance, point a local `DATABASE_URL` at it, and confirm `prisma migrate status` reports the
   expected migration state and the app can query it. Record the actual restore time observed — that's the
   real RTO, not an assumption.

### Rotate a secret

1. Generate the new value at the provider (Maps/Sentry/PostHog/OAuth/email/R2/JWT secrets).
2. Set the new value in Railway (API) and/or Vercel (web) env vars — both support zero-downtime env var
   updates that take effect on the _next_ deploy/restart, not instantly, so trigger a redeploy after setting
   it (Railway: "Redeploy" on the current deployment; Vercel: env var changes need a new deployment to take
   effect for server-rendered/edge code).
3. For `JWT_SECRET`/`JWT_REFRESH_SECRET` specifically: rotating invalidates every existing session (all users
   logged out) — only do this for a real compromise, not routine hygiene, and warn users beforehand if
   possible.
4. Revoke the old value at the provider once the new one is confirmed live (test the affected integration —
   trigger a Sentry test error, a PostHog test event, a test email — before revoking the old key).

### Respond to an outage

1. Check `GET /api/v1/health` (backend liveness/readiness — Postgres/Redis/storage) and `GET /` (homepage —
   catches a frontend-only outage that `/health` alone would miss).
2. Check Sentry for a spike in captured exceptions around the outage start time — `AllExceptionsFilter`
   captures every unmapped API error, `@sentry/nextjs` captures unhandled client/server exceptions.
3. Check Railway's service logs/metrics (CPU/memory/restart count) and Postgres/Redis connection counts —
   a connection-pool exhaustion or OOM restart loop shows here before it shows in Sentry.
4. If the deploy that shipped around the outage's start time is the suspect, roll it back first (see above)
   and investigate after service is restored — don't debug in production while users are affected.
5. Once resolved, write down what happened and the fix in this doc's "known issues" list in
   [`PROGRESS.md`](PROGRESS.md)'s Phase 10 entry, so the next on-call has it.

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
