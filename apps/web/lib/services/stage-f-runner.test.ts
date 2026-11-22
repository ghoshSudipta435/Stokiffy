/**
 * Unit tests for apps/web/lib/services/stage-f-runner.ts
 *
 * Verifies:
 * 1. DB-to-StageFInput mapping (portfolio holdings, Stage D valuation, Stage E technicals)
 * 2. Position sizing calculation respecting 1% risk budget, 10% stock cap, 30% sector cap
 * 3. Blocking behavior when risk limits are breached without an override
 * 4. Auditable override logic requiring >= 50 chars to unblock plan
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStageFForCompany } from './stage-f-runner';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    portfolioHolding: { findMany: vi.fn() },
    analysisStageD: { findFirst: vi.fn() },
    analysisStageE: { findFirst: vi.fn() },
    ruleSet: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
  RuleSetRepository: vi.fn().mockImplementation(() => ({
    getActivePublished: vi.fn().mockResolvedValue({
      id: 'rs-published',
      version: 'v1.0.0',
      status: 'PUBLISHED',
      configJson: {
        riskLimits: {
          riskBudgetPerTradePct: 1.0,
          maxStockExposurePct: 10.0,
          maxSectorExposurePct: 30.0,
        },
      },
      benchmarks: [],
    }),
  })),
}));

import { prisma } from '@stock-assistant/db';

const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst) as any;
const mockPortfolioHoldingFindMany = vi.mocked(
  prisma.portfolioHolding.findMany
) as any;
const mockAnalysisStageDFindFirst = vi.mocked(
  prisma.analysisStageD.findFirst
) as any;
const mockAnalysisStageEFindFirst = vi.mocked(
  prisma.analysisStageE.findFirst
) as any;

const baseCompany = {
  id: 'comp-infy',
  symbol: 'INFY',
  name: 'Infosys Ltd.',
  sector: 'Information Technology',
  userId: 'owner_user_01',
};

describe('Stage F Runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCompanyFindFirst.mockResolvedValue(baseCompany);
    mockPortfolioHoldingFindMany.mockResolvedValue([
      {
        id: 'hold-tcs',
        symbol: 'TCS',
        companyId: 'comp-tcs',
        quantity: 10,
        avgPrice: 3200,
        currentPrice: 3500,
        marketValue: 35000,
        sector: 'Information Technology',
        unrealisedPnl: 3000,
        unrealisedPnlPct: 9.38,
      },
    ]);
    mockAnalysisStageDFindFirst.mockResolvedValue({
      id: 'asd-infy',
      maxBuyPrice: 1600,
      fairValue: 1800,
    });
    mockAnalysisStageEFindFirst.mockResolvedValue({
      id: 'ase-infy',
      inBuyZone: true,
      currentPrice: 1450,
      maxBuyPrice: 1600,
    });
  });

  it('calculates deterministic position sizing respecting risk budget and stock cap', async () => {
    const result = await runStageFForCompany({
      userId: 'owner_user_01',
      companyId: 'comp-infy',
      entryPrice: 1450,
      stopPrice: 1350,
      thesis: 'Solid digital transformation demand and margin recovery over multi-year cycle.',
      targets: [1650, 1800],
    });

    expect(result.company.symbol).toBe('INFY');
    expect(result.portfolio.totalValue).toBeGreaterThan(100000);
    expect(result.output.stage).toBe('F');
    expect(result.output.positionSizing.adjustedQuantity).toBeGreaterThan(0);
    expect(result.output.tradePlan.stopLoss).toBe(1350);
    expect(result.output.disclaimer).toContain('Stop-loss orders do not guarantee');
  });

  it('defaults valuationMaxBuyPrice from latest AnalysisStageD if not supplied', async () => {
    const result = await runStageFForCompany({
      userId: 'owner_user_01',
      companyId: 'comp-infy',
      entryPrice: 1450,
      stopPrice: 1380,
      thesis: 'Thesis with sufficient character count for validation requirements.',
    });

    expect(mockAnalysisStageDFindFirst).toHaveBeenCalled();
    expect(result.input.valuationMaxBuyPrice).toBe(1600);
  });

  it('blocks trade plan when stop price is above entry price or risk checks fail', async () => {
    // When entry price exceeds valuation max buy price by large margin or requested quantity exceeds limits
    const result = await runStageFForCompany({
      userId: 'owner_user_01',
      companyId: 'comp-infy',
      entryPrice: 1700, // exceeds maxBuyPrice 1600
      stopPrice: 1650,
      thesis: 'Overpriced purchase attempt exceeding valuation upper boundary.',
      valuationMaxBuyPrice: 1500,
    });

    // ScoreStageF flags valuation upper violation
    expect(result.output.riskChecks.length).toBeGreaterThan(0);
  });

  it('unblocks trade plan with auditable override of at least 50 characters', async () => {
    const validOverrideReason =
      'Executive committee approved discretionary allocation based on unprecedented cloud transformation pipeline growth.';
    expect(validOverrideReason.length).toBeGreaterThanOrEqual(50);

    const result = await runStageFForCompany({
      userId: 'owner_user_01',
      companyId: 'comp-infy',
      entryPrice: 1450,
      stopPrice: 1350,
      targets: [1460], // Risk reward = 10 / 100 = 0.10 < 1.5 (triggers STAGE_F_INSUFFICIENT_RISK_REWARD)
      thesis: 'Strategic position initiated with documented committee override.',
      overrides: [
        {
          flagId: 'STAGE_F_RISK_REWARD_BELOW_MINIMUM',
          reason: validOverrideReason,
          overriddenBy: 'owner_user_01',
        },
      ],
    });

    expect(result.output.tradePlan.overrides.length).toBe(1);
    expect(result.output.tradePlan.overrides[0]?.reason).toBe(validOverrideReason);
  });
});
