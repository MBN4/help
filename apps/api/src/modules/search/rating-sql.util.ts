import { Prisma } from '@buisnez/database';

/** "Trust a business's own rating once it has ~5+ reviews" — see docs/09-search-discovery.md. */
export const BAYESIAN_PRIOR_WEIGHT = 5;

export const GLOBAL_AVERAGE_RATING_SQL = Prisma.sql`(SELECT COALESCE(AVG("rating"), 4.0) FROM "Review" WHERE "status" = 'PUBLISHED')`;

/** Bayesian weighted rating `W = (v/(v+m))*R + (m/(v+m))*C` — see docs/09-search-discovery.md. */
export function weightedRatingSql(
  reviewCountExpr: Prisma.Sql,
  avgRatingExpr: Prisma.Sql,
): Prisma.Sql {
  return Prisma.sql`(
    (${reviewCountExpr}::float / (${reviewCountExpr}::float + ${BAYESIAN_PRIOR_WEIGHT}))
    * COALESCE(${avgRatingExpr}, 0)
    + (${BAYESIAN_PRIOR_WEIGHT}::float / (${reviewCountExpr}::float + ${BAYESIAN_PRIOR_WEIGHT}))
    * ${GLOBAL_AVERAGE_RATING_SQL}
  )`;
}
