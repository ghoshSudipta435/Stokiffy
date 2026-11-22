import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, WatchlistRepository } from '@stock-assistant/db';
import { CreateWatchlistRequestSchema } from '@stock-assistant/contracts';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const repo = new WatchlistRepository(prisma);
  const watchlists = await repo.listByUser(userId);

  const data = watchlists.map((w) => ({
    id: w.id,
    userId: w.userId,
    name: w.name,
    description: w.description,
    itemCount: w._count.items,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }));

  return createSuccessResponse(data, requestId);
});

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = CreateWatchlistRequestSchema.parse(body);

  const repo = new WatchlistRepository(prisma);
  const created = await repo.create(userId, {
    name: parsed.name,
    ...(parsed.description !== undefined ? { description: parsed.description } : {}),
  });

  return createSuccessResponse(
    {
      id: created.id,
      userId: created.userId,
      name: created.name,
      description: created.description,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    requestId,
    201
  );
});
