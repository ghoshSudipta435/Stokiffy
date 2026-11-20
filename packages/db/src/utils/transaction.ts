/**
 * Transaction wrapper for unit-of-work pattern.
 * Provides a typed transaction executor for repository operations.
 */

import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Transaction wrapper for unit-of-work pattern.
 * Provides a typed transaction executor for repository operations.
 *
 * @param prisma - PrismaClient instance
 * @param callback - Transaction callback receiving a typed transaction client
 * @param options - Optional transaction settings (maxWait, timeout, isolationLevel)
 *   All optional and preserve backwards compatibility when omitted.
 */
export async function runInTransaction<T>(
  prisma: PrismaClient,
  callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  return prisma.$transaction(callback as any, options as any) as Promise<T>;
}
