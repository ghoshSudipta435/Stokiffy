/**
 * Stage B Deterministic Trend Classification Engine
 *
 * Provides pure, deterministic multi-period trend classifiers for:
 * - Quarterly Sales YoY (8+ quarters)
 * - Quarterly OPM YoY (8+ quarters)
 * - Annual Sales 5Y
 * - Annual OPM 5Y
 * - Annual Net Profit & Margin 5Y
 * - Balance Sheet Reserves vs Borrowings 5Y
 * - Cash Flow from Operations (CFO) & Forensic Check
 * - Debtor Days Trend & Hard Caps (>120, >50% rise)
 * - ROCE 5Y Trend
 * - Quarterly Shareholding Pattern & Institutional Movement
 *
 * Built with Decimal.js for exact arithmetic.
 */

import Decimal from 'decimal.js';
import type {
  QuarterlyPoint,
  TrendClassification,
  ShareholdingPoint,
} from '../types/stage-b.js';

export interface TrendAnalysisResult {
  points: number;
  maxPoints: number;
  trend: TrendClassification;
  isHardStop: boolean;
  hardStopFlag?: string | undefined;
  isConditional: boolean;
  conditionalFlag?: string | undefined;
  isDataQualityWarning: boolean;
  dataQualityFlag?: string | undefined;
  explanation: string;
  supportingData: {
    periodCount: number;
    positivePeriods: number;
    negativePeriods: number;
    flatPeriods: number;
  };
}

/**
 * Safely converts an unknown value to a Decimal or null.
 */
function toDec(val: unknown): Decimal | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? new Decimal(val) : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    try {
      const d = new Decimal(trimmed);
      return d.isFinite() ? d : null;
    } catch {
      return null;
    }
  }
  if (val instanceof Decimal) {
    return val.isFinite() ? val : null;
  }
  return null;
}

/**
 * 1. Classifies Quarterly Sales YoY over comparable quarters (minimum 8 recommended).
 * Rubric:
 * - Consistently rising (all > 0): 1.0 pt
 * - Rising overall with fluctuations (positive >= 6 of 8, negative <= 1): 0.75 pt + CONDITIONAL
 * - Flat or adverse/declining: 0.0 pt + HARD STOP
 */
export function classifyQuarterlySalesYoY(
  quarters: (QuarterlyPoint | number | null | undefined)[]
): TrendAnalysisResult {
  const values: Decimal[] = [];

  for (const q of quarters) {
    const raw = typeof q === 'object' && q !== null ? q.salesYoY : q;
    const d = toDec(raw);
    if (d !== null) {
      values.push(d);
    }
  }

  const N = values.length;
  if (N === 0) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Quarterly sales YoY data missing or empty; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: 0, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  let positive = 0;
  let negative = 0;
  let flat = 0;

  for (const v of values) {
    if (v.greaterThan(0)) {
      positive++;
    } else if (v.lessThan(0)) {
      negative++;
    } else {
      flat++;
    }
  }

  const isInsufficient = N < 8;
  const supportingData = {
    periodCount: N,
    positivePeriods: positive,
    negativePeriods: negative,
    flatPeriods: flat,
  };

  if (positive === N) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly Sales YoY consistently rising: all ${N} quarters positive (+1.0 pt).${isInsufficient ? ' (Note: <8 quarters evaluated).' : ''}`,
      supportingData,
    };
  }

  const positiveRatio = positive / N;
  if (positiveRatio >= 0.75 && negative <= 1) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'rising_with_fluctuations',
      isHardStop: false,
      isConditional: true,
      conditionalFlag: 'STAGE_B_Q_SALES_FLUCTUATING',
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly Sales YoY rising with fluctuations: ${positive}/${N} positive, ${negative} negative (+0.75 pts).`,
      supportingData,
    };
  }

  const trend: TrendClassification = flat > positive ? 'flat' : 'declining';
  return {
    points: 0.0,
    maxPoints: 1.0,
    trend,
    isHardStop: true,
    hardStopFlag: 'STAGE_B_Q_SALES_TREND_FAIL',
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
    explanation: `Quarterly Sales YoY flat or declining: ${positive}/${N} positive, ${negative} negative. HARD STOP triggered (0.0 / 1.0 pts).`,
    supportingData,
  };
}

/**
 * 2. Classifies Quarterly OPM YoY over comparable quarters.
 * Rubric:
 * - Increasing (all > 0): 1.0 pt
 * - Mostly constant with occasional rise (positive >= 5, negative <= 1): 0.75 pt
 * - Constant (all changes within ±1.0 percentage points): 0.5 pt
 * - Mostly constant with a few declines (negative <= 2, positive >= 3): 0.25 pt + CONDITIONAL
 * - Consistently falling: 0.0 pt + HARD STOP
 */
