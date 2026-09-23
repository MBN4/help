import type { z } from 'zod';
import { ApiError } from './errors';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ApiEnvelopeSuccess<T> {
  success: true;
  data: T;
  meta: { page: number; perPage: number; total: number } | null;
}

interface ApiEnvelopeError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeError;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Skip the silent-refresh-on-401 dance (used by the refresh call itself, to avoid recursion). */
  skipAuthRetry?: boolean;
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const url = new URL(
    path.replace(/^\//, ''),
    `${API_BASE_URL.replace(/\/?$/, '/')}`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function rawRequest(
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const { query, body, headers, skipAuthRetry, ...rest } = options;
  void skipAuthRetry;
  const url = buildUrl(path, query);
  return fetch(url, {
    ...rest,
    // Auth is httpOnly cookies (see docs/10-auth-roles.md) — never a JS-readable token.
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      // Required on every mutating request (CsrfGuard) — a cross-site request can't set this header.
      'x-requested-with': 'buisnez-web',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

let refreshInFlight: Promise<boolean> | null = null;

/** POSTs /auth/refresh directly (bypassing apiRequest) so concurrent 401s share a single refresh attempt. */
async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest('/auth/refresh', {
      method: 'POST',
      skipAuthRetry: true,
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export interface ApiResult<T> {
  data: T;
  meta: { page: number; perPage: number; total: number } | null;
}

export async function apiRequest<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options: ApiRequestOptions = {},
): Promise<ApiResult<z.infer<Schema>>> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawRequest(path, options);
    }
  }

  if (response.status === 429) {
    throw new ApiError(
      'Too many requests — please slow down and try again shortly.',
      'RATE_LIMITED',
      429,
    );
  }

  let envelope: ApiEnvelope<unknown>;
  try {
    envelope = (await response.json()) as ApiEnvelope<unknown>;
  } catch {
    throw new ApiError(
      'The API returned an invalid response.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  if (!envelope.success) {
    throw new ApiError(
      envelope.error.message,
      envelope.error.code,
      response.status,
      envelope.error.details,
    );
  }

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new ApiError(
      'The API response did not match the expected shape.',
      'SHAPE_MISMATCH',
      response.status,
      parsed.error.flatten(),
    );
  }

  return { data: parsed.data, meta: envelope.meta };
}
