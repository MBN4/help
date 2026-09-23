# Search & Discovery

`GET /api/v1/businesses` is the single search/listing endpoint the public site's search, category pages, and
city pages all call with different query params. All params are validated by one Zod schema,
`businessSearchQuerySchema`, in `@buisnez/shared`, used by both `apps/api` and (later) `apps/web`.

## Query params

| Param        | Type                                                           | Default     | Notes                                                                                                                          |
| ------------ | -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `q`          | string                                                         | —           | Keyword. Matches `searchVector` (full-text) with a trigram fallback for typos.                                                 |
| `category`   | category slug                                                  | —           | Includes the category's own businesses **and every descendant category's** (see [`06-api-endpoints.md`](06-api-endpoints.md)). |
| `province`   | province slug                                                  | —           |                                                                                                                                |
| `city`       | city slug                                                      | —           |                                                                                                                                |
| `area`       | area slug                                                      | —           |                                                                                                                                |
| `minRating`  | number, 1–5                                                    | —           | Filters on the business's **simple** average rating (see below).                                                               |
| `priceLevel` | comma-separated `ONE,TWO,THREE,FOUR`                           | —           | Matches `Business.priceTier`, `IN (...)`.                                                                                      |
| `features`   | comma-separated feature slugs                                  | —           | **AND** semantics: the business must have every listed feature.                                                                |
| `openNow`    | `true` \| `false`                                              | —           | See "Open now" below.                                                                                                          |
| `lat`, `lng` | numbers                                                        | —           | Must be provided together.                                                                                                     |
| `radius`     | number (meters)                                                | `5000`      | Only applied when `lat`/`lng` are present.                                                                                     |
| `sort`       | `relevance` \| `rating` \| `distance` \| `reviews` \| `newest` | `relevance` | `distance` requires `lat`/`lng` (400 `VALIDATION_ERROR` otherwise).                                                            |
| `page`       | integer ≥ 1                                                    | `1`         |                                                                                                                                |
| `perPage`    | integer, 1–50                                                  | `20`        | Rejected with 400 `VALIDATION_ERROR` above 50 — not silently clamped.                                                          |

Only `PUBLISHED` businesses are ever returned by this endpoint (see [`06-api-endpoints.md`](06-api-endpoints.md)
for what "published, non-deleted" means given the current schema).

## Two rating numbers

Two different rating figures are used on purpose, both computed from `PUBLISHED` reviews only:

- **Simple average** (`R`): `AVG(rating)` for the business. Used for `minRating` filtering, `sort=rating`,
  and displayed as "4.6 (23 reviews)" on business cards — matches user intuition ("show the highest rated
  first" means their literal average, not an adjusted one).
- **Bayesian weighted rating** (`W`): a business with 2 five-star reviews should not outrank one with 400
  reviews averaging 4.7. Used for the relevance score's quality component and for the homepage "highly
  rated" block:

  ```
  W = (v / (v + m)) * R + (m / (v + m)) * C
  ```

  where `v` = the business's `PUBLISHED` review count, `R` = its simple average, `m = 5` (a fixed prior
  weight — "trust a business's own rating over the global average once it has ~5+ reviews"), and `C` = the
  global average rating across all `PUBLISHED` reviews platform-wide (computed per-query via a small CTE;
  cheap at this data size, falls back to `4.0` if there are no reviews yet at all).

## Relevance scoring (`sort=relevance`, the default)

```
relevance = 0.45 * textMatch
          + 0.25 * (W / 5)
          + 0.15 * popularity
          + 0.05 * verifiedBoost
          + 0.10 * proximity
```

- `textMatch` — `0` if `q` is empty (browsing with no keyword; relevance then degenerates to a
  quality/popularity/proximity ordering, which is the sane default for category/city browsing). Otherwise
  `GREATEST(ts_rank_cd("searchVector", plainto_tsquery('english', q)), similarity("name", q))` — the
  trigram `similarity()` term is what makes a misspelled `q` still surface the closest-named businesses.
