/**
 * Financials repository — data access for financial statements.
 * Enforces row-level ownership through company association.
 */

import { PrismaClient } from '@prisma/client';
import type { FinancialStatement, Prisma } from '@prisma/client';

export class FinancialsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.FinancialStatementCreateInput): Promise<FinancialStatement> {
    return this.prisma.financialStatement.create({ data });
  }

  async findByCompanyAndPeriod(
    companyId: string,
    userId: string,
    periodType: string,
    fiscalYear: string,
    fiscalQuarter?: string
  ): Promise<FinancialStatement | null> {
    return this.prisma.financialStatement.findFirst({
      where: {
        companyId,
        company: { userId },
        periodType,
        fiscalYear,
        ...(fiscalQuarter ? { fiscalQuarter } : {}),
      },
      orderBy: { fetchedAt: 'desc' },
    });
  }

  async findManyByCompany(
    companyId: string,
    userId: string,
    { periodType, limit }: { periodType?: string; limit?: number } = {}
  ): Promise<FinancialStatement[]> {
    return this.prisma.financialStatement.findMany({
      where: {
        companyId,
        company: { userId },
        ...(periodType ? { periodType } : {}),
      },
      ...(limit ? { take: limit } : {}),
      orderBy: [{ fiscalYear: 'desc' }, { fiscalQuarter: 'desc' }],
    });
  }

  async findLatestByCompany(
    companyId: string,
    userId: string
  ): Promise<FinancialStatement | null> {
    return this.prisma.financialStatement.findFirst({
      where: {
        companyId,
        company: { userId },
      },
      orderBy: { reportedPeriod: 'desc', fetchedAt: 'desc' },
    });
  }

  async countByCompany(companyId: string, userId: string): Promise<number> {
    return this.prisma.financialStatement.count({
      where: {
        companyId,
        company: { userId },
      },
    });
  }
}
