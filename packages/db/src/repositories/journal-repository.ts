/**
 * Journal repository — data access for JournalEntry entities.
 * Enforces row-level ownership (userId) and immutability of original trade executions.
 */

import { PrismaClient } from '@prisma/client';
import type { JournalEntry, Prisma } from '@prisma/client';

export class JournalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEntry(
    userId: string,
    data: {
      tradePlanId: string;
      date: Date;
      action: string;
      quantity: Prisma.Decimal | number;
      price: Prisma.Decimal | number;
      fees?: Prisma.Decimal | number;
      taxes?: Prisma.Decimal | number;
      reason: string;
      ruleTriggers?: unknown;
      corporateActions?: unknown;
      realisedPnl?: Prisma.Decimal | number | null;
      unrealisedPnl?: Prisma.Decimal | number | null;
      returnPct?: Prisma.Decimal | number | null;
    }
  ): Promise<JournalEntry> {
    return this.prisma.journalEntry.create({
      data: {
        userId,
        tradePlanId: data.tradePlanId,
        date: data.date,
        action: data.action,
        quantity: data.quantity,
        price: data.price,
        fees: data.fees ?? 0,
        taxes: data.taxes ?? 0,
        reason: data.reason,
        ruleTriggers: (data.ruleTriggers as Prisma.InputJsonValue) ?? [],
        ...(data.corporateActions !== undefined ? { corporateActions: data.corporateActions as Prisma.InputJsonValue } : {}),
        ...(data.realisedPnl !== undefined && data.realisedPnl !== null ? { realisedPnl: data.realisedPnl } : {}),
        ...(data.unrealisedPnl !== undefined && data.unrealisedPnl !== null ? { unrealisedPnl: data.unrealisedPnl } : {}),
        ...(data.returnPct !== undefined && data.returnPct !== null ? { returnPct: data.returnPct } : {}),
      },
    });
  }

  async appendReview(
    id: string,
    userId: string,
    review: {
      rulesWorked: string[];
      assumptionsFailed: string[];
      executionQuality: string;
      slippage: number;
      behaviouralNotes: string;
      lesson: string;
      reviewedAt: Date;
      reviewedBy: string;
    }
  ): Promise<JournalEntry> {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error(`JournalEntry ${id} not found for user ${userId}`);
    }

    // IMMUTABILITY ENFORCEMENT: Only update review, reviewedAt, and reviewedBy.
    // Original execution fields (date, action, quantity, price, fees, taxes, reason) are NEVER updated.
    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        review: review as Prisma.InputJsonValue,
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
      },
    });
  }

  async findById(id: string, userId: string): Promise<JournalEntry | null> {
    return this.prisma.journalEntry.findFirst({
      where: { id, userId },
      include: {
        tradePlan: {
          include: {
            company: true,
          },
        },
      },
    });
  }

  async listByUser(
    userId: string,
    filters?: {
      tradePlanId?: string;
      action?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<JournalEntry[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        ...(filters?.tradePlanId ? { tradePlanId: filters.tradePlanId } : {}),
        ...(filters?.action ? { action: filters.action } : {}),
        ...(filters?.fromDate || filters?.toDate
          ? {
              date: {
                ...(filters.fromDate ? { gte: filters.fromDate } : {}),
                ...(filters.toDate ? { lte: filters.toDate } : {}),
              },
            }
          : {}),
      },
      include: {
        tradePlan: {
          select: {
            id: true,
            symbol: true,
            companyId: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async listByTradePlan(tradePlanId: string, userId: string): Promise<JournalEntry[]> {
    return this.prisma.journalEntry.findMany({
      where: { tradePlanId, userId },
      orderBy: { date: 'asc' },
    });
  }
}
