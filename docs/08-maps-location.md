# Maps & Location

All geo capability is isolated behind `GeoService` (`apps/api/src/modules/geo/geo.service.ts`). No other
module runs raw SQL against `location`/`centroid` or calls Google's API directly — `SearchService` composes
the `Prisma.sql` fragments `GeoService` exposes; it does not write its own geography SQL from scratch.

## Geocoding

`GeoService.geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>`

- Calls the Google Geocoding API (`region=pk` biasing) using `GOOGLE_MAPS_API_KEY` (already defined in
  `.env.example` from Phase 0; no new env var).
- **Stubbed when the key is absent**: `GOOGLE_MAPS_API_KEY=''` in this environment (no key has been issued
  yet). `geocodeAddress` checks for a non-empty key up front and returns `null` immediately when missing,
  logging once at startup that geocoding is disabled. This keeps the method's contract stable for whenever a
  real key is added, without a separate feature-flag env var — the key's presence _is_ the flag.
- **Cache**: successful lookups are cached in Redis as `geocode:<normalized-address>` (normalized =
  lower-cased, whitespace-collapsed, trimmed) for 30 days, since addresses geocode to the same point
  deterministically and Google's API is rate-limited/billed per call.
- This is "geocode-on-write" infrastructure for business create/update (Phase 3+, once business mutation
  endpoints exist) — Phase 2 ships the capability but has no write path to call it from yet, since Phase 2 is
  read-only APIs. `GeoService` is fully unit-testable independent of any caller.

## Distance & radius SQL

Two building blocks, both parameterized (never string-interpolated) `Prisma.sql` fragments, since Prisma
cannot express PostGIS types natively (see [`04-database.md`](04-database.md)):

- `GeoService.withinRadiusCondition(lat, lng, radiusMeters)` → a `Prisma.sql` fragment usable in a `WHERE`
  clause: `ST_DWithin("location", ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radiusMeters)`.
- `GeoService.distanceMetersExpr(lat, lng)` → a `Prisma.sql` fragment usable in a `SELECT`/`ORDER BY`:
  `ST_Distance("location", ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography)`.

`SearchService` (see [`09-search-discovery.md`](09-search-discovery.md)) composes these into its combined
filter/sort query. Both require `"location" IS NOT NULL` — callers add that condition themselves since it's
only needed when a business has no coordinates yet.

`GeoService.findBusinessIdsNear(lat, lng, radiusMeters): Promise<string[]>` from Phase 1 is unchanged (still
used by [`packages/database`](04-database.md) seed-adjacent tests) — nearest-first business ids within a
radius, for simple callers that don't need the full search/filter machinery.

## Writing a business's location (Phase 6)

`GeoService.setBusinessLocation(businessId, lat, lng): Promise<void>` — the only write path for
`Business.location`. Since `location` is a Prisma `Unsupported("geography(Point, 4326)")` field it can only
be written via raw SQL, never `.update()`:

```sql
UPDATE "Business" SET "location" = ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography WHERE "id" = $businessId
```

Called from `PATCH /businesses/:businessId/location` (owner-guarded, see
[`06-api-endpoints.md`](06-api-endpoints.md)). **The pin always wins over geocoding** — there is no
"geocode on write" trigger wired into the info-update endpoint (`PATCH /businesses/:businessId`), because
that endpoint's field list (`name`/`description`/`categoryId`/`phone`/`whatsapp`/`email`/`website`) has no
address/city/area fields to react to. `geocodeAddress()` therefore remains unused by any Phase 6 write path;
the location endpoint is the sole, exact-pin write path for a business's coordinates. A future phase that adds
address-editing to the info form would be the natural place to call `geocodeAddress()` as a fallback when no
explicit pin accompanies the same request.

## Units & precision

- All radii and distances are **meters** everywhere in the API (query params, response fields, SQL) — never
  kilometers or miles. The web app converts for display.
- Coordinates are `{ lat, lng }` (WGS84 / SRID 4326), never `{ lng, lat }`, in every JSON response —
  PostGIS's own `ST_MakePoint(lng, lat)` argument order is the one place `lng` comes first, and that stays
  internal to `GeoService`/`SearchService` SQL.