export function classifyQuarterlyOpmYoY(
  quarters: (QuarterlyPoint | number | null | undefined)[]
): TrendAnalysisResult {
  const values: Decimal[] = [];

  for (const q of quarters) {
    const raw = typeof q === 'object' && q !== null ? q.opmYoY : q;
    const d = toDec(raw);
    if (d !== null) {
      values.push(d);
    }
  }

  const N = values.length;
  if (N === 0) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Quarterly OPM YoY data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: 0, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  let positive = 0;
  let negative = 0;
  let flat = 0;
  let maxAbsChange = new Decimal(0);

  for (const v of values) {
    if (v.greaterThan(0)) {
      positive++;
    } else if (v.lessThan(0)) {
      negative++;
    } else {
      flat++;
    }
    const abs = v.abs();
    if (abs.greaterThan(maxAbsChange)) {
      maxAbsChange = abs;
    }
  }

  const isInsufficient = N < 8;
  const supportingData = {
    periodCount: N,
    positivePeriods: positive,
    negativePeriods: negative,
    flatPeriods: flat,
  };

  if (positive === N) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly OPM YoY increasing: all ${N} quarters positive (+1.0 pt).`,
      supportingData,
    };
  }

  if (positive >= 5 && negative <= 1) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'mostly_constant_occasional_rise',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly OPM mostly constant with occasional rise: ${positive}/${N} positive, ${negative} negative (+0.75 pts).`,
      supportingData,
    };
  }

  // Constant if all YoY changes are within ±1.0 percentage points
  if (maxAbsChange.lessThanOrEqualTo(1.0)) {
    return {
      points: 0.5,
      maxPoints: 1.0,
      trend: 'constant',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly OPM constant: all changes within ±1.0 percentage points (+0.5 pts).`,
      supportingData,
    };
  }

  if (negative <= 2 && positive >= 3) {
    return {
      points: 0.25,
      maxPoints: 1.0,
      trend: 'mostly_constant_few_declines',
      isHardStop: false,
      isConditional: true,
      conditionalFlag: 'STAGE_B_Q_OPM_SOME_DECLINES',
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
      explanation: `Quarterly OPM mostly constant with a few declines: ${negative} declines (+0.25 pts).`,
      supportingData,
    };
  }

  return {
    points: 0.0,
    maxPoints: 1.0,
    trend: 'consistently_falling',
    isHardStop: true,
    hardStopFlag: 'STAGE_B_Q_OPM_TREND_FAIL',
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_QUARTERS' : undefined,
    explanation: `Quarterly OPM consistently falling: ${negative}/${N} declines. HARD STOP triggered (0.0 / 1.0 pts).`,
    supportingData,
  };
}

/**
 * 3 & 4. Classifies 5-Year Annual Series (e.g. Sales 5Y, OPM 5Y).
 * Rubric:
 * - Consistently up (each year > prior): 1.0 pt
 * - Up with flat periods (no declines): 0.75 pt
 * - Up with a dip (1 decline, recovery): 0.5 pt
 * - Flat (net change within ±5%): 0.25 pt
 * - Declining (net lower than 5Y ago): 0.0 pt + HARD STOP
 */
export function classifyAnnual5YSeries(
  series: (number | null | undefined)[],
  metricName: string,
  hardStopFlag: string,
  flatThresholdRatio = 0.05
): TrendAnalysisResult {
  const values: Decimal[] = [];

  for (const item of series) {
    const d = toDec(item);
    if (d !== null) {
      values.push(d);
    }
  }

  const N = values.length;
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_INSUFFICIENT_HISTORY',
      explanation: `${metricName} 5Y series has insufficient data; rule unscored (0.0 / 1.0 pts).`,
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  const first = values[0]!;
  const latest = values[N - 1]!;
  const netDiff = latest.minus(first);
  const netChangeRatio = first.isZero() ? netDiff : netDiff.dividedBy(first.abs());

  const transitions = N - 1;
  let increases = 0;
  let declines = 0;
  let flats = 0;

  for (let i = 1; i < N; i++) {
    const diff = values[i]!.minus(values[i - 1]!);
    if (diff.greaterThan(0)) {
      increases++;
    } else if (diff.lessThan(0)) {
      declines++;
    } else {
      flats++;
    }
  }

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: increases,
    negativePeriods: declines,
    flatPeriods: flats,
  };

  if (latest.greaterThan(first)) {
    if (increases === transitions) {
      return {
        points: 1.0,
        maxPoints: 1.0,
        trend: 'consistently_rising',
        isHardStop: false,
        isConditional: false,
        isDataQualityWarning: isInsufficient,
        dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
        explanation: `${metricName} 5Y consistently up: all ${transitions} year transitions increased (+1.0 pt).`,
        supportingData,
      };
    }
    if (declines === 0) {
      return {
        points: 0.75,
        maxPoints: 1.0,
        trend: 'up_with_flat_periods',
        isHardStop: false,
        isConditional: false,
        isDataQualityWarning: isInsufficient,
        dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
        explanation: `${metricName} 5Y up with flat periods: 0 declines across ${transitions} years (+0.75 pts).`,
        supportingData,
      };
    }
    if (declines === 1) {
      return {
        points: 0.5,
        maxPoints: 1.0,
        trend: 'up_with_dip',
        isHardStop: false,
        isConditional: false,
        isDataQualityWarning: isInsufficient,
        dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
        explanation: `${metricName} 5Y up overall with a single dip/recovery (+0.5 pts).`,
        supportingData,
      };
    }
    // Net up, but more than 1 decline
    return {
      points: 0.5,
      maxPoints: 1.0,
      trend: 'rising_fluctuating',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `${metricName} 5Y rising with fluctuations: net up (${netChangeRatio.times(100).toFixed(1)}%), ${declines} declines (+0.5 pts).`,
      supportingData,
    };
  }

  // Net change is within ±flatThresholdRatio
  if (netChangeRatio.abs().lessThanOrEqualTo(flatThresholdRatio)) {
    return {
      points: 0.25,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `${metricName} 5Y flat: net change within ±${(flatThresholdRatio * 100).toFixed(0)}% (${netChangeRatio.times(100).toFixed(1)}%) (+0.25 pts).`,
      supportingData,
    };
  }

  // Net declining
  return {
    points: 0.0,
    maxPoints: 1.0,
    trend: 'declining',
    isHardStop: true,
    hardStopFlag,
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `${metricName} 5Y declining: net change ${netChangeRatio.times(100).toFixed(1)}% (< 5Y ago). HARD STOP triggered (0.0 / 1.0 pts).`,
    supportingData,
  };
}

/**
 * 5. Classifies Annual P&L Net Profit & Net Margin (5Y).
 * Rubric:
 * - Profit & margin both rising: 1.0 pt
 * - Profit rising & margin constant (within ±0.5% pts): 0.75 pt
 * - Profit rising with fluctuating margin: 0.5 pt
 * - Profit rising BUT margin falling OR profit falling: 0.0 pt + HARD STOP
 */
export function classifyNetProfitAndMargin(
  profits: (number | null | undefined)[],
  margins: (number | null | undefined)[]
): TrendAnalysisResult {
  const pVals: Decimal[] = [];
  const mVals: Decimal[] = [];

  for (const p of profits) {
    const d = toDec(p);
    if (d !== null) pVals.push(d);
  }
  for (const m of margins) {
    const d = toDec(m);
    if (d !== null) mVals.push(d);
  }

  const N = Math.min(pVals.length, mVals.length);
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Net Profit or Net Margin data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  const firstP = pVals[0]!;
  const latestP = pVals[N - 1]!;
  const profitRising = latestP.greaterThan(firstP);

  const firstM = mVals[0]!;
  const latestM = mVals[N - 1]!;
  const marginDiff = latestM.minus(firstM);

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: profitRising ? 1 : 0,
    negativePeriods: profitRising ? 0 : 1,
    flatPeriods: 0,
  };

  if (!profitRising) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'consistently_falling',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_NET_PROFIT_TREND_FAIL',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Net profit declining over 5Y (${firstP.toFixed(1)} -> ${latestP.toFixed(1)}). HARD STOP triggered (0.0 / 1.0 pts).`,
      supportingData,
    };
  }

  // Margin is falling if latest is down by > 0.5 percentage points
  if (marginDiff.lessThan(-0.5)) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'declining',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_NET_PROFIT_TREND_FAIL',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Profit rising but net margin falling (${firstM.toFixed(1)}% -> ${latestM.toFixed(1)}%). HARD STOP triggered (0.0 / 1.0 pts).`,
      supportingData,
    };
  }

  // Margin is rising if latest is up by > 0.5 percentage points
  if (marginDiff.greaterThan(0.5)) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Net profit and net margin both rising (${firstP.toFixed(1)} -> ${latestP.toFixed(1)}, margin ${firstM.toFixed(1)}% -> ${latestM.toFixed(1)}%) (+1.0 pt).`,
      supportingData,
    };
  }

  // Margin constant if within ±0.5 percentage points
  if (marginDiff.abs().lessThanOrEqualTo(0.5)) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'constant',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Net profit rising and net margin constant (${firstM.toFixed(1)}% to ${latestM.toFixed(1)}%) (+0.75 pts).`,
      supportingData,
    };
  }

  return {
    points: 0.5,
    maxPoints: 1.0,
    trend: 'rising_fluctuating',
    isHardStop: false,
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `Net profit rising with fluctuating net margin (+0.5 pts).`,
    supportingData,
  };
}

