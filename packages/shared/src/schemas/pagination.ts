import { z } from 'zod';

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 50;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PER_PAGE)
    .default(DEFAULT_PER_PAGE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
