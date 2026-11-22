/**
 * Technical Indicators & Market Context Analysis
 *
 * Implements pure deterministic indicators:
 * - Simple Moving Averages (20, 50, 200 SMA)
 * - Average True Range (14 ATR)
 * - Volume Analysis (20-day Average Volume, Volume Spike, Volume Trend)
 * - Support and Resistance Levels (Swing High / Swing Low clustering)
 * - Trend Classification & Moving Average Slopes
 *
 * Exact Decimal arithmetic. Zero external charting dependencies.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type { OhlcvBar, PatternContext } from '../types/stage-e.js';

/**
 * Calculates Simple Moving Average (SMA) for closing prices over a specified period.
 * Returns null if insufficient bars are available.
 */
export function calculateSma(bars: OhlcvBar[], period: number): number | null {
  if (!bars || bars.length < period || period <= 0) {
    return null;
  }

  const windowBars = bars.slice(bars.length - period);
  let sum = new Decimal(0);
  for (const bar of windowBars) {
    sum = sum.plus(bar.close);
  }

  return roundDecimal(sum.div(period), 2).toNumber();
}

/**
 * Calculates Average True Range (ATR) over a period (default 14).
 * True Range = Max(H - L, |H - Prior C|, |L - Prior C|)
 */
export function calculateAtr(bars: OhlcvBar[], period = 14): number {
  if (!bars || bars.length === 0) {
    return 0;
  }

  if (bars.length === 1) {
    const b0 = bars[0]!;
    return roundDecimal(new Decimal(b0.high).minus(b0.low), 2).toNumber();
  }

  const trValues: Decimal[] = [];
  for (let i = 0; i < bars.length; i++) {
    const cur = bars[i]!;
    if (i === 0) {
      trValues.push(new Decimal(cur.high).minus(cur.low));
    } else {
      const prev = bars[i - 1]!;
      const hl = new Decimal(cur.high).minus(cur.low);
      const hc = new Decimal(cur.high).minus(prev.close).abs();
      const lc = new Decimal(cur.low).minus(prev.close).abs();
      const tr = Decimal.max(hl, hc, lc);
      trValues.push(tr);
    }
  }

  const windowTr = trValues.slice(Math.max(0, trValues.length - period));
  let trSum = new Decimal(0);
  for (const tr of windowTr) {
    trSum = trSum.plus(tr);
  }

  return roundDecimal(trSum.div(windowTr.length), 2).toNumber();
}

/**
 * Calculates average volume over the last N bars (default 20).
 */
export function calculateAvgVolume(bars: OhlcvBar[], period = 20): number {
  if (!bars || bars.length === 0) {
    return 0;
  }

  const windowBars = bars.slice(Math.max(0, bars.length - period));
  let volSum = new Decimal(0);
  for (const b of windowBars) {
    volSum = volSum.plus(b.volume);
  }

  return roundDecimal(volSum.div(windowBars.length), 0).toNumber();
}

/**
 * Detects swing high resistance levels and swing low support levels.
 * Uses 2-bar left and right local extrema.
 */
export function findKeyLevels(
  bars: OhlcvBar[],
  lookback = 50
): { support: number[]; resistance: number[] } {
  if (!bars || bars.length < 5) {
    if (bars && bars.length > 0) {
      const last = bars[bars.length - 1]!;
      return { support: [last.low], resistance: [last.high] };
    }
    return { support: [], resistance: [] };
  }

  const slice = bars.slice(Math.max(0, bars.length - lookback));
  const rawSupport: number[] = [];
  const rawResistance: number[] = [];

  for (let i = 2; i < slice.length - 2; i++) {
    const cur = slice[i]!;
    const p1 = slice[i - 1]!;
    const p2 = slice[i - 2]!;
    const n1 = slice[i + 1]!;
    const n2 = slice[i + 2]!;

    // Swing Low
    if (
      cur.low <= p1.low &&
      cur.low <= p2.low &&
      cur.low <= n1.low &&
      cur.low <= n2.low
    ) {
      rawSupport.push(cur.low);
    }

    // Swing High
    if (
      cur.high >= p1.high &&
      cur.high >= p2.high &&
      cur.high >= n1.high &&
      cur.high >= n2.high
    ) {
      rawResistance.push(cur.high);
    }
  }

  // Cluster nearby levels within 1.5% of each other
  function clusterLevels(levels: number[]): number[] {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clustered: number[] = [];
    let currentCluster: number[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const val = sorted[i]!;
      const clusterAvg =
        currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length;
      if (Math.abs(val - clusterAvg) / clusterAvg <= 0.02) {
        currentCluster.push(val);
      } else {
        clustered.push(roundDecimal(new Decimal(clusterAvg), 2).toNumber());
        currentCluster = [val];
      }
    }

    if (currentCluster.length > 0) {
      const clusterAvg =
        currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length;
      clustered.push(roundDecimal(new Decimal(clusterAvg), 2).toNumber());
    }

    return clustered;
  }

  const support = clusterLevels(rawSupport);
  const resistance = clusterLevels(rawResistance);

  return { support, resistance };
}

/**
 * Classifies trend, duration, moving average alignment, and volume profile.
 */
