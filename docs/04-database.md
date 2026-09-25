# Database

PostgreSQL via `postgis/postgis:16-3.4`, accessed through Prisma from `@buisnez/database`. PostGIS geography
columns and generated/full-text-search columns are **not** representable in Prisma's schema language, so they
are declared as `Unsupported(...)` (visible to Prisma's typing, ignored by `prisma migrate`) and created by a
hand-written raw SQL migration that runs after the initial Prisma migration.

**Schema history**: `Business.featured` was added in Phase 2 (plain Prisma migration, not raw SQL) to back
the homepage "featured" block — see [`06-api-endpoints.md`](06-api-endpoints.md). `BusinessService` was added
in Phase 6 (see below). Everything else below is Phase 1.

## `BusinessService` (Phase 6)

Itemized services/menu items for a business, added for the business-owner listing editor:

```prisma
model BusinessService {
  id            String   @id @default(uuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String
  description   String?
  priceInPaisa  Int?
  isAvailable   Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([businessId])
}
```

`Business` gained a `services BusinessService[]` relation. `priceInPaisa` is nullable = "price on request",
matching the existing PKR-as-paisa-integer convention (`formatPKR` in `@buisnez/shared`) — never a separate
concept from `PriceTier` (the `$`/`$$`/`$$$` tier field, unrelated/unchanged). Public reads
(`GET /businesses/:slug`) only return `isAvailable: true` rows, ordered by `sortOrder`; the owner-only
`GET /businesses/:businessId/manage` endpoint returns all of them. Migration
`20260925061112_add_business_services` was generated with `prisma migrate dev --create-only` and manually
inspected per the gotcha below — Prisma tried to add 4 spurious `DROP INDEX` statements against the
raw-SQL-managed GIST/GIN/trigram indexes plus an `ALTER COLUMN "searchVector" DROP DEFAULT`, all stripped
before applying; the final migration is only `CREATE TABLE "BusinessService"` + its index + FK.

**Gotcha for every future migration touching `Business`/`City`**: `prisma migrate dev --create-only` diffs
the _declared_ schema (where `location`/`centroid`/`searchVector` are just bare `Unsupported` columns)
against the _actual_ database (which also has the GIST/GIN/trigram indexes and the `STORED` generation
expression from the Phase 1 raw-SQL migration). Prisma sees those as drift it should undo and will happily
generate `DROP INDEX`/`ALTER COLUMN ... DROP DEFAULT` statements for them. **Always inspect a freshly
generated migration touching either table and delete anything targeting those indexes or `searchVector`
before applying it** — this happened when adding `featured` and the auto-generated SQL had to be stripped
down to just the one `ADD COLUMN`.

## Prisma schema

`packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]
}

enum Role {
  CUSTOMER
  BUSINESS_OWNER
  ADMIN
}

enum BusinessStatus {
  PENDING
  PUBLISHED
  SUSPENDED
  REJECTED
}

enum ClaimStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ReportTargetType {
  BUSINESS
  REVIEW
}

enum ReportReason {
  SPAM
  INAPPROPRIATE
  FAKE
  CLOSED
  DUPLICATE
  OTHER
}

enum ReportStatus {
  PENDING
  RESOLVED
  DISMISSED
}

enum ReviewStatus {
  PUBLISHED
  PENDING
  REMOVED
}

enum PriceTier {
  ONE
  TWO
  THREE
  FOUR
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model User {
  id                 String    @id @default(uuid())
  email              String    @unique
  phone              String?   @unique
  passwordHash       String
  name               String
  role               Role      @default(CUSTOMER)
  avatarUrl          String?
  emailVerifiedAt    DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  businesses         Business[]
  reviews            Review[]
  photos             Photo[]
  favorites          Favorite[]
  claims             Claim[]
  reports            Report[]
  emailVerifications EmailVerificationToken[]
  passwordResets     PasswordResetToken[]

  @@index([role])
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

model Province {
  id        String   @id @default(uuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())

  cities     City[]
  businesses Business[]
}

model City {
  id         String                  @id @default(uuid())
  provinceId String
  province   Province                @relation(fields: [provinceId], references: [id], onDelete: Restrict)
  name       String
  slug       String                  @unique
  /// geography(Point, 4326) — created by migration 0001_postgis_and_indexes, not managed by Prisma migrate
  centroid   Unsupported("geography(Point, 4326)")?
  createdAt  DateTime                @default(now())

  areas      Area[]
  businesses Business[]

  @@unique([provinceId, name])
}

model Area {
  id        String   @id @default(uuid())
  cityId    String
  city      City     @relation(fields: [cityId], references: [id], onDelete: Cascade)
  name      String
  slug      String
  createdAt DateTime @default(now())

  businesses Business[]

  @@unique([cityId, slug])
}

model Category {
  id       String     @id @default(uuid())
  name     String
  slug     String     @unique
  icon     String?
  order    Int        @default(0)
  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children Category[] @relation("CategoryTree")

  businesses Business[]

  @@index([parentId])
}

model Feature {
  id   String @id @default(uuid())
  name String @unique
  slug String @unique
  icon String?

  businesses BusinessFeature[]
}

model Business {
  id          String         @id @default(uuid())
  ownerId     String?
  owner       User?          @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  name        String
  slug        String         @unique
  description String?
  categoryId  String
  category    Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  provinceId  String
  province    Province       @relation(fields: [provinceId], references: [id], onDelete: Restrict)
  cityId      String
  city        City           @relation(fields: [cityId], references: [id], onDelete: Restrict)
  areaId      String?
  area        Area?          @relation(fields: [areaId], references: [id], onDelete: SetNull)
  addressLine String
  /// geography(Point, 4326) — created by migration 0001_postgis_and_indexes, not managed by Prisma migrate
  location    Unsupported("geography(Point, 4326)")?
  phone       String?
  whatsapp    String?
  email       String?
  website     String?
  priceTier   PriceTier?
  status      BusinessStatus @default(PENDING)
  isVerified  Boolean        @default(false)
  featured    Boolean        @default(false)
  viewCount   Int            @default(0)
  /// tsvector generated column — created by migration 0001_postgis_and_indexes, not managed by Prisma migrate
  searchVector Unsupported("tsvector")?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  hours    BusinessHours[]
  features BusinessFeature[]
  photos   Photo[]
  reviews  Review[]
  favorites Favorite[]
  claims   Claim[]
  reports  Report[]

  @@index([categoryId])
  @@index([cityId])
  @@index([areaId])
  @@index([status])
}

model BusinessHours {
  id         String    @id @default(uuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  dayOfWeek  DayOfWeek
  opensAt    String?
  closesAt   String?
  isClosed   Boolean   @default(false)

  @@unique([businessId, dayOfWeek])
}

model BusinessFeature {
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  featureId  String
  feature    Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@id([businessId, featureId])
}

model Photo {
  id         String    @id @default(uuid())
  businessId String?
  business   Business? @relation(fields: [businessId], references: [id], onDelete: Cascade)
  reviewId   String?
  review     Review?   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  url        String
  caption    String?
  isApproved Boolean   @default(true)
  createdAt  DateTime  @default(now())

  @@index([businessId])
  @@index([reviewId])
}

model Review {
  id            String       @id @default(uuid())
  businessId    String
  business      Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating        Int
  title         String?
  body          String?
  status        ReviewStatus @default(PUBLISHED)
  ownerReply    String?
  ownerReplyAt  DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  photos  Photo[]
  reports Report[]

  @@unique([businessId, userId])
  @@index([businessId])
}

model Favorite {
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@id([userId, businessId])
}

model Claim {
  id           String      @id @default(uuid())
  businessId   String
  business     Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  status       ClaimStatus @default(PENDING)
  message      String?
  documentUrl  String?
  reviewedById String?
  reviewedAt   DateTime?
  createdAt    DateTime    @default(now())

  @@index([businessId])
  @@index([status])
}

model Report {
  id         String           @id @default(uuid())
  targetType ReportTargetType
  businessId String?
  business   Business?        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  reviewId   String?
  review     Review?          @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  reporterId String
  reporter   User             @relation(fields: [reporterId], references: [id], onDelete: Cascade)
  reason     ReportReason
  message    String?
  status     ReportStatus     @default(PENDING)
  createdAt  DateTime         @default(now())

  @@index([status])
}
```

Rationale for the Redis-backed refresh token store instead of a `RefreshToken` table: rotation on every use
means the table would churn heavily and add nothing durability-wise beyond what the access-token / login
history already gives us. See [`10-auth-roles.md`](10-auth-roles.md).

## Raw SQL migration: `postgis_and_indexes`

Prisma names migration folders `<timestamp>_<name>` and applies them in that order, so the folder is named
`<timestamp>_postgis_and_indexes` (e.g. `20260918095200_postgis_and_indexes`) rather than the literal
`0001_postgis_and_indexes` — a plain `0001_` prefix would sort before the initial `<timestamp>_init`
migration and fail to apply. Created with `prisma migrate dev --create-only` immediately after the initial
Prisma-generated migration, because Prisma cannot express PostGIS types or generated columns:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- "location"/"centroid"/"searchVector" columns already exist as plain columns: Prisma's initial
-- migration includes DDL for Unsupported() fields too (it only excludes them from the generated client),
-- so the columns from schema.prisma already exist at this point.

-- GIST spatial indexes
CREATE INDEX "business_location_gist" ON "Business" USING GIST ("location");
CREATE INDEX "city_centroid_gist" ON "City" USING GIST ("centroid");

-- Replace the plain "searchVector" column with a STORED generated column + GIN index
ALTER TABLE "Business" DROP COLUMN "searchVector";
ALTER TABLE "Business" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''))
  ) STORED;

CREATE INDEX "business_search_vector_gin" ON "Business" USING GIN ("searchVector");

-- Trigram index for fuzzy name search / autocomplete
CREATE INDEX "business_name_trgm" ON "Business" USING GIN ("name" gin_trgm_ops);
```

Notes:

- Declaring `location`/`centroid`/`searchVector` as `Unsupported(...)` in `schema.prisma` only excludes them
  from the generated Prisma Client — Prisma still emits `CREATE TABLE`/`ALTER TABLE` DDL for them in the
  initial migration using the exact type string given. This migration therefore only adds indexes for
  `location`/`centroid`, and has to `DROP`/re-`ADD` `searchVector` to turn it from a plain column into a
  `STORED` generated one.
- `location` and `centroid` are nullable at the DB level; application code must always write them together
  with the row (there is no default centroid). Writes go through `$executeRaw`/`$queryRaw` using
  `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` since Prisma's client cannot construct or bind
  `Unsupported` columns directly.
- Proximity search uses `ST_DWithin(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $meters)`,
  which the GIST index accelerates.
- `searchVector` is a `STORED` generated column — never written by the app, only queried
  (`searchVector @@ to_tsquery(...)` / `plainto_tsquery(...)`).
