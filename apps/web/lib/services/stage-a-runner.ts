/**
 * Stage A Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * pure TypeScript scoring engine (scoreStageA from @stock-assistant/core).
 *
 * Maps DB FinancialStatement / PriceBar rows into StageAInput, preserving nulls
 * for missing metrics (never coercing null to 0), executes scoreStageA(), and
 * returns the enriched result for persistence by the API route.
 */

import { prisma } from '@stock-assistant/db';
import {
  scoreStageA,
  findIndustryBenchmark,
  type StageAInput,
  type StageAOutput,
  type StageAConfig,
  type Sector,
  type DataProvenance,
} from '@stock-assistant/core';

export interface StageARunnerParams {
  userId: string;
  companyId?: string;
  symbol?: string;
  marketPrice?: number;
  industryPE?: number;
  industry?: string;
}

export interface StageARunnerResult {
  input: StageAInput;
  output: StageAOutput;
  company: { id: string; symbol: string; name: string; sector: string };
  statements: Array<Record<string, unknown>>;
  priceBar: Record<string, unknown> | null;
  benchmark: { industry: string; opmMin?: number; peMedian?: number; minRoa?: number } | null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const MISSING_PROVENANCE: DataProvenance = {
  source: 'postgresql',
  fetchedAt: new Date().toISOString(),
  reportedPeriod: 'FY_UNKNOWN',
  currency: 'INR' as const,
  unit: 'CRORE' as const,
  adjustmentStatus: 'reported' as const,
  quality: 'missing' as const,
  isMissing: true,
};

function metric(
  value: number | null,
  reportedPeriod: string
): { value: number | null; provenance: DataProvenance } {
  const isMissing = value === null;
  return {
    value,
    provenance: {
      source: 'postgresql',
      fetchedAt: new Date().toISOString(),
      reportedPeriod,
      currency: 'INR' as const,
      unit: 'CRORE' as const,
      adjustmentStatus: 'reported' as const,
      quality: isMissing ? ('missing' as const) : ('verified' as const),
      isMissing,
    },
  };
}

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

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function mapSectorToCore(dbSector: string): Sector {
  const s = dbSector.toLowerCase();
  if (s.includes('nbfc')) return 'nbfc';
  if (s.includes('bank') || s === 'financial services') return 'bank';
  if (s.includes('insurance')) return 'insurance';
  if (s.includes('financial')) return 'other-financial';
  return 'non-financial';
}

export async function runStageAForCompany(params: StageARunnerParams): Promise<StageARunnerResult> {
  const { userId, companyId, symbol, marketPrice, industryPE, industry } = params;

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

  // --- Fetch 5Y annual financial statements ---------------------------------
  const statements = await prisma.financialStatement.findMany({
    where: { companyId: company.id, periodType: 'Annual' },
    orderBy: { fiscalYear: 'desc' },
    take: 5,
  });

  // --- Fetch latest price bar ------------------------------------------------
  const priceBar = await prisma.priceBar.findFirst({
    where: { companyId: company.id },
    orderBy: { date: 'desc' },
  });

  const latest = statements[0] as Record<string, unknown> | undefined;
  const prior = statements[1] as Record<string, unknown> | undefined;
  const fiveYearsAgo = statements.length > 0 ? (statements[statements.length - 1] as Record<string, unknown>) : null;

  const latestPeriod = (latest?.reportedPeriod as string) ?? 'FY_LATEST';
  const priorPeriod = (prior?.reportedPeriod as string) ?? 'FY_PRIOR';
  const fiveYearPeriod = (fiveYearsAgo?.reportedPeriod as string) ?? 'FY_5Y_AGO';

  const dec = (v: unknown) => toDecimalNumber(v);

  // --- Latest FY raw values --------------------------------------------------
  const revLatest = dec(latest?.revenue);
  const npLatest = dec(latest?.netProfit);
  const opLatest = dec(latest?.operatingProfit);
  const assetsLatest = dec(latest?.totalAssets);
  const liabLatest = dec(latest?.totalLiabilities);
  const equityLatest = dec(latest?.totalEquity);
  const debtLatest = dec(latest?.totalDebt);
  const caLatest = dec(latest?.currentAssets);
  const clLatest = dec(latest?.currentLiabilities);
  const intLatest = dec(latest?.interestExpense);
  const ebitLatest = dec(latest?.ebit);
  const epsLatest = dec(latest?.eps);

  // --- Prior FY raw values (for growth) --------------------------------------
  const revPrior = dec(prior?.revenue);
  const npPrior = dec(prior?.netProfit);

  // --- 5Y ago raw values (for CAGR) ------------------------------------------
  const rev5y = dec(fiveYearsAgo?.revenue);
  const np5y = dec(fiveYearsAgo?.netProfit);

  // --- Computed ratios (latest FY) -------------------------------------------
  const roeLatest = safeRatio(npLatest, equityLatest);
  const roceLatest = safeRatio(ebitLatest, assetsLatest !== null && clLatest !== null ? assetsLatest - clLatest : null);
  const opmLatest = safeRatio(opLatest, revLatest);
  const roaLatest = safeRatio(npLatest, assetsLatest);

  // --- 5Y average ratios -----------------------------------------------------
  const roeValues: (number | null)[] = [];
  const roceValues: (number | null)[] = [];
  const opmValues: (number | null)[] = [];
  const roaValues: (number | null)[] = [];

  for (const s of statements as Array<Record<string, unknown>>) {
    const sNp = dec(s.netProfit);
    const sEq = dec(s.totalEquity);
    const sEbit = dec(s.ebit);
    const sAssets = dec(s.totalAssets);
    const sCl = dec(s.currentLiabilities);
    const sOp = dec(s.operatingProfit);
    const sRev = dec(s.revenue);

    roeValues.push(safeRatio(sNp, sEq));
    roceValues.push(safeRatio(sEbit, sAssets !== null && sCl !== null ? sAssets - sCl : null));
    opmValues.push(safeRatio(sOp, sRev));
    roaValues.push(safeRatio(sNp, sAssets));
  }

  const roe5yAvg = average(roeValues);
  const roce5yAvg = average(roceValues);
  const opm5yAvg = average(opmValues);
  const roa5yAvg = average(roaValues);

  // --- P/E ratio -------------------------------------------------------------
  const latestClose = priceBar ? toDecimalNumber(priceBar.close) : null;
  const effectiveMarketPrice = marketPrice !== undefined ? marketPrice : latestClose ?? null;
  const peRatio =
    epsLatest !== null && epsLatest !== 0 && effectiveMarketPrice !== null
      ? effectiveMarketPrice / epsLatest
      : null;

  // --- Industry benchmark ----------------------------------------------------
  const sectorForBenchmark = industry ?? company.sector;
  const resolvedBenchmark = industryPE !== undefined
    ? { industry: sectorForBenchmark, peMedian: industryPE }
    : findIndustryBenchmark(sectorForBenchmark);

  const industryPeRatio = industryPE !== undefined ? industryPE : (resolvedBenchmark?.peMedian ?? null);

  // --- Build StageAInput -----------------------------------------------------
  const coreSector: Sector = mapSectorToCore(company.sector);

  const dataProvenance: Record<string, DataProvenance> = {
    statements: {
      source: 'postgresql',
      fetchedAt: new Date().toISOString(),
      reportedPeriod: latestPeriod,
      currency: 'INR' as const,
      unit: 'CRORE' as const,
      adjustmentStatus: 'reported' as const,
      quality: latest ? 'verified' : 'missing',
      isMissing: !latest,
    },
    priceBar: priceBar
      ? {
          source: 'postgresql',
          fetchedAt: new Date(priceBar.date as unknown as Date).toISOString(),
          reportedPeriod: latestPeriod,
          currency: 'INR' as const,
          unit: 'RAW' as const,
          adjustmentStatus: 'reported' as const,
          quality: 'verified',
          isMissing: false,
        }
      : MISSING_PROVENANCE,
  };

  const input: StageAInput = {
    companyId: company.id,
    asOfDate: new Date().toISOString(),
    sector: coreSector,
    industry: industry ?? company.sector,
    dataProvenance,
    financials: {
      // Income statement
      revenue: metric(revLatest, latestPeriod),
      netProfit: metric(npLatest, latestPeriod),
      operatingProfit: metric(opLatest, latestPeriod),

      // Balance sheet
      totalAssets: metric(assetsLatest, latestPeriod),
      totalLiabilities: metric(liabLatest, latestPeriod),
      totalEquity: metric(equityLatest, latestPeriod),
      totalDebt: metric(debtLatest, latestPeriod),
      currentAssets: metric(caLatest, latestPeriod),
      currentLiabilities: metric(clLatest, latestPeriod),

      // Derived metrics
      interestExpense: metric(intLatest, latestPeriod),
      ebit: metric(ebitLatest, latestPeriod),
      eps: metric(epsLatest, latestPeriod),
      peRatio: metric(peRatio, latestPeriod),
      industryPeRatio: metric(industryPeRatio ?? null, latestPeriod),

      // Profitability ratios (objects with latestFy + avg5y)
      roe: {
        latestFy: metric(roeLatest, latestPeriod),
        avg5y: metric(roe5yAvg, fiveYearPeriod),
      },
      roce: {
        latestFy: metric(roceLatest, latestPeriod),
        avg5y: metric(roce5yAvg, fiveYearPeriod),
      },
      opm: {
        latestFy: metric(opmLatest, latestPeriod),
        avg5y: metric(opm5yAvg, fiveYearPeriod),
      },
      roa: {
        latestFy: metric(roaLatest, latestPeriod),
        avg5y: metric(roa5yAvg, fiveYearPeriod),
      },

      // Growth / historical metric extensions (engine computes YoY & CAGR)
      sales: {
        latestFy: metric(revLatest, latestPeriod),
        priorFy: metric(revPrior, priorPeriod),
        fy5yAgo: metric(rev5y, fiveYearPeriod),
      },
      profit: {
        latestFy: metric(npLatest, latestPeriod),
        priorFy: metric(npPrior, priorPeriod),
        fy5yAgo: metric(np5y, fiveYearPeriod),
      },
    },
    dataAvailability: undefined,
  };

  // --- Execute scoring engine ------------------------------------------------
  const config: StageAConfig = { ruleSetVersion: 'stage-a-v1.0' };
  const output = scoreStageA(input, config);

  return {
    input,
    output,
    company: {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
    },
    statements: statements as Array<Record<string, unknown>>,
    priceBar: (priceBar as Record<string, unknown> | null) ?? null,
    benchmark: resolvedBenchmark ?? null,
  };
}
