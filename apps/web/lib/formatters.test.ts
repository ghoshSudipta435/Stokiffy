import { describe, it, expect } from 'vitest';
import {
  formatINR,
  formatCrores,
  formatRupeesToCrores,
  formatPercent,
  formatRatio,
  formatDateIST,
} from './formatters';

describe('Financial Workstation Formatters', () => {
  describe('formatINR', () => {
    it('formats numbers with Indian currency notation', () => {
      expect(formatINR(123456.78)).toBe('₹1,23,456.78');
      expect(formatINR(1000)).toBe('₹1,000.00');
    });

    it('returns em dash for null or undefined', () => {
      expect(formatINR(null)).toBe('—');
      expect(formatINR(undefined)).toBe('—');
      expect(formatINR(NaN)).toBe('—');
    });
  });

  describe('formatCrores', () => {
    it('formats values in Crores with Cr suffix', () => {
      expect(formatCrores(1234.56)).toBe('₹1,234.56 Cr');
    });

    it('converts raw rupees to Crores correctly', () => {
      expect(formatRupeesToCrores(10000000)).toBe('₹1.00 Cr');
      expect(formatRupeesToCrores(55000000)).toBe('₹5.50 Cr');
    });
  });

  describe('formatPercent', () => {
    it('formats percentages with optional sign', () => {
      expect(formatPercent(12.345, { showSign: true })).toBe('+12.35%');
      expect(formatPercent(-4.2)).toBe('-4.20%');
      expect(formatPercent(0)).toBe('0.00%');
    });
  });

  describe('formatRatio', () => {
    it('formats financial valuation ratios', () => {
      expect(formatRatio(28.45)).toBe('28.45x');
      expect(formatRatio(1.2, 'x', 1)).toBe('1.2x');
    });
  });

  describe('formatDateIST', () => {
    it('formats dates in Indian Standard Time (IST)', () => {
      const date = new Date('2026-11-16T00:00:00.000Z');
      const formatted = formatDateIST(date);
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Nov');
    });
  });
});
