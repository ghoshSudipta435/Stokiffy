/**
 * Trade plan repository — data access for trade plans.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { TradePlan, Prisma } from '@prisma/client';

export class TradePlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.TradePlanCreateInput): Promise<TradePlan> {
    return this.prisma.tradePlan.create({ data });
  }

  async findById(id: string, userId: string): Promise<TradePlan | null> {
    return this.prisma.tradePlan.findFirst({
      where: { id, userId },
      include: {
        overrides: true,
        journal: true,
      },
    });
  }

  async findManyByUser(
    userId: string,
    { status, limit }: { status?: string; limit?: number } = {}
  ): Promise<TradePlan[]> {
    return this.prisma.tradePlan.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      ...(limit ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        overrides: true,
      },
    });
  }

  async update(id: string, userId: string, data: Prisma.TradePlanUpdateInput): Promise<TradePlan> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error(`Trade plan ${id} not found for user ${userId}`);
    }
    return this.prisma.tradePlan.update({
      where: { id },
      data,
    });
  }
}
