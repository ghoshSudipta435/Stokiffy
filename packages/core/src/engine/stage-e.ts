/**
 * Stage E (Technical Entry & Timing) Deterministic Engine
 *
 * Implements:
 * 1. Technical Indicators & Market Context (SMA 20/50/200, ATR 14, Volume Ratio, S/R Key Levels)
 * 2. Candlestick Pattern Detectors (9 blueprint patterns: 6 bullish, 3 bearish)
 * 3. Valuation Buy-Zone Overlap & Entry Zone Sizing
 * 4. Invalidation Level (Stop-loss candidate) & Risk/Reward Ratio Calculation
 * 5. Stage E Gate Enforcement (confirmed bullish setup inside buy zone with valid invalidation)
 *
 * Exact Decimal arithmetic. Strictly framed as signal candidates requiring confirmation.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  StageEInput,
  StageEOutput,
  TechnicalSetup,
} from '../types/stage-e.js';
import type { DataProvenance, RedFlag } from '../types/base.js';
import type { ScoringRuleResult } from '../types/scoring.js';
import { analyzeTechnicalContext } from './technical-indicators.js';
import { detectAllCandlestickPatterns } from './candlestick-patterns.js';

export interface StageEConfig {
  ruleSetVersion?: string | undefined;
  minRiskReward?: number | undefined;
  minDailyBars?: number | undefined;
  buyZoneTolerancePct?: number | undefined;
}

export const DEFAULT_RULE_SET_VERSION = 'stage-e-v1.0';
export const DEFAULT_MIN_RISK_REWARD = 1.5;
export const DEFAULT_MIN_DAILY_BARS = 20;

function createRedFlag(params: {
  flagKey: string;
  ruleKey?: string | undefined;
  message: string;
  threshold: string;
  actualValue: unknown;
  expectedValue?: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
  class: 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';
  companyId: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): RedFlag {
  const flag: RedFlag = {
    id: `flag_${params.flagKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    flagKey: params.flagKey,
    stage: 'E',
    message: params.message,
    threshold: params.threshold,
    actualValue: params.actualValue,
    source: 'blueprint',
    severity: params.severity,
    status: 'ACTIVE',
    companyId: params.companyId,
    analysisRunId: '',
    ruleSetVersion: params.ruleSetVersion,
    dataSnapshotId: params.dataSnapshotId ?? '',
    isOverride: false,
    class: params.class,
    createdAt: new Date().toISOString(),
  };

  if (params.ruleKey !== undefined) {
    flag.ruleKey = params.ruleKey;
  }
  if (params.expectedValue !== undefined) {
    flag.expectedValue = params.expectedValue;
  }

  return flag;
}

/**
 * Evaluates Stage E Technical Entry & Timing for a single company.
 * Deterministic pure function: StageEInput -> StageEOutput.
 */
