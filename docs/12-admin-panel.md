# Admin & Moderation Panel (Phase 7)

This doc did not exist before Phase 7 — drafted from the Phase 7 task brief, then built to. Covers the
`MODERATOR`/`ADMIN` role split, every `/admin/*` route, the `ModerationLog` audit trail, and the `/admin`
frontend.

## Role split

Enforced server-side by `RolesGuard`/`@Roles(...)` on **every** route — the frontend's role-gated layout
(`apps/web/app/[locale]/admin/layout.tsx`) is a UX nicety on top, never the security boundary.

- **`MODERATOR`** — day-to-day queue work: claims (`PATCH /claims/:id/approve|reject`, shared with the
  public `ClaimsController`), reports queue, review/photo content moderation, business status/verify
  toggles, and the moderation log viewer.
- **`ADMIN`** — superset of MODERATOR, plus user/role management, featured placement, taxonomy management,
  direct business creation, and generic business edit/soft-delete/restore.

See [`10-auth-roles.md`](10-auth-roles.md) for the ban-revocation mechanism and full role table.

## Dashboard

`GET /admin/dashboard` (MODERATOR+ADMIN) → `AdminDashboard` (`packages/shared/src/schemas/admin.ts`):

```
{
  businessesByStatus: Record<BusinessStatus, number>,  // excludes soft-deleted (deletedAt: null)
  totalUsers: number,
  totalReviews: number,
  pendingClaimsCount: number,
  openReportsCount: number,   // Report.status = PENDING
  photosPendingCount: number, // Photo.status = PENDING
}
```

## Claims queue

Reuses the existing `ClaimsController`/`ClaimsService` (`apps/api/src/modules/claims/`) rather than
duplicating routes under `/admin` — per the Phase 7 brief's explicit preference. Changes made in Phase 7:

- `PATCH /claims/:id/approve` and `PATCH /claims/:id/reject` guards loosened from `@Roles(Role.ADMIN)` to
  `@Roles(Role.MODERATOR, Role.ADMIN)`.
- `approve` body gained an optional `verifyBusiness: boolean` — when true, sets `Business.isVerified = true`
  in the same transaction as the ownership transfer.
- `reject` body gained an optional `reason: string`.
- Both now call `ModerationLogService.record()` (`CLAIM_APPROVED`/`CLAIM_REJECTED`, targetType `CLAIM`,
  metadata `{ businessId, claimantUserId }`) and `MailService.notifyClaimDecision()` (log-stub, same pattern
  as `sendEmailVerification`/`sendPasswordReset` — no real SMTP provider exists).
- `GET /claims/mine`/`POST /claims` are unchanged (any authenticated user).

