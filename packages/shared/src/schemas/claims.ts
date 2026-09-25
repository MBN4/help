import { z } from 'zod';

export const claimStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ClaimStatusValue = z.infer<typeof claimStatusSchema>;

export const createClaimRequestSchema = z.object({
  businessId: z.string().uuid(),
  message: z.string().trim().max(2000).optional(),
  documentUrl: z.string().url().optional(),
});
export type CreateClaimRequest = z.infer<typeof createClaimRequestSchema>;

// `.default({})` so a request with no body at all (e.g. an existing caller that never sent one pre-Phase-7)
// still validates — every field here is itself optional, there's nothing to require.
export const approveClaimRequestSchema = z
  .object({
    verifyBusiness: z.boolean().optional(),
  })
  .default({});
export type ApproveClaimRequest = z.infer<typeof approveClaimRequestSchema>;

export const rejectClaimRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000).optional(),
  })
  .default({});
export type RejectClaimRequest = z.infer<typeof rejectClaimRequestSchema>;

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
