-- CreateEnum
CREATE TYPE "EditSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ModerationTargetType" ADD VALUE 'EDIT_SUGGESTION';

-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'APPEAL';

-- AlterTable
ALTER TABLE "ModerationLog" ALTER COLUMN "actorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupIp" TEXT;

-- CreateTable
CREATE TABLE "BusinessEditSuggestion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" TEXT,
    "suggestedValue" TEXT NOT NULL,
    "note" TEXT,
    "status" "EditSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessEditSuggestion_businessId_idx" ON "BusinessEditSuggestion"("businessId");

-- CreateIndex
CREATE INDEX "BusinessEditSuggestion_status_idx" ON "BusinessEditSuggestion"("status");

-- AddForeignKey
ALTER TABLE "BusinessEditSuggestion" ADD CONSTRAINT "BusinessEditSuggestion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEditSuggestion" ADD CONSTRAINT "BusinessEditSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 8 moderation-scoring support: trigram similarity search over review bodies, for the
-- duplicate/near-duplicate-text rule in ModerationScoringService (pg_trgm already enabled by the Phase 1
-- postgis_and_indexes migration). Raw SQL, not Prisma-managed — same pattern as business_name_trgm.
CREATE INDEX IF NOT EXISTS "review_body_trgm" ON "Review" USING GIN ("body" gin_trgm_ops);
