/**
 * Alert repository — data access for system alerts.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { Alert, Prisma } from '@prisma/client';

export class AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.AlertCreateInput): Promise<Alert> {
    return this.prisma.alert.create({ data });
  }

  async findManyByUser(
    userId: string,
    { acknowledged, limit }: { acknowledged?: boolean; limit?: number } = {}
  ): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: {
        userId,
        ...(acknowledged !== undefined
          ? { acknowledgedAt: acknowledged ? { not: null } : null }
          : {}),
      },
      ...(limit ? { take: limit } : {}),
      orderBy: { triggeredAt: 'desc' },
    });
  }

  async acknowledge(
    id: string,
    userId: string,
    acknowledgedBy: string
  ): Promise<Alert> {
    const existing = await this.prisma.alert.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error(`Alert ${id} not found for user ${userId}`);
    }
    return this.prisma.alert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });
  }
}
