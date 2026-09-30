# Buisnez Documentation

Buisnez is a Pakistan-first local discovery and review platform. The web application is server-rendered for public discovery, while the NestJS API remains decoupled so a future mobile client can use the same backend.

## Phase 0

Phase 0 provides the runnable monorepo foundation only:

- `apps/web`: Next.js App Router application on port `3000`.
- `apps/api`: NestJS REST API on port `4000`, with the global prefix `/api/v1`.
- `packages/database`: Prisma client package with an empty PostgreSQL/PostGIS schema.
- `packages/shared`: shared TypeScript barrel package for future schemas, types, enums, constants, and utilities.
- `packages/config`: shared ESLint, Prettier, TypeScript, and Tailwind configuration.

The only API endpoint in this phase is `GET /api/v1/health`.

## Local Setup

Requirements:

- Node.js `24.3.0` or a compatible Node.js `20+` release.
- pnpm `9.15.0`.
- Docker with Compose support.

Install dependencies and start both applications:

```bash
pnpm install
pnpm dev
```

Start local infrastructure:

```bash
docker compose up -d
```

The API health check is available at `http://localhost:4000/api/v1/health` and the web application at `http://localhost:3000`.

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Copy `.env.example` files to local environment files as needed. Secrets must never be committed.

## Documentation Map

- [`01-product-overview.md`](01-product-overview.md): product scope, geography model, category tree, feature list.
- [`03-tech-stack.md`](03-tech-stack.md): full technology stack and why, across backend, frontend, and shared packages.
- [`04-database.md`](04-database.md): full Prisma schema and the raw PostGIS/full-text SQL migration.
- [`05-backend.md`](05-backend.md): NestJS module layout, validation, response envelope, security bootstrap.
- [`06-api-endpoints.md`](06-api-endpoints.md): full public API endpoint catalog and response shapes.
- [`07-frontend.md`](07-frontend.md): Next.js App Router structure, design system, data layers, and i18n.
- [`08-maps-location.md`](08-maps-location.md): `GeoService`, geocoding, distance/radius SQL.
- [`09-search-discovery.md`](09-search-discovery.md): search query params, relevance/rating scoring, homepage discovery blocks.
- [`10-auth-roles.md`](10-auth-roles.md): roles, JWT/refresh-token design, auth endpoints, guards.
- [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md): reviews, photo uploads, favourites, helpful votes, reports, OAuth.
- [`12-admin-panel.md`](12-admin-panel.md): admin/moderation roles, claims/reports/content/business/user/taxonomy endpoints.
- [`13-devops-deployment.md`](13-devops-deployment.md): local stack, env vars, Google Maps/storage provisioning, observability, test isolation, production deploy + runbook.
- [`14-build-roadmap.md`](14-build-roadmap.md): one-page phase timeline and Phase 10 launch infra decisions.
- [`15-conventions.md`](15-conventions.md): coding and architecture conventions.
- [`16-ai-prompts.md`](16-ai-prompts.md): phase-by-phase build prompts for AI-assisted development.
- [`PROGRESS.md`](PROGRESS.md): current phase status and verified versions.
