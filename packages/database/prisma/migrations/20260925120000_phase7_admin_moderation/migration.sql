-- Phase 7: admin & moderation.
--
-- NOTE: `prisma migrate diff` against the live dev DB also emitted spurious `DROP INDEX` statements for
-- `business_location_gist`, `business_name_trgm`, `business_search_vector_gin`, `city_centroid_gist` and an
-- `ALTER COLUMN "searchVector" DROP DEFAULT` — all artifacts of Prisma not understanding the raw-SQL-managed
-- `Unsupported()` columns/indexes from migration 0001_postgis_and_indexes. Stripped from this migration; do
-- not add them back.

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('BUSINESS', 'REVIEW', 'PHOTO', 'USER', 'CLAIM', 'REPORT', 'CATEGORY');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MODERATOR';

-- AlterTable: Business soft-delete + featured window
ALTER TABLE "Business"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "featuredFrom" TIMESTAMP(3),
  ADD COLUMN "featuredUntil" TIMESTAMP(3);

-- AlterTable: User ban fields
ALTER TABLE "User"
  ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bannedAt" TIMESTAMP(3);

-- AlterTable: Photo.isApproved -> Photo.status, with backfill (added nullable first so we can read the old
-- column while filling it in; existing rows are all isApproved=true per docs/11-reviews-trust-safety.md's
-- Phase 5 auto-approve stub, but handle isApproved=false correctly anyway).
ALTER TABLE "Photo" ADD COLUMN "status" "PhotoStatus";

UPDATE "Photo" SET "status" = CASE WHEN "isApproved" = true THEN 'APPROVED' ELSE 'PENDING' END::"PhotoStatus";

ALTER TABLE "Photo" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Photo" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
ALTER TABLE "Photo" DROP COLUMN "isApproved";

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_targetType_targetId_idx" ON "ModerationLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationLog_actorId_idx" ON "ModerationLog"("actorId");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
