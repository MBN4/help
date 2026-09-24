# Reviews, Contributions & Trust/Safety

Covers everything a signed-in user can create: reviews (with sub-ratings and photos), photo uploads, favourites,
helpful votes, and reports. Written retroactively against what Phase 5 actually built (see
[`PROGRESS.md`](PROGRESS.md) for the full deviation log) — no such doc existed before this phase, and the
decisions below were confirmed with the user before implementation.

## Moderation posture: publish immediately

Reviews (`Review.status`) and photos (`Photo.isApproved`) both default to published/approved — there is no
pre-publish admin queue. This was a deliberate Phase 5 decision: the schema had no admin-approval endpoint of
any kind before this phase (nothing to move a `PENDING` row to `PUBLISHED`), so holding content for approval
would have meant it stayed permanently invisible.

**Moderation enqueue seam (added during the Phase 5 verification pass)**: every review write
(`ReviewsService.createOrUpdate`) and photo confirm (`PhotosService.confirm`) now calls
`ModerationService.enqueue(targetType, targetId)` (`apps/api/src/integrations/moderation`). Today this is a
no-op that logs and always returns `{ status: 'APPROVED' }` — content still publishes immediately — but the
call site now exists so Phase 8's real automated flagging/scoring pass has somewhere to plug in without
touching `ReviewsService`/`PhotosService` again. This replaced the earlier `TODO(phase-6)` comment, which had
no actual function call behind it. **Moderation hold is still deferred to Phase 8** — this seam does not add
a pre-publish gate.

## Reviews

### One review per user per business

`Review` has `@@unique([businessId, userId])`. `PUT /businesses/:businessId/review` is an **upsert** keyed on
that constraint — submitting again always edits the same row, never creates a duplicate. The frontend's
`ReviewForm` fetches the caller's existing review first (`GET /businesses/:businessId/review/mine`) so editing
shows prior values instead of a blank form.

### Sub-ratings

`Review.subRatings` is a nullable `Json` column, e.g. `{"food": 4, "service": 5}`. Chosen over fixed columns
(`ratingFood`, `ratingService`, ...) because the dimension set varies by category and nothing queries or
filters on individual sub-rating values in SQL — see `apps/web/src/lib/utils/sub-rating-dimensions.ts` for the
category → dimension mapping used to decide which sub-rating inputs the review form shows:

| Top-level category  | Dimensions shown                  |
| ------------------- | --------------------------------- |
| Food & Dining       | food, service, ambience, value    |
| Beauty & Wellness   | service, ambience, value          |
| Health & Medical    | service, value                    |
| Automotive          | service, value                    |
| Home Services       | service, value                    |
| Shopping & Retail   | value, service                    |
| _(everything else)_ | service, value (generic fallback) |

This mapping lives in the frontend only — the API accepts any string-keyed sub-rating object
(`z.record(z.string(), z.number().int().min(1).max(5))`), so it's forward-compatible with new categories or
dimensions without a backend change.

### Aggregates

Unchanged from Phase 2: `averageRating`/`reviewCount`/`ratingBreakdown` are always computed live from
`PUBLISHED` `Review` rows (`BusinessesService.getAggregates`), never denormalized. A review write doesn't
"update an aggregate" as a separate step — the next profile read simply recomputes it from the now-changed
`Review` table. What the write _does_ explicitly do: bust the Redis-cached `GET /discovery/home` blocks
(`DiscoveryService.invalidateHomeCache()`, since rating/review-count changes can shift the "highly rated"
block) and call the web app's on-demand ISR revalidation endpoint (`RevalidateService`, see
[`07-frontend.md`](07-frontend.md)) for the business's profile/city/city+category pages.

### Endpoints (`apps/api/src/modules/reviews`)

