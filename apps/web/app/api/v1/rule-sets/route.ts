import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, RuleSetRepository } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

const DEFAULT_RISK_LIMITS = {
  riskBudgetPerTradePct: 1.0,
  maxStockExposurePct: 10.0,
  maxSectorExposurePct: 30.0,
  minRiskReward: 1.5,
  maxPositionPctOfADV: 5.0,
  lotSize: 1,
  cashBufferPct: 5.0,
  estimatedFeesPct: 0.1,
  slippagePct: 0.2,
};

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  await requireAuth(req);

  const repo = new RuleSetRepository(prisma);
  const active = await repo.getActivePublished();
  const allVersions = await repo.listVersions();

  const activeConfig = (active?.configJson as Record<string, unknown>) ?? {};
  const activeRiskLimits = (activeConfig.riskLimits as Record<string, unknown>) ?? {};

  const benchmarks =
    active?.benchmarks.map((b) => ({
      id: b.id,
      industry: b.industry,
      opmMinPct: b.opmMinPct ? Number(b.opmMinPct) : null,
      opmMaxPct: b.opmMaxPct ? Number(b.opmMaxPct) : null,
      typicalPE: b.typicalPE ? Number(b.typicalPE) : null,
      minRoaPct: b.minRoaPct ? Number(b.minRoaPct) : null,
      sourceNote: b.sourceNote,
    })) ?? [];

  const data = {
    activeRuleSet: active
      ? {
          id: active.id,
          version: active.version,
          name: active.name,
          status: active.status,
          riskLimits: { ...DEFAULT_RISK_LIMITS, ...activeRiskLimits },
          benchmarks,
          publishedAt: active.publishedAt ? active.publishedAt.toISOString() : null,
          createdAt: active.createdAt.toISOString(),
          updatedAt: active.updatedAt.toISOString(),
        }
      : null,
    versions: allVersions.map((v) => ({
      id: v.id,
      version: v.version,
      name: v.name,
      status: v.status,
      publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
    })),
  };

  return createSuccessResponse(data, requestId);
});
