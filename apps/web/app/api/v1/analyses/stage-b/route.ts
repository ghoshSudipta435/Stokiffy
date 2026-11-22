import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, runInTransaction } from '@stock-assistant/db';
import { runStageBForCompany } from '@/lib/services/stage-b-runner';

export const dynamic = 'force-dynamic';

type JsonInput = any;

const runStageBSchema = z.object({
  companyId: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
});

function mapFlagSeverity(sev: string): 'HARD' | 'WARNING' {
  return sev === 'critical' || sev === 'high' ? 'HARD' : 'WARNING';
}

type RuleStatus =
  | 'PASS'
  | 'HARD_STOP'
  | 'CONDITIONAL_WARNING'
  | 'DATA_QUALITY_WARNING'
  | 'UNSUITABLE_FOR_SECTOR';

export interface StageBRunResponse {
  analysisRunId: string;
  companyId: string;
  symbol: string;
  sector: string;
  bankVariant: boolean;
  verdict: string;
  verdictBand: string;
  totalPoints: number;
  maxPoints: number;
  minPassScore: number;
  gatePassed: boolean;
  canProceedToStageC: boolean;
  message: string;
  breakdown: Array<{
    ruleKey: string;
    points: number;
    maxPoints: number;
    inputs: Record<string, unknown>;
    explanation: string;
    status: RuleStatus;
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
  hardStopCount: number;
  forensicFlags: string[];
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

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = runStageBSchema.parse(body);

  if (!parsed.companyId && !parsed.symbol) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Either companyId or symbol is required',
      400,
      requestId
    );
  }

  // --- Execute Stage B (adapter + engine) -----------------------------------
  const result = await runStageBForCompany({
    userId,
    companyId: parsed.companyId,
    symbol: parsed.symbol,
  });

  const { input, output, company } = result;

  // --- Persist inside a Prisma transaction ----------------------------------
  const persisted = await runInTransaction(prisma, async (tx) => {
    // 1. DataSnapshot (reproducibility of exact inputs)
    const snapshot = await tx.dataSnapshot.create({
      data: {
        companyId: company.id,
        asOfDate: new Date(input.asOfDate),
        financials: {
          annual: result.annualStatements,
          quarterly: result.quarterlyStatements,
        } as unknown as JsonInput,
        marketData: undefined as unknown as JsonInput,
        provenance: input.dataProvenance as unknown as JsonInput,
      },
    });

    // 2. AnalysisRun
    const run = await tx.analysisRun.create({
      data: {
        companyId: company.id,
        userId,
        stage: 'B',
        totalPoints: output.totalPoints,
        maxPoints: output.maxPoints,
        verdict: output.verdict,
        ruleSetVersion: output.ruleSetVersion,
        dataSnapshotId: snapshot.id,
        configHash: `stage-b-${output.ruleSetVersion}`,
      },
    });

    // 3. AnalysisStageB
    await tx.analysisStageB.create({
      data: {
        analysisRunId: run.id,
        quarterlySalesTrend: output.quarterlyAnalysis.salesTrend,
        quarterlyOpmTrend: output.quarterlyAnalysis.opmTrend,
        annualSales5yTrend: output.annualAnalysis.sales5yTrend,
        annualOpm5yTrend: output.annualAnalysis.opm5yTrend,
        netProfitTrend: output.annualAnalysis.netProfitTrend,
        reservesBorrowingsTrend: output.annualAnalysis.reservesBorrowingsTrend,
        cfoTrend: output.annualAnalysis.cfoTrend,
        debtorDaysTrend: output.annualAnalysis.debtorDaysTrend,
        roceTrend: output.annualAnalysis.roceTrend,
        shareholdingScore: output.shareholdingAnalysis.score,
        shareholdingHardFlags: output.shareholdingAnalysis.hardFlags as unknown as JsonInput,
      },
    });

    // 4. RedFlags
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

    // 5. AuditEvent recording the Stage B run
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'STAGE_B_RUN',
        entityType: 'AnalysisRun',
        entityId: run.id,
        beforeState: null as unknown as JsonInput,
        afterState: {
          analysisRunId: run.id,
          companyId: company.id,
          totalPoints: output.totalPoints,
          maxPoints: output.maxPoints,
          verdict: output.verdict,
          verdictBand: output.verdictBand,
          gatePassed: output.gatePassed,
          canProceedToStageC: output.canProceedToStageC,
          hardStopCount: output.hardStops.length,
        } as unknown as JsonInput,
        reason: output.message ?? 'Stage B run completed',
      },
    });

    return { run, snapshot };
  });

  // --- Build response -------------------------------------------------------
  const breakdown = output.ruleResults.map((rule) => {
    const status: RuleStatus = (() => {
      if (rule.redFlags.some((f) => f.class === 'HARD_STOP')) return 'HARD_STOP';
      if (rule.redFlags.some((f) => f.class === 'CONDITIONAL_WARNING')) return 'CONDITIONAL_WARNING';
      if (rule.redFlags.some((f) => f.class === 'DATA_QUALITY_WARNING')) return 'DATA_QUALITY_WARNING';
      return 'PASS';
    })();

    return {
      ruleKey: rule.ruleKey,
      points: rule.points,
      maxPoints: rule.maxPoints,
      inputs: rule.inputs,
      explanation: rule.explanation,
      status,
      flags: rule.redFlags.map((f) => ({
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
    };
  });

  const flags = output.hardStops
    .concat(output.conditionalWarnings)
    .concat(output.dataQualityWarnings)
    .concat(output.valuationWarnings)
    .map((f) => ({
      id: f.id,
      code: f.flagKey,
      title: f.message,
      severity: mapFlagSeverity(f.severity),
      status: f.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
      class: f.class,
      companyId: company.id,
    }));

  const response: StageBRunResponse = {
    analysisRunId: persisted.run.id,
    companyId: company.id,
    symbol: company.symbol,
    sector: company.sector,
    bankVariant: false,
    verdict: output.verdict,
    verdictBand: output.verdictBand ?? 'AVOID',
    totalPoints: output.totalPoints,
    maxPoints: output.maxPoints,
    minPassScore: output.minPassScore ?? 0,
    gatePassed: output.gatePassed ?? false,
    canProceedToStageC: output.canProceedToStageC ?? false,
    message: output.message ?? '',
    breakdown,
    hardStopCount: output.hardStops.length,
    forensicFlags: output.forensicFlags,
    flags,
  };

  return createSuccessResponse(response, requestId, 201);
});
