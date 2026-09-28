-- Phase 9 hardening: composite indexes for SearchService's hot raw-SQL paths.
-- (Hand-inspected and stripped of spurious DROP INDEX / ALTER COLUMN ... DROP DEFAULT statements
-- that `prisma migrate dev --create-only` emits against the raw-SQL-managed PostGIS/tsvector
-- Unsupported() columns on Business/City — see docs/04-database.md's standing gotcha.)

-- CreateIndex
-- Speeds SearchService's "COUNT/AVG PUBLISHED reviews GROUP BY businessId" correlated aggregate.
CREATE INDEX "Review_businessId_status_idx" ON "Review"("businessId", "status");

-- CreateIndex
-- Speeds SearchService's LATERAL "first APPROVED photo" subquery (ORDER BY createdAt ASC LIMIT 1).
CREATE INDEX "Photo_businessId_status_createdAt_idx" ON "Photo"("businessId", "status", "createdAt");
