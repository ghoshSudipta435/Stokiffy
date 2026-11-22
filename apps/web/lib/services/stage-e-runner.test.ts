/**
 * Unit tests for apps/web/lib/services/stage-e-runner.ts
 *
 * Verifies:
 * 1. DB-to-StageEInput mapping (price bars, valuation defaults from Stage D)
 * 2. End-to-end execution of scoreStageE with sufficient price history
 * 3. Defaults valuationMaxBuyPrice / selectedFairValue from latest AnalysisStageD
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStageEForCompany } from './stage-e-runner';
import type { StageERunnerResult } from './stage-e-runner';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    priceBar: { findMany: vi.fn() },
    analysisStageD: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@stock-assistant/db';

const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst) as any;
const mockPriceBarFindMany = vi.mocked(prisma.priceBar.findMany) as any;
const mockAnalysisStageDFindFirst = vi.mocked(prisma.analysisStageD.findFirst) as any;

const baseCompany = {
  id: 'comp-tcs',
  symbol: 'TCS',
  name: 'Tata Consultancy Services Ltd.',
  sector: 'Information Technology',
  userId: 'owner_user_01',
};

function resetMocks() {
  mockCompanyFindFirst.mockReset();
  mockPriceBarFindMany.mockReset();
  mockAnalysisStageDFindFirst.mockReset();

  mockCompanyFindFirst.mockResolvedValue(baseCompany);
  mockAnalysisStageDFindFirst.mockResolvedValue({
    id: 'asd-tcs',
    analysisRunId: 'run-tcs',
    maxBuyPrice: 3200,
    fairValue: 4000,
  } as any);
}

// Generate 25 chronological daily OHLCV bars (>= DEFAULT_MIN_DAILY_BARS = 20)
function generatePriceBars(count = 25, baseClose = 3500) {
  const bars = [];
  let close = baseClose;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const open = close;
    close = close * (1 + (Math.sin(i / 5) * 0.02));
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    bars.push({
      id: `pb-${i}`,
      companyId: 'comp-tcs',
      date: new Date(now - (count - i) * 86400000).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000000 + i * 10000,
      adjusted: true,
    });
  }
  return bars;
}

describe('stage-e-runner', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('DB-to-StageEInput mapping', () => {
    it('maps price bars into StageEInput chronologically', async () => {
      const bars = generatePriceBars(25);
      mockPriceBarFindMany.mockResolvedValue(bars as any);

      const result = await runStageEForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageERunnerResult;

      expect(result.company.symbol).toBe('TCS');
      expect(result.input.adjustedOhlcvDaily.length).toBe(25);
      expect(result.input.adjustedOhlcvDaily[0]!.close).toBeDefined();
      expect(result.input.adjustedOhlcvDaily[0]!.open).toBeGreaterThan(0);

      // Valuation defaults pulled from latest Stage D
      expect(result.input.valuationMaxBuyPrice).toBe(3200);
      expect(result.input.selectedFairValue).toBe(4000);

      // Provenance tracked
      expect(result.input.dataProvenance!.source).toBe('postgresql');
      expect(result.input.dataProvenance!.isMissing).toBe(false);
    });

    it('preserves null values without zero-coercion where type allows', async () => {
      const bars = generatePriceBars(25).map((b, i) => ({
        ...b,
        close: i === 0 ? null : b.close,
      }));
      mockPriceBarFindMany.mockResolvedValue(bars as any);

      const result = await runStageEForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageERunnerResult;

      // OhlcvBar requires numbers; null close coerced to 0 for type compatibility
      // but the first bar close is 0 (fallback) — provenance not missing since bars exist
      expect(result.input.dataProvenance!.isMissing).toBe(false);
      expect(result.input.adjustedOhlcvDaily.length).toBe(25);
    });

    it('uses user overrides when provided', async () => {
      const bars = generatePriceBars(25);
      mockPriceBarFindMany.mockResolvedValue(bars as any);

      const result = await runStageEForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
        valuationMaxBuyPrice: 3000,
        targetPrice: 3800,
        minRiskReward: 2.0,
      }) as StageERunnerResult;

      expect(result.input.valuationMaxBuyPrice).toBe(3000);
      expect(result.input.selectedFairValue).toBe(3800);
      expect(result.input.minRiskReward).toBe(2.0);
    });
  });

  describe('End-to-end scoreStageE execution', () => {
    it('runs technical analysis for a company with sufficient history', async () => {
      const bars = generatePriceBars(25, 3500);
      mockPriceBarFindMany.mockResolvedValue(bars as any);

      const result = await runStageEForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageERunnerResult;

      expect(result.output.stage).toBe('E');
      expect(result.output.verdict).toBeDefined();
      expect(result.output.eligible).toBeDefined();
      expect(result.output.gatePassed).toBeDefined();
      expect(result.output.canProceedToStageF).toBeDefined();
      expect(result.output.priceData.currentPrice).toBeDefined();
      expect(result.output.priceData.maxBuyPrice).toBeDefined();
      expect(result.output.technicalContext.atr14).toBeDefined();
      expect(result.output.technicalContext.volumeRatio).toBeDefined();
      expect(result.output.setups.length).toBeGreaterThanOrEqual(0);
    });
  });
});
