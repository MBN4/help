# API Endpoints

Catalog of every `/api/v1` route. Auth routes are specified in detail in
[`10-auth-roles.md`](10-auth-roles.md) and aren't repeated here. Search/discovery query params and scoring
are specified in detail in [`09-search-discovery.md`](09-search-discovery.md); geo internals in
[`08-maps-location.md`](08-maps-location.md). Every response uses the standard envelope from
[`05-backend.md`](05-backend.md).

## What "public read" means

Unless noted otherwise, every endpoint through the "Features" section below is `@Public()` and read-only.
Business-related reads are scoped to `Business.status = 'PUBLISHED' AND deletedAt IS NULL` (soft-delete added
Phase 7 — `Business.deletedAt`, set/cleared only via the ADMIN-only `/admin/businesses/:id` DELETE/restore
routes, never a real row delete).

Phase 5 added the first **write** endpoints (reviews, photos, favourites, helpful votes, reports, profile) —
see the "Contributions" section near the bottom of this page and
[`11-reviews-trust-safety.md`](11-reviews-trust-safety.md) for full detail. Auth endpoints (including OAuth)
are covered entirely in [`10-auth-roles.md`](10-auth-roles.md).

## Locations (`modules/locations`)

| Method | Path                      | Query params            | Returns                                                   |
| ------ | ------------------------- | ----------------------- | --------------------------------------------------------- |
| GET    | `/locations/provinces`    | —                       | `{ id, name, slug, cityCount }[]`                         |
| GET    | `/locations/cities`       | `province?` (slug)      | `{ id, name, slug, provinceName }[]`, optionally filtered |
| GET    | `/locations/cities/:slug` | —                       | `{ id, name, slug, provinceName, centroid: { lat, lng }   | null }` |
| GET    | `/locations/areas`        | `city` (slug, required) | `{ id, name, slug }[]`                                    |

## Categories (`modules/categories`)

| Method | Path                | Returns                                                                                        |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/categories`       | Full tree: `{ id, name, slug, icon, order, children: [...] }[]` (top-level nodes only, nested) |
| GET    | `/categories/:slug` | `{ id, name, slug, icon, parent: {id,name,slug}                                                | null, children: [...], descendantCategoryIds: string[] }` |

`descendantCategoryIds` includes the category's own id, so callers can always do
`categoryId IN (descendantCategoryIds)` uniformly whether the slug is a leaf or a top-level node.

## Businesses (`modules/businesses`)

| Method | Path                                  | Notes                                                                                                                                         |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/businesses`                         | Search/list. See [`09-search-discovery.md`](09-search-discovery.md).                                                                          |
| GET    | `/businesses/:slug`                   | Full profile (below).                                                                                                                         |
| GET    | `/businesses/:id/reviews`             | Paginated (`page`/`perPage`, default 20 max 50), newest first, `PUBLISHED` reviews only.                                                      |
| GET    | `/businesses/:id/photos`              | Paginated, `isApproved = true` only.                                                                                                          |
| GET    | `/businesses/:slug/similar`           | Up to 6, no pagination. See matching rules below.                                                                                             |
| PUT    | `/businesses/:businessId/review`      | **Auth + verified email required.** Create-or-update the caller's own review. See [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md). |
| GET    | `/businesses/:businessId/review/mine` | **Auth required.** The caller's own review, or `null`.                                                                                        |

`GET /businesses/:slug` response:

```
{
  id, slug, name, description, addressLine,
  location: { lat, lng } | null,
  phone, whatsapp, email, website, priceTier, isVerified,
  category: { id, name, slug, parent: { id, name, slug } | null },
  province: { id, name, slug }, city: { id, name, slug }, area: { id, name, slug } | null,
  hours: { dayOfWeek, opensAt, closesAt, isClosed }[],   // 7 entries, Monday–Sunday
  isOpenNow: boolean,        // server-computed from `hours`, Asia/Karachi — see 09-search-discovery.md
  features: { id, name, slug, icon }[],
  aggregates: { averageRating: number | null, reviewCount: number, ratingBreakdown: { "1": n, "2": n, "3": n, "4": n, "5": n } },
  createdAt
}
```