**Deviation**: the pre-Phase-7 `ClaimsService` only exposed per-user listing (`myClaims`/`myClaimForBusiness`)
— there was no "list every PENDING claim across all businesses" read, which the admin claims-queue page
needs. Rather than duplicating claim-approval logic under `/admin`, a single new read method,
`ClaimsService.listAll(status?)`, was added to the existing service and exposed as
`GET /claims?status=PENDING` (MODERATOR+ADMIN — the base `/claims` path had no `GET` collection route before,
only `/claims/mine`, so this doesn't collide with anything). The admin claims-queue frontend page calls this,
then the existing `PATCH /claims/:id/approve|reject` for actions.

## Reports queue (`/admin/reports`, MODERATOR+ADMIN)

- `GET /admin/reports?status=PENDING` — reports grouped by `(targetType, targetId)`, sorted by **distinct
  reporter count** descending, raw report count as the tiebreaker (Phase 8 — previously raw count only; see
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md#report-handling-upgrades-phase-8), changed so one
  account repeatedly reporting the same target can't inflate its own priority). Each group includes the
  target's current summary (business name/slug, review snippet+author, photo url+uploader, reported user) and
  the list of individual reports — including Phase 8's appeal reports (`reason: 'APPEAL'`), which use this
  same queue rather than a separate surface.
- `GET /admin/reports/:id` — single report detail with full target content (drill-in).
- `PATCH /admin/reports/:id/resolve` — body `{ reason?: string, action?: 'REMOVE_CONTENT'|'BAN_USER'|
'RESTORE_CONTENT'|'NONE' }` (default `NONE`). Sets `status: RESOLVED`. `REMOVE_CONTENT` removes the
  underlying review/photo (via `AdminContentService`); `BAN_USER` bans the user tied to the report
  (`reportedUserId`, or the review's author for a REVIEW report); `RESTORE_CONTENT` (Phase 8 — the "grant an
  appeal" action) restores it to `PUBLISHED`/`APPROVED` and clears `moderationReason`. Logs `REPORT_RESOLVED`
  (metadata records which `action` ran) **and** the underlying action's own log entry (e.g. `REVIEW_REMOVED`,
  `USER_BANNED`, or `REVIEW_RESTORED`) — two `ModerationLog` rows per resolve-with-action.
- `PATCH /admin/reports/:id/dismiss` — body `{ reason?: string }`. Sets `status: DISMISSED`, logs
  `REPORT_DISMISSED`.

## "Suggest an edit" queue (`/admin/edit-suggestions`, MODERATOR+ADMIN, Phase 8)

- `GET /admin/edit-suggestions?status=&businessId=` — list `BusinessEditSuggestion` rows (structured
  field/suggested-value corrections submitted from a business profile, tracked separately from abuse
  `Report`s). Defaults to no filter; the frontend page requests `status=PENDING`.
- `PATCH /admin/edit-suggestions/:id/resolve` — body `{ status: 'ACCEPTED'|'REJECTED', resolutionNote? }`.
  Bookkeeping only — does **not** auto-apply `suggestedValue` to the `Business` row (see
  [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md#suggest-an-edit-phase-8) for why). Logs
  `EDIT_SUGGESTION_RESOLVED`.
- The business owner also has a read-only `GET /businesses/:businessId/manage/edit-suggestions`
  (`BusinessOwnerGuard`) — owner-side resolve isn't built this phase, same "leaner than full spec, noted
  rather than silently dropped" precedent as Phase 7's business/user detail pages below.

## Content moderation (`/admin/content`, MODERATOR+ADMIN)

- `GET /admin/content/reviews?status=&reported=` / `GET /admin/content/photos?status=&reported=` —
  `reported=true` joins open `Report` rows for that target type instead of filtering by `status`.
- `PATCH .../reviews/:id/approve|remove|restore`, `PATCH .../photos/:id/approve|remove|restore` — `remove`
  requires a non-empty `reason` (400 `VALIDATION_ERROR` otherwise); `restore` accepts an optional reason.
  Every mutation calls `RevalidateService.revalidate({ slug, city, category })` for the owning business (same
  pattern as `ReviewsService.createOrUpdate()`), since removing/restoring content changes what the ISR-cached
  profile page renders.
- **Aggregates**: confirmed by reading `business-profile.util.ts`'s `getBusinessAggregates()` — it's a live
  `groupBy` filtered to `status: 'PUBLISHED'`, so flipping a review to `REMOVED` automatically excludes it
  from the next aggregate computation. No denormalized counter to fix up.

## Businesses admin (`/admin/businesses`)

MODERATOR+ADMIN: `GET /admin/businesses` (search across all statuses, `includeDeleted` flag), `GET
/admin/businesses/:id` (full detail, works even when soft-deleted), `PATCH :id/status` (reason required
moving to `SUSPENDED`/`REJECTED`), `PATCH :id/verify`.

ADMIN-only: `PATCH :id/featured` (`{ featured, featuredFrom?, featuredUntil? }`, busts
`DiscoveryService.invalidateHomeCache()`), `POST /admin/businesses` (direct creation — the only non-claim
creation path, per the Phase 6 brief), `PATCH :id` (generic edit incl. `ownerId` reassignment; `featured`
and `isVerified` stay on their dedicated endpoints for clear audit-log action names), `DELETE :id`
(soft-delete: `deletedAt = now()`, never a real row delete), `POST :id/restore`.

**Public read paths updated to exclude soft-deleted businesses** (`deletedAt: null`):
`BusinessesService` (profile/reviews/photos/similar), `SearchService` (search + all discovery-block
queries), `DiscoveryService`'s featured block additionally now respects the `featuredFrom`/`featuredUntil`
window (`featured=true AND (featuredFrom IS NULL OR featuredFrom<=now()) AND (featuredUntil IS NULL OR
featuredUntil>=now())`). `apps/web/app/sitemap.ts` needed no direct change — it calls the public
`searchBusinesses()` API, which already excludes soft-deleted rows.

## Users admin (`/admin/users`, ADMIN-only)

`GET /admin/users?search=`, `GET /admin/users/:id` (contribution history: reviews, photos, owned businesses,
claims filed), `PATCH :id/ban` (`{ reason }` required — see [`10-auth-roles.md`](10-auth-roles.md) for the
"revoke immediately" mechanism; cannot ban an `ADMIN`), `PATCH :id/unban`, `PATCH :id/role` (`{ role }` — the
real role-management surface; can set any role incl. `MODERATOR`/`ADMIN`, no restriction beyond ADMIN-only
access to the endpoint itself).

## Taxonomy admin (`/admin/taxonomy`, ADMIN-only)

Categories/provinces/cities/areas/features, each with `POST`/`PATCH`/`DELETE`. Deletes are blocked (409) if
the row is referenced by a child row or a business (categories: child categories or businesses; provinces:
cities; cities: businesses or areas; areas: businesses) — never cascade-deletes real business data.
`Category.order` (pre-existing field, not new) is the sort/reorder key — no new `sortOrder` column was
needed. Cities/areas' `centroid` is written via the new `GeoService.setCityCentroid()` (raw SQL, mirrors
`setBusinessLocation`, since `City.centroid` is an `Unsupported("geography(Point,4326)")` column).

`ModerationTargetType` has a single `CATEGORY` value covering all taxonomy sub-kinds (category, province,
city, area, feature) — `ModerationLog.metadata.kind` disambiguates (`'category'|'province'|'city'|'area'|
'feature'`). This is intentional per the Phase 7 brief: it's an audit trail, not a strict schema.

## `ModerationLog`

`apps/api/src/integrations/moderation/moderation-log.service.ts` — `ModerationLogService.record({ actorId,
action, targetType, targetId, reason?, notes?, metadata? })`, a sibling service in the existing
`ModerationModule` alongside `ModerationService.enqueue()` (Phase 8's real automated scoring pass, not a stub
anymore — see [`11-reviews-trust-safety.md`](11-reviews-trust-safety.md)) and `ModerationScoringService`.

**`actorId` is nullable as of Phase 8** (`ModerationLog.actorId String?`, migration
`20260928060715_phase8_trust_safety`) — automated scoring-pipeline actions record `actorId: null` rather than
being misattributed to a real admin/moderator. The moderation-log viewer (below) shows these as an actor-less
row; `apps/web`'s table renders "System" when `actorName` is `null`.

`action` is a free-form string, not a Prisma enum (`MODERATION_ACTIONS` const object in the same file) so new
actions never need a migration. Current vocabulary: `CLAIM_APPROVED`, `CLAIM_REJECTED`, `REVIEW_APPROVED`,
`REVIEW_REMOVED`, `REVIEW_RESTORED`, `PHOTO_APPROVED`, `PHOTO_REMOVED`, `PHOTO_RESTORED`,
`BUSINESS_STATUS_CHANGED`, `BUSINESS_VERIFIED_TOGGLED`, `BUSINESS_FEATURED_TOGGLED`, `BUSINESS_CREATED`,
`BUSINESS_UPDATED`, `BUSINESS_SOFT_DELETED`, `BUSINESS_RESTORED`, `USER_BANNED`, `USER_UNBANNED`,
`USER_ROLE_CHANGED`, `REPORT_RESOLVED`, `REPORT_DISMISSED`, `CATEGORY_CREATED/UPDATED/DELETED`,
`PROVINCE_CREATED/UPDATED/DELETED`, `CITY_CREATED/UPDATED/DELETED`, `AREA_CREATED/UPDATED/DELETED`,
`FEATURE_CREATED/UPDATED/DELETED`, plus Phase 8's `REVIEW_AUTO_HELD`, `REVIEW_AUTO_APPROVED`,
`PHOTO_AUTO_HELD`, `PHOTO_AUTO_APPROVED`, `SELF_REVIEW_BLOCKED`, `EDIT_SUGGESTION_CREATED`,
`EDIT_SUGGESTION_RESOLVED` (all `actorId: null` except the last).

`GET /admin/moderation-log?actorId=&targetType=&targetId=&action=&from=&to=` (MODERATOR+ADMIN) — paginated,
read-only, newest-first, joins `actor.name` for display (`null` for automated rows).
`ModerationTargetType` also gained `EDIT_SUGGESTION` this phase.

## Confirmation-required actions

Every removal/ban/reject action requires a non-empty `reason` server-side (400 if missing/empty):
`PATCH /admin/content/reviews|photos/:id/remove`, `PATCH /admin/users/:id/ban`. Reject/suspend/dismiss/
resolve accept an optional reason. The frontend shows a real confirm-with-reason dialog
(`apps/web/src/components/ui/dialog.tsx`, new in Phase 7) before submitting any of these — never a bare
`window.confirm()`.

## Frontend (`apps/web/app/[locale]/admin`)

CSR, role-gated layout (`layout.tsx`) using `useSession()`; redirects non-MODERATOR/non-ADMIN users away.
Sidebar nav hides Users/Taxonomy/Featured-toggle entirely for MODERATOR. Pages: `page.tsx` (dashboard),
`claims/`, `reports/` (+ `[id]`), `content/`, `businesses/` (+ `[businessId]`), `users/` (+ `[userId]`,
ADMIN-only route), `taxonomy/` (ADMIN-only), `moderation-log/`. API client functions in
`apps/web/src/lib/api/admin.ts`, validated against the `packages/shared/src/schemas/admin.ts` Zod schemas.
