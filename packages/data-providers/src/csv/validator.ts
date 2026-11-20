/**
 * CSV data validator — sanity checks for units, dates, sign conventions.
 * Ensures data quality before mapping to domain DTOs.
 */

import type { CSVParseError } from './parser.js';

/**
 * Validates a mapped CSV row for financial statement fields.
 */
export function validateFinancialRow(
  row: Record<string, string | undefined>,
  rowNumber: number
): { valid: boolean; errors: CSVParseError[] } {
  const errors: CSVParseError[] = [];

  // Check required fields
  if (!row['symbol']) {
    errors.push({
      rowNumber,
      column: 'symbol',
      value: row['symbol'],
      message: 'Symbol is required',
    });
  }

  // Validate numeric fields are parseable
  const numericFields = [
    'revenue',
    'netProfit',
    'totalAssets',
    'totalEquity',
    'totalDebt',
    'currentAssets',
    'currentLiabilities',
    'interestExpense',
    'ebit',
    'eps',
  ];
  for (const field of numericFields) {
    const value = row[field];
    if (value !== undefined && value !== '') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        errors.push({
          rowNumber,
          column: field,
          value,
          message: `Invalid number: ${value}`,
        });
      }
      // Sign convention: revenue, assets, equity should be non-negative
      if (
        Number.isFinite(parsed) &&
        parsed < 0 &&
        ['revenue', 'totalAssets', 'totalEquity'].includes(field)
      ) {
        errors.push({
          rowNumber,
          column: field,
          value,
          message: `${field} should be non-negative`,
        });
      }
    }
  }

  // Validate reported period format (FY2024 or FY2024-Q3)
  if (row['reportedPeriod']) {
    const periodRegex = /^FY\d{4}(-Q[1-4])?$/;
    if (!periodRegex.test(row['reportedPeriod']!)) {
      errors.push({
        rowNumber,
        column: 'reportedPeriod',
        value: row['reportedPeriod'],
        message: 'Invalid period format (expected FY2024 or FY2024-Q3)',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a mapped CSV row for shareholding data.
 */
export function validateShareholdingRow(
  row: Record<string, string | undefined>,
  rowNumber: number
): { valid: boolean; errors: CSVParseError[] } {
  const errors: CSVParseError[] = [];

  if (!row['symbol']) {
    errors.push({
      rowNumber,
      column: 'symbol',
      value: row['symbol'],
      message: 'Symbol is required',
    });
  }

  const pctFields = ['promoterPct', 'fiiPct', 'diiPct', 'publicPct'];
  for (const field of pctFields) {
    const value = row[field];
    if (value !== undefined && value !== '') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        errors.push({
          rowNumber,
          column: field,
          value,
          message: `${field} must be between 0 and 100`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a mapped CSV row for price bar data (OHLCV).
 */
export function validatePriceRow(
  row: Record<string, string | undefined>,
  rowNumber: number
): { valid: boolean; errors: CSVParseError[] } {
  const errors: CSVParseError[] = [];

  if (!row['symbol']) {
    errors.push({
      rowNumber,
      column: 'symbol',
      value: row['symbol'],
      message: 'Symbol is required',
    });
  }

  if (!row['date']) {
    errors.push({
      rowNumber,
      column: 'date',
      value: row['date'],
      message: 'Date is required',
    });
  } else {
    const date = new Date(row['date']!);
    if (isNaN(date.getTime())) {
      errors.push({
        rowNumber,
        column: 'date',
        value: row['date'],
        message: 'Invalid date format',
      });
    }
  }

  const priceFields = ['open', 'high', 'low', 'close'];
  for (const field of priceFields) {
    const value = row[field];
    if (value !== undefined && value !== '') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        errors.push({
          rowNumber,
          column: field,
          value,
          message: `${field} must be a positive number`,
        });
      }
    }
  }

  // OHLC consistency: high >= open, close, low; low <= open, close, high
  const open = Number(row['open']);
  const high = Number(row['high']);
  const low = Number(row['low']);
  const close = Number(row['close']);
  if (
    Number.isFinite(open) &&
    Number.isFinite(high) &&
    Number.isFinite(low) &&
    Number.isFinite(close)
  ) {
    if (high < open || high < close || high < low) {
      errors.push({
        rowNumber,
        column: 'high',
        value: row['high'],
        message: 'High must be >= open, close, and low',
      });
    }
    if (low > open || low > close || low > high) {
      errors.push({
        rowNumber,
        column: 'low',
        value: row['low'],
        message: 'Low must be <= open, close, and high',
      });
    }
  }

  if (row['volume'] !== undefined && row['volume'] !== '') {
    const volume = Number(row['volume']);
    if (!Number.isFinite(volume) || volume < 0) {
      errors.push({
        rowNumber,
        column: 'volume',
        value: row['volume'],
        message: 'Volume must be non-negative',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
