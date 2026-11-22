import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, runInTransaction } from '@stock-assistant/db';
import { runStageAForCompany } from '@/lib/services/stage-a-runner';

export const dynamic = 'force-dynamic';

type JsonInput = any;

const runStageASchema = z.object({
  companyId: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  marketPrice: z.coerce.number().positive().optional(),
  industryPE: z.coerce.number().positive().optional(),
  industry: z.string().min(1).optional(),
});

function mapFlagSeverity(sev: string): 'HARD' | 'WARNING' {
  return sev === 'critical' || sev === 'high' ? 'HARD' : 'WARNING';
}

type RuleStatus = 'PASS' | 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'UNSUITABLE_FOR_SECTOR';

export interface StageARunResponse {
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
  canProceedToStageB: boolean;
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
  const parsed = runStageASchema.parse(body);

  if (!parsed.companyId && !parsed.symbol) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Either companyId or symbol is required',
      400,
      requestId
    );
  }

  // --- Execute Stage A (adapter + engine) -----------------------------------
  const result = await runStageAForCompany({
    userId,
    companyId: parsed.companyId,
    symbol: parsed.symbol,
    marketPrice: parsed.marketPrice,
    industryPE: parsed.industryPE,
    industry: parsed.industry,
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
        marketData: { priceBar: result.priceBar as unknown as JsonInput, marketPrice: parsed.marketPrice ?? null },
        provenance: input.dataProvenance as unknown as JsonInput,
      },
    });

    // 2. AnalysisRun
    const run = await tx.analysisRun.create({
      data: {
        companyId: company.id,
        userId,
        stage: 'A',
        totalPoints: output.totalPoints,
        maxPoints: output.maxPoints,
        verdict: output.verdict,
        ruleSetVersion: output.ruleSetVersion,
        dataSnapshotId: snapshot.id,
        configHash: `stage-a-${output.ruleSetVersion}`,
      },
    });

    // 3. AnalysisStageA
    await tx.analysisStageA.create({
      data: {
        analysisRunId: run.id,
        sector: output.sector,
        maxPossibleScore: output.maxPossibleScore,
        minPassScore: output.minPassScore,
        bankVariant: output.bankVariant,
        unsuitableRules: (output.unsuitableRules ?? []) as unknown as JsonInput,
      },
    });

    // 4. RedFlags (hard stops, conditional warnings, data quality, valuation)
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

    // 5. AuditEvent recording the Stage A run
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'STAGE_A_RUN',
        entityType: 'AnalysisRun',
        entityId: run.id,
        beforeState: null as unknown as JsonInput,
        afterState: {
          analysisRunId: run.id,
          companyId: company.id,
          totalPoints: output.totalPoints,
          maxPoints: output.maxPoints,
          verdict: output.verdict,
          verdictBand: output.verdictBand ?? 'AVOID',
          gatePassed: output.gatePassed,
          canProceedToStageB: output.canProceedToStageB,
          hardStopCount: output.hardStops.length,
        } as unknown as JsonInput,
        reason: output.message ?? 'Stage A run completed',
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

  const response: StageARunResponse = {
    analysisRunId: persisted.run.id,
    companyId: company.id,
    symbol: company.symbol,
    sector: company.sector,
    bankVariant: output.bankVariant,
    verdict: output.verdict,
    verdictBand: output.verdictBand ?? 'AVOID',
    totalPoints: output.totalPoints,
    maxPoints: output.maxPoints,
    minPassScore: output.minPassScore ?? 0,
    gatePassed: output.gatePassed ?? false,
    canProceedToStageB: output.canProceedToStageB ?? false,
    message: output.message ?? '',
    breakdown,
    hardStopCount: output.hardStops.length,
    flags,
  };

  return createSuccessResponse(response, requestId, 201);
});
