import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, runInTransaction } from '@stock-assistant/db';
import { runStageEForCompany } from '@/lib/services/stage-e-runner';

export const dynamic = 'force-dynamic';

type JsonInput = any;

const runStageESchema = z.object({
  companyId: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  valuationMaxBuyPrice: z.coerce.number().positive().optional(),
  targetPrice: z.coerce.number().positive().optional(),
  minRiskReward: z.coerce.number().min(0).optional(),
  buyZoneTolerancePct: z.coerce.number().min(0).max(1).optional(),
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

export interface StageERunResponse {
  analysisRunId: string;
  companyId: string;
  symbol: string;
  sector: string;
  stage: 'E';
  verdict: string;
  verdictBand: string;
  totalPoints: number;
  maxPoints: number;
  minPassScore: number;
  gatePassed: boolean;
  canProceedToStageF: boolean;
  message: string;
  eligible: boolean;
  currentPrice: number;
  maxBuyPrice: number;
  inBuyZone: boolean;
  distanceToMaxBuyPct: number;
  bestSetup?: {
    pattern: string;
    entryZone: { low: number; high: number };
    invalidationLevel: number;
    stopLoss: number;
    targets: number[];
    riskReward: number;
    inBuyZone: boolean;
    contextScore: number;
    setupQuality: string;
  };
  technicalContext: {
    dailyTrend: string;
    weeklyTrend: string;
    keyLevels: { support: number[]; resistance: number[] };
    volumeProfile: string;
    rsVsBenchmark: string;
    sma20?: number;
    sma50?: number;
    sma200?: number;
    atr14: number;
    volumeRatio: number;
  };
  setups: Array<{
    pattern: string;
    entryZone: { low: number; high: number };
    invalidationLevel: number;
    stopLoss: number;
    targets: number[];
    riskReward: number;
    inBuyZone: boolean;
    contextScore: number;
    setupQuality: string;
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

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = runStageESchema.parse(body);

  if (!parsed.companyId && !parsed.symbol) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Either companyId or symbol is required',
      400,
      requestId
    );
  }

  // --- Execute Stage E (adapter + engine) -----------------------------------
  const result = await runStageEForCompany({
    userId,
    companyId: parsed.companyId,
    symbol: parsed.symbol,
    valuationMaxBuyPrice: parsed.valuationMaxBuyPrice,
    targetPrice: parsed.targetPrice,
    minRiskReward: parsed.minRiskReward,
    buyZoneTolerancePct: parsed.buyZoneTolerancePct,
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
          priceBars: result.priceBars,
          currentPrice: output.priceData.currentPrice,
        } as unknown as JsonInput,
        marketData: {
          valuationMaxBuyPrice: input.valuationMaxBuyPrice,
          selectedFairValue: input.selectedFairValue,
        } as unknown as JsonInput,
        provenance: input.dataProvenance as unknown as JsonInput,
      },
    });

    // 2. AnalysisRun
    const run = await tx.analysisRun.create({
      data: {
        companyId: company.id,
        userId,
        stage: 'E',
        totalPoints: output.totalPoints,
        maxPoints: output.maxPoints,
        verdict: output.verdict,
        ruleSetVersion: output.ruleSetVersion,
        dataSnapshotId: snapshot.id,
        configHash: `stage-e-${output.ruleSetVersion}`,
      },
    });

    // 3. AnalysisStageE
    await tx.analysisStageE.create({
      data: {
        analysisRunId: run.id,
        eligible: output.eligible,
        currentPrice: output.priceData.currentPrice,
        maxBuyPrice: output.priceData.maxBuyPrice,
        inBuyZone: output.priceData.inBuyZone,
        distanceToMaxBuyPct: output.priceData.distanceToMaxBuyPct,
        dailyTrend: output.technicalContext.dailyTrend,
        weeklyTrend: output.technicalContext.weeklyTrend,
        volumeProfile: output.technicalContext.volumeProfile,
        rsVsBenchmark: output.technicalContext.rsVsBenchmark,
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

    // 5. AuditEvent recording the Stage E run
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'STAGE_E_RUN',
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
          canProceedToStageF: output.canProceedToStageF,
          eligible: output.eligible,
          currentPrice: output.priceData.currentPrice,
          maxBuyPrice: output.priceData.maxBuyPrice,
          inBuyZone: output.priceData.inBuyZone,
        } as unknown as JsonInput,
        reason: output.message ?? 'Stage E technical entry completed',
      },
    });

    return { run, snapshot };
  });

  // --- Build response -------------------------------------------------------
  const setups = output.setups.map((s) => ({
    pattern: s.pattern.name,
    entryZone: s.entryZone,
    invalidationLevel: s.invalidationLevel,
    stopLoss: s.stopLoss,
    targets: s.targets,
    riskReward: s.riskReward,
    inBuyZone: s.inBuyZone,
    contextScore: s.contextScore,
    setupQuality: s.setupQuality,
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

  const response: StageERunResponse = {
    analysisRunId: persisted.run.id,
    companyId: company.id,
    symbol: company.symbol,
    sector: company.sector,
    stage: 'E',
    verdict: output.verdict,
    verdictBand: output.verdict,
    totalPoints: output.totalPoints,
    maxPoints: output.maxPoints,
    minPassScore: 0,
    gatePassed: output.gatePassed ?? false,
    canProceedToStageF: output.canProceedToStageF ?? false,
    message: output.message ?? '',
    eligible: output.eligible,
    currentPrice: output.priceData.currentPrice,
    maxBuyPrice: output.priceData.maxBuyPrice,
    inBuyZone: output.priceData.inBuyZone,
    distanceToMaxBuyPct: output.priceData.distanceToMaxBuyPct,
    bestSetup: output.bestSetup
      ? {
          pattern: output.bestSetup.pattern.name,
          entryZone: output.bestSetup.entryZone,
          invalidationLevel: output.bestSetup.invalidationLevel,
          stopLoss: output.bestSetup.stopLoss,
          targets: output.bestSetup.targets,
          riskReward: output.bestSetup.riskReward,
          inBuyZone: output.bestSetup.inBuyZone,
          contextScore: output.bestSetup.contextScore,
          setupQuality: output.bestSetup.setupQuality,
        }
      : undefined,
    technicalContext: {
      dailyTrend: output.technicalContext.dailyTrend,
      weeklyTrend: output.technicalContext.weeklyTrend,
      keyLevels: output.technicalContext.keyLevels,
      volumeProfile: output.technicalContext.volumeProfile,
      rsVsBenchmark: output.technicalContext.rsVsBenchmark,
      sma20: output.technicalContext.sma20,
      sma50: output.technicalContext.sma50,
      sma200: output.technicalContext.sma200,
      atr14: output.technicalContext.atr14,
      volumeRatio: output.technicalContext.volumeRatio,
    },
    setups,
    flags,
  };

  return createSuccessResponse(response, requestId, 201);
});
