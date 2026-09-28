import { z } from 'zod';
import {
  adminDashboardSchema,
  editSuggestionSchema,
  moderationLogEntrySchema,
  type AdminDashboard,
  type ApproveClaimRequest,
  type BanUserRequest,
  type ChangeUserRoleRequest,
  type Claim,
  type CreateAdminBusinessRequest,
  type CreateAreaRequest,
  type CreateCategoryRequest,
  type CreateCityRequest,
  type CreateFeatureRequest,
  type CreateProvinceRequest,
  type DismissReportRequest,
  type EditSuggestion,
  type ListEditSuggestionsQuery,
  type ModerationLogEntry,
  type ModerationRemoveRequest,
  type ModerationRestoreRequest,
  type RejectClaimRequest,
  type ResolveEditSuggestionRequest,
  type ResolveReportRequest,
  type UpdateAdminBusinessRequest,
  type UpdateAreaRequest,
  type UpdateBusinessFeaturedRequest,
  type UpdateBusinessStatusRequest,
  type UpdateBusinessVerifyRequest,
  type UpdateCategoryRequest,
  type UpdateCityRequest,
  type UpdateFeatureRequest,
  type UpdateProvinceRequest,
  claimSchema,
} from '@buisnez/shared';
import { apiRequest } from './client';

// Admin list/detail responses come from Prisma `include`s with a lot of nested shape variance (business,
// user, review, photo joins). Rather than hand-writing a full Zod schema per response (the strict pattern
// used for the public API), these use a permissive passthrough schema — the request-body side (what's
// actually being validated server-side for correctness) has full Zod schemas from `@buisnez/shared`. See
// PROGRESS.md's Phase 7 deviation log.
const anyRecord = z.record(z.string(), z.unknown());
const anyArray = z.array(anyRecord);

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiRequest('/admin/dashboard', adminDashboardSchema);
  return data;
}

// --- Claims queue ---------------------------------------------------------

export async function listAdminClaims(
  status = 'PENDING',
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/claims', anyArray, { query: { status } });
  return data;
}

export async function approveClaim(
  id: string,
  body: ApproveClaimRequest,
): Promise<Claim> {
  const { data } = await apiRequest(`/claims/${id}/approve`, claimSchema, {
    method: 'PATCH',
    body,
  });
  return data;
}

export async function rejectClaim(
  id: string,
  body: RejectClaimRequest,
): Promise<Claim> {
  const { data } = await apiRequest(`/claims/${id}/reject`, claimSchema, {
    method: 'PATCH',
    body,
  });
  return data;
}

// --- Reports queue ---------------------------------------------------------

export async function listAdminReports(
  status = 'PENDING',
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/admin/reports', anyArray, {
    query: { status },
  });
  return data;
}

export async function getAdminReportDetail(
  id: string,
): Promise<Record<string, unknown>> {
  const { data } = await apiRequest(`/admin/reports/${id}`, anyRecord);
  return data;
}

export async function resolveReport(
  id: string,
  body: ResolveReportRequest,
): Promise<void> {
  await apiRequest(`/admin/reports/${id}/resolve`, anyRecord, {
    method: 'PATCH',
    body,
  });
}

export async function dismissReport(
  id: string,
  body: DismissReportRequest,
): Promise<void> {
  await apiRequest(`/admin/reports/${id}/dismiss`, anyRecord, {
    method: 'PATCH',
    body,
  });
}

// --- Content moderation -----------------------------------------------------

export async function listAdminReviews(
  status?: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/admin/content/reviews', anyArray, {
    query: status ? { status } : undefined,
  });
  return data;
}

export async function listAdminPhotos(
  status?: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/admin/content/photos', anyArray, {
    query: status ? { status } : undefined,
  });
  return data;
}

