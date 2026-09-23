import { z } from 'zod';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  children: CategoryNode[];
}

export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
    order: z.number().int(),
    children: z.array(categoryNodeSchema),
  }),
);

export const categoryRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type CategoryRef = z.infer<typeof categoryRefSchema>;

export const categoryDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
  parent: categoryRefSchema.nullable(),
  children: z.array(categoryRefSchema),
  descendantCategoryIds: z.array(z.string().uuid()),
});
export type CategoryDetail = z.infer<typeof categoryDetailSchema>;