"Services" from the original task phrasing is this endpoint's `features` list — the schema has no separate
services concept, and features (amenities/offerings) is what it actually maps to.

### `BusinessReview` shape

Used by `GET /businesses/:id/reviews`, `PUT .../review`, and `GET .../review/mine`:

```
{
  id, rating: number,
  subRatings: Record<string, number> | null,   // e.g. {"food":4,"service":5} — see 11-reviews-trust-safety.md
  title, body,
  userId, userName, userAvatarUrl: string | null,
  ownerReply, ownerReplyAt,
  createdAt,
  photoUrls: string[],
  helpfulCount: number
}
```

### `BusinessPhoto` shape

Used by `GET /businesses/:id/photos`:

```
{
  id, url,                          // url = full-size (1600w max) variant
  thumbUrl, cardUrl: string | null, // null for photos seeded before Phase 5's processing pipeline
  caption, createdAt
}
```

**Similar businesses** (`/businesses/:slug/similar`): same leaf category, same city, `PUBLISHED`, excluding
itself, ordered by Bayesian weighted rating (see [`09-search-discovery.md`](09-search-discovery.md))
descending, limit 6. If that yields fewer than 6, broaden to the category's siblings (same parent category)
in the same city to fill the remaining slots, still excluding duplicates and the business itself.

## Discovery (`modules/discovery`)

| Method | Path              | Returns                                                                                |
| ------ | ----------------- | -------------------------------------------------------------------------------------- |
| GET    | `/discovery/home` | `{ trending, highlyRated, featured, recent }`, each up to 6 `BusinessSummary` entries. |

See [`09-search-discovery.md`](09-search-discovery.md) for what each block means and the caching strategy.

### `BusinessSummary` shape

Used by `/businesses` search results, `/discovery/home`, and `/businesses/:slug/similar`:

```
{
  id, slug, name, priceTier, isVerified,
  category: { name, slug }, city: { name, slug }, area: { name, slug } | null,
  averageRating: number | null, reviewCount: number,
  thumbnailUrl: string | null,     // first PUBLISHED, approved photo, if any
  distanceMeters: number | null,   // only present (non-null) when the request included lat/lng
  isOpenNow: boolean,               // server-computed, Asia/Karachi — see 09-search-discovery.md
  location: { lat, lng } | null    // added in Phase 4 for map markers on search/discovery results
}
```

## Features (`modules/features`)

| Method | Path        | Returns                                        |
| ------ | ----------- | ---------------------------------------------- |
| GET    | `/features` | `{ id, name, slug, icon }[]`, ordered by name. |

Added in Phase 4: the frontend's search filter panel needs the full feature catalog to render amenity
checkboxes, and Phase 2 never shipped a way to list them (only per-business feature refs existed). Small
additive read, no schema/migration change — the `Feature` table already existed.

## Contributions (Phase 5) — auth required unless noted

Full detail (moderation posture, photo pipeline, OAuth) in
[`11-reviews-trust-safety.md`](11-reviews-trust-safety.md). Quick catalog:

| Method | Path                          | Notes                                                                                                        |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `/reviews/:reviewId/helpful`  | Toggles the caller's helpful vote → `{ helpful, helpfulCount }`.                                             |
| GET    | `/reviews/helpful-votes/mine` | Query: `businessId`. Review ids the caller voted helpful on.                                                 |
| POST   | `/favorites/toggle`           | `{ businessId }` → `{ favorited }`.                                                                          |
| GET    | `/favorites/mine`             | Paginated `BusinessSummary[]`.                                                                               |
| GET    | `/favorites/mine/ids`         | Favourited business ids only.                                                                                |
| POST   | `/reports`                    | `{ targetType: BUSINESS\|REVIEW\|PHOTO\|USER, targetId, reason, message? }` → `{ id }`. Rate-limited 10/min. |
| POST   | `/photos/presign`             | **+ verified email.** `{ contentType }` → `{ uploadUrl, key }`.                                              |
| POST   | `/photos/confirm`             | **+ verified email.** `{ key, businessId?, reviewId?, caption? }` → `UploadedPhoto`.                         |
| PATCH  | `/users/me`                   | `{ name?, bio?, avatarUrl? }` → `AuthUser`.                                                                  |
| GET    | `/users/me/reviews`           | Paginated `MyReview[]` (review + business ref).                                                              |
| GET    | `/users/me/photos`            | Paginated `MyPhoto[]` (photo + business ref).                                                                |

