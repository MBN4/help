# Production image for @buisnez/api. Built from the monorepo root so pnpm workspace deps
# (@buisnez/database, @buisnez/shared) resolve correctly.
#
#   docker build -f apps/api/Dockerfile -t buisnez-api .
#
# Railway (or any Docker-based host) should point its build context at the repo root with this
# Dockerfile path — see docs/13-devops-deployment.md "Production deploy" for the full setup.

FROM node:24-slim AS base
# Prisma's query engine needs to detect the OpenSSL version at generate/runtime; node:24-slim ships
# none, so Prisma silently falls back to an openssl-1.1.x-targeted engine binary that may not match
# what's actually on the box. Installing it explicitly removes that guess.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @buisnez/database run db:generate \
  && pnpm --filter @buisnez/database run build \
  && pnpm --filter @buisnez/shared run build \
  && pnpm --filter @buisnez/api run build

FROM base AS runtime
ENV NODE_ENV=production
# Carrying the whole build-stage /app forward (not a fresh `pnpm install --prod`) is deliberate:
# Prisma's generated client lives inside pnpm's node_modules/.pnpm virtual store, and a fresh prod-only
# install re-fetches a vanilla (non-generated) @prisma/client, silently breaking every Prisma call at
# runtime. Bigger image, correct behavior — revisit only with a build that re-runs `prisma generate`
# after a prod install, not before trying that.
COPY --from=build /app /app

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
