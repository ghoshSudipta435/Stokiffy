/**
 * PrismaClient singleton with connection management.
 * Follows ADR-004 (PostgreSQL + Prisma ORM) and FOLDER_STRUCTURE.md Section 2.4.
 *
 * This file defines the client shape but does not connect to any database.
 * Connection is established lazily on first use.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
