/**
 * Stage E Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * pure TypeScript technical analysis engine (scoreStageE from @stock-assistant/core).
 *
 * Maps DB PriceBar rows into StageEInput, defaults valuationMaxBuyPrice /
 * selectedFairValue from the latest persisted AnalysisStageD when not overridden,
 * executes scoreStageE(), and returns the enriched result for persistence by the
 * API route.
 */

import { prisma } from '@stock-assistant/db';
import {
  scoreStageE,
  type StageEInput,
  type StageEOutput,
  type StageEConfig,
  type DataProvenance,
} from '@stock-assistant/core';

export interface StageERunnerParams {
  userId: string;
  companyId?: string;
  symbol?: string;
  valuationMaxBuyPrice?: number;
  targetPrice?: number;
  minRiskReward?: number;
  buyZoneTolerancePct?: number;
}

export interface StageERunnerResult {
  input: StageEInput;
  output: StageEOutput;
  company: { id: string; symbol: string; name: string; sector: string };
  priceBars: Array<Record<string, unknown>>;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const MISSING_PROVENANCE: Record<string, unknown> = {
  source: 'postgresql',
  fetchedAt: new Date().toISOString(),
  reportedPeriod: 'FY_UNKNOWN',
  currency: 'INR',
  unit: 'RAW',
  adjustmentStatus: 'reported',
  quality: 'missing',
  isMissing: true,
};

function toDecimalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function runStageEForCompany(params: StageERunnerParams): Promise<StageERunnerResult> {
  const {
    userId,
    companyId,
    symbol,
    valuationMaxBuyPrice: overrideMaxBuyPrice,
    targetPrice: overrideTargetPrice,
    minRiskReward,
    buyZoneTolerancePct,
  } = params;

  // --- Resolve company -------------------------------------------------------
  let company;
  if (companyId) {
    company = await prisma.company.findFirst({ where: { id: companyId, userId } });
  } else if (symbol) {
    company = await prisma.company.findFirst({
      where: { symbol: { equals: symbol, mode: 'insensitive' }, userId },
    });
  }
  if (!company) {
    throw new Error(`Company not found for user ${userId}`);
  }

  // --- Fetch latest Stage D valuation (for max buy price / fair value) -------
  const latestStageD = await prisma.analysisStageD.findFirst({
    where: { analysisRun: { companyId: company.id } },
    orderBy: { analysisRun: { calculatedAt: 'desc' } },
  });

  const defaultMaxBuyPrice = latestStageD
    ? toDecimalNumber(latestStageD.maxBuyPrice)
    : null;
  const defaultFairValue = latestStageD
    ? toDecimalNumber(latestStageD.fairValue)
    : null;

  // --- Fetch historical price bars (chronological, oldest first) -------------
  const priceBars = await prisma.priceBar.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'asc' },
  });

  const adjustedOhlcvDaily = (priceBars as Array<Record<string, unknown>>).map(
    (bar) => ({
      date: new Date(bar.date as unknown as Date).toISOString(),
      open: toDecimalNumber(bar.open) ?? 0,
      high: toDecimalNumber(bar.high) ?? 0,
      low: toDecimalNumber(bar.low) ?? 0,
      close: toDecimalNumber(bar.close) ?? 0,
      volume: Number(bar.volume ?? 0),
      adjusted: Boolean(bar.adjusted),
    })
  );

  const latestBar = adjustedOhlcvDaily[adjustedOhlcvDaily.length - 1];
  const currentPrice = latestBar?.close ?? 0;

  // --- Resolve valuation max buy price / fair value --------------------------
  const valuationMaxBuyPrice =
    overrideMaxBuyPrice !== undefined
      ? overrideMaxBuyPrice
      : defaultMaxBuyPrice ?? null;
  const selectedFairValue =
    overrideTargetPrice !== undefined
      ? overrideTargetPrice
      : defaultFairValue ?? null;

  // --- Build StageEInput -----------------------------------------------------
  const input: StageEInput = {
    companyId: company.id,
    asOfDate: new Date().toISOString(),
    adjustedOhlcvDaily,
    ...(adjustedOhlcvDaily.length > 0 ? {} : {}),
    ...(valuationMaxBuyPrice !== null ? { valuationMaxBuyPrice } : {}),
    ...(selectedFairValue !== null ? { selectedFairValue } : {}),
    ...(minRiskReward !== undefined ? { minRiskReward } : {}),
    ...(buyZoneTolerancePct !== undefined ? { buyZoneTolerancePct } : {}),
    dataProvenance: {
      source: 'postgresql',
      fetchedAt: new Date().toISOString(),
      reportedPeriod: latestBar?.date ?? 'FY_UNKNOWN',
      currency: 'INR' as const,
      unit: 'RAW' as const,
      adjustmentStatus: 'reported' as const,
      quality: adjustedOhlcvDaily.length > 0 ? 'verified' : 'missing',
      isMissing: adjustedOhlcvDaily.length === 0,
    } as DataProvenance,
    dataSnapshotId: undefined,
  };

  // --- Execute scoring engine ------------------------------------------------
  const config: StageEConfig = { ruleSetVersion: 'stage-e-v1.0' };
  const output = scoreStageE(input, config);

  return {
    input,
    output,
    company: {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
    },
    priceBars: priceBars as Array<Record<string, unknown>>,
  };
}
