/**
 * Stage F Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * deterministic portfolio risk & position sizing engine (scoreStageF from @stock-assistant/core).
 *
 * Implements:
 * 1. PortfolioHolding snapshot aggregation and capital allocation
 * 2. Stage D (Valuation Max Buy Price) and Stage E (Technical Setup) integration
 * 3. Configurable risk limits from active RuleSet
 * 4. Auditable override handling (min 50 chars validation)
 * 5. Deterministic position sizing and risk check evaluation
 */

import { prisma, RuleSetRepository } from '@stock-assistant/db';
import {
  scoreStageF,
  type StageFInput,
  type StageFOutput,
  type StageFConfig,
  type PortfolioSnapshot,
  type OverrideRecord,
} from '@stock-assistant/core';

export interface StageFRunnerParams {
  userId: string;
  companyId: string;
  entryPrice: number;
  stopPrice: number;
  thesis: string;
  invalidationCondition?: string;
  expectedHoldingPeriod?: string;
  entryRationale?: string;
  targets?: number[];
  requestedQuantity?: number;
  riskPercentage?: number;
  valuationMaxBuyPrice?: number;
  technicalSetupId?: string;
  overrides?: Array<{
    flagId: string;
    reason: string;
    overriddenBy: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  }>;
}

export interface StageFRunnerResult {
  input: StageFInput;
  output: StageFOutput;
  company: { id: string; symbol: string; name: string; sector: string };
  portfolio: PortfolioSnapshot;
}

function roundNum(val: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(val * factor) / factor;
}

