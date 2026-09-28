# Reviews, Contributions & Trust/Safety

Covers everything a signed-in user can create: reviews (with sub-ratings and photos), photo uploads, favourites,
helpful votes, and reports. Written retroactively against what Phase 5 actually built (see
[`PROGRESS.md`](PROGRESS.md) for the full deviation log) — no such doc existed before this phase, and the
decisions below were confirmed with the user before implementation.

## Moderation posture: automated scoring on write, real admin/moderator action on top (Phase 7 + 8)

Reviews (`Review.status`) and photos (`Photo.status`, replacing the Phase 5 `isApproved` boolean — see below)
are created with the schema's default status and then immediately re-scored: Phase 5/7 left the automated
side a no-op-approve stub; **Phase 8 turns it on for real** (see "Automated moderation scoring" below). A
MODERATOR/ADMIN can still approve/remove/restore any review or photo after the fact
(`PATCH /admin/content/reviews|photos/:id/approve|remove|restore`,
`apps/api/src/modules/admin/admin-content.service.ts`), and users can report content into the reports queue
(`/admin/reports/*`) for a moderator to action — that Phase 7 surface is unchanged by Phase 8, just now fed
by both human reports and automated holds.

**`Photo.isApproved` → `Photo.status` (Phase 7)**: replaced the boolean with a `PhotoStatus` enum
(`PENDING`/`APPROVED`/`REMOVED`), mirroring `ReviewStatus`'s shape exactly. Migration
`20260925120000_phase7_admin_moderation` backfills `isApproved: true → status: APPROVED`,
`isApproved: false → status: PENDING` before dropping the old column. Every read site that filtered
`isApproved: true` now filters `status: 'APPROVED'` (`BusinessesService.getPhotos()`, `SearchService`'s
thumbnail subquery, `PhotosService.runPipeline()`'s create call).

**Moderation enqueue seam, flipped to real scoring (Phase 8)**: every review write
(`ReviewsService.createOrUpdate`) and photo confirm (`PhotosService.confirm`/`confirmForBusiness`) calls
`ModerationService.enqueue(context)` (`apps/api/src/integrations/moderation/moderation.service.ts`), passing
the target's `userId`, `businessId`, `ipAddress`, text, and (for reviews) `rating`. `enqueue()` now delegates
to `ModerationScoringService` (below) and returns `{ status: 'APPROVED' | 'PENDING', score, reasons }`; the
caller applies that status to the row (`PUBLISHED`/`PENDING` for reviews, `APPROVED`/`PENDING` for photos),
stores a human-readable `moderationReason` (the joined `reasons`, cleared on approve/restore), and — when
held — emails the author via `MailService.notifyContentHeld()`. `enqueue()` also writes a `ModerationLog` row
itself (`REVIEW_AUTO_HELD`/`REVIEW_AUTO_APPROVED`/`PHOTO_AUTO_HELD`/`PHOTO_AUTO_APPROVED`, `actorId: null` —
see below) so every automated decision is auditable the same way a human moderator's is.
`ModerationLogService` (`apps/api/src/integrations/moderation/moderation-log.service.ts`, added Phase 7) is a
separate, unrelated audit-trail writer for admin/moderator actions — `enqueue()` calls it too, just with a
null actor.

## Automated moderation scoring (Phase 8)

`ModerationScoringService` (`apps/api/src/integrations/moderation/moderation-scoring.service.ts`) is a single,
unit-tested rule engine — every threshold lives in one file so it's tunable and testable in one place, per
the phase brief. It only ever scores **toward a HOLD**, never toward auto-removal: content with no triggered
rule always auto-approves, and anything ambiguous defaults to `PENDING` for a human moderator. The one
automated action that isn't a scoring rule is the **self-review hard block** (below), because it's a
correctness check (you can't credibly review your own business), not a suspicion signal — it 403s before a
row is ever created, so there's nothing to hold or appeal.

Each rule contributes a weight; the sum is compared against `HOLD_THRESHOLD = 40`. A rule at weight ≥ 40 is
independently sufficient to hold; lower-weight rules only tip the balance in combination with another signal.
Final tuned thresholds (adjusted once, during this phase's browser/Playwright verification pass — see
`PROGRESS.md`):

| Rule                | Weight | What it checks                                                                                                                                                                                                          |
| ------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DUPLICATE_TEXT`    |     50 | `pg_trgm` `similarity()` > 0.6 (min. 20 chars) between this review's body and (a) the same user's other reviews, or (b) any review body from the last 30 days — catches copy-pasted template spam, same account or not. |
| `SPAM_LINKS`        |     60 | Body/caption contains a URL (`http(s)://`, `www.`) or a spam phrase (`wa.me/`, `t.me/`, "click here", "DM me on...", "discount code", etc.).                                                                            |
| `REVIEW_BOMBING`    |     50 | Review-only. Rating is 1 or 5 **and** the same business has ≥ 6 reviews with an extreme (1 or 5) rating in the last 60 minutes.                                                                                         |
| `IP_BURST`          |     40 | ≥ 5 reviews+photos from the same request IP (any user — catches multi-account abuse) in the last 10 minutes.                                                                                                            |
| `ACCOUNT_BURST`     |     40 | ≥ 3 reviews+photos from the same account in the last 10 minutes.                                                                                                                                                        |
| `LOW_TRUST_ACCOUNT` |     40 | The account already has ≥ 2 prior `PENDING`/`REMOVED` reviews or photos — a flagged account's _next_ piece of content defaults to held too.                                                                             |
| `NEW_ACCOUNT_FLOOD` |     30 | Account is < 24h old **and** this is its ≥ 3rd review/photo ever (only tips the balance combined with another rule).                                                                                                    |

**Why `REVIEW_BOMBING` is 6, not 5**: tuned up by one during this phase's browser verification, after the
rule collided with the Phase 1 seed data — `seed.ts` backfills 4–5 same-rated demo reviews onto a couple of
businesses in a single batch, all timestamped at seed time, which reads exactly like a bombing wave for the
first hour after any fresh `prisma migrate reset`/reseed. 6 comfortably clears that seed artifact while still
catching a real wave (this is a real interaction, not a hypothetical — it broke a previously-green Phase 5
Playwright spec during this phase's verification pass, see `PROGRESS.md`).

Every `enqueue()` call also writes a `ModerationLog` row with `actorId: null` (`ModerationLog.actorId` was
made nullable in this phase's migration specifically for automated actions — see `12-admin-panel.md`),
`action` = `REVIEW_AUTO_HELD`/`REVIEW_AUTO_APPROVED`/`PHOTO_AUTO_HELD`/`PHOTO_AUTO_APPROVED`, and
`reason`/`metadata` carrying the triggered rule names and score.

### IP capture

`Review.ipAddress`/`Photo.ipAddress`/`User.signupIp` (all nullable `String`, new this phase) are populated
from `request.ip` (`apps/api/src/common/utils/client-ip.ts`) on review write, photo confirm, and registration
— `main.ts` enables Express `trust proxy` in production so this reflects `X-Forwarded-For` behind a real
reverse proxy. Never exposed in any public-facing schema; used only by the burst/flood scoring rules above.

### Self-review: the one hard block

`ReviewsService.createOrUpdate` checks `business.ownerId === userId` (the same source of truth
`BusinessOwnerGuard` uses — see `10-auth-roles.md`) **before** any row is written, and throws
`403 SELF_REVIEW_NOT_ALLOWED` if it matches. Logged to `ModerationLog` as `SELF_REVIEW_BLOCKED`
(`targetType: USER`, `actorId: null`) for audit visibility, since there's no review row to attach the log to.

## Verification signals (Phase 8)

- **Business verified badge**: `Business.isVerified` already existed (admin-settable since Phase 7,
  `PATCH /admin/businesses/:id/verify`) — this phase just surfaces it more consistently on `ReviewCard`
  (via the reviewer, see below) and confirms `BusinessCard`/`BusinessProfile` already showed it.
- **Reviewer verified badge (new)**: contribution-based, computed live — never a stored flag, so it can never
  go stale relative to a removed review. `isVerifiedReviewer(stats)`
  (`apps/api/src/modules/users/reviewer-trust.util.ts`) is `true` when `reviewCount >= 5` (PUBLISHED only)
  **and** `helpfulVotesReceived >= 10` (helpful votes on that user's PUBLISHED reviews). Computed per-review
  on `BusinessReview.isVerifiedReviewer` (bulk-computed for a review list via `getReviewerStatsBulk`, avoiding
  N+1 queries) and shown as a badge on `ReviewCard`, linking the author's name to their new public profile.
- **Public reviewer profile (new)**: `GET /users/:userId/public-profile` (public, no auth) →
  `{ name, avatarUrl, bio, memberSince, isVerifiedReviewer, reviewCount, photoCount, helpfulVotesReceived,
recentReviews[] }` (`UsersService.publicProfile`). Frontend page `apps/web/app/[locale]/reviewers/[userId]`
  (ISR 600s, ships lean per the Phase 7 leanness precedent — name/badge/stats/recent reviews only, no
  follow/social features).

## Suggest an edit (Phase 8)

New `BusinessEditSuggestion` model — structured (field + suggested value), not free-text, so it's directly
actionable by a moderator or the business owner, and tracked separately from abuse `Report`s (this is a
correction, not a complaint).

- `POST /businesses/:businessId/suggest-edit` (any authenticated user, 5/min) — `{ field, currentValue?,
suggestedValue, note? }`. Logs `EDIT_SUGGESTION_CREATED` (`actorId: null`).
- `GET /admin/edit-suggestions?status=&businessId=` / `PATCH /admin/edit-suggestions/:id/resolve` (`{ status:
'ACCEPTED'|'REJECTED', resolutionNote? }`, MODERATOR+ADMIN) — logs `EDIT_SUGGESTION_RESOLVED`.
- `GET /businesses/:businessId/manage/edit-suggestions` (`BusinessOwnerGuard`) — owner-visible read-only list.
- **Deviation, time-boxed**: "accept" is bookkeeping only — it does **not** auto-apply `suggestedValue` to the
  `Business` row. The field is free-text with no per-field validation at this layer, so writing it directly
  would bypass every constraint the real `PATCH /businesses/:businessId` (owner) / `PATCH
/admin/businesses/:id` (admin) endpoints enforce. A moderator or the owner still makes the actual correction
  through those existing endpoints after reviewing the suggestion here. Owner-side resolve (accept/reject) is
  not built this phase — only the owner-visible read list — matching Phase 7's "leaner than full spec, noted
  rather than silently dropped" precedent; moderator resolve is the actual path today.

## Fairness & recourse (Phase 8)

- **Notification**: `MailService.notifyContentHeld(to, targetType, reasons)` fires the moment `enqueue()`
  holds a review/photo, and `notifyContentRemoved(to, targetType, reason)` fires from
  `AdminContentService.removeReview/removePhoto` (covers both a direct admin removal and a report resolved
  with `action: 'REMOVE_CONTENT'`, since that delegates to the same service). Same log-stub pattern as every
  other `MailService` method — no real SMTP provider.
- **Appeal path**: reuses the existing `Report` model and admin reports queue rather than a new appeals
  system (confirmed with the user before implementation) — `ReportReason` gained an `APPEAL` value, never
  client-selectable through the normal `POST /reports` flow (`createReportRequestSchema` excludes it; only
  the dedicated endpoint below can set it). `POST /reports/appeal` (`{ targetType: 'REVIEW'|'PHOTO',
targetId, message? }`) validates the caller is the target's own author and that it's currently
  `PENDING`/`REMOVED` (409 `NOT_HELD` otherwise), then files a normal `Report` row with `reason: 'APPEAL'` —
  it shows up in `GET /admin/reports` like any other report, distinguishable by reason. Resolving it with the
  new `action: 'RESTORE_CONTENT'` (added to `resolveReportRequestSchema` alongside `REMOVE_CONTENT`/
  `BAN_USER`) calls `AdminContentService.restoreReview/restorePhoto`, clearing `moderationReason` and
  reverting to `PUBLISHED`/`APPROVED`.
- **Never exposes reporter identity to the reported party**: unchanged from Phase 7 — no endpoint anywhere
  shows `Report` rows to the content's target, only to MODERATOR/ADMIN. For an appeal, the "reporter" is the
  content's own author reporting on their own held content, so there's no third party to protect from
  exposure in that case either.
- **Account-page visibility**: `MyReview`/`MyPhoto` (`GET /users/me/reviews|photos`) now include `status` and
  `moderationReason`, rendered as a `ModerationStatusBanner` (`apps/web/src/components/moderation/`) on
  `/account/reviews` and `/account/photos` with the reason and an "Appeal this decision" action wired to
  `POST /reports/appeal`.

## Report-handling upgrades (Phase 8)

- **Priority by distinct reporter count, not raw count**: `AdminReportsService.listGrouped` now sorts by
  `COUNT(DISTINCT reporterId)` per target first, raw count as the tiebreaker — a single account
  report-bombing the same target repeatedly no longer inflates its own queue priority; genuinely
  multi-reported targets still bubble to the top.
- **Per-user report rate limit**: `ReportsService` now enforces its own Redis counter
  (`report:count:<userId>`, 8/min, `apps/api/src/modules/reports/reports.service.ts`) alongside the
  pre-existing IP-keyed `@Throttle` (10/min) on the controller — the IP throttle alone didn't stop one account
  spread across residential IPs, or catch a single IP filing as many different accounts as it likes; the two
  together cover both axes.
- **Low-trust accounts default to `PENDING`**: covered by the `LOW_TRUST_ACCOUNT` scoring rule above, not a
  separate mechanism — an account with ≥ 2 prior held/removed items has its next review/photo start at
  `PENDING` regardless of what else the new content contains.

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

| Method | Path              | Auth     | Notes                                                                                                                                          |
| ------ | ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reports`        | required | `{ targetType, targetId, reason, message? }`. Validates the target exists. Rate-limited: 10/min/IP (`@Throttle`) **and** 8/min/user (Phase 8). |
| POST   | `/reports/appeal` | required | `{ targetType: 'REVIEW'\|'PHOTO', targetId, message? }` (Phase 8) — see "Fairness & recourse" above. Same per-user rate limit as `/reports`.   |

`reason` is `SPAM \| INAPPROPRIATE \| FAKE \| CLOSED \| DUPLICATE \| OTHER \| APPEAL` (`APPEAL` added Phase 8,
server-set-only via `/reports/appeal` — never accepted through `POST /reports`). Reports land as `PENDING`;
resolving them (`/admin/reports/:id/resolve|dismiss`, action `REMOVE_CONTENT`/`BAN_USER`/`RESTORE_CONTENT`/
`NONE`) is built as of Phase 7/8 — see [`12-admin-panel.md`](12-admin-panel.md).

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
