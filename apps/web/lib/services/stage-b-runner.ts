/**
 * Stage B Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * pure TypeScript scoring engine (scoreStageB from @stock-assistant/core).
 *
 * Maps DB FinancialStatement (annual + quarterly) / Shareholding rows into
 * StageBInput, preserving nulls for missing metrics (never coercing null to 0),
 * executes scoreStageB(), and returns the enriched result for persistence by
 * the API route.
 */

import { prisma } from '@stock-assistant/db';
import {
  scoreStageB,
  type StageBInput,
  type StageBOutput,
  type Sector,
} from '@stock-assistant/core';

export interface StageBRunnerParams {
  userId: string;
  companyId?: string;
  symbol?: string;
}

export interface StageBRunnerResult {
  input: StageBInput;
  output: StageBOutput;
  company: { id: string; symbol: string; name: string; sector: string };
  annualStatements: Array<Record<string, unknown>>;
  quarterlyStatements: Array<Record<string, unknown>>;
  shareholdings: Array<Record<string, unknown>>;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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

function metric(
  value: number | null,
  reportedPeriod: string
): { value: number | null; provenance: Record<string, unknown> } {
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

function mapSectorToCore(dbSector: string): Sector {
  const s = dbSector.toLowerCase();
  if (s.includes('nbfc')) return 'nbfc';
  if (s.includes('bank') || s === 'financial services') return 'bank';
  if (s.includes('insurance')) return 'insurance';
  if (s.includes('financial')) return 'other-financial';
  return 'non-financial';
}

export async function runStageBForCompany(params: StageBRunnerParams): Promise<StageBRunnerResult> {
  const { userId, companyId, symbol } = params;

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

  // --- Fetch annual financial statements -------------------------------------
  const annualStatements = await prisma.financialStatement.findMany({
    where: { companyId: company.id, periodType: 'Annual' },
    orderBy: { fiscalYear: 'desc' },
    take: 10,
  });

  // --- Fetch quarterly financial statements ----------------------------------
  const quarterlyStatements = await prisma.financialStatement.findMany({
    where: { companyId: company.id, periodType: 'Quarterly' },
    orderBy: { fiscalYear: 'desc' },
    take: 20,
  });

  // --- Fetch shareholding history --------------------------------------------
  const shareholdings = await prisma.shareholding.findMany({
    where: { companyId: company.id },
    orderBy: { period: 'desc' },
  });

  const latestAnnual = annualStatements[0] as Record<string, unknown> | undefined;
  const latestPeriod = (latestAnnual?.reportedPeriod as string) ?? 'FY_LATEST';

  const dec = (v: unknown) => toDecimalNumber(v);

  // --- Build Annual Points (chronological: oldest first) ---------------------
  const annualRaw: Array<{
    period: string;
    sales: number | null;
    opm: number | null;
    netProfit: number | null;
    netMargin: number | null;
    reserves: number | null;
    borrowings: number | null;
    cfo: number | null;
    pat: number | null;
    debtorDays: number | null;
    roce: number | null;
  }> = [];

  for (const s of annualStatements as Array<Record<string, unknown>>) {
    const revenue = dec(s.revenue);
    const op = dec(s.operatingProfit);
    const np = dec(s.netProfit);
    const assets = dec(s.totalAssets);
    const liab = dec(s.totalLiabilities);
    const equity = dec(s.totalEquity);
    const debt = dec(s.totalDebt);
    const ebit = dec(s.ebit);

    const opm = safeRatio(op, revenue);
    const netMargin = safeRatio(np, revenue);
    const roce = safeRatio(ebit, assets && liab ? assets - liab : null);

    annualRaw.push({
      period: (s.reportedPeriod as string) ?? latestPeriod,
      sales: revenue,
      opm,
      netProfit: np,
      netMargin,
      reserves: equity,
      borrowings: debt,
      cfo: null,
      pat: np,
      debtorDays: null,
      roce,
    });
  }

  // Engine expects oldest-first (chronological); DB returns newest-first.
  const annual = annualRaw.reverse();

  // --- Build Quarterly Points ------------------------------------------------
  const quarterly: Array<{
    period: string;
    salesYoY: number | null;
    opmYoY: number | null;
  }> = [];

  const quarterlyByPeriod = new Map<string, Record<string, unknown> | undefined>();
  for (const q of quarterlyStatements as Array<Record<string, unknown>>) {
    quarterlyByPeriod.set((q.reportedPeriod as string), q);
  }

  // For each quarterly statement, look up same quarter prior year for YoY
  const periods = Array.from(quarterlyByPeriod.keys()).sort();
  for (const period of periods) {
    const q = quarterlyByPeriod.get(period)!;
    const revenue = dec(q.revenue);
    const op = dec(q.operatingProfit);

    // Find same quarter prior year (rough heuristic: fiscalYear - 1)
    const priorPeriod = period.replace(/\d{4}/, (m) => String(Number(m) - 1));
    const priorQ = quarterlyByPeriod.get(priorPeriod);
    const priorRevenue = priorQ ? dec(priorQ.revenue) : null;
    const priorOp = priorQ ? dec(priorQ.operatingProfit) : null;

    const salesYoY = safeRatio(revenue && priorRevenue ? revenue - priorRevenue : null, priorRevenue);
    const opmYoY = safeRatio(op && priorOp ? op - priorOp : null, priorOp);

    quarterly.push({
      period: (q.reportedPeriod as string) ?? period,
      salesYoY,
      opmYoY,
    });
  }

  // Engine expects oldest-first (chronological); DB returns newest-first.
  quarterly.reverse();

  // --- Build Shareholding Points ---------------------------------------------
  const shareholding: Array<{
    period: string;
    promoterPct: number | null;
    fiiPct: number | null;
    diiPct: number | null;
    publicPct: number | null;
    promoterPledgePct: number | null;
  }> = [];

  for (const sh of shareholdings as Array<Record<string, unknown>>) {
    shareholding.push({
      period: (sh.period as string) ?? 'UNKNOWN',
      promoterPct: dec(sh.promoterPct),
      fiiPct: dec(sh.fiiPct),
      diiPct: dec(sh.diiPct),
      publicPct: dec(sh.publicPct),
      promoterPledgePct: sh.promoterPledgePct !== null && sh.promoterPledgePct !== undefined
        ? dec(sh.promoterPledgePct)
        : null,
    });
  }

  shareholding.reverse();

  // --- Build StageBInput -----------------------------------------------------
  const coreSector: Sector = mapSectorToCore(company.sector);

  const input: StageBInput = {
    companyId: company.id,
    asOfDate: new Date().toISOString(),
    quarterly,
    annual,
    shareholding,
    dataProvenance: {
      source: 'postgresql',
      fetchedAt: new Date().toISOString(),
      reportedPeriod: latestPeriod,
      currency: 'INR' as const,
      unit: 'CRORE' as const,
      adjustmentStatus: 'reported' as const,
      quality: annualStatements.length > 0 ? 'verified' : 'missing',
      isMissing: annualStatements.length === 0,
    },
    dataSnapshotId: undefined,
  };

  // --- Execute scoring engine ------------------------------------------------
  const output = scoreStageB(input, { ruleSetVersion: 'stage-b-v1.0' });

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
    quarterlyStatements: quarterlyStatements as Array<Record<string, unknown>>,
    shareholdings: shareholdings as Array<Record<string, unknown>>,
  };
}
