# API Endpoints

Catalog of every `/api/v1` route. Auth routes are specified in detail in
[`10-auth-roles.md`](10-auth-roles.md) and aren't repeated here. Search/discovery query params and scoring
are specified in detail in [`09-search-discovery.md`](09-search-discovery.md); geo internals in
[`08-maps-location.md`](08-maps-location.md). Every response uses the standard envelope from
[`05-backend.md`](05-backend.md).

## What "public read" means

Unless noted otherwise, every endpoint through the "Features" section below is `@Public()` and read-only.
Business-related reads are scoped to `Business.status = 'PUBLISHED'`. The schema has no soft-delete column
(no `deletedAt`, no `DELETED` status), so "published, non-deleted" is currently just "published".

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

## Schema addition: `Business.featured`

Phase 2 adds `Business.featured Boolean @default(false)` via a new migration. There is no admin endpoint to
set it yet (no admin/business-write surface exists until a later phase) — it defaults `false` everywhere,
and the seed script flips it `true` on 2 demo businesses so `/discovery/home`'s `featured` block has
something to return. A real curation endpoint is Phase 5+ (admin moderation) work.
