import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, runInTransaction } from '@stock-assistant/db';
import { runStageCForCompany } from '@/lib/services/stage-c-runner';

export const dynamic = 'force-dynamic';

type JsonInput = any;

const evidenceSchema = z.object({
  description: z.string().min(1),
  source: z.string().min(1),
  sourceType: z.enum(['filing', 'transcript', 'analyst-report', 'news', 'user-input', 'derived']),
  relevance: z.enum(['direct', 'supporting', 'contextual']),
});

const moatTestSchema = z.object({
  testId: z.number().int().min(1).max(5),
  answer: z.enum(['yes', 'no', 'uncertain']),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.string().min(1),
  evidence: z.array(evidenceSchema).optional(),
});

const runStageCSchema = z.object({
  businessModel: z.array(
    z.object({
      questionId: z.enum(['value-creation', 'value-capture', 'scalability']),
      answer: z.string().min(1),
      confidence: z.enum(['high', 'medium', 'low']),
      tags: z.array(z.string()).optional(),
    })
  ),
  businessModelCategory: z
    .enum(['SUBSCRIPTION', 'MARKETPLACE', 'BRANDED_MANUFACTURING', 'COMMODITY_MANUFACTURING', 'ASSET_LIGHT', 'ASSET_HEAVY', 'FREEMIUM'])
    .optional(),
  moatTypes: z
    .array(z.enum(['BRAND', 'NETWORK_EFFECT', 'COST_ADVANTAGE', 'SWITCHING_COST', 'REGULATORY_PATENT']))
    .optional(),
  moatTests: z.array(moatTestSchema),
  includeROEHistory: z.boolean().optional(),
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

export interface StageCRunResponse {
  analysisRunId: string;
  companyId: string;
  symbol: string;
  sector: string;
  stage: 'C';
  verdict: string;
  verdictBand: string;
  moatScore: number;
  maxPossibleScore: number;
  minPassScore: number;
  moatPass: boolean;
  gatePassed: boolean;
  canProceedToStageD: boolean;
  message: string;
  businessModelComplete: boolean;
  businessModelCategory?: string;
  moatTypes?: string[];
  overallConfidence: 'high' | 'medium' | 'low' | 'unsubstantiated';
  evidenceGaps: string[];
  flags: Array<{
    id: string;
    code: string;
    title: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    class: string;
    companyId: string;
  }>;
  ruleResults: Array<{
    ruleKey: string;
    testId: number;
    testName: string;
    passed: boolean;
    unsubstantiated: boolean;
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
}

export const POST = apiHandler(async (req: NextRequest, { params, requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const companyId = String(params.id || '');

  const body = await req.json();
  const parsed = runStageCSchema.parse(body);

  // --- Execute Stage C (adapter + engine) -----------------------------------
  const result = await runStageCForCompany({
    userId,
    companyId,
    businessModel: parsed.businessModel as any,
    businessModelCategory: parsed.businessModelCategory,
    moatTypes: parsed.moatTypes,
    moatTests: parsed.moatTests as any,
    includeROEHistory: parsed.includeROEHistory ?? true,
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
          roeHistory10y: input.roeHistory10y,
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
        stage: 'C',
        totalPoints: output.moatScore,
        maxPoints: output.maxPossibleScore,
        verdict: output.verdict,
        ruleSetVersion: output.ruleSetVersion,
        dataSnapshotId: snapshot.id,
        configHash: `stage-c-${output.ruleSetVersion}`,
      },
    });

    // 3. AnalysisStageC
    await tx.analysisStageC.create({
      data: {
        analysisRunId: run.id,
        moatScore: output.moatScore,
        moatPass: output.moatPass,
        businessModelComplete: output.businessModelComplete,
        overallConfidence: output.overallConfidence,
      },
    });

    // 4. RedFlags
    const allFlags = [
      ...output.flags,
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

    // 5. AuditEvent recording the Stage C run
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'STAGE_C_RUN',
        entityType: 'AnalysisRun',
        entityId: run.id,
        beforeState: undefined,
        afterState: {
          analysisRunId: run.id,
          companyId: company.id,
          moatScore: output.moatScore,
          maxPossibleScore: output.maxPossibleScore,
          moatPass: output.moatPass,
          gatePassed: output.gatePassed,
          canProceedToStageD: output.canProceedToStageD,
          overallConfidence: output.overallConfidence,
        } as unknown as JsonInput,
        reason: output.message ?? 'Stage C moat assessment completed',
      },
    });

    return { run, snapshot };
  });

  // --- Build response -------------------------------------------------------
  const flags = output.flags.map((f) => ({
    id: f.id,
    code: f.flagKey,
    title: f.message,
    severity: mapFlagSeverity(f.severity),
    status: f.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
    class: f.class,
    companyId: company.id,
  }));

  const ruleResults = output.ruleResults.map((rule) => {
    const status: RuleStatus = (() => {
      if (rule.redFlags.some((f) => f.class === 'HARD_STOP')) return 'HARD_STOP';
      if (rule.redFlags.some((f) => f.class === 'CONDITIONAL_WARNING')) return 'CONDITIONAL_WARNING';
      if (rule.redFlags.some((f) => f.class === 'DATA_QUALITY_WARNING')) return 'DATA_QUALITY_WARNING';
      return 'PASS';
    })();

    return {
      ruleKey: rule.ruleKey,
      testId: rule.testId,
      testName: rule.testName,
      passed: rule.passed,
      unsubstantiated: rule.unsubstantiated,
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

  const response: StageCRunResponse = {
    analysisRunId: persisted.run.id,
    companyId: company.id,
    symbol: company.symbol,
    sector: company.sector,
    stage: 'C',
    verdict: output.verdict,
    verdictBand: output.verdictBand ?? 'AVOID',
    moatScore: output.moatScore,
    maxPossibleScore: output.maxPossibleScore,
    minPassScore: output.minPassScore,
    moatPass: output.moatPass,
    gatePassed: output.gatePassed,
    canProceedToStageD: output.canProceedToStageD,
    message: output.message ?? '',
    businessModelComplete: output.businessModelComplete,
    businessModelCategory: output.businessModelCategory ?? undefined,
    moatTypes: output.moatTypes ?? undefined,
    overallConfidence: output.overallConfidence,
    evidenceGaps: output.evidenceGaps,
    flags,
    ruleResults,
  };

  return createSuccessResponse(response, requestId, 201);
});
