# Tech Stack

The full set of technology choices across the monorepo, and why. Version numbers are ranges as pinned in
each package's `package.json`; see [`PROGRESS.md`](PROGRESS.md) "Verified Versions" for exact resolved
versions at the time each phase shipped.

## Monorepo & tooling

- **pnpm workspaces + Turborepo** — single install, cached/parallelized `dev`/`lint`/`typecheck`/`test`/`build`
  across `apps/*` and `packages/*`.
- **TypeScript, strict, no `any`** everywhere (`packages/config/tsconfig/base.json`).
- **ESLint + Prettier**, shared config in `packages/config`.
- **Husky + lint-staged + Conventional Commits.**

## Backend (`apps/api`)

- **NestJS 11** — modules/controllers/services/guards/interceptors/filters/pipes per
  [`05-backend.md`](05-backend.md).
- **Prisma 6** on **PostgreSQL 16 + PostGIS 3.4** — schema and raw SQL in [`04-database.md`](04-database.md).
- **Redis** — refresh-token store, rate-limit store (`@nestjs/throttler`), `GET /discovery/home` cache.
- **`@node-rs/argon2`** for password hashing (native `argon2` doesn't compile on this environment's g++; see
  `PROGRESS.md` Phase 1 deviations).
- **`@nestjs/config@4.0.4`, `@nestjs/jwt@11.0.2`** — pinned below their CJS-incompatible v12 majors (see
  `PROGRESS.md` Phase 1 deviations).
- **Zod** for all request/response validation, schemas shared via `@buisnez/shared`.
- **Docker Compose**: `postgis/postgis:16-3.4`, `redis:7-alpine`, `minio/minio:latest` (S3-compatible object
  storage stand-in for Cloudflare R2 in production).

## Frontend (`apps/web`) — from Phase 3

- **Next.js 15 App Router, React 19** — server components by default; public/SEO pages stay server-rendered.
- **Tailwind CSS 3** via the shared `@buisnez/config/tailwind` preset, extended with Buisnez brand tokens
  (color, type scale, spacing, radius) — see [`07-frontend.md`](07-frontend.md).
- **shadcn/ui** — copied-in, editable primitives under `apps/web/src/components/ui` (not an npm-installed
  component library), built on Radix UI primitives + `class-variance-authority` + `tailwind-merge` + `clsx`.
  Icons via `lucide-react`.
- **next-intl** — message-catalog i18n. English catalog only for now (`src/i18n/messages/en.json`); no
  locale-prefixed routing yet (per [`15-conventions.md`](15-conventions.md): "structure future Urdu and Roman
  Urdu support through the i18n message layer"). All UI strings must go through it — no hardcoded JSX copy.
  Layouts use logical CSS properties (`ms-*`/`me-*`, `start`/`end`) so RTL Urdu is a future messages+`dir`
  change, not a layout rewrite.
- **TanStack Query** — all server/API data on the client (caching, refetch, loading/error state). Server
  components fetch directly; TanStack Query is for client components only.
- **Zustand** — client-only UI/ephemeral state (search filters draft, map viewport, UI toggles). Never stores
  server data — that's TanStack Query's job (see [`07-frontend.md`](07-frontend.md)).
- **Zod** (via `@buisnez/shared`) — the API client parses every response through the same schemas the API
  validates against.

## Shared packages

- **`@buisnez/shared`** — Zod schemas, inferred types, enums, constants, and utilities used by both `apps/api`
  and `apps/web`. Never redefine a shape independently in either app.
- **`@buisnez/database`** — Prisma client + schema + migrations + seed, consumed only by `apps/api`.
- **`@buisnez/config`** — shared ESLint, Prettier, `tsconfig`, and Tailwind preset.
