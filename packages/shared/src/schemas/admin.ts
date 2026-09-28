import { z } from 'zod';
import { roleSchema } from '../enums/role';
import { geoPointSchema } from './locations';
import { businessStatusSchema } from './business-owner';
import { paginationQuerySchema } from './pagination';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const adminDashboardSchema = z.object({
  businessesByStatus: z.record(businessStatusSchema, z.number().int()),
  totalUsers: z.number().int(),
  totalReviews: z.number().int(),
  pendingClaimsCount: z.number().int(),
  openReportsCount: z.number().int(),
  photosPendingCount: z.number().int(),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

// ---------------------------------------------------------------------------
// Reports queue
// ---------------------------------------------------------------------------

export const listAdminReportsQuerySchema = z.object({
  status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).default('PENDING'),
});
export type ListAdminReportsQuery = z.infer<typeof listAdminReportsQuerySchema>;

export const resolveReportRequestSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  action: z
    .enum(['REMOVE_CONTENT', 'BAN_USER', 'RESTORE_CONTENT', 'NONE'])
    .default('NONE'),
});
export type ResolveReportRequest = z.infer<typeof resolveReportRequestSchema>;

export const dismissReportRequestSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
export type DismissReportRequest = z.infer<typeof dismissReportRequestSchema>;

// ---------------------------------------------------------------------------
// Content moderation (reviews & photos)
// ---------------------------------------------------------------------------

export const contentModerationStatusQuerySchema = z.object({
  status: z.enum(['PENDING', 'PUBLISHED', 'REMOVED', 'APPROVED']).optional(),
  reported: z.coerce.boolean().optional(),
});
export type ContentModerationStatusQuery = z.infer<
  typeof contentModerationStatusQuerySchema
>;

export const moderationRemoveRequestSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(2000),
});
export type ModerationRemoveRequest = z.infer<
  typeof moderationRemoveRequestSchema
>;

export const moderationRestoreRequestSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
export type ModerationRestoreRequest = z.infer<
  typeof moderationRestoreRequestSchema
>;

// ---------------------------------------------------------------------------
// Businesses admin
// ---------------------------------------------------------------------------

export const listAdminBusinessesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  status: businessStatusSchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type ListAdminBusinessesQuery = z.infer<
  typeof listAdminBusinessesQuerySchema
>;

export const updateBusinessStatusRequestSchema = z
  .object({
    status: businessStatusSchema,
    reason: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.status === 'SUSPENDED' || data.status === 'REJECTED') &&
      !data.reason?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required when suspending or rejecting a business',
        path: ['reason'],
      });
    }
  });
export type UpdateBusinessStatusRequest = z.infer<
  typeof updateBusinessStatusRequestSchema
>;

export const updateBusinessVerifyRequestSchema = z.object({
  isVerified: z.boolean(),
});
export type UpdateBusinessVerifyRequest = z.infer<
  typeof updateBusinessVerifyRequestSchema
>;

export const updateBusinessFeaturedRequestSchema = z.object({
  featured: z.boolean(),
  featuredFrom: z.string().datetime().nullable().optional(),
  featuredUntil: z.string().datetime().nullable().optional(),
});
export type UpdateBusinessFeaturedRequest = z.infer<
  typeof updateBusinessFeaturedRequestSchema
>;

export const createAdminBusinessRequestSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string().uuid(),
  provinceId: z.string().uuid(),
  cityId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  addressLine: z.string().trim().min(1).max(500),
  location: geoPointSchema.nullable().optional(),
  phone: z.string().trim().max(50).optional(),
  whatsapp: z.string().trim().max(50).optional(),
  email: z.string().trim().email().optional(),
  website: z.string().trim().url().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});
export type CreateAdminBusinessRequest = z.infer<
  typeof createAdminBusinessRequestSchema
>;

export const updateAdminBusinessRequestSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  provinceId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  areaId: z.string().uuid().nullable().optional(),
  addressLine: z.string().trim().min(1).max(500).optional(),
  location: geoPointSchema.nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  whatsapp: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});
export type UpdateAdminBusinessRequest = z.infer<
  typeof updateAdminBusinessRequestSchema
>;

// ---------------------------------------------------------------------------
// Users admin
// ---------------------------------------------------------------------------

