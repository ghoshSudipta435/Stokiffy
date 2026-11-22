import { describe, it, expect } from 'vitest';
import {
  OHLCVParser,
  parseOHLCVCSV,
} from '../src/csv/ohlcv-parser.js';

describe('OHLCVParser & parseOHLCVCSV', () => {
  it('parses valid OHLCV CSV rows with standard headers and date formats', () => {
    const csv = `Date,Open,High,Low,Close,Volume,Adj Close
2024-03-25,3200.50,3250.00,3180.00,3240.75,1500000,3230.00
2024-03-26,3245.00,3260.00,3210.00,3225.50,980000,3215.00`;

    const result = parseOHLCVCSV(csv);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.bars).toHaveLength(2);

    expect(result.bars[0]).toEqual({
      date: '2024-03-25T00:00:00.000Z',
      open: 3200.5,
      high: 3250,
      low: 3180,
      close: 3240.75,
      volume: 1500000,
      adjustedClose: 3230,
    });

    expect(result.bars[1]).toEqual({
      date: '2024-03-26T00:00:00.000Z',
      open: 3245,
      high: 3260,
      low: 3210,
      close: 3225.5,
      volume: 980000,
      adjustedClose: 3215,
    });
  });

  it('parses CSV rows without optional adjustedClose column', () => {
    const csv = `date,open,high,low,close,volume
2024-03-27,100,105,95,102,50000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.bars[0]).toEqual({
      date: '2024-03-27T00:00:00.000Z',
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 50000,
    });
  });

  it('rejects invalid OHLC geometry: high < low', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,100,90,95,92,10000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.totalRows).toBe(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);

    const highLowErr = result.errors.find((e) => e.message.includes('cannot be less than low'));
    expect(highLowErr).toBeDefined();
    expect(highLowErr?.rowNumber).toBe(2);
  });

  it('rejects invalid OHLC geometry: high < open or high < close', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,110,105,95,100,10000
2024-03-29,100,105,95,110,10000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.totalRows).toBe(2);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]?.message).toContain('must be >= max(open');
    expect(result.errors[1]?.message).toContain('must be >= max(open');
  });

  it('rejects invalid OHLC geometry: low > open or low > close', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,95,110,100,105,10000
2024-03-29,105,110,100,95,10000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.totalRows).toBe(2);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]?.message).toContain('must be <= min(open');
    expect(result.errors[1]?.message).toContain('must be <= min(open');
  });

  it('rejects negative volume', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,100,110,90,105,-500`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.errors.some((e) => e.column === 'volume' && e.message.includes('non-negative'))).toBe(true);
  });

  it('accepts zero volume (e.g. trading halt or holiday bar)', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,100,110,90,105,0`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(1);
    expect(result.bars[0]?.volume).toBe(0);
  });

  it('rejects malformed or invalid dates', () => {
    const csv = `date,open,high,low,close,volume
not-a-date,100,110,90,105,5000
,100,110,90,105,5000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.errors.filter((e) => e.column === 'date')).toHaveLength(2);
  });

  it('rejects negative or NaN prices', () => {
    const csv = `date,open,high,low,close,volume
2024-03-28,-100,110,90,105,5000
2024-03-29,100,NaN,90,105,5000
2024-03-30,100,110,0,105,5000`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('returns header error when required columns are missing', () => {
    const csv = `date,open,high,low
2024-03-28,100,110,90`;

    const result = parseOHLCVCSV(csv);
    expect(result.validRows).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('Missing required CSV headers');
    expect(result.errors[0]?.message).toContain('close');
    expect(result.errors[0]?.message).toContain('volume');
  });

  it('handles empty CSV cleanly', () => {
    const result = parseOHLCVCSV('');
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.bars).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('preserves row-level validation errors cleanly without crashing batch', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-03-25,100,110,90,105,1000
2024-03-26,100,90,95,105,1000
2024-03-27,105,115,95,110,2000`;

    const result = parseOHLCVCSV(csv);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(2);
    expect(result.bars).toHaveLength(2);
    expect(result.errors).toHaveLength(2); // row 3 has high < low and high < close
    expect(result.errors[0]?.rowNumber).toBe(3);
    expect(result.bars[0]?.date).toBe('2024-03-25T00:00:00.000Z');
    expect(result.bars[1]?.date).toBe('2024-03-27T00:00:00.000Z');
  });

  it('supports custom column mapping in constructor', () => {
    const csv = `Timestamp,OpenPrice,MaxPrice,MinPrice,LastPrice,TradedQty
2024-03-28,500,520,490,515,10000`;

    const parser = new OHLCVParser({
      Timestamp: 'date',
      OpenPrice: 'open',
      MaxPrice: 'high',
      MinPrice: 'low',
      LastPrice: 'close',
      TradedQty: 'volume',
    });

    const result = parser.parse(csv);
    expect(result.validRows).toBe(1);
    expect(result.bars[0]).toEqual({
      date: '2024-03-28T00:00:00.000Z',
      open: 500,
      high: 520,
      low: 490,
      close: 515,
      volume: 10000,
    });
  });
});