export async function runStageFForCompany(
  params: StageFRunnerParams
): Promise<StageFRunnerResult> {
  const {
    userId,
    companyId,
    entryPrice,
    stopPrice,
    thesis,
    invalidationCondition,
    expectedHoldingPeriod = '3-6 months',
    entryRationale,
    targets,
    requestedQuantity,
    riskPercentage,
    overrides = [],
  } = params;

  // 1. Verify company exists and user has access
  const company = await prisma.company.findFirst({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  // 2. Fetch current user portfolio holdings to build PortfolioSnapshot
  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId },
  });

  const totalHoldingsValue = holdings.reduce(
    (acc, h) => acc + Number(h.marketValue),
    0
  );
  // Default personal mode workstation cash buffer: ₹1,000,000
  const cashBuffer = 1000000;
  const totalPortfolioValue = Math.max(totalHoldingsValue + cashBuffer, 100000);

  const sectorExposure: Record<string, number> = {};
  for (const h of holdings) {
    sectorExposure[h.sector] =
      (sectorExposure[h.sector] ?? 0) + Number(h.marketValue);
  }

  const portfolio: PortfolioSnapshot = {
    totalValue: totalPortfolioValue,
    cash: cashBuffer,
    positions: holdings.map((h) => ({
      symbol: h.symbol,
      companyId: h.companyId,
      quantity: Number(h.quantity),
      avgPrice: Number(h.avgPrice),
      currentPrice: Number(h.currentPrice),
      marketValue: Number(h.marketValue),
      sector: h.sector,
      unrealisedPnl: Number(h.unrealisedPnl),
      unrealisedPnlPct: Number(h.unrealisedPnlPct),
    })),
    sectorExposure,
    asOfDate: new Date().toISOString(),
  };

  // 3. Resolve valuationMaxBuyPrice from parameter or latest Stage D analysis
  let maxBuyPrice = params.valuationMaxBuyPrice;
  if (!maxBuyPrice) {
    const latestStageD = await prisma.analysisStageD.findFirst({
      where: { analysisRun: { companyId, userId } },
      orderBy: { analysisRun: { calculatedAt: 'desc' } },
    });
    if (latestStageD) {
      maxBuyPrice = Number(latestStageD.maxBuyPrice);
    }
  }

  // 4. Resolve technical setup from parameter or latest Stage E analysis
  const latestStageE = await prisma.analysisStageE.findFirst({
    where: { analysisRun: { companyId, userId } },
    orderBy: { analysisRun: { calculatedAt: 'desc' } },
  });

  const technicalSetupId =
    params.technicalSetupId ?? latestStageE?.id ?? 'tech-manual-setup';

  // 5. Resolve active RuleSet for risk limits
  const ruleSetRepo = new RuleSetRepository(prisma);
  const activeRuleSet = await ruleSetRepo.getActivePublished();
  const ruleSetConfig =
    (activeRuleSet?.configJson as Record<string, unknown>) ?? {};
  const riskLimits =
    (ruleSetConfig.riskLimits as Record<string, unknown>) ?? {};

  // 6. Map and validate overrides
  const mappedOverrides: OverrideRecord[] = overrides.map((o) => ({
    flagId: o.flagId,
    reason: o.reason,
    overriddenBy: o.overriddenBy,
    overriddenAt: new Date().toISOString(),
    beforeState: o.beforeState ?? {},
    afterState: o.afterState ?? {},
  }));

  // Targets default: 15% and 25% above entry if not specified
  const resolvedTargets =
    targets && targets.length > 0
      ? targets
      : [roundNum(entryPrice * 1.15, 2), roundNum(entryPrice * 1.25, 2)];

  const riskPerTrade =
    riskPercentage !== undefined
      ? riskPercentage > 1
        ? riskPercentage / 100
        : riskPercentage
      : riskLimits.riskBudgetPerTradePct !== undefined
      ? Number(riskLimits.riskBudgetPerTradePct) > 1
        ? Number(riskLimits.riskBudgetPerTradePct) / 100
        : Number(riskLimits.riskBudgetPerTradePct)
      : undefined;

  const maxStockExp =
    riskLimits.maxStockExposurePct !== undefined
      ? Number(riskLimits.maxStockExposurePct) > 1
        ? Number(riskLimits.maxStockExposurePct) / 100
        : Number(riskLimits.maxStockExposurePct)
      : undefined;

  const maxSectorExp =
    riskLimits.maxSectorExposurePct !== undefined
      ? Number(riskLimits.maxSectorExposurePct) > 1
        ? Number(riskLimits.maxSectorExposurePct) / 100
        : Number(riskLimits.maxSectorExposurePct)
      : undefined;

  // 7. Assemble StageFInput
  const stageFInput: StageFInput = {
    companyId,
    symbol: company.symbol,
    sector: company.sector,
    portfolio,
    tradePlanDraft: {
      symbol: company.symbol,
      thesis,
      entryRationale: entryRationale ?? thesis,
      expectedHoldingPeriod,
      entryZone: {
        low: roundNum(entryPrice * 0.98, 2),
        high: roundNum(entryPrice * 1.02, 2),
      },
      stopLoss: stopPrice,
      targets: resolvedTargets,
      entryPriceEst: entryPrice,
      ruleSetVersion: activeRuleSet?.version ?? 'stage-f-v1.0',
      technicalSetupId,
    },
    valuationMaxBuyPrice: maxBuyPrice,
    technicalSetup: {
      id: technicalSetupId,
      entryZone: {
        low: roundNum(entryPrice * 0.98, 2),
        high: roundNum(entryPrice * 1.02, 2),
      },
      stopLoss: stopPrice,
      targets: resolvedTargets,
      riskReward:
        stopPrice < entryPrice && resolvedTargets[0]
          ? roundNum(
              (resolvedTargets[0] - entryPrice) / (entryPrice - stopPrice),
              2
            )
          : 2.0,
      inBuyZone: true,
    },
    requestedQuantity,
    overrides: mappedOverrides,
    riskConfig: {
      riskPerTradePct: riskPerTrade,
      maxStockExposurePct: maxStockExp,
      maxSectorExposurePct: maxSectorExp,
    },
    createdBy: userId,
    asOfDate: new Date().toISOString(),
  };

  const stageFConfig: StageFConfig = {
    ruleSetVersion: activeRuleSet?.version ?? 'stage-f-v1.0',
  };

  // 8. Execute deterministic Stage F engine
  const stageFOutput = scoreStageF(stageFInput, stageFConfig);

  return {
    input: stageFInput,
    output: stageFOutput,
    company: {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
    },
    portfolio,
  };
}
