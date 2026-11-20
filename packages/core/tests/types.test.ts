/**
 * Domain type correctness tests for @stock-assistant/core
 * Verifies that type definitions match DOMAIN_MODEL_SPEC.md
 */

import { describe, it, expect } from 'vitest';
import type {
  RedFlag,
  ScoringRuleResult,
  StageScore,
  StageAInput,
  StageAOutput,
  DataProvenance,
} from '../src/index.js';

describe('Domain type definitions', () => {
  describe('DataProvenance', () => {
    it('creates a valid provenance record', () => {
      const provenance: DataProvenance = {
        source: 'manual-csv',
        fetchedAt: '2026-11-15T10:00:00Z',
        reportedPeriod: 'FY2024',
        currency: 'INR',
        unit: 'CRORE',
        adjustmentStatus: 'reported',
        quality: 'verified',
        isMissing: false,
      };
      expect(provenance.source).toBe('manual-csv');
      expect(provenance.isMissing).toBe(false);
    });
  });

  describe('RedFlag', () => {
    it('supports all four flag classes', () => {
      const classes: RedFlag['class'][] = [
        'HARD_STOP',
        'CONDITIONAL_WARNING',
        'DATA_QUALITY_WARNING',
        'VALUATION_WARNING',
      ];
      expect(classes).toHaveLength(4);
    });

    it('supports all five status values', () => {
      const statuses: RedFlag['status'][] = [
        'ACTIVE',
        'ACKNOWLEDGED',
        'OVERRIDDEN',
        'RESOLVED',
        'EXPIRED',
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('ScoringRuleResult', () => {
    it('creates a valid rule result', () => {
      const result: ScoringRuleResult = {
        ruleKey: 'STAGE_A_ROE',
        points: 1.0,
        maxPoints: 1.0,
        inputs: { roe: 0.25 },
        explanation: 'ROE >= 20%',
        redFlags: [],
        dataQuality: {
          source: 'manual-csv',
          fetchedAt: '2026-11-15T10:00:00Z',
          reportedPeriod: 'FY2024',
          currency: 'INR',
          unit: 'CRORE',
          adjustmentStatus: 'reported',
          quality: 'verified',
          isMissing: false,
        },
        ruleSetVersion: 'stage-a-v1.0',
      };
      expect(result.points).toBeLessThanOrEqual(result.maxPoints);
    });
  });

  describe('StageScore', () => {
    it('creates a valid stage score with all flag categories', () => {
      const score: StageScore = {
        stage: 'A',
        totalPoints: 8.5,
        maxPoints: 10,
        ruleResults: [],
        verdict: 'PASS',
        hardStops: [],
        conditionalWarnings: [],
        dataQualityWarnings: [],
        valuationWarnings: [],
        calculatedAt: '2026-11-15T10:00:00Z',
        ruleSetVersion: 'stage-a-v1.0',
        dataSnapshotId: 'snap-123',
      };
      expect(score.verdict).toBe('PASS');
      expect(score.totalPoints).toBeLessThanOrEqual(score.maxPoints);
    });
  });

  describe('StageAInput', () => {
    it('accepts valid Stage A financials', () => {
      const input: StageAInput = {
        companyId: 'TCS',
        asOfDate: '2026-11-15T10:00:00Z',
        financials: {
          sales: { latestFy: 1000, priorFy: 900, fy5yAgo: 600, cagr5y: 0.1 },
          profit: { latestFy: 200, priorFy: 180, fy5yAgo: 100, cagr5y: 0.15 },
          operatingProfit: { latestFy: 250, fy5yAgo: 150 },
          revenue: { latestFy: 1000, fy5yAgo: 600 },
          netProfit: { latestFy: 200, fy5yAgo: 100 },
          totalDebt: 100,
          totalEquity: 500,
          currentAssets: 400,
          currentLiabilities: 150,
          interestExpense: 10,
          ebit: 250,
          eps: 50,
          peRatio: 20,
          industryPeRatio: 15,
          roa: { latestFy: 0.15, avg5y: 0.12 },
          roe: { latestFy: 0.25, avg5y: 0.22 },
          roce: { latestFy: 0.28, avg5y: 0.24 },
          opm: { latestFy: 0.25, avg5y: 0.22 },
        },
        sector: 'non-financial',
        dataProvenance: {} as Record<keyof StageAInput['financials'], DataProvenance>,
      };
      expect(input.companyId).toBe('TCS');
      expect(input.sector).toBe('non-financial');
    });
  });

  describe('StageAOutput extends StageScore', () => {
    it('has StageA-specific fields', () => {
      const output: StageAOutput = {
        stage: 'A',
        totalPoints: 8.5,
        maxPoints: 10,
        ruleResults: [],
        verdict: 'PASS',
        hardStops: [],
        conditionalWarnings: [],
        dataQualityWarnings: [],
        valuationWarnings: [],
        calculatedAt: '2026-11-15T10:00:00Z',
        ruleSetVersion: 'stage-a-v1.0',
        dataSnapshotId: 'snap-123',
        sector: 'non-financial',
        maxPossibleScore: 10,
        minPassScore: 6.5,
        bankVariant: false,
      };
      expect(output.bankVariant).toBe(false);
      expect(output.maxPossibleScore).toBe(10);
    });
  });
});