export function analyzeTechnicalContext(
  bars: OhlcvBar[],
  _timeframe: 'daily' | 'weekly' = 'daily'
): {
  context: PatternContext;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  volumeRatio: number;
  keyLevels: { support: number[]; resistance: number[] };
} {
  const currentPrice = bars.length > 0 ? bars[bars.length - 1]!.close : 0;
  const sma20 = calculateSma(bars, 20);
  const sma50 = calculateSma(bars, 50);
  const sma200 = calculateSma(bars, 200);
  const atr = calculateAtr(bars, 14);
  const avgVol20 = calculateAvgVolume(bars, 20);
  const latestVol = bars.length > 0 ? bars[bars.length - 1]!.volume : 0;
  const volumeRatio = avgVol20 > 0 ? latestVol / avgVol20 : 1.0;
  const volumeSpike = volumeRatio >= 1.5;

  // Trend determination based on SMA20, SMA50 and price
  let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  let trendDuration = 1;

  if (sma20 !== null && sma50 !== null) {
    if (currentPrice >= sma20 && sma20 >= sma50) {
      trend = 'uptrend';
    } else if (currentPrice <= sma20 && sma20 <= sma50) {
      trend = 'downtrend';
    } else {
      trend = 'sideways';
    }
  } else if (sma20 !== null) {
    trend = currentPrice >= sma20 ? 'uptrend' : 'downtrend';
  }

  // Trend duration (number of consecutive bars on the same side of SMA20)
  if (sma20 !== null && bars.length > 1) {
    const isAbove = currentPrice >= sma20;
    for (let i = bars.length - 2; i >= 0; i--) {
      const b = bars[i]!;
      if ((b.close >= sma20) === isAbove) {
        trendDuration++;
      } else {
        break;
      }
    }
  }

  // MA slope / trend
  let maTrend: 'rising' | 'falling' | 'flat' = 'flat';
  if (bars.length >= 25) {
    const pastSma20 = calculateSma(bars.slice(0, bars.length - 5), 20);
    if (sma20 !== null && pastSma20 !== null) {
      const diffPct = (sma20 - pastSma20) / pastSma20;
      if (diffPct > 0.005) maTrend = 'rising';
      else if (diffPct < -0.005) maTrend = 'falling';
      else maTrend = 'flat';
    }
  }

  // Near Moving Average check (within 2%)
  let nearMovingAverage: '20' | '50' | '200' | undefined;
  if (sma20 !== null && Math.abs(currentPrice - sma20) / sma20 <= 0.02) {
    nearMovingAverage = '20';
  } else if (sma50 !== null && Math.abs(currentPrice - sma50) / sma50 <= 0.02) {
    nearMovingAverage = '50';
  } else if (sma200 !== null && Math.abs(currentPrice - sma200) / sma200 <= 0.02) {
    nearMovingAverage = '200';
  }

  // Support & Resistance
  const keyLevels = findKeyLevels(bars);
  const supportsBelow = keyLevels.support.filter((s) => s <= currentPrice);
  const resistancesAbove = keyLevels.resistance.filter((r) => r >= currentPrice);

  const nearestSupport =
    supportsBelow.length > 0 ? Math.max(...supportsBelow) : undefined;
  const nearestResistance =
    resistancesAbove.length > 0 ? Math.min(...resistancesAbove) : undefined;

  const distanceToSupportPct =
    nearestSupport !== undefined && currentPrice > 0
      ? roundDecimal(
          new Decimal(currentPrice).minus(nearestSupport).div(currentPrice).mul(100),
          2
        ).toNumber()
      : undefined;

  const distanceToResistancePct =
    nearestResistance !== undefined && currentPrice > 0
      ? roundDecimal(
          new Decimal(nearestResistance).minus(currentPrice).div(currentPrice).mul(100),
          2
        ).toNumber()
      : undefined;

  // Volume Trend
  const recentVol5 = calculateAvgVolume(bars, 5);
  let volumeTrend: 'increasing' | 'decreasing' | 'flat' = 'flat';
  if (avgVol20 > 0) {
    const ratio = recentVol5 / avgVol20;
    if (ratio > 1.1) volumeTrend = 'increasing';
    else if (ratio < 0.9) volumeTrend = 'decreasing';
    else volumeTrend = 'flat';
  }

  // Gap risk
  let gapRisk: 'low' | 'medium' | 'high' = 'low';
  if (bars.length >= 10) {
    let largeGaps = 0;
    for (let i = bars.length - 10; i < bars.length; i++) {
      const cur = bars[i]!;
      const prev = bars[i - 1];
      if (prev && Math.abs(cur.open - prev.close) / prev.close >= 0.02) {
        largeGaps++;
      }
    }
    if (largeGaps >= 2) gapRisk = 'high';
    else if (largeGaps === 1) gapRisk = 'medium';
  }

  const context: PatternContext = {
    trend,
    trendDuration,
    volumeSpike,
    volumeTrend,
    maTrend,
    atr,
    gapRisk,
  };

  if (nearestSupport !== undefined) context.supportLevel = nearestSupport;
  if (nearestResistance !== undefined) context.resistanceLevel = nearestResistance;
  if (distanceToSupportPct !== undefined) context.distanceToSupportPct = distanceToSupportPct;
  if (distanceToResistancePct !== undefined) context.distanceToResistancePct = distanceToResistancePct;
  if (nearMovingAverage !== undefined) context.nearMovingAverage = nearMovingAverage;

  return {
    context,
    sma20,
    sma50,
    sma200,
    volumeRatio,
    keyLevels,
  };
}
