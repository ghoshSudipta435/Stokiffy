/**
 * Company repository — data access for Company and related entities.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { Company, Prisma } from '@prisma/client';

export class CompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async findById(id: string, userId: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: { id, userId },
    });
  }

  async findBySymbol(symbol: string, userId: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: { symbol, userId },
    });
  }

  async findManyByUser(
    userId: string,
    { cursor, limit, sector, exchange }: { cursor?: string; limit?: number; sector?: string; exchange?: string } = {}
  ): Promise<{ companies: Company[]; nextCursor: string | null }> {
    const companies = await this.prisma.company.findMany({
      where: {
        userId,
        ...(sector ? { sector } : {}),
        ...(exchange ? { exchange } : {}),
      },
      take: limit ?? 25,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { symbol: 'asc' },
    });

    const nextCursor =
      companies.length > 0 && (limit ?? 25) === companies.length
        ? companies[companies.length - 1]!.id
        : null;

    return { companies, nextCursor };
  }

  async update(id: string, userId: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error(`Company ${id} not found for user ${userId}`);
    }
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string, userId: string): Promise<Company> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error(`Company ${id} not found for user ${userId}`);
    }
    return this.prisma.company.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
