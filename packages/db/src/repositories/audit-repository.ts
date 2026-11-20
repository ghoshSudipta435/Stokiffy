/**
 * Audit repository — append-only audit event logging.
 *
 * NOTE: Application-layer only creates and reads audit events (no update/delete
 * methods exposed). True database-level immutability (e.g., PostgreSQL row-level
 * security, triggers, or permissions) is NOT implemented in Phase 1A and must be
 * enforced at the infrastructure layer before production use.
 */

import { PrismaClient } from '@prisma/client';
import type { AuditEvent, Prisma } from '@prisma/client';

export class AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.AuditEventCreateInput): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({ data });
  }

  async findManyByUser(
    userId: string,
    { action, entityType, entityId, limit }: {
      action?: string;
      entityType?: string;
      entityId?: string;
      limit?: number;
    } = {}
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: {
        userId,
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      ...(limit ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findManyByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
