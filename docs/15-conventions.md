# Engineering Conventions

These conventions apply across the Buisnez monorepo.

## TypeScript

- Use TypeScript for all application and package code.
- Keep TypeScript strict; do not introduce `any`.
- Use kebab-case for files and PascalCase for React components.
- Keep shared contracts in `@buisnez/shared` and import them from both applications.
- Prefer narrow, explicit return types for public functions and controllers.

## Architecture

- Keep the web app and API decoupled.
- Public discovery pages belong in the Next.js App Router and must remain SSR/ISR-friendly.
- API routes use the global `/api/v1` prefix.
- Domain code belongs under the appropriate API module in `apps/api/src/modules`.
- Database access belongs behind the database package and Prisma service boundary.
- Keep jobs and third-party integrations isolated from domain modules.

## Product Data

- Represent money as integer paisa, never floating-point rupees.
- Use PK phone number formats and Pakistan province, city, and area terminology.
- Store and interpret time in `Asia/Karachi`.
- Keep English as the current language; structure future Urdu and Roman Urdu support through the i18n message layer.
- Treat verification, moderation, claims, reports, and anti-spam controls as trust boundaries.

## Frontend

- Use Next.js App Router, Tailwind CSS, and the shared Tailwind preset.
- Keep public discovery content SEO-friendly and server-renderable.
- Prefer shared UI primitives under `apps/web/src/components/ui`.
- Keep API access helpers under `apps/web/src/lib/api`.

## Backend

- Use NestJS modules, controllers, services, DTOs, guards, interceptors, filters, and pipes according to ownership.
- Validate external input with Nest validation pipes and DTOs.
- Use strict CORS configuration from `WEB_ORIGIN`.
- Apply security middleware such as Helmet at bootstrap.

## Workflow

- Use pnpm workspace commands from the repository root.
- Use Turborepo for cross-package `dev`, `lint`, `typecheck`, `test`, and `build` tasks.
- Use Conventional Commits.
- Keep secrets in ignored `.env` files; commit only `.env.example` templates.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before submitting changes.
- Do not add feature code to Phase 0 beyond the health endpoint.
