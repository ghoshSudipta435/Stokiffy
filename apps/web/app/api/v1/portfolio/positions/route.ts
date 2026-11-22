import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import {
  calculatePositionPnL,
  evaluateSellDecision,
  evaluateAlerts,
  type PositionWithThesis,
  type PortfolioSnapshot,
  type Alert,
} from '@stock-assistant/core';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  // 1. Fetch user holdings with latest price bar and active trade plans
  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId },
    include: {
      company: {
        include: {
          priceBars: {
            orderBy: { date: 'desc' },
            take: 1,
          },
          tradePlans: {
            where: { userId, status: { in: ['ready', 'executed'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          alerts: {
            where: { userId, acknowledgedAt: null },
            orderBy: { triggeredAt: 'desc' },
          },
        },
      },
    },
    orderBy: { symbol: 'asc' },
  });

  // 2. Fetch journal entries for all holdings to calculate accurate weighted P&L
  const journalEntries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });

  // 3. Build PortfolioSnapshot
  const totalMarketValue = holdings.reduce(
    (sum, h) => sum + Number(h.marketValue),
    0
  );
  const defaultCash = 1000000;
  const totalValue = Math.max(totalMarketValue + defaultCash, 100000);

  const sectorExposure: Record<string, number> = {};
  for (const h of holdings) {
    sectorExposure[h.sector] =
      (sectorExposure[h.sector] ?? 0) + Number(h.marketValue);
  }

  const positions: PositionWithThesis[] = holdings.map((h) => {
    const tradePlan = h.company.tradePlans[0];
    const latestPrice = h.company.priceBars[0]
      ? Number(h.company.priceBars[0].close)
      : Number(h.currentPrice);

    return {
      symbol: h.symbol,
      companyId: h.companyId,
      quantity: Number(h.quantity),
      avgPrice: Number(h.avgPrice),
      currentPrice: latestPrice,
      marketValue: Number(h.quantity) * latestPrice,
      sector: h.sector,
      unrealisedPnl: (latestPrice - Number(h.avgPrice)) * Number(h.quantity),
      unrealisedPnlPct:
        Number(h.avgPrice) > 0
          ? ((latestPrice - Number(h.avgPrice)) / Number(h.avgPrice)) * 100
          : 0,
      thesis: tradePlan?.thesis ?? 'Active holding thesis',
      stopLoss: tradePlan ? Number(tradePlan.stopLoss) : Number(h.stopLoss),
      targets: tradePlan?.targets
        ? (tradePlan.targets as number[])
        : Array.isArray(h.targets)
        ? (h.targets as number[])
        : [],
      entryDate: h.entryDate.toISOString(),
      daysHeld: Math.max(
        0,
        Math.floor((Date.now() - h.entryDate.getTime()) / (1000 * 60 * 60 * 24))
      ),
      unrealisedReturnPct:
        Number(h.avgPrice) > 0
          ? (latestPrice - Number(h.avgPrice)) / Number(h.avgPrice)
          : 0,
      alertCount: h.company.alerts.length,
      tradePlanId: tradePlan?.id,
    };
  });

  const portfolio: PortfolioSnapshot = {
    totalValue,
    cash: defaultCash,
    positions,
    sectorExposure,
    asOfDate: new Date().toISOString(),
  };

  // 4. Enrich each position with calculatePositionPnL and evaluateSellDecision
  const enrichedPositions = holdings.map((h, index) => {
    const pos = positions[index]!;
    const tradePlan = h.company.tradePlans[0];
    const latestPrice = pos.currentPrice;

    // Filter journal transactions for this company
    const txs = journalEntries
      .filter((j) => j.tradePlanId === tradePlan?.id)
      .map((j) => ({
        id: j.id,
        action: j.action as 'buy' | 'trim' | 'sell',
        quantity: Number(j.quantity),
        price: Number(j.price),
        fees: Number(j.fees),
        taxes: Number(j.taxes),
        date: j.date.toISOString(),
      }));

    // If no journal entries exist yet, synthesize a single initial buy transaction from holding
    if (txs.length === 0) {
      txs.push({
        id: `tx-init-${h.id}`,
        action: 'buy',
        quantity: Number(h.quantity),
        price: Number(h.avgPrice),
        fees: 0,
        taxes: 0,
        date: h.entryDate.toISOString(),
      });
    }

    const pnlResult = calculatePositionPnL(
      txs as any,
      latestPrice,
      h.symbol
    );

    const activeAlerts: Alert[] = h.company.alerts.map((a) => ({
      id: a.id,
      companyId: a.companyId ?? undefined,
      type: a.type as Alert['type'],
      severity: a.severity as Alert['severity'],
      message: a.message,
      triggeredAt: a.triggeredAt.toISOString(),
      data: (a.data ?? {}) as Record<string, unknown>,
      relatedTradePlanId: a.relatedTradePlanId ?? undefined,
    }));

    // Generate alerts dynamically if price breached stop or target
    const dynamicAlerts = evaluateAlerts({
      positions: [pos],
      portfolio,
      currentPrices: { [pos.symbol]: latestPrice },
    });

    const combinedAlerts = [...activeAlerts, ...dynamicAlerts];

    // Evaluate Sell Decision Framework
    const sellDecision = evaluateSellDecision({
      alerts: combinedAlerts,
      position: pos,
      portfolio,
    });

    return {
      id: h.id,
      companyId: h.companyId,
      symbol: h.symbol,
      companyName: h.company.name,
      sector: h.sector,
      quantity: Number(h.quantity),
      avgPrice: Number(h.avgPrice),
      currentPrice: latestPrice,
      marketValue: Number(h.quantity) * latestPrice,
      stopLoss: pos.stopLoss,
      targets: pos.targets,
      entryDate: h.entryDate.toISOString(),
      daysHeld: pos.daysHeld,
      unrealisedPnl: pnlResult.unrealisedPnl,
      realisedPnl: pnlResult.realisedPnl,
      netPnl: pnlResult.netPnl,
      netReturnPct: Math.round(pnlResult.netReturnPct * 10000) / 100, // percentage e.g. 12.5%
      weightedAvgCostBasis: pnlResult.weightedAvgCostBasis,
      tradePlan: tradePlan
        ? {
            id: tradePlan.id,
            status: tradePlan.status,
            thesis: tradePlan.thesis,
            plannedLossAtStop: Number(tradePlan.plannedLossAtStop),
            riskBudget: Number(tradePlan.riskBudget),
          }
        : null,
      sellDecision: {
        decision: sellDecision.decision,
        recommendedAction: sellDecision.recommendedAction,
        trigger: sellDecision.trigger,
        reason: sellDecision.reason,
      },
      activeAlertsCount: combinedAlerts.length,
      alerts: combinedAlerts.slice(0, 3).map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        message: a.message,
      })),
    };
  });

  return createSuccessResponse(enrichedPositions, requestId);
});
