import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, JournalRepository } from '@stock-assistant/db';
import { CreateJournalEntryRequestSchema } from '@stock-assistant/contracts';
import { calculatePositionPnL } from '@stock-assistant/core';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const searchParams = req.nextUrl.searchParams;
  const tradePlanId = searchParams.get('tradePlanId') || undefined;
  const action = searchParams.get('action') || undefined;

  const repo = new JournalRepository(prisma);
  const entries = await repo.listByUser(userId, { tradePlanId, action });

  const data = entries.map((e) => ({
    id: e.id,
    tradePlanId: e.tradePlanId,
    tradePlan: (e as any).tradePlan,
    date: e.date.toISOString(),
    action: e.action,
    quantity: Number(e.quantity),
    price: Number(e.price),
    fees: Number(e.fees),
    taxes: Number(e.taxes),
    reason: e.reason,
    ruleTriggers: e.ruleTriggers,
    realisedPnl: e.realisedPnl ? Number(e.realisedPnl) : null,
    unrealisedPnl: e.unrealisedPnl ? Number(e.unrealisedPnl) : null,
    returnPct: e.returnPct ? Number(e.returnPct) : null,
    corporateActions: e.corporateActions,
    review: e.review,
    reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
    reviewedBy: e.reviewedBy,
    createdAt: e.createdAt.toISOString(),
  }));

  return createSuccessResponse(data, requestId);
});

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = CreateJournalEntryRequestSchema.parse(body);

  // 1. Verify trade plan exists and belongs to user
  const tradePlan = await prisma.tradePlan.findFirst({
    where: { id: parsed.tradePlanId, userId },
    include: { company: true },
  });

  if (!tradePlan) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Trade plan ${parsed.tradePlanId} not found`,
      404,
      requestId
    );
  }

  const repo = new JournalRepository(prisma);

  // 2. Fetch past transactions to calculate realised P&L using calculatePositionPnL
  const priorEntries = await repo.listByTradePlan(tradePlan.id, userId);
  const allTxs = priorEntries.map((e) => ({
    id: e.id,
    action: e.action as 'buy' | 'trim' | 'sell',
    quantity: Number(e.quantity),
    price: Number(e.price),
    fees: Number(e.fees),
    taxes: Number(e.taxes),
    date: e.date.toISOString(),
  }));

  allTxs.push({
    id: 'current-tx',
    action: parsed.action,
    quantity: parsed.quantity,
    price: parsed.price,
    fees: parsed.fees,
    taxes: parsed.taxes,
    date: parsed.date,
  });

  const pnlResult = calculatePositionPnL(
    allTxs as any,
    parsed.price,
    tradePlan.symbol
  );

  // 3. Persist journal entry and update portfolio inside a transaction
  const entry = await prisma.$transaction(async (tx) => {
    const journalTxRepo = new JournalRepository(tx as any);
    const created = await journalTxRepo.createEntry(userId, {
      tradePlanId: tradePlan.id,
      date: new Date(parsed.date),
      action: parsed.action,
      quantity: parsed.quantity,
      price: parsed.price,
      fees: parsed.fees,
      taxes: parsed.taxes,
      reason: parsed.reason,
      ruleTriggers: parsed.ruleTriggers ?? [],
      corporateActions: parsed.corporateActions ?? [],
      realisedPnl: pnlResult.realisedPnl,
      unrealisedPnl: pnlResult.unrealisedPnl,
      returnPct: pnlResult.netReturnPct,
    });

    // Update PortfolioHolding accordingly
    const holding = await tx.portfolioHolding.findFirst({
      where: { userId, companyId: tradePlan.companyId },
    });

    if (parsed.action === 'buy') {
      if (holding) {
        const newQty = Number(holding.quantity) + parsed.quantity;
        const newCost =
          Number(holding.avgPrice) * Number(holding.quantity) +
          parsed.price * parsed.quantity;
        const newAvgPrice = newQty > 0 ? newCost / newQty : parsed.price;
        await tx.portfolioHolding.update({
          where: { id: holding.id },
          data: {
            quantity: newQty,
            avgPrice: newAvgPrice,
            currentPrice: parsed.price,
            marketValue: newQty * parsed.price,
            unrealisedPnl: (parsed.price - newAvgPrice) * newQty,
            unrealisedPnlPct: newAvgPrice > 0 ? ((parsed.price - newAvgPrice) / newAvgPrice) * 100 : 0,
          },
        });
      } else {
        await tx.portfolioHolding.create({
          data: {
            userId,
            companyId: tradePlan.companyId,
            symbol: tradePlan.symbol,
            quantity: parsed.quantity,
            avgPrice: parsed.price,
            currentPrice: parsed.price,
            marketValue: parsed.quantity * parsed.price,
            sector: tradePlan.company.sector,
            unrealisedPnl: 0,
            unrealisedPnlPct: 0,
            stopLoss: tradePlan.stopLoss,
            targets: tradePlan.targets as any,
            entryDate: new Date(parsed.date),
          },
        });
      }

      // Mark trade plan executed if not already
      if (tradePlan.status === 'draft' || tradePlan.status === 'ready') {
        await tx.tradePlan.update({
          where: { id: tradePlan.id },
          data: {
            status: 'executed',
            executedAt: new Date(parsed.date),
            executedPrice: parsed.price,
            executedQuantity: parsed.quantity,
          },
        });
      }
    } else if (parsed.action === 'trim' || parsed.action === 'sell') {
      if (holding) {
        const remainingQty = Math.max(0, Number(holding.quantity) - parsed.quantity);
        if (remainingQty === 0) {
          await tx.portfolioHolding.delete({ where: { id: holding.id } });
        } else {
          await tx.portfolioHolding.update({
            where: { id: holding.id },
            data: {
              quantity: remainingQty,
              currentPrice: parsed.price,
              marketValue: remainingQty * parsed.price,
              unrealisedPnl: (parsed.price - Number(holding.avgPrice)) * remainingQty,
              unrealisedPnlPct:
                Number(holding.avgPrice) > 0
                  ? ((parsed.price - Number(holding.avgPrice)) / Number(holding.avgPrice)) * 100
                  : 0,
            },
          });
        }
      }
    }

    // Append AuditEvent
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'RECORD_JOURNAL_ENTRY',
        entityType: 'JournalEntry',
        entityId: created.id,
        reason: `${parsed.action.toUpperCase()} ${parsed.quantity} shares of ${tradePlan.symbol} @ ₹${parsed.price}`,
        afterState: {
          journalEntryId: created.id,
          tradePlanId: tradePlan.id,
          symbol: tradePlan.symbol,
          action: parsed.action,
          quantity: parsed.quantity,
          price: parsed.price,
          realisedPnl: pnlResult.realisedPnl,
        },
      },
    });

    return created;
  });

  return createSuccessResponse(
    {
      id: entry.id,
      tradePlanId: entry.tradePlanId,
      date: entry.date.toISOString(),
      action: entry.action,
      quantity: Number(entry.quantity),
      price: Number(entry.price),
      fees: Number(entry.fees),
      taxes: Number(entry.taxes),
      reason: entry.reason,
      realisedPnl: entry.realisedPnl ? Number(entry.realisedPnl) : null,
      unrealisedPnl: entry.unrealisedPnl ? Number(entry.unrealisedPnl) : null,
      returnPct: entry.returnPct ? Number(entry.returnPct) : null,
      createdAt: entry.createdAt.toISOString(),
    },
    requestId,
    201
  );
});