## Claims (`modules/claims`, Phase 6)

| Method | Path                       | Guard                                | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/claims`                  | `JwtAuthGuard`                       | `{ businessId, message?, documentUrl? }` → `Claim`. 409 `BUSINESS_ALREADY_OWNED` / `CLAIM_ALREADY_PENDING`.                                                                                                                                                                                                                                                                    |
| GET    | `/claims/mine?businessId=` | `JwtAuthGuard`                       | Caller's most recent claim for that business, or `null`.                                                                                                                                                                                                                                                                                                                       |
| GET    | `/claims/mine`             | `JwtAuthGuard`                       | All of the caller's claims.                                                                                                                                                                                                                                                                                                                                                    |
| PATCH  | `/claims/:id/approve`      | `@Roles(Role.MODERATOR, Role.ADMIN)` | Body: `{ verifyBusiness?: boolean }`. Sets `Claim.status = APPROVED`, `Business.ownerId = claim.userId` (+ `isVerified = true` if `verifyBusiness`), promotes user to `BUSINESS_OWNER` (cosmetic — see [`10-auth-roles.md`](10-auth-roles.md)), never downgrades an ADMIN/MODERATOR. Logs `CLAIM_APPROVED`. Loosened from ADMIN-only in Phase 6 to MODERATOR+ADMIN in Phase 7. |
| PATCH  | `/claims/:id/reject`       | `@Roles(Role.MODERATOR, Role.ADMIN)` | Body: `{ reason?: string }`. Sets `Claim.status = REJECTED`. Logs `CLAIM_REJECTED`.                                                                                                                                                                                                                                                                                            |

`Claim` shape: `{ id, businessId, userId, status, message, documentUrl, createdAt, reviewedAt }`.

## Business owner endpoints (`modules/businesses/business-owner.*`, Phase 6)

All mutation routes below are gated by `BusinessOwnerGuard` (route-scoped, requires a `:businessId` uuid path
param — see [`10-auth-roles.md`](10-auth-roles.md)): `business.ownerId === request.user.id || request.user.role === 'ADMIN'`.
`BusinessOwnerController` is registered before `BusinessesController` in `BusinessesModule` so the static
`owned/mine` path isn't swallowed by the `:slug` catch-all route.

| Method | Path                                              | Guard                | Notes                                                                                                                                    |
| ------ | ------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/businesses/owned/mine`                          | `JwtAuthGuard`       | Businesses owned by the caller, with `{ id, slug, name, status, averageRating, reviewCount, createdAt }` each.                           |
| GET    | `/businesses/:businessId/manage`                  | `BusinessOwnerGuard` | Full record for editing, no `status` filter — includes `services`, `features`, `hours`, `ownerId`, `status`.                             |
| PATCH  | `/businesses/:businessId`                         | `BusinessOwnerGuard` | Partial `{ name?, description?, categoryId?, phone?, whatsapp?, email?, website? }`, at least one field required. Revalidates.           |
| PUT    | `/businesses/:businessId/hours`                   | `BusinessOwnerGuard` | Body: exactly 7 `{ dayOfWeek, opensAt, closesAt, isClosed }` entries (delete+recreate in a transaction). Revalidates.                    |
| PUT    | `/businesses/:businessId/features`                | `BusinessOwnerGuard` | `{ featureIds: string[] }` (delete+recreate, validates every id exists). Revalidates.                                                    |
| PATCH  | `/businesses/:businessId/location`                | `BusinessOwnerGuard` | `{ lat, lng }` — pin always wins, calls `GeoService.setBusinessLocation`. Revalidates. See [`08-maps-location.md`](08-maps-location.md). |
| POST   | `/businesses/:businessId/services`                | `BusinessOwnerGuard` | Create a `BusinessService`. Revalidates.                                                                                                 |
| PATCH  | `/businesses/:businessId/services/:serviceId`     | `BusinessOwnerGuard` | Update (verifies `serviceId` belongs to `businessId`). Revalidates.                                                                      |
| DELETE | `/businesses/:businessId/services/:serviceId`     | `BusinessOwnerGuard` | Delete. Revalidates.                                                                                                                     |
| POST   | `/businesses/:businessId/photos`                  | `BusinessOwnerGuard` | Presign→confirm via `PhotosService.confirmForBusiness` (skips the `PUBLISHED` requirement `PhotosService.confirm` normally enforces).    |
| DELETE | `/businesses/:businessId/photos/:photoId`         | `BusinessOwnerGuard` | Verifies photo belongs to the business, deletes the row + underlying storage objects via `StorageService.deleteObject`.                  |
| PUT    | `/businesses/:businessId/reviews/:reviewId/reply` | `BusinessOwnerGuard` | `{ reply }` (1–2000 chars). Sets `Review.ownerReply`/`ownerReplyAt` (upsert-by-overwrite, single nullable column). Revalidates.          |
| DELETE | `/businesses/:businessId/reviews/:reviewId/reply` | `BusinessOwnerGuard` | Clears `ownerReply`/`ownerReplyAt`. Revalidates.                                                                                         |

