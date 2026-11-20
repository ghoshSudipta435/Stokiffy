# Technical Analysis Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-e-v1.0`

---

## 1. Purpose

Stage E identifies **technical entry signals** to time a potential entry within the valuation buy zone. Candlestick patterns are **signal candidates only** — never predictive certainty. A technical setup is eligible only when:
1. Price is inside/near the valuation buy zone (≤ Max Buy Price from Stage D)
2. Pattern is confirmed (next candle validation)
3. Invalidation level defined
4. Risk/reward shown before user approval

---

## 2. Candlestick Patterns (From Handwritten Notes)

### 2.1 Bullish Reversal Patterns

| Pattern | Structure | Typical Interpretation | System Treatment |
|---------|-----------|------------------------|------------------|
| **Bullish Engulfing** | 2 candles: small bearish engulfed by larger bullish | Potential bullish reversal | Candidate; require trend/level context + confirmation |
| **Hammer** | Small body, long lower shadow (≥2× body), little/no upper shadow, after decline | Potential bullish reversal | Check location (support), proportions, next-session confirmation |
| **Inverted Hammer** | Small body, long upper shadow, little/no lower shadow, after decline | Potential bullish reversal | Require confirmation; false signals common |
| **Morning Star** | 3 candles: long bearish, small body (star), long bullish closing > 50% of first | Potential bullish reversal | Validate 3-candle structure + support context |
| **Dragonfly Doji** | Open=High=Close, long lower shadow | Potential rejection of lower prices | Context + confirmation required |
| **Three White Soldiers** | 3 consecutive long bullish candles, each opening within prior body, closing near high | Strong bullish sequence | Check overextension + nearby resistance |

### 2.2 Bearish Reversal Patterns (For Monitoring/Exit)

| Pattern | Structure | Typical Interpretation | System Treatment |
|---------|-----------|------------------------|------------------|
| **Bearish Engulfing** | 2 candles: small bullish engulfed by larger bearish | Potential bearish reversal | Warning for existing positions; not auto-short |
| **Evening Star** | 3 candles: long bullish, small body (star), long bearish closing > 50% of first | Potential bearish reversal | Confirm pattern + support break |
| **Shooting Star** | Small body, long upper shadow (≥2× body), little/no lower shadow, after advance | Potential bearish reversal | Require resistance/context + confirmation |

### 2.3 Pattern Detection Requirements

```typescript
// packages/core/src/types/stage-e.ts

export type PatternName = 
  | 'bullish-engulfing' | 'hammer' | 'inverted-hammer' 
  | 'morning-star' | 'dragonfly-doji' | 'three-white-soldiers'
  | 'bearish-engulfing' | 'evening-star' | 'shooting-star';

export interface CandlestickPattern {
  name: PatternName;
  detectedAt: string;           // Date of pattern completion (ISO 8601)
  timeframe: 'daily' | 'weekly';
  candles: OhlcvBar[];          // The pattern candles (2 or 3)
  confirmation: boolean;        // Next candle confirmed direction
  confirmationCandle?: OhlcvBar;
  context: PatternContext;
  qualityScore: number;         // 0-1: how well structure matches textbook
}

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted: boolean;            // True if adjusted for splits/bonuses/dividends
}

export interface PatternContext {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  trendDuration: number;        // Bars in current trend
  supportLevel?: number;
  resistanceLevel?: number;
  distanceToSupportPct?: number;
  distanceToResistancePct?: number;
  volumeSpike: boolean;         // Volume > 1.5× 20-day avg
  volumeTrend: 'increasing' | 'decreasing' | 'flat';
  nearMovingAverage?: '20' | '50' | '200'; // Within 2% of MA
  maTrend: 'rising' | 'falling' | 'flat';
  atr: number;                  // Average True Range (14)
  gapRisk: 'low' | 'medium' | 'high';      // Near earnings, ex-div, etc.
}
```

### 2.4 Detection Algorithms (Deterministic)

#### Bullish Engulfing
```
C1: bearish (close < open)
C2: bullish (close > open)
C2.open ≤ C1.close AND C2.close ≥ C1.open
C2.body > C1.body
Trend context: downtrend or pullback in uptrend
Confirmation: C3.close > C2.close
```

#### Hammer
```
C1: (high - low) > 3 × body
lowerShadow ≥ 2 × body
upperShadow ≤ 0.1 × body
body near high of candle
Trend: downtrend
Confirmation: C2.close > C1.close
```

#### Morning Star
```
C1: long bearish (body > 60% of range)
C2: small body (body < 30% of range), gaps down from C1
C3: long bullish (body > 60% of range), closes > 50% into C1 body
Confirmation: C3 structure complete (no extra candle needed)
```

#### Three White Soldiers
```
C1, C2, C3: all bullish
Each opens within prior body (open > prior.open && open < prior.close)
Each closes near high (close > open + 0.7 × (high - low))
Each body > 1.5 × 20-day avg body
Trend: downtrend reversal or continuation
Overextension check: RSI > 70 or > 3× ATR from 20MA → flag
```

