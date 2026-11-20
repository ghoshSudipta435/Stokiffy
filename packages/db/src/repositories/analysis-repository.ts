/**
 * Analysis repository — data access for analysis runs and stage results.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { AnalysisRun, Prisma } from '@prisma/client';

export class AnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.AnalysisRunCreateInput): Promise<AnalysisRun> {
    return this.prisma.analysisRun.create({ data });
  }

  async findById(id: string, userId: string): Promise<AnalysisRun | null> {
    return this.prisma.analysisRun.findFirst({
      where: { id, userId },
      include: {
        stageA: true,
        stageB: true,
        stageC: true,
        stageD: true,
        stageE: true,
        stageF: true,
        stageG: true,
        redFlags: true,
      },
    });
  }

  async findManyByCompany(
    companyId: string,
    userId: string,
    { stage, limit }: { stage?: string; limit?: number } = {}
  ): Promise<AnalysisRun[]> {
    return this.prisma.analysisRun.findMany({
      where: {
        companyId,
        userId,
        ...(stage ? { stage } : {}),
      },
      ...(limit ? { take: limit } : {}),
      orderBy: { calculatedAt: 'desc' },
      include: {
        redFlags: true,
      },
    });
  }

  async findLatestByCompanyAndStage(
    companyId: string,
    userId: string,
    stage: string
  ): Promise<AnalysisRun | null> {
    return this.prisma.analysisRun.findFirst({
      where: { companyId, userId, stage },
      orderBy: { calculatedAt: 'desc' },
      include: {
        redFlags: true,
      },
    });
  }
}
