/**
 * Stage D Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * pure TypeScript valuation engine (scoreStageD from @stock-assistant/core).
 *
 * Maps DB FinancialStatement / PriceBar rows into StageDInput, preserving nulls
 * for missing metrics (never coercing null to 0 where the type allows), applies
 * user valuation overrides, executes scoreStageD(), and returns the enriched
 * result for persistence by the API route.
 */

import { prisma } from '@stock-assistant/db';
import {
  scoreStageD,
  findIndustryBenchmark,
  type StageDInput,
  type StageDOutput,
  type StageDConfig,
  type DataProvenance,
} from '@stock-assistant/core';

export interface StageDRunnerParams {
  userId: string;
  companyId?: string;
  symbol?: string;
  marketPrice?: number;
  selectedFairPE?: number;
  selectedFairPB?: number;
  assumedExitPE?: number;
  discountRate?: number;
  terminalGrowthRate?: number;
  marginOfSafetyPct?: number;
  primaryMethod?: 'PE' | 'PEG' | 'PB' | 'DCF';
}

export interface StageDRunnerResult {
  input: StageDInput;
  output: StageDOutput;
  company: { id: string; symbol: string; name: string; sector: string };
  annualStatements: Array<Record<string, unknown>>;
  priceBar: Record<string, unknown> | null;
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
  unit: 'CRORE',
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

function safeRatio(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0 || den < 0) return null;
  return num / den;
}

function cagr(first: number | null, last: number | null, periods: number): number | null {
  if (first === null || last === null || first <= 0 || periods <= 0) return null;
  return Math.pow(last / first, 1 / periods) - 1;
}

export async function runStageDForCompany(params: StageDRunnerParams): Promise<StageDRunnerResult> {
  const {
    userId,
    companyId,
    symbol,
    marketPrice: overrideMarketPrice,
    selectedFairPE,
    selectedFairPB,
    assumedExitPE,
    discountRate,
    terminalGrowthRate,
    marginOfSafetyPct,
    primaryMethod,
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

  // --- Fetch annual financial statements (chronological, oldest first) -------
  const annualStatements = await prisma.financialStatement.findMany({
    where: { companyId: company.id, periodType: 'Annual' },
    orderBy: { fiscalYear: 'asc' },
    take: 10,
  });

  // --- Fetch latest price bar ------------------------------------------------
  const priceBar = await prisma.priceBar.findFirst({
    where: { companyId: company.id },
    orderBy: { date: 'desc' },
  });

  const latest = annualStatements[annualStatements.length - 1] as
    | Record<string, unknown>
    | undefined;
  const dec = (v: unknown) => toDecimalNumber(v);

  // --- Latest FY values ------------------------------------------------------
  const epsLatest = dec(latest?.eps);
  const bookValueLatest = dec(latest?.bookValuePerShare);
  const sharesLatest = dec(latest?.sharesOutstanding);
  const totalDebtLatest = dec(latest?.totalDebt);
  const revenueLatest = dec(latest?.revenue);
  const fcfLatest = dec(latest?.fcf);

  // --- Revenue CAGR (historical growth) --------------------------------------
  const revenueValues = annualStatements.map((s) => dec(s.revenue));
  const firstRev = revenueValues[0];
  const lastRev = revenueValues[revenueValues.length - 1];
  const periods = revenueValues.length > 1 ? revenueValues.length - 1 : 0;
  const historicalGrowth = cagr(firstRev ?? null, lastRev ?? null, periods);

  // --- Market price resolution -----------------------------------------------
  const latestClose = priceBar ? toDecimalNumber(priceBar.close) : null;
  const marketPrice =
    overrideMarketPrice !== undefined
      ? overrideMarketPrice
      : latestClose ?? 0;

  // --- Industry P/E ratio ----------------------------------------------------
  const sectorForBenchmark = company.sector;
  const benchmark = findIndustryBenchmark(sectorForBenchmark);
  const industryPeRatio =
    selectedFairPE ?? benchmark?.peMedian ?? null;

  // --- Build StageDFinancials ------------------------------------------------
  const financials: StageDInput['financials'] = {
    eps: {
      reported: epsLatest ?? 0,
      ...(epsLatest !== null ? { normalised: epsLatest } : {}),
      ...(fcfLatest !== null ? { forecast: epsLatest as number } : {}),
    },
    bookValuePerShare: bookValueLatest ?? 0,
    fcf: revenueValues.map((v) => v ?? 0),
    netDebt: totalDebtLatest ?? 0,
    sharesOutstanding: sharesLatest ?? 0,
    industryPeRatio: industryPeRatio ?? 0,
    ...(historicalGrowth !== null
      ? {
          growthRate: {
            historical: historicalGrowth,
            ...(assumedExitPE !== null ? { forward: historicalGrowth } : {}),
          },
        }
      : {}),
    ...(discountRate !== undefined || terminalGrowthRate !== undefined
      ? {
          dcfInputs: {
            horizon: 5,
            wacc: discountRate ?? 0.1,
            terminalGrowth: terminalGrowthRate ?? 0.03,
          },
        }
      : {}),
  };

  // --- Build StageDInput -----------------------------------------------------
  const input: StageDInput = {
    companyId: company.id,
    asOfDate: new Date().toISOString(),
    marketPrice,
    financials,
    sector: company.sector,
    businessModel: company.sector,
    dataProvenance: {
      source: 'postgresql',
      fetchedAt: new Date().toISOString(),
      reportedPeriod: (latest?.reportedPeriod as string) ?? 'FY_LATEST',
      currency: 'INR' as const,
      unit: 'CRORE' as const,
      adjustmentStatus: 'reported' as const,
      quality: latest ? 'verified' : 'missing',
      isMissing: !latest,
    } as DataProvenance,
    dataSnapshotId: undefined,
    ...(selectedFairPE !== undefined ? { selectedFairPE } : {}),
    ...(selectedFairPB !== undefined ? { selectedFairPB } : {}),
    ...(assumedExitPE !== undefined ? { assumedExitPE } : {}),
    ...(marginOfSafetyPct !== undefined ? { marginOfSafety: marginOfSafetyPct / 100 } : {}),
    ...(primaryMethod !== undefined ? { primaryMethodOverride: primaryMethod } : {}),
  };

  // --- Execute scoring engine ------------------------------------------------
  const config: StageDConfig = { ruleSetVersion: 'stage-d-v1.0' };
  const output = scoreStageD(input, config);

  return {
    input,
    output,
    company: {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
    },
    annualStatements: annualStatements as Array<Record<string, unknown>>,
    priceBar: (priceBar as Record<string, unknown> | null) ?? null,
  };
}
