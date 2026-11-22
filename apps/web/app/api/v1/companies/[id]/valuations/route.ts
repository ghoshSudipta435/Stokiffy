import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, runInTransaction } from '@stock-assistant/db';
import { runStageDForCompany } from '@/lib/services/stage-d-runner';

export const dynamic = 'force-dynamic';

type JsonInput = any;

const runStageDSchema = z.object({
  marketPrice: z.coerce.number().positive().optional(),
  selectedFairPE: z.coerce.number().positive().optional(),
  selectedFairPB: z.coerce.number().positive().optional(),
  assumedExitPE: z.coerce.number().positive().optional(),
  discountRate: z.coerce.number().min(0).max(1).optional(),
  terminalGrowthRate: z.coerce.number().min(0).max(1).optional(),
  marginOfSafetyPct: z.coerce.number().min(0).max(1).optional(),
  primaryMethod: z.enum(['PE', 'PEG', 'PB', 'DCF']).optional(),
});

function mapFlagSeverity(sev: string): 'HARD' | 'WARNING' {
  return sev === 'critical' || sev === 'high' ? 'HARD' : 'WARNING';
}

type RuleStatus =
  | 'PASS'
  | 'HARD_STOP'
  | 'CONDITIONAL_WARNING'
  | 'DATA_QUALITY_WARNING'
  | 'UNSUITABLE_FOR_SECTOR'
  | 'VALUATION_WARNING';

export interface StageDRunResponse {
  analysisRunId: string;
  companyId: string;
  symbol: string;
  sector: string;
  stage: 'D';
  verdict: string;
  verdictBand: string;
  totalPoints: number;
  maxPoints: number;
  minPassScore: number;
  gatePassed: boolean;
  canProceedToStageE: boolean;
  message: string;
  marketPrice: number;
  primaryMethod: string;
  selectedFairValue: number;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number;
  marginOfSafetyPct: number;
  buyReady: boolean;
  overallConfidence: string;
  methods: Array<{
    method: string;
    fairValue: number;
    assumptions: Record<string, unknown>;
    applicability: string;
    confidence: string;
    explanation: string;
    scenarios?: { bear: number; base: number; bull: number };
    sensitivity?: Record<string, number[]>;
    flags: Array<{
      id: string;
      code: string;
      title: string;
      severity: 'HARD' | 'WARNING';
      status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
      class: string;
      message: string;
      threshold: string;
      actualValue: unknown;
    }>;
  }>;
  valuationWarnings: Array<{
    id: string;
    code: string;
    title: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    class: string;
    message: string;
    threshold: string;
    actualValue: unknown;
  }>;
  flags: Array<{
    id: string;
    code: string;
    title: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    class: string;
    companyId: string;
  }>;
}

