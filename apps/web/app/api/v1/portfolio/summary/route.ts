import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import {
  scoreStageG,
  type PortfolioSnapshot,
  type Alert,
  type JournalEntry,
  type PositionWithThesis,
} from '@stock-assistant/core';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  // 1. Fetch user's holdings, journal entries, and active alerts
  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId },
    include: {
      company: {
        select: { id: true, symbol: true, name: true, sector: true },
      },
    },
    orderBy: { symbol: 'asc' },
  });

  const journalEntries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const dbAlerts = await prisma.alert.findMany({
    where: { userId, acknowledgedAt: null },
    orderBy: { triggeredAt: 'desc' },
  });

  // 2. Build PortfolioSnapshot
  const totalMarketValue = holdings.reduce(
    (sum, h) => sum + Number(h.marketValue),
    0
  );
  const totalInvestedCapital = holdings.reduce(
    (sum, h) => sum + Number(h.avgPrice) * Number(h.quantity),
    0
  );
  const totalUnrealisedPnl = holdings.reduce(
    (sum, h) => sum + Number(h.unrealisedPnl),
    0
  );
  const totalRealisedPnl = journalEntries.reduce(
    (sum, j) => sum + (j.realisedPnl ? Number(j.realisedPnl) : 0),
    0
  );

  const defaultCash = 1000000; // Baseline personal workstation cash
  const totalValue = Math.max(totalMarketValue + defaultCash, 100000);

  const sectorExposure: Record<string, number> = {};
  for (const h of holdings) {
    sectorExposure[h.sector] =
      (sectorExposure[h.sector] ?? 0) + Number(h.marketValue);
  }

  const positions: PositionWithThesis[] = holdings.map((h) => ({
    symbol: h.symbol,
    companyId: h.companyId,
    quantity: Number(h.quantity),
    avgPrice: Number(h.avgPrice),
    currentPrice: Number(h.currentPrice),
    marketValue: Number(h.marketValue),
    sector: h.sector,
    unrealisedPnl: Number(h.unrealisedPnl),
    unrealisedPnlPct: Number(h.unrealisedPnlPct),
    thesis: 'Holding investment thesis',
    stopLoss: Number(h.stopLoss),
    targets: Array.isArray(h.targets) ? (h.targets as number[]) : [],
    entryDate: h.entryDate.toISOString(),
    daysHeld: Math.max(
      0,
      Math.floor((Date.now() - h.entryDate.getTime()) / (1000 * 60 * 60 * 24))
    ),
    unrealisedReturnPct: Number(h.unrealisedPnlPct),
    alertCount: 0,
  }));

  const portfolio: PortfolioSnapshot = {
    totalValue,
    cash: defaultCash,
    positions,
    sectorExposure,
    asOfDate: new Date().toISOString(),
  };

  const coreAlerts: Alert[] = dbAlerts.map((a) => ({
    id: a.id,
    companyId: a.companyId ?? undefined,
    type: a.type as Alert['type'],
    severity: a.severity as Alert['severity'],
    message: a.message,
    triggeredAt: a.triggeredAt.toISOString(),
    data: (a.data ?? {}) as Record<string, unknown>,
    relatedTradePlanId: a.relatedTradePlanId ?? undefined,
  }));

  const coreJournalEntries: JournalEntry[] = journalEntries.map((j) => ({
    id: j.id,
    tradePlanId: j.tradePlanId,
    date: j.date.toISOString(),
    action: j.action as JournalEntry['action'],
    quantity: Number(j.quantity),
    price: Number(j.price),
    fees: Number(j.fees),
    taxes: Number(j.taxes),
    reason: j.reason,
    ruleTriggers: Array.isArray(j.ruleTriggers) ? (j.ruleTriggers as string[]) : [],
    realisedPnl: j.realisedPnl ? Number(j.realisedPnl) : undefined,
    unrealisedPnl: j.unrealisedPnl ? Number(j.unrealisedPnl) : undefined,
    returnPct: j.returnPct ? Number(j.returnPct) : undefined,
    corporateActions: [],
    portfolioContext: portfolio,
    createdAt: j.createdAt.toISOString(),
  }));

  // 3. Evaluate deterministic Stage G monitoring & portfolio health
  const stageGOutput = scoreStageG({
    portfolio,
    alerts: coreAlerts,
    openPositions: positions,
    tradeHistory: coreJournalEntries,
  });

  const cashPct = totalValue > 0 ? (defaultCash / totalValue) * 100 : 100;
  const exposurePct = totalValue > 0 ? (totalMarketValue / totalValue) * 100 : 0;
  const unrealisedPnlPct =
    totalInvestedCapital > 0
      ? (totalUnrealisedPnl / totalInvestedCapital) * 100
      : 0;

  return createSuccessResponse(
    {
      totalValue,
      marketValue: totalMarketValue,
      investedCapital: totalInvestedCapital,
      cash: defaultCash,
      cashPct: Math.round(cashPct * 100) / 100,
      exposurePct: Math.round(exposurePct * 100) / 100,
      unrealisedPnl: totalUnrealisedPnl,
      unrealisedPnlPct: Math.round(unrealisedPnlPct * 100) / 100,
      realisedPnl: totalRealisedPnl,
      positionsCount: holdings.length,
      sectorExposure,
      portfolioHealth: stageGOutput.portfolioHealth,
      healthFlags: stageGOutput.flags,
      score: stageGOutput.totalPoints,
      verdict: stageGOutput.verdict,
    },
    requestId
  );
});
