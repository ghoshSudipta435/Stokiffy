/**
 * Stage C Runner — adapter between PostgreSQL (via @stock-assistant/db) and the
 * pure TypeScript scoring engine (scoreStageC from @stock-assistant/core).
 *
 * Maps user-provided Business Model answers, Moat Type selections, Moat Test
 * answers, and optional 10Y ROE history (from DB FinancialStatement) into
 * StageCInput, preserving nulls for missing metrics, executes scoreStageC(),
 * and returns the enriched result for persistence by the API route.
 */

import { prisma } from '@stock-assistant/db';
import {
  scoreStageC,
  type StageCInput,
  type StageCOutput,
  type Sector,
  type DataProvenance,
} from '@stock-assistant/core';

export interface StageCRunnerParams {
  userId: string;
  companyId?: string;
  symbol?: string;
  businessModel: Array<{
    questionId: 'value-creation' | 'value-capture' | 'scalability';
    answer: string;
    confidence: 'high' | 'medium' | 'low';
    tags: string[];
    evidence?: Array<{
      description: string;
      source: string;
      sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
      relevance: 'direct' | 'supporting' | 'contextual';
    }>;
  }>;
  businessModelCategory?: string;
  moatTypes?: string[];
  moatTests: Array<{
    testId: 1 | 2 | 3 | 4 | 5;
    answer: 'yes' | 'no' | 'uncertain';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
    evidence: Array<{
      description: string;
      source: string;
      sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
      relevance: 'direct' | 'supporting' | 'contextual';
    }>;
  }>;
  includeROEHistory?: boolean;
}

export interface StageCRunnerResult {
  input: StageCInput;
  output: StageCOutput;
  company: { id: string; symbol: string; name: string; sector: string };
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

function mapSectorToCore(dbSector: string): Sector {
  const s = dbSector.toLowerCase();
  if (s.includes('nbfc')) return 'nbfc';
  if (s.includes('bank') || s === 'financial services') return 'bank';
  if (s.includes('insurance')) return 'insurance';
  if (s.includes('financial')) return 'other-financial';
  return 'non-financial';
}

export async function runStageCForCompany(params: StageCRunnerParams): Promise<StageCRunnerResult> {
  const { userId, companyId, symbol, businessModel, businessModelCategory, moatTypes, moatTests, includeROEHistory } = params;

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

  // --- Optional: Pull 10Y ROE history from DB FinancialStatement -------------
  let roeHistory10y: (number | null)[] | undefined;
  if (includeROEHistory) {
    const annualStatements = await prisma.financialStatement.findMany({
      where: { companyId: company.id, periodType: 'Annual' },
      orderBy: { fiscalYear: 'asc' },
      take: 10,
    });

    roeHistory10y = annualStatements.map((s) => {
      const np = toDecimalNumber(s.netProfit);
      const eq = toDecimalNumber(s.totalEquity);
      if (np === null || eq === null || eq === 0) return null;
      return np / eq;
    });
  }

  // --- Build BusinessModelAnswer[] -------------------------------------------
  const now = new Date().toISOString();
  const businessModelAnswers = businessModel.map((bm) => ({
    questionId: bm.questionId,
    answer: bm.answer,
    evidence: (bm.evidence ?? []).map((e) => ({
      id: `ev_bm_${bm.questionId}_${e.description.slice(0, 20)}`,
      description: e.description,
      source: e.source,
      sourceType: e.sourceType,
      date: now,
      tags: [],
      relevance: e.relevance,
    })),
    confidence: bm.confidence,
    tags: (bm.tags ?? []) as Array<'verified-fact' | 'company-claim' | 'analyst-estimate' | 'inference' | 'news-report' | 'user-input'>,
    completedAt: now,
    completedBy: userId,
  }));

  // --- Build MoatTestResult[] ------------------------------------------------
  const moatTestResults = moatTests.map((mt) => ({
    testId: mt.testId,
    question: '',
    answer: mt.answer,
    passes: false,
    evidence: mt.evidence.map((e) => ({
      id: `ev_${mt.testId}_${e.description.slice(0, 20)}`,
      description: e.description,
      source: e.source,
      sourceType: e.sourceType,
      date: now,
      tags: [],
      relevance: e.relevance,
    })),
    confidence: mt.confidence,
    rationale: mt.rationale,
    completedAt: now,
    completedBy: userId,
    unsubstantiated: false,
  }));

  // --- Build StageCInput -----------------------------------------------------
  const input: StageCInput = {
    companyId: company.id,
    asOfDate: now,
    businessModel: businessModelAnswers,
    businessModelCategory: businessModelCategory as any,
    moatTypes: moatTypes as any,
    moatTests: moatTestResults,
    roeHistory10y,
    dataProvenance: roeHistory10y
      ? {
          source: 'postgresql',
          fetchedAt: now,
          reportedPeriod: 'FY_10Y_ROE',
          currency: 'INR' as const,
          unit: 'CRORE' as const,
          adjustmentStatus: 'reported' as const,
          quality: roeHistory10y.some((v) => v !== null) ? 'verified' : 'missing',
          isMissing: roeHistory10y.every((v) => v === null),
        }
      : MISSING_PROVENANCE,
    dataSnapshotId: undefined,
  };

  // --- Execute scoring engine ------------------------------------------------
  const output = scoreStageC(input, { ruleSetVersion: 'stage-c-v1.0' });

  return {
    input,
    output,
    company: {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
    },
  };
}
