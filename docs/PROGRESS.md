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

## Next Phase

Phase 1 can introduce the first domain contracts and persistence models. It should preserve the conventions in [`15-conventions.md`](15-conventions.md) and keep public discovery routes SEO-friendly.