- `popularity` — `ln(1 + reviewCount) / ln(101)`, i.e. normalized against a soft cap of ~100 reviews. Never
  clamped (very-high-review businesses just get a slightly-over-1 term, which is fine — it's a weighted sum,
  not a strict 0–1 score).
- `verifiedBoost` — `1` if `Business.isVerified`, else `0`.
- `proximity` — `0` when no `lat`/`lng` given. Otherwise `GREATEST(0, 1 - distanceMeters / radiusMeters)`
  (using the effective radius: the request's `radius` if given, else the default `5000`).

Weights are deliberately simple and documented here as the single source of truth; retune by editing this
table and `SearchService`'s `RELEVANCE_WEIGHTS` constant together.

## Open now

Computed in application code (not Postgres date functions), so "now" is unambiguously **Asia/Karachi** wall
clock time regardless of the DB server's timezone:

1. Compute `todayDow` (a `DayOfWeek`), `yesterdayDow`, and `nowTime` (`"HH:MM"`) for the current instant in
   `Asia/Karachi`.
2. A business is open now if **either**:
   - it has a `BusinessHours` row for `todayDow` with `isClosed = false`, `opensAt <= closesAt` (a normal
     same-day window), and `opensAt <= nowTime <= closesAt`; **or**
   - it has a `BusinessHours` row for `todayDow` with `isClosed = false`, `opensAt > closesAt` (an
     overnight window, e.g. `18:00`–`02:00`), and `nowTime >= opensAt` (still within today's portion of that
     overnight window); **or**
   - it has a `BusinessHours` row for `yesterdayDow` with `isClosed = false`, `opensAt > closesAt`
     (overnight), and `nowTime <= closesAt` (still within the early-morning tail of yesterday's overnight
     window).

`todayDow`, `yesterdayDow`, and `nowTime` are computed once per request and passed as bound query
parameters — the SQL only ever compares against them, it never calls `now()` itself.

## Category descendant resolution

`category=<slug>` resolves to a list of category ids (itself plus every descendant, walked recursively — the
tree is at most 2 levels deep per [`01-product-overview.md`](01-product-overview.md), but the resolution
code doesn't assume that) and filters `Business.categoryId IN (...)`. The same resolution function backs
`GET /categories/:slug`'s `descendantCategoryIds` field (see [`06-api-endpoints.md`](06-api-endpoints.md)) —
one implementation, not two.

## Pagination & response shape

Standard envelope from [`05-backend.md`](05-backend.md): `{ success: true, data: BusinessSummary[], meta: {
page, perPage, total } }`. `total` is the count with all filters applied, before pagination.

## Homepage discovery blocks

`GET /api/v1/discovery/home` → `{ trending, highlyRated, featured, recent }`, each up to 6
`BusinessSummary` entries, `PUBLISHED` only:

- **`recent`** — newest by `createdAt`. Unambiguous.
- **`highlyRated`** — ordered by the Bayesian weighted rating `W` above, `WHERE reviewCount >= 3` (so a
  single 5-star review can't appear here at all, not just be down-weighted).
- **`trending`** — ordered by `viewCount` descending. This is a simplification: the schema has a lifetime
  `viewCount` counter, not time-windowed view events, so "trending" today means "most-viewed overall," not
  "most-viewed this week." Revisit once view events are tracked with timestamps.
- **`featured`** — see [`06-api-endpoints.md`](06-api-endpoints.md) for the `Business.featured` flag this
  needs (a Phase 2 schema addition — `isVerified` means something different: moderation trust, not editorial
  promotion).

Cached in Redis (`discovery:home`, TTL 10 minutes) via `DiscoveryService`. Phase 2 ships no business/review
write endpoints, so time-based expiry is the only invalidation path for now;
`DiscoveryService.invalidateHomeCache()` exists for Phase 3+ write endpoints (new business published, review
posted, etc.) to call directly.
