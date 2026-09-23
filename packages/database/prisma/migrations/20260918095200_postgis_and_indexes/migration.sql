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
