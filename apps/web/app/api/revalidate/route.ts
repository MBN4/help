import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

interface RevalidateBody {
  slug?: string;
  city?: string;
  category?: string;
}

/**
 * Called by the API after a business/review write to refresh the affected ISR pages.
 * No writer exists yet (Phase 2 has no business-mutation endpoints) — this is the seam for one.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret =
    request.headers.get('x-revalidate-secret') ??
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing revalidation secret',
        },
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as RevalidateBody;
  const paths = new Set<string>(['/']);
  if (body.slug) {
    paths.add(`/business/${body.slug}`);
  }
  if (body.city) {
    paths.add(`/${body.city}`);
  }
  if (body.city && body.category) {
    paths.add(`/${body.city}/${body.category}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    success: true,
    data: { revalidated: Array.from(paths) },
  });
}
