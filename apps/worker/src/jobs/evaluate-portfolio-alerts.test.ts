import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertEvaluationService } from './services/alert-evaluation.service.js';
import { handleEvaluatePortfolioAlerts } from './handlers/evaluate-portfolio-alerts.js';
import { logger } from '../lib/logger.js';

describe('AlertEvaluationService', () => {
  let mockPrisma: any;
  let service: AlertEvaluationService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      portfolioHolding: {
        findMany: vi.fn(),
      },
      watchlist: {
        findMany: vi.fn(),
      },
      tradePlan: {
        findFirst: vi.fn(),
      },
      priceBar: {
        findFirst: vi.fn(),
      },
      redFlag: {
        findMany: vi.fn(),
      },
      alert: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'alert-mock-1', ...data })
        ),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: 'audit-mock-1' }),
      },
    };

    service = new AlertEvaluationService(mockPrisma);
  });

  it('triggers stop-loss alert when price is at or below stop loss', async () => {
    // 1 holding: TCS, current price 3000, stopLoss 3050 (breached!)
    mockPrisma.portfolioHolding.findMany.mockResolvedValue([
      {
        id: 'hold-1',
        userId: 'user-1',
        companyId: 'comp-tcs',
        symbol: 'TCS',
        quantity: 10,
        avgPrice: 3200,
        currentPrice: 3000,
        marketValue: 30000,
        sector: 'Technology',
        unrealisedPnl: -2000,
        unrealisedPnlPct: -6.25,
        stopLoss: 3050,
        targets: [3500],
        entryDate: new Date('2026-11-01'),
      },
    ]);

    mockPrisma.tradePlan.findFirst.mockResolvedValue({
      id: 'tp-1',
      thesis: 'Growth runway intact',
      stopLoss: 3050,
      targets: [3500],
    });

    mockPrisma.priceBar.findFirst.mockResolvedValue({
      close: 3000,
      date: new Date('2026-11-20'),
    });

    mockPrisma.redFlag.findMany.mockResolvedValue([]);
    mockPrisma.watchlist.findMany.mockResolvedValue([]);
    mockPrisma.alert.findMany.mockResolvedValue([]); // No existing unacknowledged alerts

    mockPrisma.alert.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'alert-new-1', ...data })
    );
    mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });

    const jobLogger = logger.forJob('job-test-1', 'evaluate-portfolio-alerts');
    const result = await service.evaluate({ userId: 'user-1' }, jobLogger);

    expect(result.totalPositionsEvaluated).toBe(1);
    expect(result.totalNewAlertsCreated).toBeGreaterThanOrEqual(1);
    expect(mockPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          companyId: 'comp-tcs',
          type: 'price-stop',
          severity: 'critical',
        }),
      })
    );
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'EVALUATE_PORTFOLIO_ALERTS',
          entityType: 'Portfolio',
        }),
      })
    );
  });

  it('triggers target alert when stock reaches first target', async () => {
    // 1 holding: TCS, current price 3550, target 3500 (reached!)
    mockPrisma.portfolioHolding.findMany.mockResolvedValue([
      {
        id: 'hold-1',
        userId: 'user-1',
        companyId: 'comp-tcs',
        symbol: 'TCS',
        quantity: 10,
        avgPrice: 3200,
        currentPrice: 3550,
        marketValue: 35500,
        sector: 'Technology',
        unrealisedPnl: 3500,
        unrealisedPnlPct: 10.9,
        stopLoss: 3000,
        targets: [3500],
        entryDate: new Date('2026-11-01'),
      },
    ]);

    mockPrisma.tradePlan.findFirst.mockResolvedValue({
      id: 'tp-1',
      thesis: 'Growth runway intact',
      stopLoss: 3000,
      targets: [3500],
    });

    mockPrisma.priceBar.findFirst.mockResolvedValue({
      close: 3550,
      date: new Date('2026-11-20'),
    });

    mockPrisma.redFlag.findMany.mockResolvedValue([]);
    mockPrisma.watchlist.findMany.mockResolvedValue([]);
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'alert-target-1', ...data })
    );

    const jobLogger = logger.forJob('job-test-2', 'evaluate-portfolio-alerts');
    const result = await service.evaluate({ userId: 'user-1' }, jobLogger);

    expect(result.totalPositionsEvaluated).toBe(1);
    expect(result.totalNewAlertsCreated).toBeGreaterThanOrEqual(1);
    expect(mockPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          companyId: 'comp-tcs',
          type: 'price-target',
          severity: 'warning',
        }),
      })
    );
  });

  it('deduplicates alerts when unacknowledged alert of same type and company already exists', async () => {
    // Current price is at stop loss, but an unacknowledged price-stop alert already exists!
    mockPrisma.portfolioHolding.findMany.mockResolvedValue([
      {
        id: 'hold-1',
        userId: 'user-1',
        companyId: 'comp-tcs',
        symbol: 'TCS',
        quantity: 10,
        avgPrice: 3200,
        currentPrice: 3000,
        marketValue: 30000,
        sector: 'Technology',
        unrealisedPnl: -2000,
        unrealisedPnlPct: -6.25,
        stopLoss: 3050,
        targets: [3500],
        entryDate: new Date('2026-11-01'),
      },
    ]);

    mockPrisma.tradePlan.findFirst.mockResolvedValue({
      id: 'tp-1',
      stopLoss: 3050,
    });

    mockPrisma.priceBar.findFirst.mockResolvedValue({
      close: 3000,
    });

    mockPrisma.redFlag.findMany.mockResolvedValue([]);
    mockPrisma.watchlist.findMany.mockResolvedValue([]);

    // EXISTING unacknowledged alerts for TCS, concentration, and cash drawdown
    mockPrisma.alert.findMany.mockResolvedValue([
      {
        type: 'price-stop',
        companyId: 'comp-tcs',
      },
      {
        type: 'portfolio-concentration',
        companyId: 'comp-tcs',
      },
      {
        type: 'portfolio-concentration',
        companyId: null,
      },
      {
        type: 'portfolio-drawdown',
        companyId: null,
      },
    ]);

    const jobLogger = logger.forJob('job-test-3', 'evaluate-portfolio-alerts');
    const result = await service.evaluate({ userId: 'user-1' }, jobLogger);

    expect(result.totalPositionsEvaluated).toBe(1);
    // Duplicate was skipped, 0 new alerts created
    expect(result.totalNewAlertsCreated).toBe(0);
    expect(result.totalSkippedDuplicates).toBeGreaterThanOrEqual(1);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
  });

  it('handles empty portfolio gracefully without error', async () => {
    mockPrisma.portfolioHolding.findMany.mockResolvedValue([]);
    mockPrisma.watchlist.findMany.mockResolvedValue([]);
    mockPrisma.alert.findMany.mockResolvedValue([]);

    const jobLogger = logger.forJob('job-test-4', 'evaluate-portfolio-alerts');
    const result = await service.evaluate({ userId: 'user-empty' }, jobLogger);

    expect(result.totalUsers).toBe(1);
    expect(result.totalPositionsEvaluated).toBe(0);
    expect(result.totalNewAlertsCreated).toBe(0);
    expect(result.totalSkippedDuplicates).toBe(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
  });

  it('evaluates watchlist target price reaches', async () => {
    mockPrisma.portfolioHolding.findMany.mockResolvedValue([]);
    mockPrisma.watchlist.findMany.mockResolvedValue([
      {
        id: 'wl-1',
        userId: 'user-1',
        items: [
          {
            companyId: 'comp-infy',
            targetPrice: 1800,
            company: { symbol: 'INFY' },
          },
        ],
      },
    ]);

    mockPrisma.priceBar.findFirst.mockResolvedValue({
      close: 1850,
    });

    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'alert-wl-1', ...data })
    );

    const jobLogger = logger.forJob('job-test-5', 'evaluate-portfolio-alerts');
    const result = await service.evaluate({ userId: 'user-1', includeWatchlists: true }, jobLogger);

    expect(result.totalNewAlertsCreated).toBe(1);
    expect(mockPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          companyId: 'comp-infy',
          type: 'price-target',
        }),
      })
    );
  });
});

describe('handleEvaluatePortfolioAlerts Handler', () => {
  it('accepts valid or empty payload and returns success', async () => {
    const result = await handleEvaluatePortfolioAlerts('job-h-1', {});
    expect(result).toBeDefined();
    expect(result.jobId).toBe('job-h-1');
  });

  it('rejects invalid payload without retrying', async () => {
    const result = await handleEvaluatePortfolioAlerts('job-h-2', {
      includeWatchlists: 'NOT_A_BOOLEAN',
    });
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe('INVALID_PAYLOAD');
    expect(result.retryable).toBe(false);
  });
});
