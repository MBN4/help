import { z } from 'zod';

export const claimStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ClaimStatusValue = z.infer<typeof claimStatusSchema>;

export const createClaimRequestSchema = z.object({
  businessId: z.string().uuid(),
  message: z.string().trim().max(2000).optional(),
  documentUrl: z.string().url().optional(),
});
export type CreateClaimRequest = z.infer<typeof createClaimRequestSchema>;

export const claimSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  status: claimStatusSchema,
  message: z.string().nullable(),
  documentUrl: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
});
export type Claim = z.infer<typeof claimSchema>;
