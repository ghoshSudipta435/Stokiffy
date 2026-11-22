import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, WatchlistRepository } from '@stock-assistant/db';
import { AddWatchlistItemRequestSchema } from '@stock-assistant/contracts';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const watchlistId = params.id as string;

  const body = await req.json();
  const parsed = AddWatchlistItemRequestSchema.parse(body);

  const repo = new WatchlistRepository(prisma);
  const item = await repo.addItem(watchlistId, userId, {
    companyId: parsed.companyId,
    ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
  });

  return createSuccessResponse(
    {
      id: item.id,
      watchlistId: item.watchlistId,
      companyId: item.companyId,
      notes: item.notes,
      addedAt: item.addedAt.toISOString(),
    },
    requestId,
    201
  );
});

export const DELETE = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const watchlistId = params.id as string;

  let companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    try {
      const body = await req.json();
      companyId = body.companyId;
    } catch {
      // Body might be empty when using query param
    }
  }

  if (!companyId) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Missing required companyId query parameter or body field',
      400,
      requestId
    );
  }

  const repo = new WatchlistRepository(prisma);
  await repo.removeItem(watchlistId, companyId, userId);

  return createSuccessResponse(
    {
      success: true,
      watchlistId,
      companyId,
    },
    requestId
  );
});