---

## 3. Required Technical Context (Proposed Enhancements)

| Indicator | Purpose | Parameters |
|-----------|---------|------------|
| **Daily & Weekly Trend** | Higher timeframe alignment | 20/50/200 MA slopes; HH/HL vs LH/LL |
| **Moving Averages** | Dynamic support/resistance | 20, 50, 200 SMA/EMA |
| **Volume Analysis** | Confirmation quality | Volume vs 20-day avg; OBV; Volume-price divergence |
| **Support/Resistance** | Key levels | Swing highs/lows; psychological levels; Fibonacci |
| **Relative Strength** | vs Benchmark (Nifty 50) | RS line; outperforming/underperforming |
| **ATR Volatility** | Position sizing, stop distance | 14-period ATR |
| **Gap Risk** | Earnings, corporate actions | Calendar awareness |

**Data:** Adjusted OHLCV (splits, bonuses, dividends). Unadjusted stored separately.

---

## 4. Technical Setup & Entry Eligibility

### 4.1 Technical Setup

```typescript
export interface TechnicalSetup {
  pattern: CandlestickPattern;
  entryZone: { low: number; high: number };     // Suggested entry range
  invalidationLevel: number;                     // Stop/invalidation price
  stopLoss: number;                              // Initial stop-loss
  targets: number[];                             // Target 1, 2, 3...
  riskReward: number;                            // (Target1 - Entry) / (Entry - Stop)
  inBuyZone: boolean;                            // entryZone overlaps valuation maxBuyPrice
  contextScore: number;                          // 0-1: quality of technical context
}
```

### 4.2 Entry Zone Calculation

```
Entry Zone Low = Max(Pattern Low, Support Level)
Entry Zone High = Min(Pattern High + 0.5×ATR, Valuation MaxBuyPrice)
```
If Entry Zone Low > Entry Zone High → **No valid entry zone**

### 4.3 Invalidation Level

```
Invalidation = Pattern Low - 1×ATR (for bullish patterns)
```
Or: Recent swing low, key moving average, or user-defined.

### 4.4 Eligibility Rules

A setup is **eligible** iff ALL:
1. `pattern.confirmation === true`
2. `inBuyZone === true`
3. `riskReward ≥ 1.5` (configurable, default 1.5)
4. `invalidationLevel < entryZone.low`
5. No `STAGE_E_PATTERN_OUT_OF_CONTEXT` flag active

---

## 5. Stage E Output

```typescript
export interface StageEInput {
  companyId: string;
  asOfDate: string;
  adjustedOhlcvDaily: OhlcvBar[];      // Min 200 bars
  adjustedOhlcvWeekly: OhlcvBar[];     // Min 100 bars
  valuationMaxBuyPrice: number;        // From Stage D
  dataProvenance: DataProvenance;
}

export interface StageEOutput {
  stage: 'E';
  setups: TechnicalSetup[];
  eligible: boolean;                   // At least one eligible setup
  bestSetup?: TechnicalSetup;          // Highest contextScore among eligible
  priceData: {
    currentPrice: number;
    maxBuyPrice: number;
    inBuyZone: boolean;
    distanceToMaxBuyPct: number;
  };
  technicalContext: {
    dailyTrend: 'uptrend' | 'downtrend' | 'sideways';
    weeklyTrend: 'uptrend' | 'downtrend' | 'sideways';
    keyLevels: { support: number[]; resistance: number[] };
    volumeProfile: 'bullish' | 'bearish' | 'neutral';
    rsVsBenchmark: 'outperforming' | 'underperforming' | 'inline';
  };
  flags: RedFlag[];
  calculatedAt: string;
  ruleSetVersion: string;
}
```

---

## 6. Flags

| Flag ID | Class | Condition |
|---------|-------|-----------|
| `STAGE_E_PATTERN_UNCONFIRMED` | CONDITIONAL_WARNING | Pattern detected but next candle not confirmed |
| `STAGE_E_PATTERN_OUT_OF_CONTEXT` | CONDITIONAL_WARNING | Pattern at wrong location (hammer in uptrend, shooting star in downtrend) |
| `STAGE_E_OVEREXTENDED` | CONDITIONAL_WARNING | RSI > 75, price > 3×ATR from 20MA, or at strong resistance |
| `STAGE_E_GAP_RISK_HIGH` | DATA_QUALITY_WARNING | Earnings/ex-div within 5 sessions; history of >2% gaps |
| `STAGE_E_PRICE_OUTSIDE_BUY_ZONE` | HARD_STOP (for entry) | Current price > valuation maxBuyPrice |
| `STAGE_E_INSUFFICIENT_DATA` | DATA_QUALITY_WARNING | < 50 daily bars or < 20 weekly bars |
| `STAGE_E_NO_ELIGIBLE_SETUP` | CONDITIONAL_WARNING | Patterns exist but none meet eligibility |

