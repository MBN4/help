# API Endpoints

Catalog of every `/api/v1` route. Auth routes are specified in detail in
[`10-auth-roles.md`](10-auth-roles.md) and aren't repeated here. Search/discovery query params and scoring
are specified in detail in [`09-search-discovery.md`](09-search-discovery.md); geo internals in
[`08-maps-location.md`](08-maps-location.md). Every response uses the standard envelope from
[`05-backend.md`](05-backend.md).

## What "public read" means

Every endpoint on this page is `@Public()` and read-only. Unless noted otherwise, business-related reads are
scoped to `Business.status = 'PUBLISHED'`. The schema has no soft-delete column (no `deletedAt`, no
`DELETED` status) as of Phase 2, so "published, non-deleted" is currently just "published" — a real
soft-delete concept can be added if/when a delete endpoint is built (Phase 5+, claims/admin moderation).

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

| Method | Path                        | Notes                                                                                    |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/businesses`               | Search/list. See [`09-search-discovery.md`](09-search-discovery.md).                     |
| GET    | `/businesses/:slug`         | Full profile (below).                                                                    |
| GET    | `/businesses/:id/reviews`   | Paginated (`page`/`perPage`, default 20 max 50), newest first, `PUBLISHED` reviews only. |
| GET    | `/businesses/:id/photos`    | Paginated, `isApproved = true` only.                                                     |
| GET    | `/businesses/:slug/similar` | Up to 6, no pagination. See matching rules below.                                        |

`GET /businesses/:slug` response:

```
{
  id, slug, name, description, addressLine,
  location: { lat, lng } | null,
  phone, whatsapp, email, website, priceTier, isVerified,
  category: { id, name, slug, parent: { id, name, slug } | null },
  province: { id, name, slug }, city: { id, name, slug }, area: { id, name, slug } | null,
  hours: { dayOfWeek, opensAt, closesAt, isClosed }[],   // 7 entries, Monday–Sunday
  features: { id, name, slug, icon }[],
  aggregates: { averageRating: number | null, reviewCount: number, ratingBreakdown: { "1": n, "2": n, "3": n, "4": n, "5": n } },
  createdAt
}
```

"Services" from the original task phrasing is this endpoint's `features` list — the schema has no separate
services concept, and features (amenities/offerings) is what it actually maps to.

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
  distanceMeters: number | null    // only present when the request included lat/lng
}
```

## Schema addition: `Business.featured`

Phase 2 adds `Business.featured Boolean @default(false)` via a new migration. There is no admin endpoint to
set it yet (no admin/business-write surface exists until a later phase) — it defaults `false` everywhere,
and the seed script flips it `true` on 2 demo businesses so `/discovery/home`'s `featured` block has
something to return. A real curation endpoint is Phase 5+ (admin moderation) work.