export const POST = apiHandler(async (req: NextRequest, { params, requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const companyId = String(params.id || '');

  const body = await req.json();
  const parsed = runStageDSchema.parse(body);

  // --- Execute Stage D (adapter + engine) -----------------------------------
  const result = await runStageDForCompany({
    userId,
    companyId,
    marketPrice: parsed.marketPrice,
    selectedFairPE: parsed.selectedFairPE,
    selectedFairPB: parsed.selectedFairPB,
    assumedExitPE: parsed.assumedExitPE,
    discountRate: parsed.discountRate,
    terminalGrowthRate: parsed.terminalGrowthRate,
    marginOfSafetyPct: parsed.marginOfSafetyPct,
    primaryMethod: parsed.primaryMethod,
  });

  const { input, output, company } = result;

  // --- Persist inside a Prisma transaction ----------------------------------
  const persisted = await runInTransaction(prisma, async (tx) => {
    // 1. DataSnapshot (reproducibility of exact inputs)
    const snapshot = await tx.dataSnapshot.create({
      data: {
        companyId: company.id,
        asOfDate: new Date(input.asOfDate),
        financials: input.financials as unknown as JsonInput,
        marketData: { marketPrice: input.marketPrice, priceBar: result.priceBar } as unknown as JsonInput,
        provenance: input.dataProvenance as unknown as JsonInput,
      },
    });

    // 2. AnalysisRun
    const run = await tx.analysisRun.create({
      data: {
        companyId: company.id,
        userId,
        stage: 'D',
        totalPoints: output.totalPoints,
        maxPoints: output.maxPoints,
        verdict: output.verdict,
        ruleSetVersion: output.ruleSetVersion,
        dataSnapshotId: snapshot.id,
        configHash: `stage-d-${output.ruleSetVersion}`,
      },
    });

    // 3. AnalysisStageD
    await tx.analysisStageD.create({
      data: {
        analysisRunId: run.id,
        primaryMethod: output.primaryMethod,
        fairValue: output.selectedFairValue,
        valuationRangeLow: output.valuationRange.low,
        valuationRangeHigh: output.valuationRange.high,
        maxBuyPrice: output.maxBuyPrice,
        marginOfSafetyPct: output.marginOfSafetyPct,
        buyReady: output.buyReady,
        confidence: output.overallConfidence,
      },
    });

    // 4. RedFlags + valuation warnings
    const allFlags = [
      ...output.hardStops,
      ...output.conditionalWarnings,
      ...output.dataQualityWarnings,
      ...output.valuationWarnings,
    ];

    for (const flag of allFlags) {
      await tx.redFlag.create({
        data: {
          analysisRunId: run.id,
          companyId: company.id,
          flagKey: flag.flagKey,
          stage: flag.stage,
          ruleKey: flag.ruleKey ?? null,
          class: flag.class,
          severity: mapFlagSeverity(flag.severity),
          status: 'ACTIVE',
          message: flag.message,
          threshold: flag.threshold,
          actualValue: flag.actualValue as unknown as JsonInput,
          expectedValue: flag.expectedValue ? (flag.expectedValue as unknown as JsonInput) : null,
          source: flag.source,
          isOverride: false,
        },
      });
    }

    // 5. AuditEvent recording the Stage D run
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'STAGE_D_RUN',
        entityType: 'AnalysisRun',
        entityId: run.id,
        beforeState: undefined,
        afterState: {
          analysisRunId: run.id,
          companyId: company.id,
          totalPoints: output.totalPoints,
          maxPoints: output.maxPoints,
          verdict: output.verdict,
          verdictBand: output.verdict,
          gatePassed: output.gatePassed,
          canProceedToStageE: output.canProceedToStageE,
          selectedFairValue: output.selectedFairValue,
          maxBuyPrice: output.maxBuyPrice,
          marginOfSafetyPct: output.marginOfSafetyPct,
          buyReady: output.buyReady,
        } as unknown as JsonInput,
        reason: output.message ?? 'Stage D valuation completed',
      },
    });

    return { run, snapshot };
  });

  // --- Build response -------------------------------------------------------
  const methods = output.methods.map((m) => ({
    method: m.method,
    fairValue: m.fairValue,
    assumptions: m.assumptions,
    applicability: m.applicability,
    confidence: m.confidence,
    explanation: m.explanation,
    scenarios: m.scenarios,
    sensitivity: m.sensitivity,
    flags: m.flags.map((f) => ({
      id: f.id,
      code: f.flagKey,
      title: f.message,
      severity: mapFlagSeverity(f.severity),
      status: f.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
      class: f.class,
      message: f.message,
      threshold: f.threshold,
      actualValue: f.actualValue,
    })),
  }));

  const valuationWarnings = output.valuationWarnings.map((f) => ({
    id: f.id,
    code: f.flagKey,
    title: f.message,
    severity: mapFlagSeverity(f.severity),
    status: f.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
    class: f.class,
    message: f.message,
    threshold: f.threshold,
    actualValue: f.actualValue,
  }));

  const flags = [
    ...output.hardStops,
    ...output.conditionalWarnings,
    ...output.dataQualityWarnings,
    ...output.valuationWarnings,
  ].map((f) => ({
    id: f.id,
    code: f.flagKey,
    title: f.message,
    severity: mapFlagSeverity(f.severity),
    status: f.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
    class: f.class,
    companyId: company.id,
  }));

  const response: StageDRunResponse = {
    analysisRunId: persisted.run.id,
    companyId: company.id,
    symbol: company.symbol,
    sector: company.sector,
    stage: 'D',
    verdict: output.verdict,
    verdictBand: output.verdict,
    totalPoints: output.totalPoints,
    maxPoints: output.maxPoints,
    minPassScore: 0,
    gatePassed: output.gatePassed ?? false,
    canProceedToStageE: output.canProceedToStageE ?? false,
    message: output.message ?? '',
    marketPrice: input.marketPrice,
    primaryMethod: output.primaryMethod,
    selectedFairValue: output.selectedFairValue,
    valuationRange: output.valuationRange,
    maxBuyPrice: output.maxBuyPrice,
    marginOfSafetyPct: output.marginOfSafetyPct,
    buyReady: output.buyReady,
    overallConfidence: output.overallConfidence,
    methods,
    valuationWarnings,
    flags,
  };

  return createSuccessResponse(response, requestId, 201);
});
