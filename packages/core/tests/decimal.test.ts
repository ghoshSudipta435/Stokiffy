/**
 * Decimal precision tests for @stock-assistant/core
 * Verifies arbitrary-precision financial math (ADR-005)
 */

import { describe, it, expect } from 'vitest';
import {
  safeDecimal,
  toDecimal,
  toCurrency,
  toRatio,
  toPercentage,
  safeDivide,
  safeMultiply,
  safeAdd,
  roundDecimal,
  decimalsEqual,
  isPositive,
  DECIMAL_PRECISION,
} from '../src/common/decimal.js';
import Decimal from 'decimal.js';

describe('Decimal precision primitives', () => {
  describe('safeDecimal', () => {
    it('converts a number to Decimal', () => {
      const result = safeDecimal(10.5);
      expect(result).not.toBeNull();
      expect(result!.toNumber()).toBe(10.5);
    });

    it('returns null for null input', () => {
      expect(safeDecimal(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(safeDecimal(undefined)).toBeNull();
    });

    it('returns null for NaN', () => {
      expect(safeDecimal(NaN)).toBeNull();
    });

    it('returns null for Infinity', () => {
      expect(safeDecimal(Infinity)).toBeNull();
    });
  });

  describe('toCurrency', () => {
    it('rounds to 2 decimal places (paise)', () => {
      const d = new Decimal('123.456');
      const result = toCurrency(d);
      expect(result).toBe(123.46);
    });

    it('returns null for null input', () => {
      expect(toCurrency(null)).toBeNull();
    });
  });

  describe('toRatio', () => {
    it('rounds to 10 decimal places', () => {
      const d = new Decimal('1.234567890123');
      const result = toRatio(d);
      expect(result).toBe(1.2345678901);
    });

    it('returns null for null input', () => {
      expect(toRatio(null)).toBeNull();
    });
  });

  describe('toPercentage', () => {
    it('rounds to 4 decimal places (basis points)', () => {
      const d = new Decimal('15.12345');
      const result = toPercentage(d);
      expect(result).toBe(15.1235);
    });

    it('returns null for null input', () => {
      expect(toPercentage(null)).toBeNull();
    });
  });

  describe('safeDivide', () => {
    it('divides two Decimals correctly', () => {
      const result = safeDivide(new Decimal(10), new Decimal(4));
      expect(result!.toNumber()).toBe(2.5);
    });

    it('returns null for zero denominator', () => {
      expect(safeDivide(new Decimal(10), new Decimal(0))).toBeNull();
    });

    it('returns null for null numerator', () => {
      expect(safeDivide(null, new Decimal(4))).toBeNull();
    });

    it('returns null for null denominator', () => {
      expect(safeDivide(new Decimal(10), null)).toBeNull();
    });
  });

  describe('safeMultiply', () => {
    it('multiplies multiple Decimals', () => {
      const result = safeMultiply(
        new Decimal(2),
        new Decimal(3),
        new Decimal(4)
      );
      expect(result!.toNumber()).toBe(24);
    });

    it('returns null if any input is null', () => {
      expect(safeMultiply(new Decimal(2), null, new Decimal(4))).toBeNull();
    });
  });

  describe('safeAdd', () => {
    it('adds multiple Decimals without float drift', () => {
      // 0.1 + 0.2 should equal 0.3 exactly with Decimal.js
      const result = safeAdd(new Decimal(0.1), new Decimal(0.2));
      expect(result!.toNumber()).toBe(0.3);
    });

    it('returns null if any input is null', () => {
      expect(safeAdd(new Decimal(1), null)).toBeNull();
    });
  });

  describe('roundDecimal', () => {
    it('rounds to specified decimal places', () => {
      const d = new Decimal('3.14159');
      const result = roundDecimal(d, 2);
      expect(result.toNumber()).toBe(3.14);
    });
  });

  describe('decimalsEqual', () => {
    it('returns true for equal Decimals within tolerance', () => {
      const a = new Decimal('1.0000000001');
      const b = new Decimal('1.0000000002');
      expect(decimalsEqual(a, b)).toBe(true);
    });

    it('returns false for significantly different Decimals', () => {
      const a = new Decimal('1.0');
      const b = new Decimal('2.0');
      expect(decimalsEqual(a, b)).toBe(false);
    });
  });

  describe('isPositive', () => {
    it('returns true for positive values', () => {
      expect(isPositive(new Decimal(1))).toBe(true);
    });

    it('returns false for zero', () => {
      expect(isPositive(new Decimal(0))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isPositive(null)).toBe(false);
    });
  });

  describe('DECIMAL_PRECISION', () => {
    it('defines precision constants per calculation type', () => {
      expect(DECIMAL_PRECISION.RATIO).toBe(10);
      expect(DECIMAL_PRECISION.CURRENCY).toBe(2);
      expect(DECIMAL_PRECISION.PERCENTAGE).toBe(4);
      expect(DECIMAL_PRECISION.CAGR).toBe(6);
    });
  });

  describe('no floating-point drift', () => {
    it('0.1 + 0.2 equals 0.3 exactly', () => {
      const result = safeAdd(new Decimal(0.1), new Decimal(0.2));
      expect(result!.equals(new Decimal(0.3))).toBe(true);
    });

    it('0.1 * 0.2 equals 0.02 exactly', () => {
      const result = safeMultiply(new Decimal(0.1), new Decimal(0.2));
      expect(result!.equals(new Decimal(0.02))).toBe(true);
    });
  });
});
