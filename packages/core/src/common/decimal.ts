import Decimal from 'decimal.js';

/**
 * Decimal.js configuration for financial precision.
 *
 * Per DOMAIN_MODEL_SPEC.md Section 9:
 * - Ratios: 10 decimal places
 * - Currency: 2 decimal places (paise)
 * - Percentages: 4 decimal places (basis points)
 * - Share quantities: Integer (floor)
 * - CAGR: 6 decimal places
 *
 * We use Decimal.js exclusively (per GAP-005: eliminate big.js redundancy).
 * Share quantities use Decimal.floor().toNumber() instead of big.js.
 */

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Precision constants per calculation type.
 */
export const DECIMAL_PRECISION = {
  RATIO: 10,
  CURRENCY: 2,
  PERCENTAGE: 4,
  CAGR: 6,
} as const;

/**
 * Creates a Decimal from a value, safely handling null/undefined.
 * Returns null if the value is missing (never coerces missing to zero).
 */
export function safeDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }
  try {
    return new Decimal(value as number | string);
  } catch {
    return null;
  }
}

/**
 * Creates a Decimal from a number value.
 * Throws if the value is not a finite number.
 */
export function toDecimal(value: number | string): Decimal {
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new Error(`Cannot create Decimal from non-finite value: ${value}`);
  }
  return d;
}

/**
 * Converts a Decimal to a number with currency precision (2 decimal places).
 * Returns null if the input is null.
 */
export function toCurrency(value: Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(DECIMAL_PRECISION.CURRENCY));
}

/**
 * Converts a Decimal to a number with ratio precision (10 decimal places).
 * Returns null if the input is null.
 */
export function toRatio(value: Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(DECIMAL_PRECISION.RATIO));
}

/**
 * Converts a Decimal to a number with percentage precision (4 decimal places).
 * Returns null if the input is null.
 */
export function toPercentage(value: Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(DECIMAL_PRECISION.PERCENTAGE));
}

/**
 * Converts a Decimal to a number with CAGR precision (6 decimal places).
 * Returns null if the input is null.
 */
export function toCagr(value: Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(DECIMAL_PRECISION.CAGR));
}

/**
 * Converts a Decimal share quantity to an integer using floor.
 * Returns null if the input is null.
 */
export function toShareQuantity(value: Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return value.floor().toNumber();
}

/**
 * Safely divides two Decimals. Returns null if denominator is zero or missing.
 * Never returns Infinity.
 */
export function safeDivide(
  numerator: Decimal | null,
  denominator: Decimal | null
): Decimal | null {
  if (numerator === null || denominator === null) {
    return null;
  }
  if (denominator.isZero()) {
    return null;
  }
  return numerator.dividedBy(denominator);
}

/**
 * Safely multiplies Decimals. Returns null if any input is null.
 */
export function safeMultiply(...values: (Decimal | null)[]): Decimal | null {
  if (values.some((v) => v === null)) {
    return null;
  }
  return values.reduce<Decimal>(
    (acc, v) => acc.times(v!),
    new Decimal(1)
  );
}

/**
 * Safely adds Decimals. Returns null if any input is null.
 */
export function safeAdd(...values: (Decimal | null)[]): Decimal | null {
  if (values.some((v) => v === null)) {
    return null;
  }
  return values.reduce<Decimal>(
    (acc, v) => acc.plus(v!),
    new Decimal(0)
  );
}

/**
 * Safely subtracts Decimals. Returns null if any input is null.
 */
export function safeSubtract(...values: (Decimal | null)[]): Decimal | null {
  if (values.some((v) => v === null)) {
    return null;
  }
  return values.reduce<Decimal>(
    (acc, v) => acc.minus(v!),
    new Decimal(0)
  );
}

/**
 * Rounds a Decimal to a specified number of decimal places.
 */
export function roundDecimal(value: Decimal, places: number): Decimal {
  return value.toDecimalPlaces(places);
}

/**
 * Compares two Decimals for equality within a tolerance.
 */
export function decimalsEqual(a: Decimal, b: Decimal, tolerance: string = '1e-10'): boolean {
  return a.minus(b).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Checks if a Decimal is positive (greater than zero).
 */
export function isPositive(value: Decimal | null): boolean {
  return value !== null && value.greaterThan(0);
}

/**
 * Checks if a Decimal is non-negative (greater than or equal to zero).
 */
export function isNonNegative(value: Decimal | null): boolean {
  return value !== null && value.greaterThanOrEqualTo(0);
}
