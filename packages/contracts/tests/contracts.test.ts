/**
 * Zod validation tests for @stock-assistant/contracts
 * Verifies contract schemas validate correctly
 */

import { describe, it, expect } from 'vitest';
import {
  CompanySchema,
  FinancialStatementSchema,
  PriceBarSchema,
  DataProvenanceSchema,
  SectorSchema,
  FlagClassSchema,
  CreateTradePlanRequestSchema,
  TransactionRequestSchema,
  PaginationQuerySchema,
  HttpErrorCode,
} from '../src/index.js';

describe('Zod contract schemas', () => {
  describe('CompanySchema', () => {
    it('validates a complete company profile', () => {
      const result = CompanySchema.safeParse({
        id: 'cuid1234567890',
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        isin: 'INE467B01029',
        sector: 'non-financial',
        exchange: 'NSE',
        isActive: true,
        createdAt: '2026-11-15T10:00:00Z',
        updatedAt: '2026-11-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing symbol', () => {
      const result = CompanySchema.safeParse({
        id: 'cuid1234567890',
        symbol: '',
        name: 'Test',
        sector: 'non-financial',
        exchange: 'NSE',
        createdAt: '2026-11-15T10:00:00Z',
        updatedAt: '2026-11-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FinancialStatementSchema', () => {
    it('validates a complete financial statement', () => {
      const result = FinancialStatementSchema.safeParse({
        id: 'cuid1234567890',
        companyId: 'TCS',
        periodType: 'Annual',
        fiscalYear: 'FY2024',
        revenue: { value: 10000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        netProfit: { value: 2000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        operatingProfit: { value: 2500, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        totalAssets: { value: 50000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        totalLiabilities: { value: 20000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        totalEquity: { value: 30000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        totalDebt: { value: 5000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        currentAssets: { value: 15000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        currentLiabilities: { value: 10000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        interestExpense: { value: 500, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        ebit: { value: 3000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        eps: { value: 50, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        depreciationAmortization: { value: 1000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        capitalExpenditure: { value: 2000, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        changeInWorkingCapital: { value: 500, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        fcf: { value: 1500, provenance: { source: 'csv', fetchedAt: '2026-11-15T10:00:00Z', reportedPeriod: 'FY2024', currency: 'INR', unit: 'CRORE', adjustmentStatus: 'reported', quality: 'verified', isMissing: false } },
        createdAt: '2026-11-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PriceBarSchema', () => {
    it('validates OHLCV data with consistency', () => {
      const result = PriceBarSchema.safeParse({
        id: 'cuid1234567890',
        companyId: 'TCS',
        date: '2026-11-15T10:00:00Z',
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1000000,
        adjusted: true,
        createdAt: '2026-11-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-positive close price', () => {
      const result = PriceBarSchema.safeParse({
        id: 'cuid1234567890',
        companyId: 'TCS',
        date: '2026-11-15T10:00:00Z',
        open: 100,
        high: 105,
        low: 99,
        close: 0,
        volume: 1000000,
        createdAt: '2026-11-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DataProvenanceSchema', () => {
    it('validates a complete provenance record', () => {
      const result = DataProvenanceSchema.safeParse({
        source: 'manual-csv',
        fetchedAt: '2026-11-15T10:00:00Z',
        reportedPeriod: 'FY2024',
        currency: 'INR',
        unit: 'CRORE',
        adjustmentStatus: 'reported',
        quality: 'verified',
        isMissing: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SectorSchema', () => {
    it('accepts all valid sector values', () => {
      const validSectors = [
        'non-financial',
        'bank',
        'nbfc',
        'insurance',
        'other-financial',
      ];
      for (const sector of validSectors) {
        const result = SectorSchema.safeParse(sector);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('FlagClassSchema', () => {
    it('accepts all four flag classes', () => {
      const classes = [
        'HARD_STOP',
        'CONDITIONAL_WARNING',
        'DATA_QUALITY_WARNING',
        'VALUATION_WARNING',
      ];
      for (const cls of classes) {
        const result = FlagClassSchema.safeParse(cls);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('CreateTradePlanRequestSchema', () => {
    it('validates a valid trade plan request', () => {
      const result = CreateTradePlanRequestSchema.safeParse({
        companyId: 'TCS',
        entryPrice: 100,
        stopPrice: 95,
        riskPercentage: 1.0,
        thesis: 'Strong fundamentals with good moat and reasonable valuation.',
        invalidationCondition: 'ROCE falls below 10% for two consecutive quarters.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects stop price >= entry price', () => {
      const result = CreateTradePlanRequestSchema.safeParse({
        companyId: 'TCS',
        entryPrice: 100,
        stopPrice: 105,
        riskPercentage: 1.0,
        thesis: 'Test thesis with sufficient length here.',
        invalidationCondition: 'Test invalidation condition here.',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TransactionRequestSchema', () => {
    it('validates a valid transaction request', () => {
      const result = TransactionRequestSchema.safeParse({
        companyId: 'TCS',
        action: 'buy',
        quantity: 100,
        price: 1500,
        fees: 10,
        taxes: 5,
        reason: 'Fundamental analysis score above threshold',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PaginationQuerySchema', () => {
    it('applies default limit', () => {
      const result = PaginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
      }
    });

    it('rejects limit above 100', () => {
      const result = PaginationQuerySchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('HttpErrorCode', () => {
    it('defines all standard error codes', () => {
      expect(HttpErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(HttpErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(HttpErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(HttpErrorCode.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(HttpErrorCode.CONFLICT).toBe('CONFLICT');
      expect(HttpErrorCode.UNPROCESSABLE_ENTITY).toBe('UNPROCESSABLE_ENTITY');
      expect(HttpErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(HttpErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
