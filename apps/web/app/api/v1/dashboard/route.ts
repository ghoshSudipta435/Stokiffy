import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  // 1. Fetch tracked companies for the user with latest analysis run & trade plan
  const companies = await prisma.company.findMany({
    where: { userId },
    include: {
      analysisRuns: {
        where: { userId },
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
      tradePlans: {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { symbol: 'asc' },
  });

  // 2. Compute pipeline funnel counts across Stages A-G
  const allRuns = await prisma.analysisRun.findMany({
    where: { userId },
    select: {
      companyId: true,
      stage: true,
      verdict: true,
    },
  });

  const stageACompanies = new Set(
    allRuns.filter((r) => r.stage === 'A' && r.verdict === 'PASS').map((r) => r.companyId)
  );
  const stageBCompanies = new Set(
    allRuns.filter((r) => r.stage === 'B' && r.verdict === 'PASS').map((r) => r.companyId)
  );
  const stageCCompanies = new Set(
    allRuns.filter((r) => r.stage === 'C' && r.verdict === 'PASS').map((r) => r.companyId)
  );
  const stageDCompanies = new Set(
    allRuns.filter((r) => r.stage === 'D' && r.verdict === 'PASS').map((r) => r.companyId)
  );
  const stageECompanies = new Set(
    allRuns.filter((r) => r.stage === 'E' && r.verdict === 'PASS').map((r) => r.companyId)
  );

  const tradePlans = await prisma.tradePlan.findMany({
    where: { userId, status: { in: ['ready', 'executed'] } },
    select: { companyId: true },
  });
  const stageFCompanies = new Set(tradePlans.map((tp) => tp.companyId));

  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId },
    include: {
      company: {
        select: { symbol: true, name: true, sector: true },
      },
    },
  });
  const stageGCompanies = new Set(holdings.map((h) => h.companyId));

  const funnel = {
    totalTracked: companies.length,
    stageA: stageACompanies.size,
    stageB: stageBCompanies.size,
    stageC: stageCCompanies.size,
    stageD: stageDCompanies.size,
    stageE: stageECompanies.size,
    stageF: stageFCompanies.size,
    stageG: stageGCompanies.size,
  };

  // 3. Fetch top 5 recent unacknowledged alerts
  const recentAlerts = await prisma.alert.findMany({
    where: { userId, acknowledgedAt: null },
    orderBy: { triggeredAt: 'desc' },
    take: 5,
  });

  // 4. Portfolio holding summary
  const totalMarketValue = holdings.reduce((sum, h) => sum + Number(h.marketValue), 0);
  const totalInvested = holdings.reduce(
    (sum, h) => sum + Number(h.avgPrice) * Number(h.quantity),
    0
  );
  const totalUnrealisedPnl = holdings.reduce((sum, h) => sum + Number(h.unrealisedPnl), 0);
  const totalUnrealisedPnlPct =
    totalInvested > 0 ? (totalUnrealisedPnl / totalInvested) * 100 : 0;
  const cashBuffer = 1000000; // Baseline workstation available cash
  const totalPortfolioValue = totalMarketValue + cashBuffer;
  const cashPct = totalPortfolioValue > 0 ? (cashBuffer / totalPortfolioValue) * 100 : 100;
  const exposurePct =
    totalPortfolioValue > 0 ? (totalMarketValue / totalPortfolioValue) * 100 : 0;

  const portfolioSummary = {
    totalValue: totalPortfolioValue,
    investedCapital: totalInvested,
    marketValue: totalMarketValue,
    cash: cashBuffer,
    cashPct: Math.round(cashPct * 100) / 100,
    exposurePct: Math.round(exposurePct * 100) / 100,
    unrealisedPnl: totalUnrealisedPnl,
    unrealisedPnlPct: Math.round(totalUnrealisedPnlPct * 100) / 100,
    positionsCount: holdings.length,
  };

  // 5. Enriched tracked equities list
  const trackedEquities = companies.map((c) => {
    const latestRun = c.analysisRuns[0];
    const latestPlan = c.tradePlans[0];
    return {
      companyId: c.id,
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      latestStage: latestRun?.stage ?? null,
      latestVerdict: latestRun?.verdict ?? 'PENDING',
      latestScore: latestRun?.totalPoints ? Number(latestRun.totalPoints) : null,
      maxScore: latestRun?.maxPoints ? Number(latestRun.maxPoints) : null,
      calculatedAt: latestRun?.calculatedAt ? latestRun.calculatedAt.toISOString() : null,
      hasTradePlan: Boolean(latestPlan),
      tradePlanStatus: latestPlan?.status ?? null,
      isHolding: stageGCompanies.has(c.id),
    };
  });

  return createSuccessResponse(
    {
      funnel,
      recentAlerts: recentAlerts.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        type: a.type,
        severity: a.severity,
        message: a.message,
        triggeredAt: a.triggeredAt.toISOString(),
        data: a.data,
      })),
      portfolioSummary,
      trackedEquities,
    },
    requestId
  );
});
