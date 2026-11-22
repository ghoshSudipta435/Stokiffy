/**
 * Repository tests for WatchlistRepository, RuleSetRepository, and JournalRepository.
 * Verifies tenant isolation, audit immutability, and relational queries with mocked Prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatchlistRepository } from '../src/repositories/watchlist-repository.js';
import { RuleSetRepository } from '../src/repositories/rule-set-repository.js';
import { JournalRepository } from '../src/repositories/journal-repository.js';

// Mock Prisma Client
const mockPrisma = {
  watchlist: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  watchlistItem: {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
  ruleSet: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  industryBenchmark: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  tradePlan: {
    findFirst: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (callback: any) => {
    if (typeof callback === 'function') {
      return callback(mockPrisma);
    }
    return Promise.all(callback);
  }),
} as any;

describe('WatchlistRepository', () => {
  let repo: WatchlistRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new WatchlistRepository(mockPrisma);
  });

  it('can be instantiated with a mock Prisma client', () => {
    expect(repo).toBeInstanceOf(WatchlistRepository);
  });

  it('create passes userId, name, and optional description', async () => {
    mockPrisma.watchlist.create.mockResolvedValue({
      id: 'wl-1',
      userId: 'user-1',
      name: 'High Growth',
      description: 'Growth tech stocks',
    });

    const res = await repo.create('user-1', {
      name: 'High Growth',
      description: 'Growth tech stocks',
    });

    expect(mockPrisma.watchlist.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'High Growth',
        description: 'Growth tech stocks',
      },
    });
    expect(res.id).toBe('wl-1');
  });

  it('findById scopes by id and userId', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({
      id: 'wl-1',
      userId: 'user-1',
      name: 'High Growth',
    });

    const res = await repo.findById('wl-1', 'user-1');
    expect(mockPrisma.watchlist.findFirst).toHaveBeenCalledWith({
      where: { id: 'wl-1', userId: 'user-1' },
      include: {
        items: {
          include: { company: true },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
    expect(res?.name).toBe('High Growth');
  });

  it('findByName scopes by userId and name', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue(null);
    await repo.findByName('user-1', 'High Growth');
    expect(mockPrisma.watchlist.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', name: 'High Growth' },
      include: {
        items: {
          include: { company: true },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
  });

  it('listByUser orders by createdAt asc and includes item count', async () => {
    mockPrisma.watchlist.findMany.mockResolvedValue([]);
    await repo.listByUser('user-1');
    expect(mockPrisma.watchlist.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('update verifies tenant ownership before updating', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1' });
    mockPrisma.watchlist.update.mockResolvedValue({ id: 'wl-1', name: 'Updated Name' });

    const res = await repo.update('wl-1', 'user-1', { name: 'Updated Name' });
    expect(mockPrisma.watchlist.findFirst).toHaveBeenCalledWith({
      where: { id: 'wl-1', userId: 'user-1' },
    });
    expect(mockPrisma.watchlist.update).toHaveBeenCalledWith({
      where: { id: 'wl-1' },
      data: { name: 'Updated Name' },
    });
    expect(res.name).toBe('Updated Name');
  });

  it('update throws error if watchlist does not belong to user', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue(null);
    await expect(repo.update('wl-foreign', 'user-1', { name: 'Hack' })).rejects.toThrow(
      'Watchlist wl-foreign not found for user user-1'
    );
  });

  it('delete verifies tenant ownership before deleting', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1' });
    mockPrisma.watchlist.delete.mockResolvedValue({ id: 'wl-1' });

    await repo.delete('wl-1', 'user-1');
    expect(mockPrisma.watchlist.delete).toHaveBeenCalledWith({
      where: { id: 'wl-1' },
    });
  });

  it('addItem adds or upserts company to user-owned watchlist', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1' });
    mockPrisma.watchlistItem.upsert.mockResolvedValue({
      id: 'wli-1',
      watchlistId: 'wl-1',
      companyId: 'comp-1',
      notes: 'Entry test',
    });

    const res = await repo.addItem('wl-1', 'user-1', {
      companyId: 'comp-1',
      notes: 'Entry test',
    });

    expect(mockPrisma.watchlistItem.upsert).toHaveBeenCalledWith({
      where: {
        watchlistId_companyId: {
          watchlistId: 'wl-1',
          companyId: 'comp-1',
        },
      },
      create: {
        watchlistId: 'wl-1',
        companyId: 'comp-1',
        notes: 'Entry test',
      },
      update: {
        notes: 'Entry test',
      },
    });
    expect(res.id).toBe('wli-1');
  });

  it('removeItem verifies ownership before deleting item', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1' });
    mockPrisma.watchlistItem.delete.mockResolvedValue({ id: 'wli-1' });

    await repo.removeItem('wl-1', 'comp-1', 'user-1');
    expect(mockPrisma.watchlistItem.delete).toHaveBeenCalledWith({
      where: {
        watchlistId_companyId: {
          watchlistId: 'wl-1',
          companyId: 'comp-1',
        },
      },
    });
  });

  it('updateItemNotes updates notes safely after ownership check', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1' });
    mockPrisma.watchlistItem.update.mockResolvedValue({
      id: 'wli-1',
      notes: 'New note',
    });

    const res = await repo.updateItemNotes('wl-1', 'comp-1', 'user-1', 'New note');
    expect(mockPrisma.watchlistItem.update).toHaveBeenCalledWith({
      where: {
        watchlistId_companyId: {
          watchlistId: 'wl-1',
          companyId: 'comp-1',
        },
      },
      data: { notes: 'New note' },
    });
    expect(res.notes).toBe('New note');
  });

  it('getWatchlistWithItems queries watchlist, items, company and latest analysisRun', async () => {
    mockPrisma.watchlist.findFirst.mockResolvedValue({
      id: 'wl-1',
      userId: 'user-1',
      name: 'Core',
      items: [],
    });

    await repo.getWatchlistWithItems('wl-1', 'user-1');
    expect(mockPrisma.watchlist.findFirst).toHaveBeenCalledWith({
      where: { id: 'wl-1', userId: 'user-1' },
      include: {
        items: {
          include: {
            company: {
              include: {
                analysisRuns: {
                  where: { userId: 'user-1' },
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
  });
});

describe('RuleSetRepository', () => {
  let repo: RuleSetRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new RuleSetRepository(mockPrisma);
  });

  it('can be instantiated with a mock Prisma client', () => {
    expect(repo).toBeInstanceOf(RuleSetRepository);
  });

  it('getActivePublished finds latest published rule set with benchmarks', async () => {
    mockPrisma.ruleSet.findFirst.mockResolvedValue({
      id: 'rs-1',
      version: 'v1.0.0',
      status: 'PUBLISHED',
      benchmarks: [],
    });

    const res = await repo.getActivePublished();
    expect(mockPrisma.ruleSet.findFirst).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      include: {
        benchmarks: {
          orderBy: { industry: 'asc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
    expect(res?.version).toBe('v1.0.0');
  });

  it('getByVersion finds rule set by unique version string', async () => {
    mockPrisma.ruleSet.findUnique.mockResolvedValue({ id: 'rs-1', version: 'v1.0.0' });
    const res = await repo.getByVersion('v1.0.0');
    expect(mockPrisma.ruleSet.findUnique).toHaveBeenCalledWith({
      where: { version: 'v1.0.0' },
      include: {
        benchmarks: {
          orderBy: { industry: 'asc' },
        },
      },
    });
    expect(res?.id).toBe('rs-1');
  });

  it('listVersions orders by createdAt desc', async () => {
    mockPrisma.ruleSet.findMany.mockResolvedValue([]);
    await repo.listVersions();
    expect(mockPrisma.ruleSet.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('upsertDraft creates or updates draft rule set', async () => {
    mockPrisma.ruleSet.upsert.mockResolvedValue({
      id: 'rs-draft',
      version: 'v2.0.0-draft',
      status: 'DRAFT',
    });

    const res = await repo.upsertDraft('v2.0.0-draft', {
      name: 'Next Gen Valuation',
      configJson: { stageA: { minRoce: 18 } },
    });

    expect(mockPrisma.ruleSet.upsert).toHaveBeenCalledWith({
      where: { version: 'v2.0.0-draft' },
      create: {
        version: 'v2.0.0-draft',
        name: 'Next Gen Valuation',
        status: 'DRAFT',
        configJson: { stageA: { minRoce: 18 } },
      },
      update: {
        name: 'Next Gen Valuation',
        configJson: { stageA: { minRoce: 18 } },
      },
    });
    expect(res.status).toBe('DRAFT');
  });

  it('publishVersion transitions status to PUBLISHED and archives previous', async () => {
    mockPrisma.ruleSet.findUnique.mockResolvedValue({
      id: 'rs-1',
      version: 'v1.0.0',
      status: 'DRAFT',
    });
    mockPrisma.ruleSet.update.mockResolvedValue({
      id: 'rs-1',
      version: 'v1.0.0',
      status: 'PUBLISHED',
    });

    const res = await repo.publishVersion('v1.0.0');

    expect(mockPrisma.ruleSet.updateMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    expect(mockPrisma.ruleSet.update).toHaveBeenCalledWith({
      where: { version: 'v1.0.0' },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      },
    });
    expect(res.status).toBe('PUBLISHED');
  });

  it('publishVersion throws when rule set not found', async () => {
    mockPrisma.ruleSet.findUnique.mockResolvedValue(null);
    await expect(repo.publishVersion('v999')).rejects.toThrow('RuleSet version v999 not found');
  });

  it('upsertBenchmark upserts industry benchmark for ruleSet', async () => {
    mockPrisma.industryBenchmark.upsert.mockResolvedValue({
      id: 'bm-1',
      ruleSetId: 'rs-1',
      industry: 'IT services',
      opmMinPct: 0.22,
      opmMaxPct: 0.28,
    });

    await repo.upsertBenchmark('rs-1', {
      industry: 'IT services',
      opmMinPct: 0.22,
      opmMaxPct: 0.28,
    });

    expect(mockPrisma.industryBenchmark.upsert).toHaveBeenCalledWith({
      where: {
        ruleSetId_industry: {
          ruleSetId: 'rs-1',
          industry: 'IT services',
        },
      },
      create: {
        ruleSetId: 'rs-1',
        industry: 'IT services',
        opmMinPct: 0.22,
        opmMaxPct: 0.28,
      },
      update: {
        opmMinPct: 0.22,
        opmMaxPct: 0.28,
      },
    });
  });

  it('bulkUpsertBenchmarks calls upsert for all benchmarks', async () => {
    mockPrisma.industryBenchmark.upsert.mockResolvedValue({ id: 'bm-1' });

    const count = await repo.bulkUpsertBenchmarks('rs-1', [
      { industry: 'IT services', opmMinPct: 0.22 },
      { industry: 'Pharma', opmMinPct: 0.25 },
    ]);

    expect(count).toBe(2);
    expect(mockPrisma.industryBenchmark.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('JournalRepository', () => {
  let repo: JournalRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new JournalRepository(mockPrisma);
  });

  it('can be instantiated with a mock Prisma client', () => {
    expect(repo).toBeInstanceOf(JournalRepository);
  });

  it('createEntry creates journal entry with tenant scoping', async () => {
    mockPrisma.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      userId: 'user-1',
      tradePlanId: 'tp-1',
      action: 'buy',
      quantity: 100,
      price: 3200,
    });

    const res = await repo.createEntry('user-1', {
      tradePlanId: 'tp-1',
      date: new Date('2026-11-20'),
      action: 'buy',
      quantity: 100,
      price: 3200,
      fees: 25,
      taxes: 15,
      reason: 'Stage F approval triggered entry',
    });

    expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tradePlanId: 'tp-1',
        date: expect.any(Date),
        action: 'buy',
        quantity: 100,
        price: 3200,
        fees: 25,
        taxes: 15,
        reason: 'Stage F approval triggered entry',
        ruleTriggers: [],
      },
    });
    expect(res.id).toBe('je-1');
  });

  it('appendReview strictly updates ONLY review fields, preserving original execution audit trail', async () => {
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      id: 'je-1',
      userId: 'user-1',
      action: 'buy',
      quantity: 100,
      price: 3200,
      fees: 25,
      taxes: 15,
    });
    mockPrisma.journalEntry.update.mockResolvedValue({
      id: 'je-1',
      review: {
        rulesWorked: ['Breakout confirmation'],
        assumptionsFailed: [],
        executionQuality: 'good',
        slippage: 0.05,
        behaviouralNotes: 'Disciplined entry',
        lesson: 'Wait for volume spike',
      },
      reviewedAt: new Date('2026-11-20T10:00:00Z'),
      reviewedBy: 'user-1',
    });

    const reviewPayload = {
      rulesWorked: ['Breakout confirmation'],
      assumptionsFailed: [],
      executionQuality: 'good',
      slippage: 0.05,
      behaviouralNotes: 'Disciplined entry',
      lesson: 'Wait for volume spike',
      reviewedAt: new Date('2026-11-20T10:00:00Z'),
      reviewedBy: 'user-1',
    };

    const res = await repo.appendReview('je-1', 'user-1', reviewPayload);

    // Verify findFirst checked tenant ownership
    expect(mockPrisma.journalEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'je-1',
        userId: 'user-1',
      },
    });

    // Verify update ONLY touched review, reviewedAt, reviewedBy (immutability check)
    expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith({
      where: { id: 'je-1' },
      data: {
        review: reviewPayload,
        reviewedAt: reviewPayload.reviewedAt,
        reviewedBy: 'user-1',
      },
    });

    expect(res.reviewedBy).toBe('user-1');
  });

  it('appendReview throws when journal entry does not belong to user', async () => {
    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      repo.appendReview('je-foreign', 'user-1', {
        rulesWorked: [],
        assumptionsFailed: [],
        executionQuality: 'poor',
        slippage: 0,
        behaviouralNotes: '',
        lesson: '',
        reviewedAt: new Date('2026-11-20T10:00:00Z'),
        reviewedBy: 'user-1',
      })
    ).rejects.toThrow('JournalEntry je-foreign not found for user user-1');
  });

  it('findById scopes by id and userId', async () => {
    mockPrisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1' });
    const res = await repo.findById('je-1', 'user-1');
    expect(mockPrisma.journalEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'je-1',
        userId: 'user-1',
      },
      include: {
        tradePlan: {
          include: {
            company: true,
          },
        },
      },
    });
    expect(res?.id).toBe('je-1');
  });

  it('listByUser scopes by userId', async () => {
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);
    await repo.listByUser('user-1');
    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
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
  });

  it('listByTradePlan scopes by tradePlanId and userId', async () => {
    mockPrisma.journalEntry.findMany.mockResolvedValue([]);
    await repo.listByTradePlan('tp-1', 'user-1');
    expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith({
      where: { tradePlanId: 'tp-1', userId: 'user-1' },
      orderBy: { date: 'asc' },
    });
  });
});
