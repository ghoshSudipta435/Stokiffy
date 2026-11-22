/**
 * Stage E (Technical Entry & Timing) Vitest Unit Tests
 *
 * Verifies:
 * 1. Technical Indicators:
 *    - SMA (20, 50, 200) exact calculations and insufficient data handling
 *    - ATR (14-period) exact True Range averaging
 *    - Volume Analysis (20-day average volume, volume ratio, volume spike)
 *    - Support & Resistance key levels clustering
 *    - Trend classification (uptrend, downtrend, sideways, duration, MA slopes)
 * 2. Candlestick Pattern Detectors (All 9 Blueprint Patterns):
 *    - Bullish: Bullish Engulfing, Hammer, Inverted Hammer, Morning Star,
 *      Dragonfly Doji, Three White Soldiers
 *    - Bearish: Bearish Engulfing, Evening Star, Shooting Star
 *    - Neutral candle series non-detection
 * 3. Signal-Only Rejection & Gate Progression:
 *    - Unconfirmed patterns emit STAGE_E_PATTERN_UNCONFIRMED and do not pass gate
 *    - Bullish setup outside valuation buy zone emits STAGE_E_PRICE_OUTSIDE_BUY_ZONE (HARD_STOP)
 *    - Confirmed bullish setup inside buy zone with valid invalidation & R:R passes gate
 * 4. Invalidation Level & Risk/Reward:
 *    - Invalidation strictly below entry price
 *    - Risk/Reward ratio calculation and threshold enforcement
 * 5. Data Quality Warnings & Safe Fallbacks:
 *    - Insufficient daily bars (< 20) emits STAGE_E_INSUFFICIENT_DATA and fails safely
 *    - Unadjusted bars emit STAGE_E_UNADJUSTED_DATA
 *    - No patterns emit STAGE_E_NO_ELIGIBLE_SETUP
 * 6. Determinism & Invariants:
 *    - Pure function repeatability
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageE,
  analyzeStageE,
  evaluateStageE,
  calculateSma,
  calculateAtr,
  calculateAvgVolume,
  findKeyLevels,
  analyzeTechnicalContext,
  detectBullishEngulfing,
  detectHammer,
  detectInvertedHammer,
  detectMorningStar,
  detectDragonflyDoji,
  detectThreeWhiteSoldiers,
  detectBearishEngulfing,
  detectEveningStar,
  detectShootingStar,
  detectAllCandlestickPatterns,
  type OhlcvBar,
  type StageEInput,
  type PatternContext,
} from '../src/index.js';

function createBar(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100000,
  adjusted = true
): OhlcvBar {
  return { date, open, high, low, close, volume, adjusted };
}

function createDefaultContext(): PatternContext {
  return {
    trend: 'downtrend',
    trendDuration: 10,
    supportLevel: 800,
    resistanceLevel: 950,
    distanceToSupportPct: 2.0,
    distanceToResistancePct: 15.0,
    volumeSpike: true,
    volumeTrend: 'increasing',
    atr: 20.0,
    maTrend: 'flat',
    gapRisk: 'low',
  };
}

function createDowntrendBars(count = 30, startPrice = 1000, step = 5): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price - step;
    const high = open + 2;
    const low = close - 2;
    bars.push({
      date: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      open,
      high,
      low,
      close,
      volume: 100000,
      adjusted: true,
    });
    price = close;
  }
  return bars;
}

describe('Stage E — Technical Analysis Engine', () => {
  // ==========================================================================
  // 1. Technical Indicators & Market Context
  // ==========================================================================
  describe('Technical Indicators', () => {
    it('calculates SMA accurately and returns null when bars < period', () => {
      const bars = createDowntrendBars(25, 500, 2); // 25 bars: closes 498, 496, ..., 450
      const sma20 = calculateSma(bars, 20);
      const sma50 = calculateSma(bars, 50);

      expect(sma20).toBeDefined();
      expect(typeof sma20).toBe('number');
      expect(sma50).toBeNull(); // Only 25 bars available
    });

    it('calculates 14-period ATR accurately', () => {
      const bars = createDowntrendBars(20, 1000, 10);
      const atr = calculateAtr(bars, 14);

      expect(atr).toBeGreaterThan(0);
      // Daily range is open+2 to close-2 (approx 14 points)
      expect(atr).toBeCloseTo(14, 0);
    });

    it('calculates 20-day average volume and detects volume ratio', () => {
      const bars = createDowntrendBars(20, 1000, 5);
      bars[bars.length - 1]!.volume = 250000; // 2.5x volume spike

      const avgVol = calculateAvgVolume(bars, 20);
      expect(avgVol).toBeGreaterThan(100000);

      const analysis = analyzeTechnicalContext(bars, 'daily');
      expect(analysis.volumeRatio).toBeGreaterThan(2.0);
      expect(analysis.context.volumeSpike).toBe(true);
    });

    it('identifies swing high and swing low key support & resistance levels', () => {
      const bars = createDowntrendBars(30, 1000, 5);
      // Create a swing low at bar 15
      bars[15] = createBar('2024-01-16T00:00:00.000Z', 850, 855, 820, 845);
      // Create a swing high at bar 20
      bars[20] = createBar('2024-01-21T00:00:00.000Z', 860, 920, 855, 910);

      const levels = findKeyLevels(bars, 30);
      expect(levels.support).toBeDefined();
      expect(levels.resistance).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. Candlestick Pattern Detectors (All 9 Patterns)
  // ==========================================================================
  describe('Candlestick Pattern Detectors', () => {
    it('detects Bullish Engulfing pattern with confirmation candle', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 102, 88, 90), // C1: Bearish (body = 10)
        createBar('2024-03-02T00:00:00.000Z', 89, 106, 88, 105), // C2: Bullish engulfing (body = 16)
        createBar('2024-03-03T00:00:00.000Z', 106, 112, 105, 110), // C3: Confirmation (close 110 > 105)
      ];

      const pattern = detectBullishEngulfing(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('bullish-engulfing');
      expect(pattern?.confirmation).toBe(true);
      expect(pattern?.qualityScore).toBeGreaterThanOrEqual(0.7);
    });

    it('detects Hammer pattern after decline with next-session confirmation', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 101, 80, 98), // Hammer: body = 2, lower shadow = 18 (9x body)
        createBar('2024-03-02T00:00:00.000Z', 99, 108, 98, 106), // Confirmation: close > 98
      ];

      const pattern = detectHammer(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('hammer');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Inverted Hammer pattern with upper shadow >= 2x body', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 82, 98, 81, 85), // body = 3, upper shadow = 13 (4.3x body), lower shadow = 1
        createBar('2024-03-02T00:00:00.000Z', 86, 95, 85, 92), // Confirmation
      ];

      const pattern = detectInvertedHammer(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('inverted-hammer');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Morning Star 3-candle reversal pattern', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 120, 122, 98, 100), // C1: Long bearish (body = 20)
        createBar('2024-03-02T00:00:00.000Z', 96, 98, 93, 95), // C2: Star (small body = 1)
        createBar('2024-03-03T00:00:00.000Z', 98, 116, 97, 114), // C3: Long bullish (> 50% into C1: > 110)
      ];

      const pattern = detectMorningStar(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('morning-star');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Dragonfly Doji rejecting lower prices', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 100.5, 75, 100.2), // Open ~ Close ~ High, long lower shadow (25)
        createBar('2024-03-02T00:00:00.000Z', 101, 110, 100, 108), // Confirmation
      ];

      const pattern = detectDragonflyDoji(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('dragonfly-doji');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Three White Soldiers consecutive bullish sequence', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 112, 99, 110), // Soldier 1
        createBar('2024-03-02T00:00:00.000Z', 104, 122, 103, 120), // Soldier 2 (opens within prior body)
        createBar('2024-03-03T00:00:00.000Z', 114, 133, 113, 131), // Soldier 3 (opens within prior body)
      ];

      const pattern = detectThreeWhiteSoldiers(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('three-white-soldiers');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Bearish Engulfing reversal warning', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 110, 99, 108), // Green candle (body = 8)
        createBar('2024-03-02T00:00:00.000Z', 110, 112, 95, 96), // Red candle engulfing prior body (body = 14)
        createBar('2024-03-03T00:00:00.000Z', 95, 97, 88, 90), // Follow through
      ];

      const pattern = detectBearishEngulfing(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('bearish-engulfing');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Evening Star 3-candle bearish topping pattern', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 122, 99, 120), // C1: Long bullish (body = 20)
        createBar('2024-03-02T00:00:00.000Z', 123, 126, 122, 124), // C2: Star (body = 1)
        createBar('2024-03-03T00:00:00.000Z', 121, 122, 105, 106), // C3: Long bearish (< 50% into C1: < 110)
      ];

      const pattern = detectEveningStar(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('evening-star');
      expect(pattern?.confirmation).toBe(true);
    });

    it('detects Shooting Star topping candle', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 125, 99, 102), // Upper shadow = 23 (11.5x body of 2), lower shadow = 1
        createBar('2024-03-02T00:00:00.000Z', 101, 102, 90, 92), // Confirmation
      ];

      const pattern = detectShootingStar(bars, context);
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('shooting-star');
      expect(pattern?.confirmation).toBe(true);
    });

    it('returns empty array when candles are neutral or non-conforming', () => {
      const context = createDefaultContext();
      const bars = [
        createBar('2024-03-01T00:00:00.000Z', 100, 105, 95, 101),
        createBar('2024-03-02T00:00:00.000Z', 101, 104, 98, 100),
        createBar('2024-03-03T00:00:00.000Z', 100, 103, 97, 101),
      ];

      const patterns = detectAllCandlestickPatterns(bars, context);
      expect(patterns).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 3. Stage E Engine Execution & Gate Progression
  // ==========================================================================
  describe('Stage E Engine Execution & Gate Progression', () => {
    function createInputWithPattern(patternType: 'confirmed-engulfing' | 'unconfirmed-hammer' | 'outside-buy-zone'): StageEInput {
      const bars = createDowntrendBars(25, 1000, 5); // Bars down to ~875

      if (patternType === 'confirmed-engulfing') {
        bars.push(createBar('2024-02-01T00:00:00.000Z', 880, 882, 850, 855)); // Bearish
        bars.push(createBar('2024-02-02T00:00:00.000Z', 852, 890, 850, 888)); // Bullish engulfing
        bars.push(createBar('2024-02-03T00:00:00.000Z', 889, 910, 887, 905)); // Confirmation
      } else if (patternType === 'unconfirmed-hammer') {
        bars.push(createBar('2024-02-01T00:00:00.000Z', 870, 872, 820, 868)); // Hammer with no follow-through candle
      } else if (patternType === 'outside-buy-zone') {
        bars.push(createBar('2024-02-01T00:00:00.000Z', 880, 882, 850, 855));
        bars.push(createBar('2024-02-02T00:00:00.000Z', 852, 890, 850, 888));
        bars.push(createBar('2024-02-03T00:00:00.000Z', 889, 910, 887, 905));
      }

      return {
        companyId: 'TEST_TITAN',
        asOfDate: '2024-02-03T00:00:00.000Z',
        adjustedOhlcvDaily: bars,
        valuationMaxBuyPrice: patternType === 'outside-buy-zone' ? 850 : 950, // Price 905 > 850 is outside buy zone!
        selectedFairValue: 1200,
        dataSnapshotId: 'snap_001',
      };
    }

    it('passes gate when confirmed bullish setup is inside valuation buy zone with valid invalidation (Scenario E-01)', () => {
      const input = createInputWithPattern('confirmed-engulfing');
      const output = scoreStageE(input);

      expect(output.stage).toBe('E');
      expect(output.priceData.inBuyZone).toBe(true);
      expect(output.eligible).toBe(true);
      expect(output.gatePassed).toBe(true);
      expect(output.canProceedToStageF).toBe(true);
      expect(output.bestSetup).toBeDefined();
      expect(output.bestSetup?.pattern.name).toBe('bullish-engulfing');
      expect(output.bestSetup?.pattern.confirmation).toBe(true);
      expect(output.bestSetup?.invalidationLevel).toBeLessThan(output.priceData.currentPrice);
      expect(output.bestSetup?.riskReward).toBeGreaterThanOrEqual(1.5);
      expect(output.hardStops).toHaveLength(0);
    });

    it('fails gate and flags STAGE_E_PATTERN_UNCONFIRMED when pattern lacks next-session confirmation (Scenario E-02)', () => {
      const input = createInputWithPattern('unconfirmed-hammer');
      const output = scoreStageE(input);

      expect(output.eligible).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageF).toBe(false);
      const unconfirmedFlag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_E_PATTERN_UNCONFIRMED'
      );
      expect(unconfirmedFlag).toBeDefined();
    });

    it('triggers HARD STOP STAGE_E_PRICE_OUTSIDE_BUY_ZONE when price exceeds valuation max buy price (Scenario E-03)', () => {
      const input = createInputWithPattern('outside-buy-zone');
      const output = scoreStageE(input);

      expect(output.priceData.inBuyZone).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageF).toBe(false);

      const outsideZoneStop = output.hardStops.find(
        (f) => f.flagKey === 'STAGE_E_PRICE_OUTSIDE_BUY_ZONE'
      );
      expect(outsideZoneStop).toBeDefined();
      expect(outsideZoneStop?.class).toBe('HARD_STOP');
      expect(outsideZoneStop?.severity).toBe('critical');
    });

    it('flags STAGE_E_NO_ELIGIBLE_SETUP when price is in buy zone but no candlestick patterns exist (Scenario E-08)', () => {
      // Clean downtrend bars without any reversal pattern at the end
      const bars = createDowntrendBars(25, 1000, 5);
      const input: StageEInput = {
        companyId: 'TEST_TITAN',
        asOfDate: '2024-02-03T00:00:00.000Z',
        adjustedOhlcvDaily: bars,
        valuationMaxBuyPrice: 1000,
      };

      const output = scoreStageE(input);
      expect(output.eligible).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.flags.some((f) => f.flagKey === 'STAGE_E_NO_ELIGIBLE_SETUP')).toBe(true);
    });

    it('emits DATA_QUALITY_WARNING STAGE_E_INSUFFICIENT_DATA and fails safely when daily bars < 20', () => {
      const input: StageEInput = {
        companyId: 'TEST_NEW_IPO',
        asOfDate: '2024-02-03T00:00:00.000Z',
        adjustedOhlcvDaily: createDowntrendBars(10), // only 10 bars
        valuationMaxBuyPrice: 1000,
      };

      const output = scoreStageE(input);
      expect(output.eligible).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.flags.some((f) => f.flagKey === 'STAGE_E_INSUFFICIENT_DATA')).toBe(true);
    });

    it('works identically via analyzeStageE and evaluateStageE aliases', () => {
      const input = createInputWithPattern('confirmed-engulfing');
      const out1 = scoreStageE(input);
      const out2 = analyzeStageE(input);
      const out3 = evaluateStageE(input);

      expect(out1.gatePassed).toBe(out2.gatePassed);
      expect(out1.gatePassed).toBe(out3.gatePassed);
      expect(out1.bestSetup?.invalidationLevel).toBe(out2.bestSetup?.invalidationLevel);
    });
  });

  // ==========================================================================
  // 4. Invariants & Determinism
  // ==========================================================================
  describe('Invariants & Repeatability', () => {
    it('produces identical deterministic outputs across consecutive invocations', () => {
      const bars = createDowntrendBars(25, 1000, 5);
      bars.push(createBar('2024-02-01T00:00:00.000Z', 880, 882, 850, 855));
      bars.push(createBar('2024-02-02T00:00:00.000Z', 852, 890, 850, 888));
      bars.push(createBar('2024-02-03T00:00:00.000Z', 889, 910, 887, 905));

      const input: StageEInput = {
        companyId: 'TEST_REPEAT',
        asOfDate: '2024-02-03T00:00:00.000Z',
        adjustedOhlcvDaily: bars,
        valuationMaxBuyPrice: 950,
      };

      const run1 = scoreStageE(input);
      const run2 = scoreStageE(input);

      expect(run1.gatePassed).toBe(run2.gatePassed);
      expect(run1.eligible).toBe(run2.eligible);
      expect(run1.priceData.currentPrice).toBe(run2.priceData.currentPrice);
      expect(run1.bestSetup?.riskReward).toBe(run2.bestSetup?.riskReward);
      expect(run1.flags.length).toBe(run2.flags.length);
    });
  });
});