/**
 * 6. Classifies Balance Sheet Reserves vs Borrowings (5Y).
 * Rubric:
 * - Reserves up / Borrowings down: 1.0 pt
 * - Reserves up / Borrowings flat (±5%): 0.75 pt
 * - Both up: 0.5 pt
 * - Both flat: 0.25 pt
 * - Other adverse patterns: 0.0 pt + HARD STOP
 */
export function classifyReservesVsBorrowings(
  reserves: (number | null | undefined)[],
  borrowings: (number | null | undefined)[]
): TrendAnalysisResult {
  const rVals: Decimal[] = [];
  const bVals: Decimal[] = [];

  for (const r of reserves) {
    const d = toDec(r);
    if (d !== null) rVals.push(d);
  }
  for (const b of borrowings) {
    const d = toDec(b);
    if (d !== null) bVals.push(d);
  }

  const N = Math.min(rVals.length, bVals.length);
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Reserves or Borrowings data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  const firstR = rVals[0]!;
  const latestR = rVals[N - 1]!;
  const firstB = bVals[0]!;
  const latestB = bVals[N - 1]!;

  const rDiff = latestR.minus(firstR);
  const rChange = firstR.abs().greaterThan(0) ? rDiff.dividedBy(firstR.abs()) : rDiff;

  const bDiff = latestB.minus(firstB);
  const bChange = firstB.abs().greaterThan(0) ? bDiff.dividedBy(firstB.abs()) : bDiff;

  const resUp = rChange.greaterThan(0.05);
  const resFlat = rChange.abs().lessThanOrEqualTo(0.05);
  const resDown = rChange.lessThan(-0.05);

  const borDown = bChange.lessThan(-0.05) || (firstB.isZero() && latestB.isZero());
  const borFlat = bChange.abs().lessThanOrEqualTo(0.05);
  const borUp = bChange.greaterThan(0.05);

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: resUp ? 1 : 0,
    negativePeriods: resDown ? 1 : 0,
    flatPeriods: resFlat ? 1 : 0,
  };

  if (resUp && borDown) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Reserves up (+${rChange.times(100).toFixed(1)}%) and Borrowings down (${bChange.times(100).toFixed(1)}%) (+1.0 pt).`,
      supportingData,
    };
  }

  if (resUp && borFlat) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'up_with_flat_periods',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Reserves up (+${rChange.times(100).toFixed(1)}%) and Borrowings flat (${bChange.times(100).toFixed(1)}%) (+0.75 pts).`,
      supportingData,
    };
  }

  if (resUp && borUp) {
    return {
      points: 0.5,
      maxPoints: 1.0,
      trend: 'rising_fluctuating',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Both Reserves (+${rChange.times(100).toFixed(1)}%) and Borrowings (+${bChange.times(100).toFixed(1)}%) up (+0.5 pts).`,
      supportingData,
    };
  }

  if (resFlat && borFlat) {
    return {
      points: 0.25,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Both Reserves and Borrowings flat (within ±5%) (+0.25 pts).`,
      supportingData,
    };
  }

  return {
    points: 0.0,
    maxPoints: 1.0,
    trend: 'declining',
    isHardStop: true,
    hardStopFlag: 'STAGE_B_RESERVES_BORROWINGS_FAIL',
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `Adverse Reserves vs Borrowings pattern: Reserves ${rChange.times(100).toFixed(1)}%, Borrowings ${bChange.times(100).toFixed(1)}%. HARD STOP triggered (0.0 / 1.0 pts).`,
    supportingData,
  };
}

