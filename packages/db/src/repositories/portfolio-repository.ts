/**
 * Portfolio repository — data access for portfolio holdings.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { PortfolioHolding, Prisma } from '@prisma/client';

export class PortfolioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.PortfolioHoldingCreateInput): Promise<PortfolioHolding> {
    return this.prisma.portfolioHolding.create({ data });
  }

  async findManyByUser(userId: string): Promise<PortfolioHolding[]> {
    return this.prisma.portfolioHolding.findMany({
      where: { userId },
      orderBy: { symbol: 'asc' },
    });
  }

  async findById(id: string, userId: string): Promise<PortfolioHolding | null> {
    return this.prisma.portfolioHolding.findFirst({
      where: { id, userId },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Prisma.PortfolioHoldingUpdateInput
  ): Promise<PortfolioHolding> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error(`Portfolio holding ${id} not found for user ${userId}`);
    }
    return this.prisma.portfolioHolding.update({
      where: { id },
      data,
    });
  }

  async upsert(
    userId: string,
    companyId: string,
    data: Prisma.PortfolioHoldingUncheckedCreateInput
  ): Promise<PortfolioHolding> {
    const existing = await this.prisma.portfolioHolding.findFirst({
      where: { userId, companyId },
    });
    if (existing) {
      return this.prisma.portfolioHolding.update({
        where: { id: existing.id },
        data: data as Prisma.PortfolioHoldingUpdateInput,
      });
    }
    return this.prisma.portfolioHolding.create({
      data: { ...data, userId, companyId } as unknown as Prisma.PortfolioHoldingCreateInput,
    });
  }
}
