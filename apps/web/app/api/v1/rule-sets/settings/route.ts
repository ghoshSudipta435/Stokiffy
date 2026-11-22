import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, RuleSetRepository } from '@stock-assistant/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  riskLimits: z
    .object({
      riskBudgetPerTradePct: z.number().positive().max(100).optional(),
      maxStockExposurePct: z.number().positive().max(100).optional(),
      maxSectorExposurePct: z.number().positive().max(100).optional(),
      minRiskReward: z.number().positive().optional(),
      maxPositionPctOfADV: z.number().positive().max(100).optional(),
      lotSize: z.number().int().positive().optional(),
      cashBufferPct: z.number().nonnegative().max(100).optional(),
      estimatedFeesPct: z.number().nonnegative().max(10).optional(),
      slippagePct: z.number().nonnegative().max(10).optional(),
      marginOfSafetyPct: z.number().nonnegative().max(100).optional(),
    })
    .optional(),
  benchmarks: z
    .array(
      z.object({
        industry: z.string().min(1),
        opmMinPct: z.number().nullable().optional(),
        opmMaxPct: z.number().nullable().optional(),
        typicalPE: z.number().nullable().optional(),
        minRoaPct: z.number().nullable().optional(),
        sourceNote: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = updateSettingsSchema.parse(body);

  const repo = new RuleSetRepository(prisma);

  // 1. Resolve active published RuleSet or fallback to first available
  let ruleSet = await repo.getActivePublished();
  if (!ruleSet) {
    const all = await repo.listVersions();
    if (all.length > 0) {
      ruleSet = (await repo.getByVersion(all[0]!.version)) as any;
    }
  }

  if (!ruleSet) {
    // Idempotently create default v1 published rule set if none exists
    const created = await repo.upsertDraft('v1.0.0', {
      name: 'Default Stock Assistant V1 Policy',
      configJson: {
        riskLimits: {
          riskBudgetPerTradePct: 1.0,
          maxStockExposurePct: 10.0,
          maxSectorExposurePct: 30.0,
          minRiskReward: 1.5,
          marginOfSafetyPct: 20.0,
        },
      },
    });
    ruleSet = (await repo.publishVersion(created.version)) as any;
  }

  // 2. Merge existing configJson with updated riskLimits
  const existingConfig = (ruleSet!.configJson as Record<string, unknown>) ?? {};
  const existingRiskLimits =
    (existingConfig.riskLimits as Record<string, unknown>) ?? {};

  const mergedRiskLimits = {
    ...existingRiskLimits,
    ...(parsed.riskLimits ?? {}),
  };

  const updatedConfig = {
    ...existingConfig,
    riskLimits: mergedRiskLimits,
  };

  await prisma.ruleSet.update({
    where: { id: ruleSet!.id },
    data: {
      configJson: updatedConfig as any,
    },
  });

  // 3. Upsert benchmarks if provided
  if (parsed.benchmarks && parsed.benchmarks.length > 0) {
    await repo.bulkUpsertBenchmarks(ruleSet!.id, parsed.benchmarks);
  }

  // 4. Fetch updated benchmarks
  const updatedBenchmarks = await repo.getBenchmarks(ruleSet!.id);

  // 5. Append AuditEvent
  await prisma.auditEvent.create({
    data: {
      userId,
      action: 'UPDATE_RULE_SET_SETTINGS',
      entityType: 'RuleSet',
      entityId: ruleSet!.id,
      reason: 'Updated workstation risk limits and industry benchmark parameters',
      afterState: {
        ruleSetVersion: ruleSet!.version,
        updatedRiskLimits: parsed.riskLimits ?? {},
        updatedBenchmarksCount: parsed.benchmarks?.length ?? 0,
      },
    },
  });

  return createSuccessResponse(
    {
      ruleSetId: ruleSet!.id,
      version: ruleSet!.version,
      riskLimits: mergedRiskLimits,
      benchmarks: updatedBenchmarks.map((b) => ({
        id: b.id,
        industry: b.industry,
        opmMinPct: b.opmMinPct ? Number(b.opmMinPct) : null,
        opmMaxPct: b.opmMaxPct ? Number(b.opmMaxPct) : null,
        typicalPE: b.typicalPE ? Number(b.typicalPE) : null,
        minRoaPct: b.minRoaPct ? Number(b.minRoaPct) : null,
        sourceNote: b.sourceNote,
      })),
    },
    requestId
  );
});