/**
 * 7. Classifies Cash Flow from Operations (CFO) and performs forensic PAT cross-check.
 * Rubric:
 * - CFO & CFO margin both rising: 1.0 pt
 * - CFO rising & margin constant: 0.75 pt
 * - CFO rising with fluctuating margin: 0.5 pt
 * - CFO rising but margin falling OR CFO falling: 0.0 pt + HARD STOP
 * Forensic Check:
 * - If cumulative 5Y CFO vs 5Y PAT divergence > 20% or CFO/PAT < 0.7: CONDITIONAL_WARNING
 */
export function classifyCfoTrend(
  cfos: (number | null | undefined)[],
  revenues: (number | null | undefined)[],
  pats: (number | null | undefined)[]
): TrendAnalysisResult & {
  isForensicWarning: boolean;
  forensicFlag?: string | undefined;
  cumulativeCfo: number | null;
  cumulativePat: number | null;
  cfoPatRatio: number | null;
} {
  const cVals: Decimal[] = [];
  const rVals: Decimal[] = [];
  const pVals: Decimal[] = [];

  for (const c of cfos) {
    const d = toDec(c);
    if (d !== null) cVals.push(d);
  }
  for (const r of revenues) {
    const d = toDec(r);
    if (d !== null) rVals.push(d);
  }
  for (const p of pats) {
    const d = toDec(p);
    if (d !== null) pVals.push(d);
  }

  const N = cVals.length;
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Cash Flow from Operations (CFO) data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
      isForensicWarning: false,
      cumulativeCfo: null,
      cumulativePat: null,
      cfoPatRatio: null,
    };
  }

  const firstC = cVals[0]!;
  const latestC = cVals[N - 1]!;
  const cfoRising = latestC.greaterThan(firstC);

  // Compute CFO Margins if revenue is available
  let firstMargin = new Decimal(0);
  let latestMargin = new Decimal(0);
  let hasMargins = false;

  if (rVals.length >= N && rVals[0]!.greaterThan(0) && rVals[N - 1]!.greaterThan(0)) {
    firstMargin = firstC.dividedBy(rVals[0]!).times(100);
    latestMargin = latestC.dividedBy(rVals[N - 1]!).times(100);
    hasMargins = true;
  }

  const marginDiff = latestMargin.minus(firstMargin);

  // Forensic PAT cross-check
  let cumCfo = new Decimal(0);
  for (const c of cVals) cumCfo = cumCfo.plus(c);

  let cumPat = new Decimal(0);
  for (const p of pVals) cumPat = cumPat.plus(p);

  let isForensicWarning = false;
  let forensicFlag: string | undefined;
  let cfoPatRatio: number | null = null;

  if (pVals.length > 0 && cumPat.greaterThan(0)) {
    const ratio = cumCfo.dividedBy(cumPat);
    cfoPatRatio = ratio.toNumber();
    const divergence = cumCfo.minus(cumPat).abs().dividedBy(cumPat);

    if (divergence.greaterThan(0.20) || ratio.lessThan(0.70)) {
      isForensicWarning = true;
      forensicFlag = 'STAGE_B_CFO_PAT_DIVERGENCE';
    }
  }

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: cfoRising ? 1 : 0,
    negativePeriods: cfoRising ? 0 : 1,
    flatPeriods: 0,
  };

  const forensicNote = isForensicWarning
    ? ` (Forensic Warning: Cumulative 5Y CFO (${cumCfo.toFixed(1)}) diverges >20% from PAT (${cumPat.toFixed(1)}), CFO/PAT = ${cfoPatRatio?.toFixed(2)}).`
    : '';

  if (!cfoRising) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'consistently_falling',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_CFO_TREND_FAIL',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `CFO declining over 5Y (${firstC.toFixed(1)} -> ${latestC.toFixed(1)}). HARD STOP triggered (0.0 / 1.0 pts).${forensicNote}`,
      supportingData,
      isForensicWarning,
      forensicFlag,
      cumulativeCfo: cumCfo.toNumber(),
      cumulativePat: cumPat.toNumber(),
      cfoPatRatio,
    };
  }

  if (hasMargins && marginDiff.lessThan(-0.5)) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'declining',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_CFO_TREND_FAIL',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `CFO rising but CFO margin falling (${firstMargin.toFixed(1)}% -> ${latestMargin.toFixed(1)}%). HARD STOP triggered (0.0 / 1.0 pts).${forensicNote}`,
      supportingData,
      isForensicWarning,
      forensicFlag,
      cumulativeCfo: cumCfo.toNumber(),
      cumulativePat: cumPat.toNumber(),
      cfoPatRatio,
    };
  }

  if (hasMargins && marginDiff.greaterThan(0.5)) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `CFO and CFO margin both rising (${firstC.toFixed(1)} -> ${latestC.toFixed(1)}, margin ${firstMargin.toFixed(1)}% -> ${latestMargin.toFixed(1)}%) (+1.0 pt).${forensicNote}`,
      supportingData,
      isForensicWarning,
      forensicFlag,
      cumulativeCfo: cumCfo.toNumber(),
      cumulativePat: cumPat.toNumber(),
      cfoPatRatio,
    };
  }

  if (hasMargins && marginDiff.abs().lessThanOrEqualTo(0.5)) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'constant',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `CFO rising and CFO margin constant (${firstMargin.toFixed(1)}% to ${latestMargin.toFixed(1)}%) (+0.75 pts).${forensicNote}`,
      supportingData,
      isForensicWarning,
      forensicFlag,
      cumulativeCfo: cumCfo.toNumber(),
      cumulativePat: cumPat.toNumber(),
      cfoPatRatio,
    };
  }

  return {
    points: 0.5,
    maxPoints: 1.0,
    trend: 'rising_fluctuating',
    isHardStop: false,
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `CFO rising with fluctuating cash margin (+0.5 pts).${forensicNote}`,
    supportingData,
    isForensicWarning,
    forensicFlag,
    cumulativeCfo: cumCfo.toNumber(),
    cumulativePat: cumPat.toNumber(),
    cfoPatRatio,
  };
}