`GET /businesses/:slug` (public) now additionally returns `services: BusinessService[]` (only
`isAvailable: true`, ordered by `sortOrder`) and `isClaimed: boolean` (derived from `ownerId !== null`,
`ownerId` itself is never exposed on the public profile).

`BusinessService` shape (public, `isAvailable:true` only shown): `{ id, businessId, name, description, priceInPaisa, isAvailable, sortOrder, createdAt }`. `priceInPaisa: null` means "price on request".

## Schema addition: `Business.featured`

Phase 2 adds `Business.featured Boolean @default(false)` via a new migration. Phase 7 adds the real
curation surface: `PATCH /admin/businesses/:id/featured` plus `featuredFrom`/`featuredUntil` window bounds
(see the Admin section below).

## Admin & moderation (`modules/admin`, Phase 7)

Full route/guard/request/response detail lives in [`12-admin-panel.md`](12-admin-panel.md); this is the
summary table. All paths are prefixed `/admin`. `@Roles(Role.MODERATOR, Role.ADMIN)` means MODERATOR-tier;
`@Roles(Role.ADMIN)` means ADMIN-only. See [`10-auth-roles.md`](10-auth-roles.md) for the full role split.

| Method            | Path                                                                     | Guard           | Notes                                                                                       |
| ----------------- | ------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| GET               | `/admin/ping`                                                            | `@Roles(ADMIN)` | Phase 1 smoke-test route, unchanged.                                                        |
| GET               | `/admin/dashboard`                                                       | MODERATOR+ADMIN | Counts: businesses by status, users, reviews, pending claims, open reports, pending photos. |
| GET               | `/admin/reports?status=`                                                 | MODERATOR+ADMIN | Grouped by target, sorted by open-report count desc (priority).                             |
| GET               | `/admin/reports/:id`                                                     | MODERATOR+ADMIN | Full detail incl. current target content.                                                   |
| PATCH             | `/admin/reports/:id/resolve`                                             | MODERATOR+ADMIN | `{ reason?, action: 'REMOVE_CONTENT'\|'BAN_USER'\|'NONE' }` — performs the real action too. |
| PATCH             | `/admin/reports/:id/dismiss`                                             | MODERATOR+ADMIN | `{ reason? }`.                                                                              |
| GET               | `/admin/content/reviews?status=&reported=`                               | MODERATOR+ADMIN | Reviews pending or reported.                                                                |
| GET               | `/admin/content/photos?status=&reported=`                                | MODERATOR+ADMIN | Photos pending or reported.                                                                 |
| PATCH             | `/admin/content/reviews/:id/approve`                                     | MODERATOR+ADMIN | -> `PUBLISHED`.                                                                             |
| PATCH             | `/admin/content/reviews/:id/remove`                                      | MODERATOR+ADMIN | `{ reason }` **required**. -> `REMOVED`, revalidates.                                       |
| PATCH             | `/admin/content/reviews/:id/restore`                                     | MODERATOR+ADMIN | `{ reason? }`. -> `PUBLISHED`, revalidates.                                                 |
| PATCH             | `/admin/content/photos/:id/approve`                                      | MODERATOR+ADMIN | -> `APPROVED`.                                                                              |
| PATCH             | `/admin/content/photos/:id/remove`                                       | MODERATOR+ADMIN | `{ reason }` **required**. -> `REMOVED`, revalidates.                                       |
| PATCH             | `/admin/content/photos/:id/restore`                                      | MODERATOR+ADMIN | -> `APPROVED`, revalidates.                                                                 |
| GET               | `/admin/businesses?q=&status=&includeDeleted=`                           | MODERATOR+ADMIN | Admin search — all statuses, optionally incl. soft-deleted.                                 |
| GET               | `/admin/businesses/:id`                                                  | MODERATOR+ADMIN | Full detail, works for soft-deleted businesses too.                                         |
| PATCH             | `/admin/businesses/:id/status`                                           | MODERATOR+ADMIN | `{ status, reason? }` — reason required moving to `SUSPENDED`/`REJECTED`.                   |
| PATCH             | `/admin/businesses/:id/verify`                                           | MODERATOR+ADMIN | `{ isVerified }`.                                                                           |
| PATCH             | `/admin/businesses/:id/featured`                                         | `@Roles(ADMIN)` | `{ featured, featuredFrom?, featuredUntil? }` — busts `/discovery/home` cache.              |
| POST              | `/admin/businesses`                                                      | `@Roles(ADMIN)` | Direct creation (owners can only create via the claim flow).                                |
| PATCH             | `/admin/businesses/:id`                                                  | `@Roles(ADMIN)` | Generic edit incl. `ownerId` reassignment.                                                  |
| DELETE            | `/admin/businesses/:id`                                                  | `@Roles(ADMIN)` | Soft-delete (`deletedAt = now`), revalidates.                                               |
| POST              | `/admin/businesses/:id/restore`                                          | `@Roles(ADMIN)` | Clears `deletedAt`, revalidates.                                                            |
| GET               | `/admin/users?search=`                                                   | `@Roles(ADMIN)` | Search, paginated.                                                                          |
| GET               | `/admin/users/:id`                                                       | `@Roles(ADMIN)` | Full detail + contribution history.                                                         |
| PATCH             | `/admin/users/:id/ban`                                                   | `@Roles(ADMIN)` | `{ reason }` **required** — "revoke immediately" (see `10-auth-roles.md`).                  |
| PATCH             | `/admin/users/:id/unban`                                                 | `@Roles(ADMIN)` | Clears ban state.                                                                           |
| PATCH             | `/admin/users/:id/role`                                                  | `@Roles(ADMIN)` | `{ role }` — the real role-management surface.                                              |
| POST/PATCH/DELETE | `/admin/taxonomy/categories(/:id)`                                       | `@Roles(ADMIN)` | 409 if the category has children or businesses referencing it.                              |
| POST/PATCH/DELETE | `/admin/taxonomy/provinces(/:id)`                                        | `@Roles(ADMIN)` | 409 if in use.                                                                              |
| POST/PATCH/DELETE | `/admin/taxonomy/cities(/:id)`                                           | `@Roles(ADMIN)` | `centroid` written via `GeoService.setCityCentroid` (raw SQL, `Unsupported()` column).      |
| POST/PATCH/DELETE | `/admin/taxonomy/areas(/:id)`                                            | `@Roles(ADMIN)` | 409 if in use.                                                                              |
| POST/PATCH/DELETE | `/admin/taxonomy/features(/:id)`                                         | `@Roles(ADMIN)` | —                                                                                           |
| GET               | `/admin/moderation-log?actorId=&targetType=&targetId=&action=&from=&to=` | MODERATOR+ADMIN | Paginated, newest-first audit trail.                                                        |

Every removal/ban/reject action requires a non-empty `reason` in the body (400 `VALIDATION_ERROR` if
missing); approvals/restores accept an optional `reason`. Every consequential action writes a `ModerationLog`
row via `ModerationLogService.record()` — see [`12-admin-panel.md`](12-admin-panel.md) for the action
vocabulary.