export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const banUserRequestSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(2000),
});
export type BanUserRequest = z.infer<typeof banUserRequestSchema>;

export const changeUserRoleRequestSchema = z.object({
  role: roleSchema,
});
export type ChangeUserRoleRequest = z.infer<typeof changeUserRoleRequestSchema>;

// ---------------------------------------------------------------------------
// Taxonomy admin
// ---------------------------------------------------------------------------

export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  icon: z.string().trim().max(100).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

export const createProvinceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
});
export type CreateProvinceRequest = z.infer<typeof createProvinceRequestSchema>;
export const updateProvinceRequestSchema =
  createProvinceRequestSchema.partial();
export type UpdateProvinceRequest = z.infer<typeof updateProvinceRequestSchema>;

export const createCityRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
  provinceId: z.string().uuid(),
  centroid: geoPointSchema.nullable().optional(),
});
export type CreateCityRequest = z.infer<typeof createCityRequestSchema>;
export const updateCityRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  provinceId: z.string().uuid().optional(),
  centroid: geoPointSchema.nullable().optional(),
});
export type UpdateCityRequest = z.infer<typeof updateCityRequestSchema>;

export const createAreaRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
  cityId: z.string().uuid(),
});
export type CreateAreaRequest = z.infer<typeof createAreaRequestSchema>;
export const updateAreaRequestSchema = createAreaRequestSchema.partial();
export type UpdateAreaRequest = z.infer<typeof updateAreaRequestSchema>;

export const createFeatureRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(100).optional(),
});
export type CreateFeatureRequest = z.infer<typeof createFeatureRequestSchema>;
export const updateFeatureRequestSchema = createFeatureRequestSchema.partial();
export type UpdateFeatureRequest = z.infer<typeof updateFeatureRequestSchema>;

// ---------------------------------------------------------------------------
// "Suggest an edit" (Phase 8)
// ---------------------------------------------------------------------------

export const createEditSuggestionRequestSchema = z.object({
  field: z.string().trim().min(1).max(100),
  currentValue: z.string().trim().max(1000).optional(),
  suggestedValue: z.string().trim().min(1).max(1000),
  note: z.string().trim().max(1000).optional(),
});
export type CreateEditSuggestionRequest = z.infer<
  typeof createEditSuggestionRequestSchema
>;

export const editSuggestionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
]);
export type EditSuggestionStatusValue = z.infer<
  typeof editSuggestionStatusSchema
>;

export const listEditSuggestionsQuerySchema = z.object({
  status: editSuggestionStatusSchema.optional(),
  businessId: z.string().uuid().optional(),
});
export type ListEditSuggestionsQuery = z.infer<
  typeof listEditSuggestionsQuerySchema
>;

export const resolveEditSuggestionRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  resolutionNote: z.string().trim().max(1000).optional(),
});
export type ResolveEditSuggestionRequest = z.infer<
  typeof resolveEditSuggestionRequestSchema
>;

export const editSuggestionSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  business: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  userId: z.string().uuid(),
  userName: z.string(),
  field: z.string(),
  currentValue: z.string().nullable(),
  suggestedValue: z.string(),
  note: z.string().nullable(),
  status: editSuggestionStatusSchema,
  resolvedById: z.string().uuid().nullable(),
  resolvedAt: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: z.string(),
});
export type EditSuggestion = z.infer<typeof editSuggestionSchema>;

// ---------------------------------------------------------------------------
// ModerationLog viewer
// ---------------------------------------------------------------------------

export const moderationLogQuerySchema = paginationQuerySchema.extend({
  actorId: z.string().uuid().optional(),
  targetType: z
    .enum([
      'BUSINESS',
      'REVIEW',
      'PHOTO',
      'USER',
      'CLAIM',
      'REPORT',
      'CATEGORY',
      'EDIT_SUGGESTION',
    ])
    .optional(),
  targetId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ModerationLogQuery = z.infer<typeof moderationLogQuerySchema>;

export const moderationLogEntrySchema = z.object({
  id: z.string().uuid(),
  /** Null for Phase 8's automated scoring-pipeline actions — no human actor. */
  actorId: z.string().uuid().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type ModerationLogEntry = z.infer<typeof moderationLogEntrySchema>;