/**
 * 8. Classifies Debtor Days Trend.
 * Rubric:
 * - Consistently falling: 1.0 pt
 * - Almost constant (within ±5%): 0.75 pt
 * - Fluctuating: 0.5 pt
 * - Rising: 0.0 pt + CONDITIONAL_WARNING: STAGE_B_DEBTOR_DAYS_RISING
 * Hard Stop:
 * - Latest debtor days > 120 OR rose > 50% over 5 years -> HARD STOP: STAGE_B_DEBTOR_DAYS_HIGH
 */
export function classifyDebtorDays(
  days: (number | null | undefined)[]
): TrendAnalysisResult {
  const values: Decimal[] = [];

  for (const d of days) {
    const dec = toDec(d);
    if (dec !== null) values.push(dec);
  }

  const N = values.length;
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'Debtor Days data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  const first = values[0]!;
  const latest = values[N - 1]!;
  const diff = latest.minus(first);
  const fiveYearRiseRatio = first.greaterThan(0) ? diff.dividedBy(first) : new Decimal(0);

  const transitions = N - 1;
  let falls = 0;
  let rises = 0;
  let flats = 0;

  for (let i = 1; i < N; i++) {
    const t = values[i]!.minus(values[i - 1]!);
    if (t.lessThan(0)) {
      falls++;
    } else if (t.greaterThan(0)) {
      rises++;
    } else {
      flats++;
    }
  }

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: falls,
    negativePeriods: rises,
    flatPeriods: flats,
  };

  // Hard Stop Condition 1: Latest year debtor days > 120
  if (latest.greaterThan(120)) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_DEBTOR_DAYS_HIGH',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Debtor days is ${latest.toFixed(0)} days (> 120 days threshold). HARD STOP triggered (0.0 / 1.0 pts).`,
      supportingData,
    };
  }

  // Hard Stop Condition 2: Rose > 50% over 5 years
  if (fiveYearRiseRatio.greaterThan(0.50)) {
    return {
      points: 0.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: true,
      hardStopFlag: 'STAGE_B_DEBTOR_DAYS_HIGH',
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Debtor days rose ${fiveYearRiseRatio.times(100).toFixed(1)}% over 5 years (> 50% limit, ${first.toFixed(0)} -> ${latest.toFixed(0)} days). HARD STOP triggered (0.0 / 1.0 pts).`,
      supportingData,
    };
  }

  // Consistently falling (all transitions non-positive)
  if (falls === transitions) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_falling',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Debtor days consistently falling: improved every year (${first.toFixed(0)} -> ${latest.toFixed(0)} days) (+1.0 pt).`,
      supportingData,
    };
  }

  // Almost constant within ±5%
  if (fiveYearRiseRatio.abs().lessThanOrEqualTo(0.05)) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'constant',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Debtor days almost constant (within ±5%, ${first.toFixed(0)} to ${latest.toFixed(0)} days) (+0.75 pts).`,
      supportingData,
    };
  }

  // Fluctuating (not net rising by > 5%)
  if (latest.lessThanOrEqualTo(first)) {
    return {
      points: 0.5,
      maxPoints: 1.0,
      trend: 'rising_fluctuating',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `Debtor days fluctuating without structural deterioration (${first.toFixed(0)} to ${latest.toFixed(0)} days) (+0.5 pts).`,
      supportingData,
    };
  }

  // Rising (latest > first, up to 50%)
  return {
    points: 0.0,
    maxPoints: 1.0,
    trend: 'consistently_rising',
    isHardStop: false,
    isConditional: true,
    conditionalFlag: 'STAGE_B_DEBTOR_DAYS_RISING',
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `Debtor days rising: increased from ${first.toFixed(0)} to ${latest.toFixed(0)} days (+${fiveYearRiseRatio.times(100).toFixed(1)}%) (0.0 / 1.0 pts).`,
    supportingData,
  };
}

/**
 * 9. Classifies ROCE 5-Year Trend.
 * Rubric:
 * - Consistently rising (each year >= prior and latest > first): 1.0 pt
 * - Maintained (within ±1.0% and latest >= 15%): 0.75 pt
 * - Rising but fluctuating (latest > first, with some declines): 0.5 pt
 * - Falling: 0.0 pt + HARD STOP: STAGE_B_ROCE_TREND_FALLING
 */
export function classifyRoceTrend(
  roces: (number | null | undefined)[]
): TrendAnalysisResult {
  const values: Decimal[] = [];

  for (const r of roces) {
    const d = toDec(r);
    if (d !== null) values.push(d);
  }

  const N = values.length;
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      trend: 'flat',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: true,
      dataQualityFlag: 'STAGE_B_DATA_MISSING',
      explanation: 'ROCE 5Y data missing; rule unscored (0.0 / 1.0 pts).',
      supportingData: { periodCount: N, positivePeriods: 0, negativePeriods: 0, flatPeriods: 0 },
    };
  }

  const first = values[0]!;
  const latest = values[N - 1]!;
  const diff = latest.minus(first);

  const transitions = N - 1;
  let increases = 0;
  let declines = 0;

  for (let i = 1; i < N; i++) {
    const t = values[i]!.minus(values[i - 1]!);
    if (t.greaterThan(0)) {
      increases++;
    } else if (t.lessThan(0)) {
      declines++;
    }
  }

  const isInsufficient = N < 5;
  const supportingData = {
    periodCount: N,
    positivePeriods: increases,
    negativePeriods: declines,
    flatPeriods: transitions - increases - declines,
  };

  if (diff.greaterThan(0) && declines === 0) {
    return {
      points: 1.0,
      maxPoints: 1.0,
      trend: 'consistently_rising',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `ROCE 5Y consistently rising: ${first.toFixed(1)}% -> ${latest.toFixed(1)}% (+1.0 pt).`,
      supportingData,
    };
  }

  // Maintained: stays at high level (>= 15%) without significant decline (±1.0 percentage points)
  if (diff.abs().lessThanOrEqualTo(1.0) && latest.greaterThanOrEqualTo(15.0)) {
    return {
      points: 0.75,
      maxPoints: 1.0,
      trend: 'maintained_high',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `ROCE maintained at high level: ${latest.toFixed(1)}% (>= 15% and within ±1.0%) (+0.75 pts).`,
      supportingData,
    };
  }

  if (diff.greaterThan(0)) {
    return {
      points: 0.5,
      maxPoints: 1.0,
      trend: 'rising_fluctuating',
      isHardStop: false,
      isConditional: false,
      isDataQualityWarning: isInsufficient,
      dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
      explanation: `ROCE 5Y rising with fluctuations: net up (${first.toFixed(1)}% -> ${latest.toFixed(1)}%) with ${declines} declines (+0.5 pts).`,
      supportingData,
    };
  }

  return {
    points: 0.0,
    maxPoints: 1.0,
    trend: 'consistently_falling',
    isHardStop: true,
    hardStopFlag: 'STAGE_B_ROCE_TREND_FALLING',
    isConditional: false,
    isDataQualityWarning: isInsufficient,
    dataQualityFlag: isInsufficient ? 'STAGE_B_INSUFFICIENT_HISTORY' : undefined,
    explanation: `ROCE 5Y falling: decreased from ${first.toFixed(1)}% to ${latest.toFixed(1)}%. HARD STOP triggered (0.0 / 1.0 pts).`,
    supportingData,
  };
}

export interface ShareholdingAnalysisResult {
  points: number;
  maxPoints: number;
  pattern: {
    promoter: 'up' | 'down' | 'flat';
    fiiDii: 'up' | 'down' | 'flat';
    public: 'up' | 'down' | 'flat';
  };
  hardFlags: string[];
  conditionalFlags: string[];
  dataQualityFlags: string[];
  explanation: string;
}

/**
 * 10. Classifies Shareholding Pattern.
 * Scoring Table:
 * - Promoter Up, FII+DII Up, Public Down: 1.0 pt
 * - Promoter Up, FII+DII Flat, Public Down: 0.75 pt
 * - Promoter Up, FII+DII Down, Public Down: 0.75 pt
 * - Promoter Flat, FII+DII Up, Public Down: 0.5 pt
 * - Promoter Up, FII+DII Down, Public Up: 0.0 pt + CONDITIONAL_WARNING
 * Hard Stops:
 * - Public holding rises while Promoter & FII+DII fall: HARD STOP
 * - Public holding >= 50% (configurable, default enabled): HARD STOP
 */
export function classifyShareholdingPattern(
  shareholding: ShareholdingPoint[],
  config?: {
    publicHoldingThreshold?: number | undefined;
    enablePublicHoldingHardStop?: boolean | undefined;
    changeThreshold?: number | undefined;
  } | undefined
): ShareholdingAnalysisResult {
  const publicThreshold = config?.publicHoldingThreshold ?? 50.0;
  const enablePublicHardStop = config?.enablePublicHoldingHardStop ?? true;
  const changeThresh = config?.changeThreshold ?? 0.5; // ±0.5% threshold for up/down/flat

  const hardFlags: string[] = [];
  const conditionalFlags: string[] = [];
  const dataQualityFlags: string[] = [];

  const N = shareholding.length;
  if (N < 2) {
    return {
      points: 0,
      maxPoints: 1.0,
      pattern: { promoter: 'flat', fiiDii: 'flat', public: 'flat' },
      hardFlags: [],
      conditionalFlags: [],
      dataQualityFlags: ['STAGE_B_DATA_MISSING'],
      explanation: 'Shareholding pattern data missing or insufficient; rule unscored (0.0 / 1.0 pts).',
    };
  }

  if (N < 8) {
    dataQualityFlags.push('STAGE_B_INSUFFICIENT_QUARTERS');
  }

  const latest = shareholding[N - 1]!;
  const prior = shareholding[N - 2]!;

  const pLatest = toDec(latest.promoterPct) ?? new Decimal(0);
  const pPrior = toDec(prior.promoterPct) ?? new Decimal(0);
  const pDiff = pLatest.minus(pPrior);

  const fiiLatest = toDec(latest.fiiPct) ?? new Decimal(0);
  const diiLatest = toDec(latest.diiPct) ?? new Decimal(0);
  const instLatest = fiiLatest.plus(diiLatest);

  const fiiPrior = toDec(prior.fiiPct) ?? new Decimal(0);
  const diiPrior = toDec(prior.diiPct) ?? new Decimal(0);
  const instPrior = fiiPrior.plus(diiPrior);
  const instDiff = instLatest.minus(instPrior);

  const pubLatest = toDec(latest.publicPct) ?? new Decimal(0);
  const pubPrior = toDec(prior.publicPct) ?? new Decimal(0);
  const pubDiff = pubLatest.minus(pubPrior);

  const toDirection = (diff: Decimal): 'up' | 'down' | 'flat' => {
    if (diff.greaterThan(changeThresh)) return 'up';
    if (diff.lessThan(-changeThresh)) return 'down';
    return 'flat';
  };

  const promoterDir = toDirection(pDiff);
  const fiiDiiDir = toDirection(instDiff);
  const publicDir = toDirection(pubDiff);

  const pattern = {
    promoter: promoterDir,
    fiiDii: fiiDiiDir,
    public: publicDir,
  };

  // Hard Stop 1: Public holding >= 50%
  if (enablePublicHardStop && pubLatest.greaterThanOrEqualTo(publicThreshold)) {
    hardFlags.push('STAGE_B_PUBLIC_HOLDING_GE_50');
  }

  // Hard Stop 2: Public rising while promoter and institutional holdings both fall
  if (publicDir === 'up' && promoterDir !== 'up' && fiiDiiDir !== 'up') {
    hardFlags.push('STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL');
  }

  // Additional Checks (Promoter pledge, dilution, institutional exit)
  const pledgeLatest = toDec(latest.promoterPledgePct);
  const pledgePrior = toDec(prior.promoterPledgePct);

  if (pledgeLatest !== null) {
    if (pledgeLatest.greaterThan(20.0)) {
      conditionalFlags.push('STAGE_B_PROMOTER_PLEDGE_HIGH');
    }
    if (pledgePrior !== null && pledgeLatest.greaterThan(pledgePrior)) {
      conditionalFlags.push('STAGE_B_PROMOTER_PLEDGE_RISING');
    }
  }

  if (fiiPrior.minus(fiiLatest).greaterThan(5.0)) {
    conditionalFlags.push('STAGE_B_INSTITUTIONAL_EXIT');
  }

  // Scoring Table lookup
  let points = 0;
  let explanation = '';

  if (promoterDir === 'up' && fiiDiiDir === 'up' && publicDir === 'down') {
    points = 1.0;
    explanation = 'Promoter Up, Institutional Up, Public Down: Ideal accumulation pattern (+1.0 pt).';
  } else if (promoterDir === 'up' && fiiDiiDir === 'flat' && publicDir === 'down') {
    points = 0.75;
    explanation = 'Promoter Up, Institutional Flat, Public Down: Strong insider accumulation (+0.75 pts).';
  } else if (promoterDir === 'up' && fiiDiiDir === 'down' && publicDir === 'down') {
    points = 0.75;
    explanation = 'Promoter Up, Institutional Down, Public Down (+0.75 pts).';
  } else if (promoterDir === 'flat' && fiiDiiDir === 'up' && publicDir === 'down') {
    points = 0.5;
    explanation = 'Promoter Flat, Institutional Up, Public Down: Institutional accumulation (+0.5 pts).';
  } else if (promoterDir === 'up' && fiiDiiDir === 'down' && publicDir === 'up') {
    points = 0.0;
    conditionalFlags.push('STAGE_B_SHAREHOLDING_INCOMPLETE');
    explanation = 'Promoter Up, Institutional Down, Public Up: Incomplete pattern; review required (0.0 / 1.0 pts).';
  } else if (hardFlags.length > 0) {
    points = 0.0;
    explanation = `Adverse shareholding pattern (Promoter ${promoterDir}, FII+DII ${fiiDiiDir}, Public ${publicDir}). HARD STOP triggered (0.0 / 1.0 pts).`;
  } else {
    // Other neutral patterns without hard stop
    points = publicDir === 'down' ? 0.5 : 0.25;
    explanation = `Shareholding pattern: Promoter ${promoterDir}, FII+DII ${fiiDiiDir}, Public ${publicDir} (+${points.toFixed(2)} pts).`;
  }

  if (hardFlags.length > 0) {
    explanation += ` Flags: ${hardFlags.join(', ')}.`;
  }

  return {
    points,
    maxPoints: 1.0,
    pattern,
    hardFlags,
    conditionalFlags,
    dataQualityFlags,
    explanation,
  };
}
