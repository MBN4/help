# Backend

NestJS API in `apps/api`, global prefix `/api/v1`. Extends the Phase 0 bootstrap in
[`main.ts`](../apps/api/src/main.ts).

## Module layout

One Nest module per folder under `apps/api/src/modules` (already scaffolded): `auth`, `users`, `locations`
(Province/City/Area), `categories`, `businesses`, `photos`, `reviews`, `favorites`, `claims`, `reports`,
`geo` (shared proximity-search helpers), `search`, `admin`. Cross-cutting code lives in
`apps/api/src/common` (filters, pipes, interceptors, guards, decorators), `apps/api/src/config`
(env validation), `apps/api/src/integrations` (mail, sms, maps, storage), `apps/api/src/jobs`.

## Prisma integration

- `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) extends `PrismaClient` (re-exported from
  `@buisnez/database`), implements `OnModuleInit`/`OnModuleDestroy` to `$connect`/`$disconnect`.
- `PrismaModule` (`apps/api/src/prisma/prisma.module.ts`) is `@Global()`, provides and exports
  `PrismaService`, imported once in `AppModule`.
- All `Unsupported` columns (`location`, `centroid`, `searchVector`) are read/written with
  `prisma.$queryRaw`/`$executeRaw` — see [`04-database.md`](04-database.md). Wrap these in a small
  `GeoService` under `modules/geo` rather than inlining raw SQL in feature services.

## Validation: Zod, not class-validator DTOs

Request/response contracts live once in `@buisnez/shared` as Zod schemas and are imported by both
`apps/api` and `apps/web`. The API validates with a custom pipe, not `class-validator` decorators:

- `ZodValidationPipe` (`apps/api/src/common/pipes/zod-validation.pipe.ts`) takes a `ZodSchema`. On failure it
  throws (an `AppException`, `VALIDATION_ERROR`, 400) with the flattened Zod issue list, caught by the
  exception filter below.
- **Apply it on the specific param decorator** — `@Query(new ZodValidationPipe(schema)) query: X` or
  `@Body(new ZodValidationPipe(schema)) body: X` — **not** `@UsePipes(...)` at the method level whenever the
  handler has more than one pipelined parameter. Pipelined means `@Body`/`@Query`/`@Param`/`@Headers` **and
  any custom decorator built with `createParamDecorator`** (e.g. `@CurrentUser()`) — only `@Req()`/`@Res()`
  are exempt (Nest treats those as special host objects, not pipelined data). A method-level pipe runs against
  _every_ pipelined parameter, so a handler like `getReviews(@Param('id') id: string, @Query() query:
PaginationQuery)` with a method-level `@UsePipes(new ZodValidationPipe(paginationQuerySchema))` fails
  immediately — the pipe also runs the pagination schema against the plain `id` string and rejects it. This
  bit us in Phase 2's `businesses.controller.ts` before every handler was switched to param-level pipes, and
  again in Phase 5 in a broader form: every new controller combining `@CurrentUser()` with `@Body()`/`@Query()`
  under a method-level pipe hit the same failure (`@CurrentUser()` is pipelined too, despite not looking like
  request data) — see `PROGRESS.md`'s Phase 5 entry.
- The existing global `ValidationPipe` from `@nestjs/common` (Phase 0) is removed once every route has an
  explicit Zod schema; `class-validator`/`class-transformer` stay as transitive Nest dependencies but are not
  used for new DTOs.

## Standard response envelope

All responses share one shape, applied by a global interceptor/filter — controllers return plain data or
throw; they never construct the envelope themselves.

Success (`ResponseTransformInterceptor`, `apps/api/src/common/interceptors/response.interceptor.ts`):

```json
{ "success": true, "data": {}, "meta": null }
```

`meta` carries pagination info (`{ "page": 1, "perPage": 20, "total": 137 }`) when the underlying controller
method returns `{ data, meta }`; otherwise it is `null` and `data` is the raw payload.

Error (`AllExceptionsFilter`, `apps/api/src/common/filters/all-exceptions.filter.ts`, catches everything —
`HttpException`, Zod validation errors, Prisma errors, unknown errors):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

`code` is a stable machine-readable string (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, ...); HTTP status is still set correctly on the response.
Unknown/unexpected errors are logged with a stack trace server-side and returned to the client as a generic
`INTERNAL_ERROR` with no internal details leaked.

## Security bootstrap

`main.ts` keeps: `helmet()`, `app.setGlobalPrefix('api/v1')`, and CORS restricted to `WEB_ORIGIN` with
`credentials: true` (required because the refresh token is an httpOnly cookie — see
[`10-auth-roles.md`](10-auth-roles.md)). Phase 1 adds `cookie-parser` middleware (for reading the refresh
cookie) and `@nestjs/throttler` bound globally with a permissive default limit and a strict override on auth
routes.

## Config

Environment variables are validated once at bootstrap with a Zod schema in `apps/api/src/config` (fail fast
on a missing `JWT_SECRET`, malformed `DATABASE_URL`, etc.), then exposed through `@nestjs/config`'s
`ConfigService` rather than reading `process.env` directly in feature code.

## Testing

- **Unit**: services tested in isolation with a mocked `PrismaService`/Redis client (Jest, colocated
  `*.spec.ts`).
- **Integration**: `apps/api/test` boots the full Nest app (`Test.createTestingModule` +
  `app.init()`) against the real dockerized Postgres/Redis, exercising controllers through `supertest`.
- **PostGIS**: at least one integration test seeds known coordinates and asserts `ST_DWithin` proximity
  search returns the expected business IDs and excludes out-of-radius ones.

Run with `pnpm test` (Turborepo fans out to each package/app's `test` script).
