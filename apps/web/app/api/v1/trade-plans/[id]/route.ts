import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import { UpdateTradePlanRequestSchema } from '@stock-assistant/contracts';
import { runStageFForCompany } from '@/lib/services/stage-f-runner';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const plan = await prisma.tradePlan.findFirst({
    where: { id, userId },
    include: {
      company: {
        select: { id: true, symbol: true, name: true, sector: true },
      },
      overrides: true,
      journal: true,
    },
  });

  if (!plan) {
    return createErrorResponse('RESOURCE_NOT_FOUND', `Trade plan ${id} not found`, 404, requestId);
  }

  return createSuccessResponse(plan, requestId);
});

export const PATCH = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const plan = await prisma.tradePlan.findFirst({
    where: { id, userId },
    include: { overrides: true },
  });

  if (!plan) {
    return createErrorResponse('RESOURCE_NOT_FOUND', `Trade plan ${id} not found`, 404, requestId);
  }

  const body = await req.json();
  const parsed = UpdateTradePlanRequestSchema.parse(body);

  // If parameters (entry/stop/thesis) or overrides are modified, re-run Stage F risk checks
  const needsRescoring =
    (parsed.entryPrice !== undefined && parsed.entryPrice !== Number(plan.entryPriceEst)) ||
    (parsed.stopPrice !== undefined && parsed.stopPrice !== Number(plan.stopLoss)) ||
    parsed.overrides !== undefined;

  let updatedPositionSize = Number(plan.positionSize);
  let updatedRiskBudget = Number(plan.riskBudget);
  let updatedLossAtStop = Number(plan.plannedLossAtStop);
  let updatedStockExp = Number(plan.portfolioExposurePct);
  let updatedSectorExp = Number(plan.sectorExposurePct);
  let updatedCashRemaining = Number(plan.cashRemaining);
  let updatedBlocked = plan.blocked;
  let updatedStatus = parsed.status ?? plan.status;
  let newOverridesToCreate: any[] = [];

  if (needsRescoring) {
    const entryPrice = parsed.entryPrice ?? Number(plan.entryPriceEst);
    const stopPrice = parsed.stopPrice ?? Number(plan.stopLoss);

    const runnerResult = await runStageFForCompany({
      userId,
      companyId: plan.companyId,
      entryPrice,
      stopPrice,
      thesis: parsed.thesis ?? plan.thesis,
      overrides: parsed.overrides,
    });

    updatedPositionSize = runnerResult.output.positionSizing.adjustedQuantity;
    updatedRiskBudget = runnerResult.output.positionSizing.riskBudget;
    updatedLossAtStop = runnerResult.output.positionSizing.plannedLossAtStop;
    updatedStockExp = runnerResult.output.positionSizing.postTradeStockExposurePct;
    updatedSectorExp = runnerResult.output.positionSizing.postTradeSectorExposurePct;
    updatedCashRemaining = runnerResult.output.positionSizing.cashRemaining;
    updatedBlocked = runnerResult.output.blocked;

    if (!parsed.status) {
      updatedStatus = runnerResult.output.tradePlan.status;
    }

    newOverridesToCreate = runnerResult.output.tradePlan.overrides;
  }

  // Update inside a transaction with audit event
  const updated = await prisma.$transaction(async (tx) => {
    // If overrides provided during update, create them
    if (newOverridesToCreate.length > 0) {
      for (const o of newOverridesToCreate) {
        await tx.tradePlanOverride.create({
          data: {
            tradePlanId: plan.id,
            flagId: o.flagId,
            reason: o.reason,
            overriddenBy: o.overriddenBy,
            beforeState: (o.beforeState ?? {}) as any,
            afterState: (o.afterState ?? {}) as any,
          },
        });
      }
    }

    const saved = await tx.tradePlan.update({
      where: { id },
      data: {
        ...(parsed.status ? { status: updatedStatus } : { status: updatedStatus }),
        ...(parsed.thesis ? { thesis: parsed.thesis } : {}),
        ...(parsed.entryPrice ? { entryPriceEst: parsed.entryPrice } : {}),
        ...(parsed.stopPrice ? { stopLoss: parsed.stopPrice } : {}),
        positionSize: updatedPositionSize,
        riskBudget: updatedRiskBudget,
        plannedLossAtStop: updatedLossAtStop,
        portfolioExposurePct: updatedStockExp,
        sectorExposurePct: updatedSectorExp,
        cashRemaining: updatedCashRemaining,
        blocked: updatedBlocked,
        ...(parsed.executedAt ? { executedAt: new Date(parsed.executedAt) } : {}),
        ...(parsed.executedPrice ? { executedPrice: parsed.executedPrice } : {}),
        ...(parsed.executedQuantity ? { executedQuantity: parsed.executedQuantity } : {}),
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
        action: 'UPDATE_TRADE_PLAN',
        entityType: 'TradePlan',
        entityId: saved.id,
        reason: `Updated trade plan for ${saved.symbol} (status: ${saved.status}, blocked: ${saved.blocked})`,
        afterState: {
          planId: saved.id,
          status: saved.status,
          blocked: saved.blocked,
          positionSize: Number(saved.positionSize),
        },
      },
    });

    return saved;
  });

  return createSuccessResponse(updated, requestId);
});
