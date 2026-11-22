/**
 * RuleSet repository — data access for RuleSet and IndustryBenchmark entities.
 * Manages configurable strategy parameters and industry benchmarks.
 */

import { PrismaClient } from '@prisma/client';
import type { IndustryBenchmark, Prisma, RuleSet } from '@prisma/client';

export class RuleSetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActivePublished(): Promise<(RuleSet & { benchmarks: IndustryBenchmark[] }) | null> {
    return this.prisma.ruleSet.findFirst({
      where: { status: 'PUBLISHED' },
      include: {
        benchmarks: {
          orderBy: { industry: 'asc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getByVersion(version: string): Promise<(RuleSet & { benchmarks: IndustryBenchmark[] }) | null> {
    return this.prisma.ruleSet.findUnique({
      where: { version },
      include: {
        benchmarks: {
          orderBy: { industry: 'asc' },
        },
      },
    });
  }

  async listVersions(): Promise<RuleSet[]> {
    return this.prisma.ruleSet.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertDraft(
    version: string,
    data: { name: string; configJson: Record<string, unknown> }
  ): Promise<RuleSet> {
    return this.prisma.ruleSet.upsert({
      where: { version },
      create: {
        version,
        name: data.name,
        status: 'DRAFT',
        configJson: data.configJson as Prisma.InputJsonValue,
      },
      update: {
        name: data.name,
        configJson: data.configJson as Prisma.InputJsonValue,
      },
    });
  }

  async publishVersion(version: string): Promise<RuleSet> {
    const existing = await this.prisma.ruleSet.findUnique({ where: { version } });
    if (!existing) {
      throw new Error(`RuleSet version ${version} not found`);
    }

    // Archive currently published rule sets
    await this.prisma.ruleSet.updateMany({
      where: { status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });

    return this.prisma.ruleSet.update({
      where: { version },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  async getBenchmarks(ruleSetId: string): Promise<IndustryBenchmark[]> {
    return this.prisma.industryBenchmark.findMany({
      where: { ruleSetId },
      orderBy: { industry: 'asc' },
    });
  }

  async upsertBenchmark(
    ruleSetId: string,
    benchmark: {
      industry: string;
      opmMinPct?: Prisma.Decimal | number | null;
      opmMaxPct?: Prisma.Decimal | number | null;
      typicalPE?: Prisma.Decimal | number | null;
      minRoaPct?: Prisma.Decimal | number | null;
      sourceNote?: string | null;
    }
  ): Promise<IndustryBenchmark> {
    return this.prisma.industryBenchmark.upsert({
      where: {
        ruleSetId_industry: {
          ruleSetId,
          industry: benchmark.industry,
        },
      },
      create: {
        ruleSetId,
        industry: benchmark.industry,
        ...(benchmark.opmMinPct !== undefined ? { opmMinPct: benchmark.opmMinPct } : {}),
        ...(benchmark.opmMaxPct !== undefined ? { opmMaxPct: benchmark.opmMaxPct } : {}),
        ...(benchmark.typicalPE !== undefined ? { typicalPE: benchmark.typicalPE } : {}),
        ...(benchmark.minRoaPct !== undefined ? { minRoaPct: benchmark.minRoaPct } : {}),
        ...(benchmark.sourceNote !== undefined ? { sourceNote: benchmark.sourceNote } : {}),
      },
      update: {
        ...(benchmark.opmMinPct !== undefined ? { opmMinPct: benchmark.opmMinPct } : {}),
        ...(benchmark.opmMaxPct !== undefined ? { opmMaxPct: benchmark.opmMaxPct } : {}),
        ...(benchmark.typicalPE !== undefined ? { typicalPE: benchmark.typicalPE } : {}),
        ...(benchmark.minRoaPct !== undefined ? { minRoaPct: benchmark.minRoaPct } : {}),
        ...(benchmark.sourceNote !== undefined ? { sourceNote: benchmark.sourceNote } : {}),
      },
    });
  }

  async bulkUpsertBenchmarks(
    ruleSetId: string,
    benchmarks: Array<{
      industry: string;
      opmMinPct?: Prisma.Decimal | number | null;
      opmMaxPct?: Prisma.Decimal | number | null;
      typicalPE?: Prisma.Decimal | number | null;
      minRoaPct?: Prisma.Decimal | number | null;
      sourceNote?: string | null;
    }>
  ): Promise<number> {
    let count = 0;
    for (const b of benchmarks) {
      await this.upsertBenchmark(ruleSetId, b);
      count++;
    }
    return count;
  }
}