---

## 7. Missing Data Behaviour

| Missing Data | Handling |
|--------------|----------|
| < 50 daily bars | DATA_QUALITY_WARNING; limited pattern detection |
| No weekly data | Use daily only; contextScore reduced |
| Volume missing | Volume analysis skipped; flag |
| Adjustment data missing | Use unadjusted; flag `unadjusted_data` |
| Valuation maxBuyPrice missing | Cannot compute `inBuyZone`; STAGE_E_PRICE_OUTSIDE_BUY_ZONE not evaluated |

---

## 8. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Multiple patterns same day | All detected; each evaluated separately |
| Pattern confirmed but price gaps past entry zone | `inBuyZone` = false; setup ineligible |
| Invalidation level = entry price | Setup rejected (zero risk) |
| Risk/reward < 1.5 | Setup ineligible; flagged |
| Bearish pattern on held position | Generates alert (Stage G); not a Stage E setup |
| Pattern at all-time high | `OVEREXTENDED` flag; contextScore reduced |
| Illiquid stock (volume < 10k/day) | `LIQUIDITY_INSUFFICIENT` flag (Stage F); pattern quality reduced |

---

## 9. Configuration

```yaml
# config/stage-e-v1.0.yaml
stageE:
  version: "1.0"
  patterns:
    bullish:
      - bullish-engulfing
      - hammer
      - inverted-hammer
      - morning-star
      - dragonfly-doji
      - three-white-soldiers
    bearish:
      - bearish-engulfing
      - evening-star
      - shooting-star
  detection:
    minDailyBars: 50
    minWeeklyBars: 20
    bodySizeThreshold: 0.6      # For "long" candles
    smallBodyThreshold: 0.3     # For doji/star
    shadowRatio: 2.0            # Hammer: lower shadow ≥ 2× body
    engulfingRatio: 1.0         # Engulfing body must be larger
    morningStarCloseIntoFirst: 0.5  # C3 closes > 50% into C1
    threeSoldiersMinBars: 3
    volumeSpikeMultiplier: 1.5
  context:
    trendLookback: 20
    maPeriods: [20, 50, 200]
    atrPeriod: 14
    overextended:
      rsiThreshold: 75
      atrMultipleFromMA: 3.0
    gapRisk:
      lookaheadSessions: 5
      gapHistoryThreshold: 0.02
  entry:
    minRiskReward: 1.5
    atrMultipleForEntryHigh: 0.5
    atrMultipleForInvalidation: 1.0
  eligibility:
    requireConfirmation: true
    requireInBuyZone: true
    minContextScore: 0.4
```

---

## 10. Test Scenarios

| Test ID | Scenario | Expected |
|---------|----------|----------|
| E-01 | Bullish engulfing at support, confirmed, price 950, maxBuy 1000 | Eligible = true; inBuyZone = true |
| E-02 | Hammer but next candle lower (no confirmation) | Eligible = false; FLAG: PATTERN_UNCONFIRMED |
| E-03 | Morning star confirmed, price 1050, maxBuy 1000 | Eligible = false; FLAG: PRICE_OUTSIDE_BUY_ZONE |
| E-04 | Three white soldiers at resistance, RSI 78 | FLAG: OVEREXTENDED; contextScore reduced |
| E-05 | Bearish engulfing on held position | No Stage E setup; Stage G alert generated |
| E-06 | Pattern detected, volume missing | Setup detected; volume context skipped; DATA_QUALITY_WARNING |
| E-07 | Invalidation level ≥ entry zone low | Setup rejected; zero/negative risk |
| E-08 | Price in buy zone but no patterns | Eligible = false; NO_ELIGIBLE_SETUP |
| E-09 | Shooting star confirmed at resistance | Bearish pattern detected; monitoring alert only |
| E-10 | Gap risk: earnings in 2 days, history of 3% gaps | FLAG: GAP_RISK_HIGH; entry zone widened or flagged |

---

## 11. Decisions Requiring Approval

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Minimum risk/reward for eligibility | 1.5 vs 2.0 vs configurable | 1.5 default, configurable |
| 2 | Pattern confirmation strictness | Next candle close > pattern high vs next candle bullish | Next candle bullish (close > open) |
| 3 | Weekly timeframe patterns | Detect on weekly + daily vs daily only | Both; weekly higher weight |
| 4 | Technical context indicators | Full set (MA, Vol, RS, ATR) vs minimal | Full set (proposed enhancements) |
| 5 | Overextended definition | RSI>75 + 3×ATR from MA vs simpler | RSI>75 OR 3×ATR from MA |
| 6 | Gap risk handling | Flag only vs widen entry zone vs block | Flag + widen entry zone by 1×ATR |
| 7 | Illiquidity threshold for pattern quality | < 10k vol/day vs < 50k | < 50k shares/day |

---

*End of Technical Analysis Specification*