import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, WatchlistRepository } from '@stock-assistant/db';
import { UpdateWatchlistRequestSchema } from '@stock-assistant/contracts';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const watchlist = await prisma.watchlist.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          company: {
            include: {
              analysisRuns: {
                where: { userId },
                orderBy: { calculatedAt: 'desc' },
                take: 10,
                include: {
                  stageA: true,
                  stageB: true,
                  stageC: true,
                  stageD: true,
                  stageE: true,
                },
              },
              priceBars: {
                orderBy: { date: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { addedAt: 'asc' },
      },
    },
  });

  if (!watchlist) {
    return createErrorResponse('RESOURCE_NOT_FOUND', `Watchlist ${id} not found`, 404, requestId);
  }

  const comparisonItems = watchlist.items.map((item) => {
    const c = item.company;
    const latestPrice = c.priceBars[0] ? Number(c.priceBars[0].close) : undefined;
    const runA = c.analysisRuns.find((r) => r.stage === 'A');
    const runB = c.analysisRuns.find((r) => r.stage === 'B');
    const runC = c.analysisRuns.find((r) => r.stage === 'C');
    const runD = c.analysisRuns.find((r) => r.stage === 'D');
    const runE = c.analysisRuns.find((r) => r.stage === 'E');

    return {
      companyId: c.id,
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      currentPrice: latestPrice,
      stageAScore: runA ? Number(runA.totalPoints) : null,
      stageBScore: runB ? Number(runB.totalPoints) : null,
      stageCScore: runC ? Number(runC.totalPoints) : null,
      fairValue: runD?.stageD?.fairValue ? Number(runD.stageD.fairValue) : null,
      maxBuyPrice: runD?.stageD?.maxBuyPrice ? Number(runD.stageD.maxBuyPrice) : null,
      gatePassed: runA?.verdict === 'PASS',
      notes: item.notes,
      addedAt: item.addedAt.toISOString(),
    };
  });

  return createSuccessResponse(
    {
      id: watchlist.id,
      userId: watchlist.userId,
      name: watchlist.name,
      description: watchlist.description,
      comparedAt: new Date().toISOString(),
      itemCount: watchlist.items.length,
      items: comparisonItems,
    },
    requestId
  );
});

export const PATCH = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const body = await req.json();
  const parsed = UpdateWatchlistRequestSchema.parse(body);

  const repo = new WatchlistRepository(prisma);
  const updated = await repo.update(id, userId, {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.description !== undefined ? { description: parsed.description ?? undefined } : {}),
  });

  return createSuccessResponse(
    {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      description: updated.description,
      updatedAt: updated.updatedAt.toISOString(),
    },
    requestId
  );
});

export const DELETE = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const repo = new WatchlistRepository(prisma);
  await repo.delete(id, userId);

  return createSuccessResponse({ success: true, id }, requestId);
});