export function scoreStageE(input: StageEInput, config?: StageEConfig): StageEOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const minRiskReward = config?.minRiskReward ?? input.minRiskReward ?? DEFAULT_MIN_RISK_REWARD;
  const companyId = input.companyId;

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'adjusted-price-feed',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'TECHNICAL_ANALYSIS',
    currency: 'INR',
    unit: 'RAW',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];
  const dataQualityWarnings: RedFlag[] = [];
  const valuationWarnings: RedFlag[] = [];

  const dailyBars = input.adjustedOhlcvDaily ?? [];

  // ==========================================================================
  // 1. Guardrails & Data Quality Checks
  // ==========================================================================
  if (dailyBars.length === 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_E_INSUFFICIENT_DATA',
      ruleKey: 'dataQuality',
      message: 'No daily OHLCV bar data available for technical analysis.',
      threshold: '>= 20 daily bars required',
      actualValue: 0,
      expectedValue: '>= 20 bars',
      severity: 'critical',
      class: 'DATA_QUALITY_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    dataQualityWarnings.push(flag);

    return {
      stage: 'E',
      companyId,
      asOfDate: input.asOfDate,
      executedAt: new Date().toISOString(),
      ruleSetVersion,
      message: 'Stage E execution failed: No OHLCV bar history provided.',
      totalPoints: 0,
      maxPoints: 1.0,
      setups: [],
      eligible: false,
      gatePassed: false,
      canProceedToStageF: false,
      priceData: {
        currentPrice: 0,
        maxBuyPrice: input.valuationMaxBuyPrice ?? 0,
        inBuyZone: false,
        distanceToMaxBuyPct: 0,
      },
      technicalContext: {
        dailyTrend: 'sideways',
        weeklyTrend: 'sideways',
        keyLevels: { support: [], resistance: [] },
        volumeProfile: 'neutral',
        rsVsBenchmark: 'inline',
        atr14: 0,
        volumeRatio: 1.0,
      },
      flags: [flag],
      hardStops,
      conditionalWarnings,
      dataQualityWarnings,
      valuationWarnings,
      ruleResults: [],
      verdict: 'FAIL',
      calculatedAt: new Date().toISOString(),
      dataSnapshotId: input.dataSnapshotId ?? '',
    };
  }

  if (dailyBars.length < DEFAULT_MIN_DAILY_BARS) {
    const flag = createRedFlag({
      flagKey: 'STAGE_E_INSUFFICIENT_DATA',
      ruleKey: 'dataQuality',
      message: `Insufficient daily OHLCV bars (${dailyBars.length} bars available, minimum ${DEFAULT_MIN_DAILY_BARS} required).`,
      threshold: `>= ${DEFAULT_MIN_DAILY_BARS} daily bars required`,
      actualValue: dailyBars.length,
      expectedValue: `>= ${DEFAULT_MIN_DAILY_BARS} bars`,
      severity: 'high',
      class: 'DATA_QUALITY_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    dataQualityWarnings.push(flag);
  }

  // Check for unadjusted bars
  const hasUnadjusted = dailyBars.some((b) => !b.adjusted);
  if (hasUnadjusted) {
    const flag = createRedFlag({
      flagKey: 'STAGE_E_UNADJUSTED_DATA',
      ruleKey: 'dataQuality',
      message: 'OHLCV data contains unadjusted prices for corporate actions. Price series may have artificial gaps.',
      threshold: 'All bars must be adjusted',
      actualValue: 'unadjusted bars present',
      severity: 'medium',
      class: 'DATA_QUALITY_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    dataQualityWarnings.push(flag);
  }

  // ==========================================================================
  // 2. Technical Context & Indicators
  // ==========================================================================
  const dailyAnalysis = analyzeTechnicalContext(dailyBars, 'daily');
  const currentPrice = dailyBars[dailyBars.length - 1]!.close;

  // Weekly Context (if provided)
  const weeklyBars = input.adjustedOhlcvWeekly ?? [];
  const weeklyAnalysis =
    weeklyBars.length >= 20 ? analyzeTechnicalContext(weeklyBars, 'weekly') : undefined;
  const weeklyTrend = weeklyAnalysis ? weeklyAnalysis.context.trend : dailyAnalysis.context.trend;

  // Volume Profile
  let volumeProfile: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (dailyAnalysis.volumeRatio >= 1.3 && currentPrice > dailyBars[dailyBars.length - 1]!.open) {
    volumeProfile = 'bullish';
  } else if (dailyAnalysis.volumeRatio >= 1.3 && currentPrice < dailyBars[dailyBars.length - 1]!.open) {
    volumeProfile = 'bearish';
  }

  // ==========================================================================
  // 3. Valuation Buy-Zone Integration
  // ==========================================================================
  const maxBuyPrice = input.valuationMaxBuyPrice ?? currentPrice;
  const inBuyZone = currentPrice <= maxBuyPrice;
  const distanceToMaxBuyPct =
    maxBuyPrice > 0
      ? roundDecimal(
          new Decimal(currentPrice).minus(maxBuyPrice).div(maxBuyPrice).mul(100),
          2
        ).toNumber()
      : 0;

  if (input.valuationMaxBuyPrice !== undefined && !inBuyZone) {
    const outsideZoneFlag = createRedFlag({
      flagKey: 'STAGE_E_PRICE_OUTSIDE_BUY_ZONE',
      ruleKey: 'valuationBuyZoneGate',
      message: `Current market price ₹${currentPrice.toFixed(2)} is outside valuation buy zone (Max Buy Price ₹${maxBuyPrice.toFixed(2)}; +${distanceToMaxBuyPct.toFixed(1)}% above max price).`,
      threshold: `<= ₹${maxBuyPrice.toFixed(2)}`,
      actualValue: currentPrice,
      expectedValue: `<= ${maxBuyPrice}`,
      severity: 'critical',
      class: 'HARD_STOP',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    hardStops.push(outsideZoneFlag);
  }

  // ==========================================================================
  // 4. Candlestick Pattern Detectors & Setup Construction
  // ==========================================================================
  const detectedPatterns = detectAllCandlestickPatterns(dailyBars, dailyAnalysis.context, 'daily');
  const setups: TechnicalSetup[] = [];

  for (const pattern of detectedPatterns) {
    const isBullish = [
      'bullish-engulfing',
      'hammer',
      'inverted-hammer',
      'morning-star',
      'dragonfly-doji',
      'three-white-soldiers',
    ].includes(pattern.name);

    if (isBullish) {
      const patternLow = Math.min(...pattern.candles.map((c) => c.low));
      const patternHigh = Math.max(...pattern.candles.map((c) => c.high));

      // Invalidation level = patternLow - 1 * ATR
      let invalidationLevel = Math.max(
        0,
        roundDecimal(new Decimal(patternLow).minus(dailyAnalysis.context.atr), 2).toNumber()
      );
      if (
        dailyAnalysis.context.supportLevel !== undefined &&
        dailyAnalysis.context.supportLevel < currentPrice
      ) {
        invalidationLevel = Math.max(
          invalidationLevel,
          roundDecimal(
            new Decimal(dailyAnalysis.context.supportLevel).minus(0.5 * dailyAnalysis.context.atr),
            2
          ).toNumber()
        );
      }
      const stopLoss = invalidationLevel;

      // Entry Zone
      const entryZoneLow = Math.max(
        patternLow,
        dailyAnalysis.context.supportLevel ?? patternLow
      );
      let entryZoneHigh = Math.min(
        patternHigh + 0.5 * dailyAnalysis.context.atr,
        maxBuyPrice > 0 ? maxBuyPrice : patternHigh + 0.5 * dailyAnalysis.context.atr
      );
      if (entryZoneLow > entryZoneHigh) {
        entryZoneHigh = Math.max(entryZoneLow, patternHigh);
      }

      // Target calculation
      let target1 =
        dailyAnalysis.context.resistanceLevel !== undefined &&
        dailyAnalysis.context.resistanceLevel > currentPrice
          ? dailyAnalysis.context.resistanceLevel
          : input.selectedFairValue !== undefined && input.selectedFairValue > currentPrice
          ? input.selectedFairValue
          : roundDecimal(
              new Decimal(currentPrice).plus(
                new Decimal(2.5).mul(Math.max(dailyAnalysis.context.atr, currentPrice - stopLoss))
              ),
              2
            ).toNumber();

      const targets = [target1];

      // Risk / Reward
      const risk = currentPrice - stopLoss;
      const reward = target1 - currentPrice;
      const riskReward =
        risk > 0 && reward > 0 ? roundDecimal(new Decimal(reward).div(risk), 2).toNumber() : 0;

      // Context Score: quality, inBuyZone, confirmation, volumeSpike
      const contextScore = roundDecimal(
        new Decimal(pattern.qualityScore)
          .mul(0.4)
          .plus(inBuyZone ? 0.3 : 0.0)
          .plus(pattern.confirmation ? 0.2 : 0.0)
          .plus(dailyAnalysis.context.volumeSpike ? 0.1 : 0.0),
        2
      ).toNumber();

      let setupQuality: 'A+' | 'A' | 'B' | 'C' = 'C';
      if (contextScore >= 0.85) setupQuality = 'A+';
      else if (contextScore >= 0.7) setupQuality = 'A';
      else if (contextScore >= 0.5) setupQuality = 'B';
      else setupQuality = 'C';

      setups.push({
        pattern,
        entryZone: {
          low: roundDecimal(new Decimal(entryZoneLow), 2).toNumber(),
          high: roundDecimal(new Decimal(entryZoneHigh), 2).toNumber(),
        },
        invalidationLevel,
        stopLoss,
        targets,
        riskReward,
        inBuyZone,
        contextScore,
        setupQuality,
      });

      // Pattern confirmation check
      if (!pattern.confirmation) {
        const flag = createRedFlag({
          flagKey: 'STAGE_E_PATTERN_UNCONFIRMED',
          ruleKey: `candlestick_${pattern.name}`,
          message: `Bullish pattern '${pattern.name}' detected but confirmation candle is pending or failed.`,
          threshold: 'Next-session candle confirmation required',
          actualValue: 'confirmation pending',
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        conditionalWarnings.push(flag);
      }

      // Risk / Reward warning
      if (riskReward > 0 && riskReward < minRiskReward) {
        const flag = createRedFlag({
          flagKey: 'STAGE_E_RISK_REWARD_UNFAVORABLE',
          ruleKey: 'riskRewardCheck',
          message: `Technical setup risk/reward (${riskReward.toFixed(2)}) is below minimum threshold (${minRiskReward.toFixed(1)}).`,
          threshold: `>= ${minRiskReward.toFixed(1)}`,
          actualValue: riskReward,
          expectedValue: `>= ${minRiskReward}`,
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        conditionalWarnings.push(flag);
      }
    } else {
      // Bearish Pattern Detected
      const flag = createRedFlag({
        flagKey: 'STAGE_E_BEARISH_PATTERN_DETECTED',
        ruleKey: `candlestick_${pattern.name}`,
        message: `Bearish reversal pattern '${pattern.name}' detected. Potential selling pressure or distribution.`,
        threshold: 'No bearish reversal at resistance',
        actualValue: pattern.name,
        severity: 'medium',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      conditionalWarnings.push(flag);
    }
  }

  // ==========================================================================
  // 5. Best Setup Selection & Stage E Gate
  // ==========================================================================
  const eligibleSetups = setups.filter(
    (s) =>
      s.pattern.confirmation &&
      s.inBuyZone &&
      s.riskReward >= minRiskReward &&
      s.invalidationLevel < currentPrice &&
      s.invalidationLevel > 0
  );

  const bestSetup =
    eligibleSetups.length > 0
      ? eligibleSetups.sort((a, b) => b.contextScore - a.contextScore)[0]
      : setups.length > 0
      ? setups.sort((a, b) => b.contextScore - a.contextScore)[0]
      : undefined;

  const eligible = eligibleSetups.length > 0;

  if (setups.length === 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_E_NO_ELIGIBLE_SETUP',
      ruleKey: 'patternDetection',
      message: 'No candlestick reversal patterns detected on daily chart within recent lookback.',
      threshold: 'At least one confirmed pattern required for technical entry',
      actualValue: 0,
      severity: 'low',
      class: 'CONDITIONAL_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    conditionalWarnings.push(flag);
  }

  // Stage E Gate:
  // - Eligible setup exists (confirmed, inBuyZone, riskReward >= threshold, invalidation < price)
  // - Current price inside buy zone
  // - Zero hard stops
  const hasHardStops = hardStops.length > 0;
  const gatePassed = eligible && inBuyZone && !hasHardStops;
  const canProceedToStageF = gatePassed;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (dailyBars.length < DEFAULT_MIN_DAILY_BARS) {
    verdict = 'INCOMPLETE';
  } else if (!gatePassed) {
    verdict = 'FAIL';
  } else if (conditionalWarnings.length > 0 || dataQualityWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const message = gatePassed
    ? `Stage E technical entry PASSED with confirmed '${bestSetup?.pattern.name}' setup (Quality: ${bestSetup?.setupQuality}, R:R ${bestSetup?.riskReward.toFixed(2)}). Eligible for Stage F portfolio sizing.`
    : hasHardStops
    ? `Stage E entry BLOCKED by ${hardStops.length} HARD STOP flag(s): Price is outside valuation buy zone.`
    : !inBuyZone
    ? `Stage E entry BLOCKED: Current Price ₹${currentPrice.toFixed(2)} exceeds Max Buy Price ₹${maxBuyPrice.toFixed(2)}.`
    : !eligible
    ? `Stage E entry BLOCKED: No confirmed technical setup meets buy zone and risk/reward criteria.`
    : 'Stage E technical entry requirements not satisfied.';

  const allFlags = [
    ...hardStops,
    ...conditionalWarnings,
    ...dataQualityWarnings,
    ...valuationWarnings,
  ];

  const ruleResults: ScoringRuleResult[] = [
    {
      ruleKey: 'technicalContext',
      points: dailyAnalysis.context.trend === 'uptrend' ? 1.0 : dailyAnalysis.context.trend === 'sideways' ? 0.5 : 0.0,
      maxPoints: 1.0,
      inputs: {
        trend: dailyAnalysis.context.trend,
        sma20: dailyAnalysis.sma20,
        sma50: dailyAnalysis.sma50,
        sma200: dailyAnalysis.sma200,
      },
      explanation: `Daily trend is ${dailyAnalysis.context.trend} (SMA20: ₹${dailyAnalysis.sma20?.toFixed(2) ?? 'N/A'}, SMA50: ₹${dailyAnalysis.sma50?.toFixed(2) ?? 'N/A'}).`,
      redFlags: [],
      dataQuality: defaultProv,
      ruleSetVersion,
    },
    {
      ruleKey: 'valuationBuyZone',
      points: inBuyZone ? 1.0 : 0.0,
      maxPoints: 1.0,
      inputs: { currentPrice, maxBuyPrice, inBuyZone, distanceToMaxBuyPct },
      explanation: inBuyZone
        ? `Price ₹${currentPrice.toFixed(2)} is within valuation buy zone (<= ₹${maxBuyPrice.toFixed(2)}).`
        : `Price ₹${currentPrice.toFixed(2)} is outside valuation buy zone (Max Buy Price ₹${maxBuyPrice.toFixed(2)}).`,
      redFlags: hardStops.filter((f) => f.flagKey === 'STAGE_E_PRICE_OUTSIDE_BUY_ZONE'),
      dataQuality: defaultProv,
      ruleSetVersion,
    },
    {
      ruleKey: 'candlestickSetup',
      points: eligible ? 1.0 : 0.0,
      maxPoints: 1.0,
      inputs: {
        patternCount: detectedPatterns.length,
        eligibleSetups: eligibleSetups.length,
        bestPattern: bestSetup?.pattern.name,
        bestSetupScore: bestSetup?.contextScore,
      },
      explanation: eligible
        ? `Confirmed setup '${bestSetup?.pattern.name}' with invalidation at ₹${bestSetup?.invalidationLevel.toFixed(2)} and R:R ${bestSetup?.riskReward.toFixed(2)}.`
        : 'No confirmed setup meets all technical entry and risk/reward criteria.',
      redFlags: conditionalWarnings.filter((f) =>
        ['STAGE_E_PATTERN_UNCONFIRMED', 'STAGE_E_NO_ELIGIBLE_SETUP'].includes(f.flagKey)
      ),
      dataQuality: defaultProv,
      ruleSetVersion,
    },
  ];

  const technicalContext: StageEOutput['technicalContext'] = {
    dailyTrend: dailyAnalysis.context.trend,
    weeklyTrend,
    keyLevels: dailyAnalysis.keyLevels,
    volumeProfile,
    rsVsBenchmark: 'inline',
    atr14: dailyAnalysis.context.atr,
    volumeRatio: roundDecimal(new Decimal(dailyAnalysis.volumeRatio), 2).toNumber(),
  };

  if (dailyAnalysis.sma20 !== null) technicalContext.sma20 = dailyAnalysis.sma20;
  if (dailyAnalysis.sma50 !== null) technicalContext.sma50 = dailyAnalysis.sma50;
  if (dailyAnalysis.sma200 !== null) technicalContext.sma200 = dailyAnalysis.sma200;

  return {
    stage: 'E',
    companyId,
    asOfDate: input.asOfDate,
    executedAt: new Date().toISOString(),
    ruleSetVersion,
    message,
    totalPoints: gatePassed ? 1.0 : 0.0,
    maxPoints: 1.0,
    setups,
    eligible,
    gatePassed,
    canProceedToStageF,
    bestSetup,
    priceData: {
      currentPrice,
      maxBuyPrice,
      inBuyZone,
      distanceToMaxBuyPct,
    },
    technicalContext,
    flags: allFlags,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings,
    ruleResults,
    verdict,
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
  };
}

/**
 * Interface alias for ScoringEngine.analyzeStageE compatibility.
 */
export const analyzeStageE = scoreStageE;
export const evaluateStageE = scoreStageE;
