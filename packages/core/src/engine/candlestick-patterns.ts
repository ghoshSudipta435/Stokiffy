/**
 * Candlestick Pattern Detectors (Signal Candidates Only)
 *
 * Implements deterministic proportion-based detectors for all 9 blueprint patterns:
 * - Bullish Candidates: Bullish Engulfing, Hammer, Inverted Hammer, Morning Star,
 *   Dragonfly Doji, Three White Soldiers.
 * - Bearish Warnings: Bearish Engulfing, Evening Star, Shooting Star.
 *
 * Note: Candlestick patterns represent signal candidates requiring context
 * and confirmation — never predictive certainty.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  CandlestickPattern,
  OhlcvBar,
  PatternContext,
} from '../types/stage-e.js';

interface CandleMetrics {
  bar: OhlcvBar;
  range: number;
  body: number;
  upperShadow: number;
  lowerShadow: number;
  isBullish: boolean;
  isBearish: boolean;
  isDoji: boolean;
}

function getMetrics(bar: OhlcvBar): CandleMetrics {
  const range = Math.max(0.001, bar.high - bar.low);
  const body = Math.abs(bar.close - bar.open);
  const upperShadow = bar.high - Math.max(bar.open, bar.close);
  const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
  const isBullish = bar.close > bar.open;
  const isBearish = bar.close < bar.open;
  const isDoji = body <= 0.1 * range;

  return {
    bar,
    range,
    body,
    upperShadow,
    lowerShadow,
    isBullish,
    isBearish,
    isDoji,
  };
}

export function detectBullishEngulfing(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 2) return null;

  // Option 1: Pattern completed on bars[N-2] with confirmation candle on bars[N-1]
  if (bars.length >= 3) {
    const m1 = getMetrics(bars[bars.length - 3]!);
    const m2 = getMetrics(bars[bars.length - 2]!);
    const conf = bars[bars.length - 1]!;

    if (m1.isBearish && m2.isBullish) {
      const tolerance = 0.005 * m1.bar.open;
      const opensLower = m2.bar.open <= m1.bar.close + tolerance;
      const closesHigher = m2.bar.close >= m1.bar.open - tolerance;
      const bodyLarger = m2.body >= m1.body * 1.05 && m2.body >= 0.35 * m2.range;

      if (opensLower && closesHigher && bodyLarger) {
        const confirmation = conf.close > m2.bar.close || conf.close > conf.open;
        const qualityScore = roundDecimal(
          new Decimal(0.7)
            .plus(m2.body > m1.body * 1.2 ? 0.15 : 0)
            .plus(context.volumeSpike ? 0.15 : 0),
          2
        ).toNumber();

        return {
          name: 'bullish-engulfing',
          detectedAt: m2.bar.date,
          timeframe,
          candles: [m1.bar, m2.bar],
          confirmation,
          confirmationCandle: conf,
          context,
          qualityScore: Math.min(1.0, qualityScore),
          explanation:
            'Bullish Engulfing candidate: Large green body completely engulfs prior red body. ' +
            'Signal candidate requiring support context and next-session confirmation.',
        };
      }
    }
  }

  // Option 2: Pattern completed on latest 2 bars (confirmation pending)
  const m1 = getMetrics(bars[bars.length - 2]!);
  const m2 = getMetrics(bars[bars.length - 1]!);

  if (m1.isBearish && m2.isBullish) {
    const tolerance = 0.005 * m1.bar.open;
    const opensLower = m2.bar.open <= m1.bar.close + tolerance;
    const closesHigher = m2.bar.close >= m1.bar.open - tolerance;
    const bodyLarger = m2.body >= m1.body * 1.05 && m2.body >= 0.35 * m2.range;

    if (opensLower && closesHigher && bodyLarger) {
      return {
        name: 'bullish-engulfing',
        detectedAt: m2.bar.date,
        timeframe,
        candles: [m1.bar, m2.bar],
        confirmation: false,
        context,
        qualityScore: 0.7,
        explanation:
          'Bullish Engulfing candidate: Large green body completely engulfs prior red body. Confirmation pending next session.',
      };
    }
  }

  return null;
}

export function detectHammer(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 1) return null;

  const hasNext = bars.length >= 2;
  const hammerIdx = hasNext ? bars.length - 2 : bars.length - 1;
  const m = getMetrics(bars[hammerIdx]!);

  // Lower shadow >= 2x body, upper shadow small (<= 0.25 * body or <= 0.15 * range)
  const isHammerStructure =
    m.lowerShadow >= 2.0 * m.body &&
    m.upperShadow <= Math.max(0.25 * m.body, 0.15 * m.range) &&
    m.body <= 0.4 * m.range;

  if (!isHammerStructure) {
    if (hasNext) {
      // Check latest bar as unconfirmed hammer
      const altM = getMetrics(bars[bars.length - 1]!);
      if (
        altM.lowerShadow >= 2.0 * altM.body &&
        altM.upperShadow <= Math.max(0.25 * altM.body, 0.15 * altM.range) &&
        altM.body <= 0.4 * altM.range
      ) {
        return {
          name: 'hammer',
          detectedAt: altM.bar.date,
          timeframe,
          candles: [altM.bar],
          confirmation: false,
          context,
          qualityScore: 0.75,
          explanation:
            'Hammer candidate detected on latest bar with long lower shadow rejecting lower prices. ' +
            'Confirmation pending next session.',
        };
      }
    }
    return null;
  }

  let confirmation = false;
  let confirmationCandle: OhlcvBar | undefined;

  if (hasNext) {
    const nextBar = bars[bars.length - 1]!;
    confirmation = nextBar.close > m.bar.close;
    confirmationCandle = nextBar;
  }

  const qualityScore = roundDecimal(
    new Decimal(0.7)
      .plus(m.lowerShadow >= 2.5 * m.body ? 0.15 : 0.05)
      .plus(context.supportLevel !== undefined ? 0.15 : 0),
    2
  ).toNumber();

  return {
    name: 'hammer',
    detectedAt: m.bar.date,
    timeframe,
    candles: [m.bar],
    confirmation,
    confirmationCandle,
    context,
    qualityScore: Math.min(1.0, qualityScore),
    explanation:
      'Hammer candidate: Long lower shadow indicates aggressive buyers stepping in at lows. ' +
      'Requires trend context and next-session follow-through.',
  };
}

export function detectInvertedHammer(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 1) return null;

  const hasNext = bars.length >= 2;
  const candleIdx = hasNext ? bars.length - 2 : bars.length - 1;
  const m = getMetrics(bars[candleIdx]!);

  const isInvertedHammerStructure =
    m.upperShadow >= 2.0 * m.body &&
    m.lowerShadow <= Math.max(0.25 * m.body, 0.15 * m.range) &&
    m.body <= 0.4 * m.range;

  if (!isInvertedHammerStructure) {
    if (hasNext) {
      const altM = getMetrics(bars[bars.length - 1]!);
      if (
        altM.upperShadow >= 2.0 * altM.body &&
        altM.lowerShadow <= Math.max(0.25 * altM.body, 0.15 * altM.range) &&
        altM.body <= 0.4 * altM.range
      ) {
        return {
          name: 'inverted-hammer',
          detectedAt: altM.bar.date,
          timeframe,
          candles: [altM.bar],
          confirmation: false,
          context,
          qualityScore: 0.7,
          explanation: 'Inverted Hammer candidate: Long upper shadow after decline; confirmation required.',
        };
      }
    }
    return null;
  }

  let confirmation = false;
  let confirmationCandle: OhlcvBar | undefined;

  if (hasNext) {
    const nextBar = bars[bars.length - 1]!;
    confirmation = nextBar.close > m.bar.close;
    confirmationCandle = nextBar;
  }

  return {
    name: 'inverted-hammer',
    detectedAt: m.bar.date,
    timeframe,
    candles: [m.bar],
    confirmation,
    confirmationCandle,
    context,
    qualityScore: 0.75,
    explanation:
      'Inverted Hammer candidate: Buyers tested higher levels; requires confirmation above candle body.',
  };
}

export function detectMorningStar(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 3) return null;

  const c1 = getMetrics(bars[bars.length - 3]!);
  const c2 = getMetrics(bars[bars.length - 2]!);
  const c3 = getMetrics(bars[bars.length - 1]!);

  // C1: Long bearish
  const c1Bearish = c1.isBearish && c1.body >= 0.5 * c1.range;
  // C2: Small body star
  const c2Star = c2.body <= 0.35 * c2.range;
  // C3: Long bullish closing > 50% into C1 body
  const c1Midpoint = c1.bar.close + 0.5 * (c1.bar.open - c1.bar.close);
  const c3Bullish = c3.isBullish && c3.bar.close >= c1Midpoint && c3.body >= 0.4 * c3.range;

  if (c1Bearish && c2Star && c3Bullish) {
    return {
      name: 'morning-star',
      detectedAt: c3.bar.date,
      timeframe,
      candles: [c1.bar, c2.bar, c3.bar],
      confirmation: true, // 3-candle structure self-confirms
      context,
      qualityScore: 0.85,
      explanation:
        'Morning Star candidate: 3-candle reversal sequence with star consolidation and decisive bullish close > 50% into first candle.',
    };
  }

  return null;
}

export function detectDragonflyDoji(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 1) return null;

  const hasNext = bars.length >= 2;
  const candleIdx = hasNext ? bars.length - 2 : bars.length - 1;
  const m = getMetrics(bars[candleIdx]!);

  const isDragonfly =
    m.isDoji &&
    m.lowerShadow >= 0.65 * m.range &&
    m.upperShadow <= 0.1 * m.range;

  if (!isDragonfly) {
    if (hasNext) {
      const altM = getMetrics(bars[bars.length - 1]!);
      if (
        altM.isDoji &&
        altM.lowerShadow >= 0.65 * altM.range &&
        altM.upperShadow <= 0.1 * altM.range
      ) {
        return {
          name: 'dragonfly-doji',
          detectedAt: altM.bar.date,
          timeframe,
          candles: [altM.bar],
          confirmation: false,
          context,
          qualityScore: 0.75,
          explanation: 'Dragonfly Doji candidate: Extreme lower price rejection; confirmation pending.',
        };
      }
    }
    return null;
  }

  let confirmation = false;
  let confirmationCandle: OhlcvBar | undefined;

  if (hasNext) {
    const nextBar = bars[bars.length - 1]!;
    confirmation = nextBar.close > m.bar.close;
    confirmationCandle = nextBar;
  }

  return {
    name: 'dragonfly-doji',
    detectedAt: m.bar.date,
    timeframe,
    candles: [m.bar],
    confirmation,
    confirmationCandle,
    context,
    qualityScore: 0.8,
    explanation:
      'Dragonfly Doji candidate: Sellers drove prices down but buyers pushed it back to open/high.',
  };
}

export function detectThreeWhiteSoldiers(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 3) return null;

  const c1 = getMetrics(bars[bars.length - 3]!);
  const c2 = getMetrics(bars[bars.length - 2]!);
  const c3 = getMetrics(bars[bars.length - 1]!);

  const allBullish = c1.isBullish && c2.isBullish && c3.isBullish;
  if (!allBullish) return null;

  // Each closes higher than previous close
  const consecutiveHigherCloses =
    c2.bar.close > c1.bar.close && c3.bar.close > c2.bar.close;
  // Each opens within or near the previous candle body
  const opensInPriorBody =
    c2.bar.open >= c1.bar.open &&
    c2.bar.open <= c1.bar.close &&
    c3.bar.open >= c2.bar.open &&
    c3.bar.open <= c2.bar.close;
  // Closes near highs (small upper shadow)
  const closesNearHigh =
    c1.upperShadow <= 0.3 * c1.range &&
    c2.upperShadow <= 0.3 * c2.range &&
    c3.upperShadow <= 0.3 * c3.range;

  if (consecutiveHigherCloses && opensInPriorBody && closesNearHigh) {
    return {
      name: 'three-white-soldiers',
      detectedAt: c3.bar.date,
      timeframe,
      candles: [c1.bar, c2.bar, c3.bar],
      confirmation: true,
      context,
      qualityScore: 0.9,
      explanation:
        'Three White Soldiers candidate: Powerful 3-day consecutive bullish march. Check for overextension near resistance.',
    };
  }

  return null;
}

export function detectBearishEngulfing(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 2) return null;

  // Option 1: Pattern completed on bars[N-2] with confirmation candle on bars[N-1]
  if (bars.length >= 3) {
    const m1 = getMetrics(bars[bars.length - 3]!);
    const m2 = getMetrics(bars[bars.length - 2]!);
    const conf = bars[bars.length - 1]!;

    if (m1.isBullish && m2.isBearish) {
      const tolerance = 0.005 * m1.bar.open;
      const opensHigher = m2.bar.open >= m1.bar.close - tolerance;
      const closesLower = m2.bar.close <= m1.bar.open + tolerance;
      const bodyLarger = m2.body >= m1.body * 1.05 && m2.body >= 0.35 * m2.range;

      if (opensHigher && closesLower && bodyLarger) {
        const confirmation = conf.close < m2.bar.close;
        return {
          name: 'bearish-engulfing',
          detectedAt: m2.bar.date,
          timeframe,
          candles: [m1.bar, m2.bar],
          confirmation,
          confirmationCandle: conf,
          context,
          qualityScore: 0.8,
          explanation:
            'Bearish Engulfing warning: Large red candle completely engulfs prior green candle after advance. Potential distribution.',
        };
      }
    }
  }

  // Option 2: Pattern completed on latest 2 bars (confirmation pending)
  const m1 = getMetrics(bars[bars.length - 2]!);
  const m2 = getMetrics(bars[bars.length - 1]!);

  if (m1.isBullish && m2.isBearish) {
    const tolerance = 0.005 * m1.bar.open;
    const opensHigher = m2.bar.open >= m1.bar.close - tolerance;
    const closesLower = m2.bar.close <= m1.bar.open + tolerance;
    const bodyLarger = m2.body >= m1.body * 1.05 && m2.body >= 0.35 * m2.range;

    if (opensHigher && closesLower && bodyLarger) {
      return {
        name: 'bearish-engulfing',
        detectedAt: m2.bar.date,
        timeframe,
        candles: [m1.bar, m2.bar],
        confirmation: false,
        context,
        qualityScore: 0.75,
        explanation:
          'Bearish Engulfing warning: Large red candle engulfs prior green candle. Confirmation pending next session.',
      };
    }
  }

  return null;
}

export function detectEveningStar(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 3) return null;

  const c1 = getMetrics(bars[bars.length - 3]!);
  const c2 = getMetrics(bars[bars.length - 2]!);
  const c3 = getMetrics(bars[bars.length - 1]!);

  const c1Bullish = c1.isBullish && c1.body >= 0.5 * c1.range;
  const c2Star = c2.body <= 0.35 * c2.range;
  const c1Midpoint = c1.bar.open + 0.5 * (c1.bar.close - c1.bar.open);
  const c3Bearish = c3.isBearish && c3.bar.close <= c1Midpoint && c3.body >= 0.4 * c3.range;

  if (c1Bullish && c2Star && c3Bearish) {
    return {
      name: 'evening-star',
      detectedAt: c3.bar.date,
      timeframe,
      candles: [c1.bar, c2.bar, c3.bar],
      confirmation: true,
      context,
      qualityScore: 0.85,
      explanation:
        'Evening Star warning: 3-candle bearish topping pattern with indecision star and heavy close into first green candle.',
    };
  }

  return null;
}

export function detectShootingStar(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern | null {
  if (!bars || bars.length < 1) return null;

  const hasNext = bars.length >= 2;
  const candleIdx = hasNext ? bars.length - 2 : bars.length - 1;
  const m = getMetrics(bars[candleIdx]!);

  const isShootingStar =
    m.upperShadow >= 2.0 * m.body &&
    m.lowerShadow <= Math.max(0.25 * m.body, 0.15 * m.range) &&
    m.body <= 0.4 * m.range;

  if (!isShootingStar) {
    if (hasNext) {
      const altM = getMetrics(bars[bars.length - 1]!);
      if (
        altM.upperShadow >= 2.0 * altM.body &&
        altM.lowerShadow <= Math.max(0.25 * altM.body, 0.15 * altM.range) &&
        altM.body <= 0.4 * altM.range
      ) {
        return {
          name: 'shooting-star',
          detectedAt: altM.bar.date,
          timeframe,
          candles: [altM.bar],
          confirmation: false,
          context,
          qualityScore: 0.75,
          explanation:
            'Shooting Star warning: Intraday high rejected by strong selling pressure. Potential topping candle.',
        };
      }
    }
    return null;
  }

  let confirmation = false;
  let confirmationCandle: OhlcvBar | undefined;

  if (hasNext) {
    const nextBar = bars[bars.length - 1]!;
    confirmation = nextBar.close < m.bar.close;
    confirmationCandle = nextBar;
  }

  return {
    name: 'shooting-star',
    detectedAt: m.bar.date,
    timeframe,
    candles: [m.bar],
    confirmation,
    confirmationCandle,
    context,
    qualityScore: 0.8,
    explanation:
      'Shooting Star warning: High rejected decisively. Exit/hedging review recommended if held.',
  };
}

/**
 * Runs all 9 pattern detectors across the OHLCV series.
 */
export function detectAllCandlestickPatterns(
  bars: OhlcvBar[],
  context: PatternContext,
  timeframe: 'daily' | 'weekly' = 'daily'
): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];

  const detectors = [
    detectBullishEngulfing,
    detectHammer,
    detectInvertedHammer,
    detectMorningStar,
    detectDragonflyDoji,
    detectThreeWhiteSoldiers,
    detectBearishEngulfing,
    detectEveningStar,
    detectShootingStar,
  ];

  for (const detector of detectors) {
    const match = detector(bars, context, timeframe);
    if (match) {
      patterns.push(match);
    }
  }

  return patterns;
}
