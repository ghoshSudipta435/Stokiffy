import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import { CreateTradePlanRequestSchema } from '@stock-assistant/contracts';
import { runStageFForCompany } from '@/lib/services/stage-f-runner';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const companyId = req.nextUrl.searchParams.get('companyId') || undefined;

  const plans = await prisma.tradePlan.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      company: {
        select: { id: true, symbol: true, name: true, sector: true },
      },
      overrides: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return createSuccessResponse(plans, requestId);
});

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = CreateTradePlanRequestSchema.parse(body);

  // 1. Run deterministic Stage F risk & position sizing engine
  const runnerResult = await runStageFForCompany({
    userId,
    companyId: parsed.companyId,
    entryPrice: parsed.entryPrice,
    stopPrice: parsed.stopPrice,
    thesis: parsed.thesis,
    invalidationCondition: parsed.invalidationCondition,
    expectedHoldingPeriod: parsed.expectedHoldingPeriod,
    entryRationale: parsed.entryRationale,
    targets: parsed.targets,
    requestedQuantity: parsed.requestedQuantity,
    riskPercentage: parsed.riskPercentage,
    overrides: Array.isArray(body.overrides) ? body.overrides : undefined,
  });

  // 2. Persist TradePlan and optional Overrides inside an atomic transaction
  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.tradePlan.create({
      data: {
        companyId: parsed.companyId,
        userId,
        symbol: runnerResult.company.symbol,
        thesis: parsed.thesis,
        expectedHoldingPeriod: parsed.expectedHoldingPeriod ?? '3-6 months',
        entryRationale: parsed.entryRationale ?? parsed.thesis,
        entryZoneLow: runnerResult.output.tradePlan.entryZone.low,
        entryZoneHigh: runnerResult.output.tradePlan.entryZone.high,
        stopLoss: runnerResult.output.tradePlan.stopLoss,
        targets: runnerResult.output.tradePlan.targets,
        positionSize: runnerResult.output.positionSizing.adjustedQuantity,
        entryPriceEst: runnerResult.output.positionSizing.entryPriceEst,
        riskBudget: runnerResult.output.positionSizing.riskBudget,
        plannedLossAtStop: runnerResult.output.positionSizing.plannedLossAtStop,
        portfolioExposurePct: runnerResult.output.positionSizing.postTradeStockExposurePct,
        sectorExposurePct: runnerResult.output.positionSizing.postTradeSectorExposurePct,
        cashRemaining: runnerResult.output.positionSizing.cashRemaining,
        status: runnerResult.output.tradePlan.status,
        blocked: runnerResult.output.blocked,
        ruleSetVersion: runnerResult.output.ruleSetVersion,
        valuationMaxBuyPrice: runnerResult.input.valuationMaxBuyPrice ?? 0,
        technicalSetupId: runnerResult.output.tradePlan.technicalSetupId,
        createdBy: userId,
        ...(runnerResult.output.tradePlan.overrides.length > 0
          ? {
              overrides: {
                create: runnerResult.output.tradePlan.overrides.map((o) => ({
                  flagId: o.flagId,
                  reason: o.reason,
                  overriddenBy: o.overriddenBy,
                  beforeState: (o.beforeState ?? {}) as any,
                  afterState: (o.afterState ?? {}) as any,
                })),
              },
            }
          : {}),
      },
      include: {
        company: {
          select: { id: true, symbol: true, name: true, sector: true },
        },
        overrides: true,
      },
    });

    await tx.auditEvent.create({
      data: {
        userId,
        action: 'CREATE_TRADE_PLAN',
        entityType: 'TradePlan',
        entityId: created.id,
        reason: `Created trade plan for ${runnerResult.company.symbol} (status: ${created.status}, blocked: ${created.blocked})`,
        afterState: {
          planId: created.id,
          symbol: created.symbol,
          status: created.status,
          blocked: created.blocked,
          positionSize: Number(created.positionSize),
          riskBudget: Number(created.riskBudget),
        },
      },
    });

    return created;
  });

  return createSuccessResponse(
    {
      tradePlan: plan,
      stageF: runnerResult.output,
    },
    requestId,
    201
  );
});
