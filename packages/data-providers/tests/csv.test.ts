/**
 * CSV parser tests for @stock-assistant/data-providers
 * Verifies CSV parsing, mapping, and validation behavior
 */

import { describe, it, expect } from 'vitest';
import { CSVParser } from '../src/csv/parser.js';
import {
  validateFinancialRow,
  validateShareholdingRow,
  validatePriceRow,
} from '../src/csv/validator.js';
import {
  mapToFinancialStatement,
  mapToShareholdingPoint,
  mapToCorporateAction,
} from '../src/csv/mapper.js';

describe('CSVParser', () => {
  const mapping = {
    symbol: 'Symbol',
    revenue: 'Revenue (Cr)',
    netProfit: 'Net Profit (Cr)',
    reportedPeriod: 'Period',
  };

  it('parses valid CSV rows', () => {
    const csv = `Symbol,Revenue (Cr),Net Profit (Cr),Period
TCS,10000,2000,FY2024
HUL,50000,8000,FY2024`;

    const parser = new CSVParser(mapping);
    const result = parser.parse(csv, (row) => {
      const errors = validateFinancialRow(row, 0).errors;
      return {
        valid: errors.length === 0,
        errors,
        data: row,
      };
    });

    expect(result.rowCount).toBe(2);
    expect(result.validRowCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
  });

  it('captures parse errors for invalid rows', () => {
    const csv = `Symbol,Revenue (Cr),Net Profit (Cr),Period
,10000,2000,FY2024`;

    const parser = new CSVParser(mapping);
    const result = parser.parse(csv, (row) => {
      const errors = validateFinancialRow(row, 0).errors;
      return {
        valid: errors.length === 0,
        errors,
      };
    });

    expect(result.validRowCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles empty CSV', () => {
    const parser = new CSVParser(mapping);
    const result = parser.parse('', () => ({ valid: true, errors: [] }));
    expect(result.rowCount).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});

describe('validateFinancialRow', () => {
  it('accepts valid financial row', () => {
    const result = validateFinancialRow(
      {
        symbol: 'TCS',
        revenue: '10000',
        netProfit: '2000',
        reportedPeriod: 'FY2024',
      },
      1
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing symbol', () => {
    const result = validateFinancialRow(
      { symbol: '', revenue: '10000', netProfit: '2000', reportedPeriod: 'FY2024' },
      1
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.column).toBe('symbol');
  });

  it('rejects invalid period format', () => {
    const result = validateFinancialRow(
      {
        symbol: 'TCS',
        revenue: '10000',
        netProfit: '2000',
        reportedPeriod: 'INVALID',
      },
      1
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.column).toBe('reportedPeriod');
  });
});

describe('validateShareholdingRow', () => {
  it('accepts valid shareholding row', () => {
    const result = validateShareholdingRow(
      {
        symbol: 'TCS',
        promoterPct: '55',
        fiiPct: '20',
        diiPct: '15',
        publicPct: '10',
      },
      1
    );
    expect(result.valid).toBe(true);
  });

  it('rejects percentage > 100', () => {
    const result = validateShareholdingRow(
      { symbol: 'TCS', promoterPct: '150', fiiPct: '20', diiPct: '15', publicPct: '10' },
      1
    );
    expect(result.valid).toBe(false);
  });
});

describe('validatePriceRow', () => {
  it('accepts valid OHLCV row', () => {
    const result = validatePriceRow(
      {
        symbol: 'TCS',
        date: '2026-11-15',
        open: '100',
        high: '105',
        low: '99',
        close: '103',
        volume: '1000000',
      },
      1
    );
    expect(result.valid).toBe(true);
  });

  it('rejects high less than close', () => {
    const result = validatePriceRow(
      {
        symbol: 'TCS',
        date: '2026-11-15',
        open: '100',
        high: '100',
        low: '99',
        close: '103',
        volume: '1000000',
      },
      1
    );
    expect(result.valid).toBe(false);
  });
});

describe('mapToFinancialStatement', () => {
  it('maps valid CSV row to FinancialStatement', () => {
    const { statement, errors } = mapToFinancialStatement(
      {
        symbol: 'TCS',
        revenue: '10000',
        netProfit: '2000',
      },
      'manual-csv',
      'FY2024'
    );
    expect(statement).not.toBeNull();
    expect(statement!.companyId).toBe('TCS');
    expect(errors).toHaveLength(0);
  });

  it('returns null for missing symbol', () => {
    const { statement, errors } = mapToFinancialStatement(
      { revenue: '10000', netProfit: '2000' },
      'manual-csv',
      'FY2024'
    );
    expect(statement).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('mapToShareholdingPoint', () => {
  it('maps valid CSV row to ShareholdingPoint', () => {
    const { shareholding, errors } = mapToShareholdingPoint(
      {
        symbol: 'TCS',
        promoterPct: '55',
        fiiPct: '20',
        diiPct: '15',
        publicPct: '10',
      },
      'manual-csv',
      'FY2024'
    );
    expect(shareholding).not.toBeNull();
    expect(shareholding!.promoterPct).toBe(55);
    expect(errors).toHaveLength(0);
  });
});

describe('mapToCorporateAction', () => {
  it('maps valid CSV row to CorporateAction', () => {
    const { action, errors } = mapToCorporateAction(
      {
        symbol: 'TCS',
        type: 'dividend',
        date: '2026-11-15',
        amount: '50',
      },
      'manual-csv'
    );
    expect(action).not.toBeNull();
    expect(action!.type).toBe('dividend');
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid action type', () => {
    const { action, errors } = mapToCorporateAction(
      { symbol: 'TCS', type: 'invalid', date: '2026-11-15' },
      'manual-csv'
    );
    expect(action).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
