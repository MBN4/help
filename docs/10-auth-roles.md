# Authentication & Roles

## Roles

`Role` enum on `User`: `CUSTOMER` (default on register), `BUSINESS_OWNER`, `ADMIN`. A user is promoted from
`CUSTOMER` to `BUSINESS_OWNER` automatically when an admin approves their first `Claim` (Phase 2+ business
logic, not part of Phase 1). `ADMIN` is only ever set by direct DB action/seed — there is no self-service
admin signup.

## Password storage

`argon2id` via `@node-rs/argon2` (`hash(password)` / `verify(hash, password)`) — a napi-rs binding that
ships prebuilt native binaries, unlike the `argon2` package, which compiles from source via node-gyp and
requires a C++20-capable compiler (this environment's g++ predates that). `@node-rs/argon2`'s default
algorithm is already Argon2id. Never `bcrypt`, never plain `crypto`.

## Tokens

Two JWTs, both `jsonwebtoken`-compatible via `@nestjs/jwt`:

| Token   | Secret               | Lifetime | Carried as                                                                                          |
| ------- | -------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Access  | `JWT_SECRET`         | 15m      | httpOnly, secure (prod), `SameSite=Lax` cookie named `access_token`, path `/`                       |
| Refresh | `JWT_REFRESH_SECRET` | 30d      | httpOnly, secure (prod), `SameSite=Lax` cookie named `refresh_token`, scoped to path `/api/v1/auth` |

**Phase 5 transport decision**: both tokens are httpOnly cookies for the web client — neither is ever
returned in a JSON response body, so web JS can never read either token (`register`/`login` return
`{ user }` only; `refresh` returns `{ refreshed: true }`). `JwtAuthGuard` reads the access token from the
`access_token` cookie first; if absent, it falls back to an `Authorization: Bearer` header, which is reserved
for a future mobile app (mobile has no browser cookie jar, so it authenticates with the header instead — nothing
else about the token or guard changes for that case). This replaced Phase 1's original design, where the
access token was returned in the JSON body for any client to store; that broke the requirement that the web
client never touch a JS-readable token, so it was fixed before Phase 5's login UI was built on top of it. See
`PROGRESS.md`'s Phase 5 entry.

Access token payload: `{ sub: userId, role, jti }`. Refresh token payload: `{ sub: userId, jti }`, where `jti`
is a random UUID minted per token.

### CSRF

Cookie-based auth means browsers attach `access_token`/`refresh_token` to cross-site requests automatically;
`SameSite=Lax` blocks most of that but isn't a complete defense alone. Every mutating request (any method
other than `GET`/`HEAD`/`OPTIONS`) additionally requires a `X-Requested-With: buisnez-web` header
(`CsrfGuard`, bound globally, runs before `JwtAuthGuard`) — a cross-site form/script/image tag cannot set a
custom header, so this blocks CSRF with no extra token-issuing endpoint. The web client attaches it to every
request (`apps/web/src/lib/api/client.ts`). The future mobile app authenticates via the `Authorization` header
instead of cookies, so it's unaffected and doesn't need the header.

### Server-side refresh store (Redis)

Every issued refresh token's `jti` is written to Redis as `refresh:<userId>:<jti>` with a TTL equal to the
refresh token's remaining lifetime; value is opaque (`"1"` or a small metadata blob e.g. device/UA). This is
what makes refresh tokens revocable despite being stateless JWTs:

- **Login/Register**: mint access + refresh, write `refresh:<userId>:<jti>` to Redis, set the cookie.
- **Refresh** (`POST /auth/refresh`): verify the refresh JWT signature, look up `refresh:<userId>:<jti>` in
  Redis — if missing, the token was already used/revoked, so reject with `401` and (defensively) delete any
  other keys under `refresh:<userId>:*` (reuse detection: assume the token was stolen and log the user out
  everywhere). If present, delete that key, mint a **new** access + refresh pair (**rotation**), store the
  new `jti`, set the new cookie.
- **Logout** (`POST /auth/logout`): delete `refresh:<userId>:<jti>` for the presented cookie, clear the
  cookie. Does not touch other sessions/devices.
- **Password reset / detected compromise**: delete all `refresh:<userId>:*` keys, invalidating every session.

## Endpoints (`apps/api/src/modules/auth`)

All under `/api/v1/auth`. Request/response bodies are Zod schemas from `@buisnez/shared` (`packages/shared/src/schemas`).

| Method | Path               | Auth      | Notes                                                                                    |
| ------ | ------------------ | --------- | ---------------------------------------------------------------------------------------- |
| POST   | `/register`        | `@Public` | Creates `CUSTOMER`, sends email verification link, logs in.                              |
| POST   | `/login`           | `@Public` | Email + password.                                                                        |
| POST   | `/refresh`         | `@Public` | Reads `refresh_token` cookie; see rotation above.                                        |
| POST   | `/logout`          | `@Public` | Reads `refresh_token` cookie; no-op if absent/already invalid.                           |
| GET    | `/me`              | required  | Returns the current user from the access token.                                          |
| POST   | `/verify-email`    | `@Public` | Body: `{ token }`, single-use, expires in 24h.                                           |
| POST   | `/forgot-password` | `@Public` | Always `200` regardless of whether the email exists (no enumeration).                    |
| POST   | `/reset-password`  | `@Public` | Body: `{ token, newPassword }`, single-use, expires in 1h, revokes all refresh sessions. |

`EmailVerificationToken`/`PasswordResetToken` store only a hash of the token (`sha256`), never the raw value,
mirroring password storage discipline; the raw token is emailed to the user and never persisted.

## Guards & decorators (`apps/api/src/common`)

- **`JwtAuthGuard`** — bound **globally** (`APP_GUARD`). Reads the `Authorization: Bearer` header, verifies
  against `JWT_SECRET`, attaches `request.user = { id, role }`. Throws `401` if missing/invalid, unless the
  route (or its controller) is marked `@Public()`.
- **`@Public()`** — decorator setting reflector metadata `isPublic: true`, checked by `JwtAuthGuard` to skip
  auth entirely (used on the auth endpoints above).
- **`RolesGuard`** — reads `@Roles(...roles: Role[])` metadata; runs after `JwtAuthGuard` and 403s if
  `request.user.role` isn't in the list. Routes with no `@Roles()` allow any authenticated role.
- **`@CurrentUser()`** — param decorator returning `request.user` (optionally `@CurrentUser('id')` for a
  single field).

Guard order in `main.ts`/`AppModule`: `JwtAuthGuard` first (global), `RolesGuard` applied per-route/controller
where role restriction is needed.

## Rate limiting

`@nestjs/throttler`, backed by the same Redis instance (`nestjs-throttler-storage-redis` or equivalent), so
limits survive across API instances. Global default: 100 req/min per IP. Auth routes override with a strict
limit — `login`/`register`/`forgot-password`: 5 req/min per IP; `refresh`: 20 req/min per IP (higher, since
it's called routinely by legitimate clients).

## Cookies & CORS

The refresh cookie requires `credentials: true` on CORS (already set in `main.ts`, restricted to
`WEB_ORIGIN`) and `cookie-parser` middleware. In production the cookie is `Secure`; in local dev over HTTP it
is not (gated on `NODE_ENV`).
