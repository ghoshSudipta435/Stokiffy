/**
 * Watchlist repository — data access for Watchlist and WatchlistItem entities.
 * Enforces row-level ownership (userId) on all queries.
 */

import { PrismaClient } from '@prisma/client';
import type { Watchlist, WatchlistItem } from '@prisma/client';

export class WatchlistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, data: { name: string; description?: string }): Promise<Watchlist> {
    return this.prisma.watchlist.create({
      data: {
        userId,
        name: data.name,
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
  }

  async findById(id: string, userId: string): Promise<(Watchlist & { items: (WatchlistItem & { company: any })[] }) | null> {
    return this.prisma.watchlist.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            company: true,
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  async findByName(userId: string, name: string): Promise<(Watchlist & { items: (WatchlistItem & { company: any })[] }) | null> {
    return this.prisma.watchlist.findFirst({
      where: { userId, name },
      include: {
        items: {
          include: {
            company: true,
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }

  async listByUser(userId: string): Promise<(Watchlist & { _count: { items: number } })[]> {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, userId: string, data: { name?: string; description?: string }): Promise<Watchlist> {
    const existing = await this.prisma.watchlist.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new Error(`Watchlist ${id} not found for user ${userId}`);
    }
    return this.prisma.watchlist.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
  }

  async delete(id: string, userId: string): Promise<Watchlist> {
    const existing = await this.prisma.watchlist.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new Error(`Watchlist ${id} not found for user ${userId}`);
    }
    return this.prisma.watchlist.delete({ where: { id } });
  }

  async addItem(
    watchlistId: string,
    userId: string,
    data: { companyId: string; notes?: string }
  ): Promise<WatchlistItem> {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!watchlist) {
      throw new Error(`Watchlist ${watchlistId} not found for user ${userId}`);
    }
    return this.prisma.watchlistItem.upsert({
      where: {
        watchlistId_companyId: {
          watchlistId,
          companyId: data.companyId,
        },
      },
      create: {
        watchlistId,
        companyId: data.companyId,
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      update: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
  }

  async removeItem(watchlistId: string, companyId: string, userId: string): Promise<WatchlistItem> {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!watchlist) {
      throw new Error(`Watchlist ${watchlistId} not found for user ${userId}`);
    }
    return this.prisma.watchlistItem.delete({
      where: {
        watchlistId_companyId: {
          watchlistId,
          companyId,
        },
      },
    });
  }

  async updateItemNotes(
    watchlistId: string,
    companyId: string,
    userId: string,
    notes: string
  ): Promise<WatchlistItem> {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!watchlist) {
      throw new Error(`Watchlist ${watchlistId} not found for user ${userId}`);
    }
    return this.prisma.watchlistItem.update({
      where: {
        watchlistId_companyId: {
          watchlistId,
          companyId,
        },
      },
      data: { notes },
    });
  }

  async getWatchlistWithItems(watchlistId: string, userId: string) {
    return this.prisma.watchlist.findFirst({
      where: { id: watchlistId, userId },
      include: {
        items: {
          include: {
            company: {
              include: {
                analysisRuns: {
                  where: { userId },
                  orderBy: { calculatedAt: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    verdict: true,
                    totalPoints: true,
                    calculatedAt: true,
                  },
                },
              },
            },
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  }
}