export async function approveReview(id: string): Promise<void> {
  await apiRequest(`/admin/content/reviews/${id}/approve`, anyRecord, {
    method: 'PATCH',
  });
}
export async function removeReview(
  id: string,
  body: ModerationRemoveRequest,
): Promise<void> {
  await apiRequest(`/admin/content/reviews/${id}/remove`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function restoreReview(
  id: string,
  body: ModerationRestoreRequest = {},
): Promise<void> {
  await apiRequest(`/admin/content/reviews/${id}/restore`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function approvePhoto(id: string): Promise<void> {
  await apiRequest(`/admin/content/photos/${id}/approve`, anyRecord, {
    method: 'PATCH',
  });
}
export async function removePhoto(
  id: string,
  body: ModerationRemoveRequest,
): Promise<void> {
  await apiRequest(`/admin/content/photos/${id}/remove`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function restorePhoto(
  id: string,
  body: ModerationRestoreRequest = {},
): Promise<void> {
  await apiRequest(`/admin/content/photos/${id}/restore`, anyRecord, {
    method: 'PATCH',
    body,
  });
}

// --- Businesses admin --------------------------------------------------------

export async function listAdminBusinesses(
  query: {
    q?: string;
    status?: string;
    includeDeleted?: boolean;
    page?: number;
  } = {},
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/admin/businesses', anyArray, { query });
  return data;
}

export async function getAdminBusiness(
  id: string,
): Promise<Record<string, unknown>> {
  const { data } = await apiRequest(`/admin/businesses/${id}`, anyRecord);
  return data;
}

export async function updateBusinessStatus(
  id: string,
  body: UpdateBusinessStatusRequest,
): Promise<void> {
  await apiRequest(`/admin/businesses/${id}/status`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function updateBusinessVerify(
  id: string,
  body: UpdateBusinessVerifyRequest,
): Promise<void> {
  await apiRequest(`/admin/businesses/${id}/verify`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function updateBusinessFeatured(
  id: string,
  body: UpdateBusinessFeaturedRequest,
): Promise<void> {
  await apiRequest(`/admin/businesses/${id}/featured`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function createAdminBusiness(
  body: CreateAdminBusinessRequest,
): Promise<Record<string, unknown>> {
  const { data } = await apiRequest('/admin/businesses', anyRecord, {
    method: 'POST',
    body,
  });
  return data;
}
export async function updateAdminBusiness(
  id: string,
  body: UpdateAdminBusinessRequest,
): Promise<void> {
  await apiRequest(`/admin/businesses/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function softDeleteBusiness(id: string): Promise<void> {
  await apiRequest(`/admin/businesses/${id}`, anyRecord, { method: 'DELETE' });
}
export async function restoreBusiness(id: string): Promise<void> {
  await apiRequest(`/admin/businesses/${id}/restore`, anyRecord, {
    method: 'POST',
  });
}

// --- Users admin ---------------------------------------------------------

export async function listAdminUsers(
  search?: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await apiRequest('/admin/users', anyArray, {
    query: search ? { search } : undefined,
  });
  return data;
}
export async function getAdminUser(
  id: string,
): Promise<Record<string, unknown>> {
  const { data } = await apiRequest(`/admin/users/${id}`, anyRecord);
  return data;
}
export async function banUser(id: string, body: BanUserRequest): Promise<void> {
  await apiRequest(`/admin/users/${id}/ban`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function unbanUser(id: string): Promise<void> {
  await apiRequest(`/admin/users/${id}/unban`, anyRecord, { method: 'PATCH' });
}
export async function changeUserRole(
  id: string,
  body: ChangeUserRoleRequest,
): Promise<void> {
  await apiRequest(`/admin/users/${id}/role`, anyRecord, {
    method: 'PATCH',
    body,
  });
}

// --- Taxonomy admin --------------------------------------------------------

export async function createCategory(
  body: CreateCategoryRequest,
): Promise<void> {
  await apiRequest('/admin/taxonomy/categories', anyRecord, {
    method: 'POST',
    body,
  });
}
export async function updateCategory(
  id: string,
  body: UpdateCategoryRequest,
): Promise<void> {
  await apiRequest(`/admin/taxonomy/categories/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function deleteCategory(id: string): Promise<void> {
  await apiRequest(`/admin/taxonomy/categories/${id}`, anyRecord, {
    method: 'DELETE',
  });
}

export async function createProvince(
  body: CreateProvinceRequest,
): Promise<void> {
  await apiRequest('/admin/taxonomy/provinces', anyRecord, {
    method: 'POST',
    body,
  });
}
export async function updateProvince(
  id: string,
  body: UpdateProvinceRequest,
): Promise<void> {
  await apiRequest(`/admin/taxonomy/provinces/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function deleteProvince(id: string): Promise<void> {
  await apiRequest(`/admin/taxonomy/provinces/${id}`, anyRecord, {
    method: 'DELETE',
  });
}

export async function createCity(body: CreateCityRequest): Promise<void> {
  await apiRequest('/admin/taxonomy/cities', anyRecord, {
    method: 'POST',
    body,
  });
}
export async function updateCity(
  id: string,
  body: UpdateCityRequest,
): Promise<void> {
  await apiRequest(`/admin/taxonomy/cities/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function deleteCity(id: string): Promise<void> {
  await apiRequest(`/admin/taxonomy/cities/${id}`, anyRecord, {
    method: 'DELETE',
  });
}

export async function createArea(body: CreateAreaRequest): Promise<void> {
  await apiRequest('/admin/taxonomy/areas', anyRecord, {
    method: 'POST',
    body,
  });
}
export async function updateArea(
  id: string,
  body: UpdateAreaRequest,
): Promise<void> {
  await apiRequest(`/admin/taxonomy/areas/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function deleteArea(id: string): Promise<void> {
  await apiRequest(`/admin/taxonomy/areas/${id}`, anyRecord, {
    method: 'DELETE',
  });
}

export async function createFeature(body: CreateFeatureRequest): Promise<void> {
  await apiRequest('/admin/taxonomy/features', anyRecord, {
    method: 'POST',
    body,
  });
}
export async function updateFeature(
  id: string,
  body: UpdateFeatureRequest,
): Promise<void> {
  await apiRequest(`/admin/taxonomy/features/${id}`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
export async function deleteFeature(id: string): Promise<void> {
  await apiRequest(`/admin/taxonomy/features/${id}`, anyRecord, {
    method: 'DELETE',
  });
}

// --- Moderation log ----------------------------------------------------------

export async function listModerationLog(
  query: {
    actorId?: string;
    targetType?: string;
    targetId?: string;
    action?: string;
  } = {},
): Promise<ModerationLogEntry[]> {
  const { data } = await apiRequest(
    '/admin/moderation-log',
    z.array(moderationLogEntrySchema),
    { query },
  );
  return data;
}

// --- "Suggest an edit" queue (Phase 8) ---------------------------------------

export async function listAdminEditSuggestions(
  query: ListEditSuggestionsQuery = {},
): Promise<EditSuggestion[]> {
  const { data } = await apiRequest(
    '/admin/edit-suggestions',
    z.array(editSuggestionSchema),
    { query },
  );
  return data;
}

export async function resolveEditSuggestion(
  id: string,
  body: ResolveEditSuggestionRequest,
): Promise<void> {
  await apiRequest(`/admin/edit-suggestions/${id}/resolve`, anyRecord, {
    method: 'PATCH',
    body,
  });
}