| Method | Path                                      | Auth                      | Notes                                                                                                                  |
| ------ | ----------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PUT    | `/businesses/:businessId/review`          | required + verified email | Body: `CreateReviewRequest` (`rating`, `subRatings?`, `title?`, `body?`, `photoIds?`). Upserts.                        |
| GET    | `/businesses/:businessId/review/mine`     | required                  | The caller's own review for this business, or `null`.                                                                  |
| POST   | `/reviews/:reviewId/helpful`              | required                  | Toggles the caller's helpful vote. Returns `{ helpful, helpfulCount }`.                                                |
| GET    | `/reviews/helpful-votes/mine?businessId=` | required                  | Review ids (within that business) the caller has voted helpful on — used to hydrate the vote button state client-side. |

`GET /businesses/:id/reviews` (Phase 2) now also returns `subRatings`, `userId`, `userAvatarUrl`, and
`helpfulCount` per review (additive; see [`06-api-endpoints.md`](06-api-endpoints.md)).

### Verified-email gate

`VerifiedEmailGuard` (`apps/api/src/common/guards/verified-email.guard.ts`) re-reads `emailVerifiedAt` from
the database (never trusts the JWT payload, which doesn't carry it) and 403s with `EMAIL_NOT_VERIFIED`
otherwise. Applied to the review-write route and both photo routes — never global, since favourites/helpful
votes/reports don't require verification.

## Photos

### Pipeline: presign → direct upload → confirm → process

No job queue exists in this stack (no BullMQ/worker process), and the phase brief's "sharp job" was resolved
(with the user, before implementation) to run **synchronously inside the confirm request** rather than standing
up new queue infrastructure for a single job type:

1. `POST /photos/presign` (`{ contentType }`) → a presigned S3-compatible `PutObject` URL (5 min expiry) and a
   `key` under `uploads/originals/`. No DB row yet.
2. The client `PUT`s the raw file directly to that URL (MinIO locally, R2 in production — same S3 API).
3. `POST /photos/confirm` (`{ key, businessId?, reviewId?, caption? }`): downloads the original, runs
   `ImageProcessingService.processVariants()` — `sharp(...).rotate()` (bakes in EXIF orientation) then three
   resizes (`thumb` 200×200 cover, `card` 640w, `full` 1600w max), each re-encoded as JPEG. Sharp's default
   output drops all other EXIF (GPS, camera info, etc.) since `.withMetadata()` is never called. All three
   variants are uploaded, then one `Photo` row is created with `url`/`thumbUrl`/`cardUrl` and `isApproved: true`.

`Photo.thumbUrl`/`cardUrl` are nullable — photos seeded before this phase (Phase 1/2 fixtures) have only
`url` set; the frontend falls back to `url` wherever a variant is missing.

**Size/type/timeout guards (added during the Phase 5 verification pass)**: `confirm` previously downloaded
and processed whatever was at `key` with no checks beyond the presign-time `contentType` allowlist (which a
client could ignore when actually `PUT`ing the file). It now calls `StorageService.headObject(key)` first and
rejects with `400 PHOTO_TOO_LARGE` above 10MB or `400 PHOTO_INVALID_TYPE` if the object's actual stored
content type isn't `image/jpeg`/`image/png`/`image/webp`, before ever downloading it or invoking `sharp`. The
`sharp` call itself is now wrapped with a 15s timeout (`408 PHOTO_PROCESSING_TIMEOUT`) so a malformed image
can't hang the request indefinitely. **This is still tech debt to revisit**: these guards protect the
synchronous in-request pipeline, but the right long-term fix is moving photo processing to a real BullMQ
image queue (see the "Pipeline" section above) so a pathological upload can't hold up an API worker thread at
all — the guards here are a stopgap, not a replacement for that queue.

### Storage (`apps/api/src/integrations/storage`)

`StorageService` wraps `@aws-sdk/client-s3` (works against both MinIO and R2 — same S3-compatible API), reads
`S3_*` env vars (see `.env.example`), and on boot best-effort creates the bucket + a public-read policy if
missing (MinIO starts with neither; no-op-safe against R2, which is configured differently in production).

### Endpoints

| Method | Path              | Auth                      | Notes                                     |
| ------ | ----------------- | ------------------------- | ----------------------------------------- |
| POST   | `/photos/presign` | required + verified email | `{ contentType }` → `{ uploadUrl, key }`. |
| POST   | `/photos/confirm` | required + verified email | See pipeline above → `UploadedPhoto`.     |

## Favourites

`Favorite` (`@@id([userId, businessId])`) — a plain toggle, no trust/safety concerns.

| Method | Path                  | Auth     | Notes                                                                                             |
| ------ | --------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| POST   | `/favorites/toggle`   | required | `{ businessId }` → `{ favorited }`.                                                               |
| GET    | `/favorites/mine`     | required | Paginated `BusinessSummary[]` (reuses `SearchService.listByIds`, preserving favourited-at order). |
| GET    | `/favorites/mine/ids` | required | Just the ids — cheap way to hydrate "is this saved" state across a page of cards.                 |

## Reports

`Report.targetType` now covers `BUSINESS | REVIEW | PHOTO | USER` (Phase 2 only had the first two).
`Report.photoId`/`reportedUserId` are new nullable FKs alongside the existing `businessId`/`reviewId`.

| Method | Path       | Auth     | Notes                                                                                                                |
| ------ | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reports` | required | `{ targetType, targetId, reason, message? }`. Validates the target exists before creating. Rate-limited (10/min/IP). |

`reason` is `SPAM \| INAPPROPRIATE \| FAKE \| CLOSED \| DUPLICATE \| OTHER` (unchanged `ReportReason` enum).
Reports land as `PENDING` — resolving them is admin-moderation scope, not built here (same "no admin surface
yet" situation as the moderation posture above).

## Accounts: OAuth & profile

### OAuth (Google/Facebook)

New `OAuthAccount` model (`provider`, `providerAccountId`, `userId`, unique on the first two) links a social
identity to a `User`. `User.passwordHash` became nullable — OAuth-only accounts never set one
(`AuthUser.hasPassword` tells the frontend whether to show a "set a password" hint).

Flow (`apps/api/src/modules/auth/oauth.{service,controller}.ts`), all plain `GET` redirects (no CSRF header
needed — `GET` is exempt from `CsrfGuard` already):

- `GET /auth/google` / `/auth/facebook` — redirects to the real provider consent screen if
  `GOOGLE_OAUTH_CLIENT_ID`/`FACEBOOK_OAUTH_CLIENT_ID` is set, otherwise redirects to the web app's
  `/auth/oauth-stub?provider=...` page.
- `GET /auth/google/callback` / `/auth/facebook/callback` — exchanges the code, fetches the profile, upserts
  the `User`/`OAuthAccount` (linking by email if a password account already exists with that address), sets
  the same httpOnly cookies as email/password login, redirects to `WEB_ORIGIN`.
- `GET /auth/oauth-stub/:provider/callback?email=&name=` — only reachable when that provider has **no**
  credentials configured (checked server-side; throws `STUB_DISABLED` otherwise, so this can never activate
  in an environment where real OAuth is actually configured). Mints a user the same way, with a synthetic
  `stub-<email>` provider account id. This is how OAuth was verified end-to-end without real Google/Facebook
  app credentials — see `PROGRESS.md`.
- OAuth-verified emails are trusted as pre-verified (`emailVerifiedAt` set immediately) since the provider
  already verified them.

### Profile

`PATCH /users/me` (`{ name?, bio?, avatarUrl? }`) updates the three new self-service profile fields
(`User.bio` is new this phase; `avatarUrl` existed since Phase 1 but was never settable). Avatar upload reuses
the same photo pipeline (no `businessId`/`reviewId`), then the returned `url` is passed as `avatarUrl`.

`GET /users/me/reviews` and `GET /users/me/photos` (paginated) back the account area's "My reviews"/"My
photos" pages.

## CSRF (cross-cutting, applies to every mutating endpoint above)

See [`10-auth-roles.md`](10-auth-roles.md)'s CSRF section — every `POST`/`PUT`/`PATCH`/`DELETE` above requires
the `X-Requested-With: buisnez-web` header, enforced by the global `CsrfGuard`. All of Phase 5's mutating
endpoints ship rate limits or the verified-email gate (or both) on top of that where relevant.
