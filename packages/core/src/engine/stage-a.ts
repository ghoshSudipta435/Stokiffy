/**
 * Stage A (Quick Screening) Deterministic Scoring Engine
 *
 * Implements the 10-point non-financial and 9-point bank/NBFC scoring rules
 * as defined in STAGE_A_SCORING_SPEC.md.
 *
 * Pure TypeScript implementation using Decimal.js for financial precision.
 * Zero external framework dependencies.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  StageAInput,
  StageAOutput,
  StageAFinancials,
  StageAVerdictBand,
  StageADataAvailability,
} from '../types/stage-a.js';
import type { RedFlag, DataProvenance } from '../types/base.js';
import type { ScoringRuleResult } from '../types/scoring.js';
import {
  findIndustryBenchmark,
  type IndustryBenchmark,
} from '../config/benchmarks.js';

/**
 * Stage A Engine Configuration Options.
 */
export interface StageAConfig {
  ruleSetVersion?: string | undefined;
  customBenchmarks?: Record<string, IndustryBenchmark> | undefined;
}

const DEFAULT_RULE_SET_VERSION = 'stage-a-v1.0';

/**
 * Safely extracts a Decimal value from a metric input,
 * preserving nulls and never coercing missing values to 0.
 */
function extractValue(val: unknown): Decimal | null {
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
  if (typeof val === 'object') {
    if ('value' in (val as Record<string, unknown>)) {
      const v = (val as { value: unknown }).value;
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? new Decimal(v) : null;
      try {
        const d = new Decimal(v as string | number);
        return d.isFinite() ? d : null;
      } catch {
        return null;
      }
    }
    if ('latestFy' in (val as Record<string, unknown>)) {
      return extractValue((val as Record<string, unknown>).latestFy);
    }
  }
  return null;
}

/**
 * Extracts provenance from metric or returns fallback.
 */
function extractProvenance(val: unknown, fallback: DataProvenance): DataProvenance {
  if (val && typeof val === 'object' && 'provenance' in (val as Record<string, unknown>)) {
    const p = (val as { provenance: unknown }).provenance;
    if (p && typeof p === 'object') {
      return p as DataProvenance;
    }
  }
  return fallback;
}

/**
 * Normalizes input value to percentage scale if provided as a decimal ratio.
 * E.g., if benchmark/threshold is 20 (meaning 20%) and input is 0.25 (meaning 25%),
 * converts 0.25 -> 25.
 */
function normalizeToPercentage(val: Decimal, referenceThreshold: number): Decimal {
  if (Math.abs(referenceThreshold) >= 5 && !val.isZero() && val.abs().lessThan(1)) {
    return val.times(100);
  }
  if (Math.abs(referenceThreshold) < 1 && referenceThreshold > 0 && !val.isZero() && val.abs().lessThanOrEqualTo(0.05)) {
    return val.times(100);
  }
  return val;
}

/**
 * Calculates CAGR over 5 years.
 * Returns null if either value is non-positive.
 */
function calculateCagr5y(latest: Decimal, fiveYearsAgo: Decimal): Decimal | null {
  if (latest.lessThanOrEqualTo(0) || fiveYearsAgo.lessThanOrEqualTo(0)) {
    return null;
  }
  try {
    return latest.dividedBy(fiveYearsAgo).pow(new Decimal(1).dividedBy(5)).minus(1);
  } catch {
    return null;
  }
}

/**
 * Calculates YoY growth.
 * Returns null if prior value is zero.
 */
function calculateYoY(latest: Decimal, prior: Decimal): Decimal | null {
  if (prior.isZero()) {
    return null;
  }
  return latest.minus(prior).dividedBy(prior);
}

/**
 * Helper to construct standardized RedFlag records.
 */
function createRedFlag(params: {
  flagKey: string;
  ruleKey: string;
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
  return {
    id: `flag_${params.flagKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    flagKey: params.flagKey,
    stage: 'A',
    ruleKey: params.ruleKey,
    message: params.message,
    threshold: params.threshold,
    actualValue: params.actualValue,
    expectedValue: params.expectedValue,
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
}

/**
 * Computes default data availability report if not provided.
 */
function computeAvailability(financials: StageAFinancials): StageADataAvailability {
  const keys: (keyof StageAFinancials)[] = [
    'revenue', 'netProfit', 'operatingProfit', 'totalAssets', 'totalLiabilities',
    'totalEquity', 'totalDebt', 'currentAssets', 'currentLiabilities', 'interestExpense',
    'ebit', 'eps', 'peRatio', 'roa', 'roe', 'roce', 'opm',
  ];

  let present = 0;
  let missing = 0;
  const incomplete: string[] = [];

  for (const k of keys) {
    const val = financials[k];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
        if ((val as { value: unknown }).value !== null) {
          present++;
        } else {
          missing++;
          incomplete.push(String(k));
        }
      } else {
        present++;
      }
    } else {
      missing++;
      incomplete.push(String(k));
    }
  }

  const total = present + missing;
  const coverageRatio = total > 0 ? Number((present / total).toFixed(4)) : 0;

  return {
    totalMetrics: total,
    presentMetrics: present,
    missingMetrics: missing,
    incompleteMetrics: incomplete,
    qualityWarnings: missing > 0 ? [`Missing ${missing} metrics`] : [],
    coverageRatio,
  };
}

/**
 * Evaluates Stage A screening for a single company.
 * Deterministic pure function: StageAInput -> StageAOutput.
 */
export function scoreStageA(input: StageAInput, config?: StageAConfig): StageAOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const companyId = input.companyId;
  const sector = input.sector;
  const isBankOrNbfc =
    sector === 'bank' ||
    sector === 'nbfc' ||
    (typeof sector === 'string' && (sector.toLowerCase().includes('bank') || sector.toLowerCase().includes('nbfc')));

  const maxPossibleScore = isBankOrNbfc ? 9 : 10;
  const minPassScore = isBankOrNbfc ? 5.5 : 6.5;

  const defaultProv: DataProvenance = {
    source: 'engine-derived',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'FY_LATEST',
    currency: 'INR',
    unit: 'RAW',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  // Resolve industry benchmark
  const benchmarkLookupName = input.industry || sector;
  const resolvedBenchmark =
    (config?.customBenchmarks && input.industry && config.customBenchmarks[input.industry]) ||
    findIndustryBenchmark(benchmarkLookupName);

  const ruleResults: ScoringRuleResult[] = [];
  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];
  const dataQualityWarnings: RedFlag[] = [];
  const valuationWarnings: RedFlag[] = [];
  const unsuitableRules: string[] = isBankOrNbfc ? ['currentRatio', 'interestCoverage'] : [];

  const f = input.financials;

  // --------------------------------------------------------------------------
  // Rule 1: Sales Growth (1.0 pt max)
  // +0.5 if latest FY YoY > 0 AND 5Y CAGR > 0; +0.5 if latest FY YoY > 5Y CAGR.
  // Negative growth = Hard Stop.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'salesGrowth';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    let latestYoY =
      extractValue(f.salesGrowth?.latestYoY) ??
      extractValue(f.sales?.latestYoY) ??
      extractValue(f.revenueGrowth?.latestYoY);

    let cagr5y =
      extractValue(f.salesGrowth?.cagr5y) ??
      extractValue(f.sales?.cagr5y) ??
      extractValue(f.revenueGrowth?.cagr5y);

    // Attempt derived computation if direct growth metrics are missing
    const salesLatest =
      extractValue(f.sales?.latestFy) ??
      extractValue(f.salesGrowth?.latestFy) ??
      extractValue(f.revenue);
    const salesPrior =
      extractValue(f.sales?.priorFy) ??
      extractValue(f.salesGrowth?.priorFy) ??
      extractValue(f.revenueGrowth?.priorFy);
    const sales5yAgo =
      extractValue(f.sales?.fy5yAgo) ??
      extractValue(f.salesGrowth?.fy5yAgo) ??
      extractValue(f.revenueGrowth?.fy5yAgo);

    if (latestYoY === null && salesLatest !== null && salesPrior !== null) {
      latestYoY = calculateYoY(salesLatest, salesPrior);
    }
    if (cagr5y === null && salesLatest !== null && sales5yAgo !== null) {
      cagr5y = calculateCagr5y(salesLatest, sales5yAgo);
    }

    let explanation = '';

    if (latestYoY === null || cagr5y === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_SALES_GROWTH_DATA_MISSING',
        ruleKey,
        message: 'Sales growth data is missing or incomplete; rule unscored (0.0 / 1.0 pts)',
        threshold: 'latestYoY and cagr5y must be non-null',
        actualValue: {
          latestYoY: latestYoY ? latestYoY.toNumber() : null,
          cagr5y: cagr5y ? cagr5y.toNumber() : null,
        },
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Sales growth data missing or incomplete; unscored (0.0 / 1.0 pts).';
    } else {
      // Normalize if one is ratio and one is percentage
      let normYoY = latestYoY;
      let normCagr = cagr5y;
      if (normYoY.abs().lessThanOrEqualTo(1) && normCagr.abs().greaterThan(1)) {
        normYoY = normYoY.times(100);
      } else if (normCagr.abs().lessThanOrEqualTo(1) && normYoY.abs().greaterThan(1)) {
        normCagr = normCagr.times(100);
      }

      if (normYoY.lessThan(0) || normCagr.lessThan(0)) {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_SALES_GROWTH_NEGATIVE',
          ruleKey,
          message: 'Sales growth negative in latest FY or 5Y CAGR; fundamental deterioration',
          threshold: 'latestYoY >= 0 and cagr5y >= 0',
          actualValue: {
            latestYoY: normYoY.toNumber(),
            cagr5y: normCagr.toNumber(),
          },
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        points = new Decimal(0);
        explanation = `Sales growth negative: Latest FY YoY (${normYoY.toFixed(2)}%), 5Y CAGR (${normCagr.toFixed(2)}%). HARD STOP triggered (0.0 / 1.0 pts).`;
      } else {
        const explParts: string[] = [];
        if (normYoY.greaterThan(0) && normCagr.greaterThan(0)) {
          points = points.plus(0.5);
          explParts.push('YoY and 5Y CAGR both positive (+0.5 pts)');
        }
        if (normYoY.greaterThan(normCagr)) {
          points = points.plus(0.5);
          explParts.push('YoY exceeded 5Y CAGR (+0.5 pts)');
        }
        if (points.isZero()) {
          explParts.push('growth was flat (0.0 / 1.0 pts)');
        }
        explanation = `Sales growth: YoY ${normYoY.toFixed(2)}%, CAGR ${normCagr.toFixed(2)}%. ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        latestYoY: latestYoY ? latestYoY.toNumber() : null,
        cagr5y: cagr5y ? cagr5y.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.revenue, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 2: Profit Growth (1.0 pt max)
  // +0.5 if latest FY YoY > 0 AND 5Y CAGR > 0; +0.5 if latest FY YoY > 5Y CAGR.
  // Negative growth = Hard Stop.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'profitGrowth';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    let latestYoY =
      extractValue(f.profitGrowth?.latestYoY) ??
      extractValue(f.profit?.latestYoY) ??
      extractValue(f.netProfitGrowth?.latestYoY);

    let cagr5y =
      extractValue(f.profitGrowth?.cagr5y) ??
      extractValue(f.profit?.cagr5y) ??
      extractValue(f.netProfitGrowth?.cagr5y);

    const profitLatest =
      extractValue(f.profit?.latestFy) ??
      extractValue(f.profitGrowth?.latestFy) ??
      extractValue(f.netProfit);
    const profitPrior =
      extractValue(f.profit?.priorFy) ??
      extractValue(f.profitGrowth?.priorFy) ??
      extractValue(f.netProfitGrowth?.priorFy);
    const profit5yAgo =
      extractValue(f.profit?.fy5yAgo) ??
      extractValue(f.profitGrowth?.fy5yAgo) ??
      extractValue(f.netProfitGrowth?.fy5yAgo);

    if (latestYoY === null && profitLatest !== null && profitPrior !== null) {
      latestYoY = calculateYoY(profitLatest, profitPrior);
    }
    if (cagr5y === null && profitLatest !== null && profit5yAgo !== null) {
      cagr5y = calculateCagr5y(profitLatest, profit5yAgo);
    }

    let explanation = '';

    if (latestYoY === null || cagr5y === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_PROFIT_GROWTH_DATA_MISSING',
        ruleKey,
        message: 'Profit growth data is missing or incomplete; rule unscored (0.0 / 1.0 pts)',
        threshold: 'latestYoY and cagr5y must be non-null',
        actualValue: {
          latestYoY: latestYoY ? latestYoY.toNumber() : null,
          cagr5y: cagr5y ? cagr5y.toNumber() : null,
        },
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Profit growth data missing or incomplete; unscored (0.0 / 1.0 pts).';
    } else {
      let normYoY = latestYoY;
      let normCagr = cagr5y;
      if (normYoY.abs().lessThanOrEqualTo(1) && normCagr.abs().greaterThan(1)) {
        normYoY = normYoY.times(100);
      } else if (normCagr.abs().lessThanOrEqualTo(1) && normYoY.abs().greaterThan(1)) {
        normCagr = normCagr.times(100);
      }

      if (normYoY.lessThan(0) || normCagr.lessThan(0)) {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_PROFIT_GROWTH_NEGATIVE',
          ruleKey,
          message: 'Profit growth negative in latest FY or 5Y CAGR; check for one-off items',
          threshold: 'latestYoY >= 0 and cagr5y >= 0',
          actualValue: {
            latestYoY: normYoY.toNumber(),
            cagr5y: normCagr.toNumber(),
          },
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        points = new Decimal(0);
        explanation = `Profit growth negative: Latest FY YoY (${normYoY.toFixed(2)}%), 5Y CAGR (${normCagr.toFixed(2)}%). HARD STOP triggered (0.0 / 1.0 pts).`;
      } else {
        const explParts: string[] = [];
        if (normYoY.greaterThan(0) && normCagr.greaterThan(0)) {
          points = points.plus(0.5);
          explParts.push('YoY and 5Y CAGR both positive (+0.5 pts)');
        }
        if (normYoY.greaterThan(normCagr)) {
          points = points.plus(0.5);
          explParts.push('YoY exceeded 5Y CAGR (+0.5 pts)');
        }
        if (points.isZero()) {
          explParts.push('growth was flat (0.0 / 1.0 pts)');
        }
        explanation = `Profit growth: YoY ${normYoY.toFixed(2)}%, CAGR ${normCagr.toFixed(2)}%. ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        latestYoY: latestYoY ? latestYoY.toNumber() : null,
        cagr5y: cagr5y ? cagr5y.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.netProfit, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 3: Operating Profit Margin (OPM) (1.0 pt max)
  // +0.5 if both 1Y and 5Y OPM ≥ industry lower benchmark;
  // +0.5 if also 1Y OPM > 5Y OPM.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'opm';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const opm1yRaw = extractValue(f.opm?.latestFy ?? f.opm);
    const opm5yRaw = extractValue(f.opm?.avg5y);
    const benchOpmMinRaw =
      extractValue(f.industryOpmMin) ??
      (resolvedBenchmark?.opmMin !== undefined ? new Decimal(resolvedBenchmark.opmMin) : null);

    let explanation = '';

    if (benchOpmMinRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_BENCHMARK_MISSING',
        ruleKey,
        message: 'Industry OPM benchmark missing; cannot score margin vs peers',
        threshold: 'industryOpmMin benchmark must be defined',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Industry OPM benchmark missing; rule unscored (0.0 / 1.0 pts).';
    } else if (opm1yRaw === null || opm5yRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_OPM_DATA_MISSING',
        ruleKey,
        message: 'Operating Profit Margin data missing (1Y or 5Y average); rule unscored',
        threshold: '1Y and 5Y OPM required',
        actualValue: {
          opm1y: opm1yRaw ? opm1yRaw.toNumber() : null,
          opm5y: opm5yRaw ? opm5yRaw.toNumber() : null,
        },
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'OPM data incomplete (1Y or 5Y avg missing); unscored (0.0 / 1.0 pts).';
    } else {
      const benchMin = benchOpmMinRaw;
      const opm1y = normalizeToPercentage(opm1yRaw, benchMin.toNumber());
      const opm5y = normalizeToPercentage(opm5yRaw, benchMin.toNumber());

      const meetsBoth = opm1y.greaterThanOrEqualTo(benchMin) && opm5y.greaterThanOrEqualTo(benchMin);
      const explParts: string[] = [];

      if (meetsBoth) {
        points = points.plus(0.5);
        explParts.push(`1Y (${opm1y.toFixed(2)}%) and 5Y avg (${opm5y.toFixed(2)}%) ≥ benchmark (${benchMin.toFixed(2)}%) (+0.5 pts)`);

        if (opm1y.greaterThan(opm5y)) {
          points = points.plus(0.5);
          explParts.push(`1Y OPM exceeded 5Y avg (+0.5 pts)`);
        } else {
          explParts.push(`1Y OPM did not exceed 5Y avg`);
        }
      } else {
        explParts.push(`OPM below industry lower benchmark (${benchMin.toFixed(2)}%)`);
      }

      explanation = `OPM: ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        opm1y: opm1yRaw ? opm1yRaw.toNumber() : null,
        opm5y: opm5yRaw ? opm5yRaw.toNumber() : null,
        industryOpmMin: benchOpmMinRaw ? benchOpmMinRaw.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.opm?.latestFy ?? f.operatingProfit, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 4: Return on Equity (ROE) (1.0 pt max)
  // +0.5 for ≥20%, +0.25 for 10% to <20%; +0.5 if 1Y ROE > 5Y ROE.
  // ROE <10% = Hard Stop.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'roe';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const roe1yRaw = extractValue(f.roe?.latestFy ?? f.roe);
    const roe5yRaw = extractValue(f.roe?.avg5y);

    let explanation = '';

    if (roe1yRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_ROE_DATA_MISSING',
        ruleKey,
        message: 'ROE data missing for latest FY; rule unscored',
        threshold: 'roe.latestFy required',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'ROE data missing for latest FY; unscored (0.0 / 1.0 pts).';
    } else {
      const roe1y = normalizeToPercentage(roe1yRaw, 20);
      const explParts: string[] = [];

      if (roe1y.greaterThanOrEqualTo(20)) {
        points = points.plus(0.5);
        explParts.push(`1Y ROE (${roe1y.toFixed(2)}%) ≥ 20% (+0.5 pts)`);
      } else if (roe1y.greaterThanOrEqualTo(10)) {
        points = points.plus(0.25);
        explParts.push(`1Y ROE (${roe1y.toFixed(2)}%) between 10%–20% (+0.25 pts)`);
      } else {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_ROE_BELOW_10',
          ruleKey,
          message: 'ROE below 10% threshold; review leverage and buybacks',
          threshold: 'ROE >= 10%',
          actualValue: roe1y.toNumber(),
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        explParts.push(`1Y ROE (${roe1y.toFixed(2)}%) < 10%. HARD STOP triggered`);
      }

      if (roe5yRaw !== null) {
        const roe5y = normalizeToPercentage(roe5yRaw, 20);
        if (roe1y.greaterThan(roe5y)) {
          points = points.plus(0.5);
          explParts.push(`1Y ROE exceeded 5Y avg (${roe5y.toFixed(2)}%) (+0.5 pts)`);
        } else {
          explParts.push(`1Y ROE did not exceed 5Y avg (${roe5y.toFixed(2)}%)`);
        }
      }

      explanation = `ROE: ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        roe1y: roe1yRaw ? roe1yRaw.toNumber() : null,
        roe5y: roe5yRaw ? roe5yRaw.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.roe?.latestFy ?? f.netProfit, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 5: Return on Capital Employed (ROCE) (1.0 pt max)
  // +0.5 for ≥20%, +0.25 for 10% to <20%; +0.5 if 1Y ROCE > 5Y ROCE.
  // ROCE <10% = Hard Stop.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'roce';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const roce1yRaw = extractValue(f.roce?.latestFy ?? f.roce);
    const roce5yRaw = extractValue(f.roce?.avg5y);

    let explanation = '';

    if (roce1yRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_ROCE_DATA_MISSING',
        ruleKey,
        message: 'ROCE data missing for latest FY; rule unscored',
        threshold: 'roce.latestFy required',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'ROCE data missing for latest FY; unscored (0.0 / 1.0 pts).';
    } else {
      const roce1y = normalizeToPercentage(roce1yRaw, 20);
      const explParts: string[] = [];

      if (roce1y.greaterThanOrEqualTo(20)) {
        points = points.plus(0.5);
        explParts.push(`1Y ROCE (${roce1y.toFixed(2)}%) ≥ 20% (+0.5 pts)`);
      } else if (roce1y.greaterThanOrEqualTo(10)) {
        points = points.plus(0.25);
        explParts.push(`1Y ROCE (${roce1y.toFixed(2)}%) between 10%–20% (+0.25 pts)`);
      } else {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_ROCE_BELOW_10',
          ruleKey,
          message: 'ROCE below 10% threshold; compare with ROE for leverage analysis',
          threshold: 'ROCE >= 10%',
          actualValue: roce1y.toNumber(),
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        explParts.push(`1Y ROCE (${roce1y.toFixed(2)}%) < 10%. HARD STOP triggered`);
      }

      if (roce5yRaw !== null) {
        const roce5y = normalizeToPercentage(roce5yRaw, 20);
        if (roce1y.greaterThan(roce5y)) {
          points = points.plus(0.5);
          explParts.push(`1Y ROCE exceeded 5Y avg (${roce5y.toFixed(2)}%) (+0.5 pts)`);
        } else {
          explParts.push(`1Y ROCE did not exceed 5Y avg (${roce5y.toFixed(2)}%)`);
        }
      }

      explanation = `ROCE: ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        roce1y: roce1yRaw ? roce1yRaw.toNumber() : null,
        roce5y: roce5yRaw ? roce5yRaw.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.roce?.latestFy ?? f.ebit, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 6: Debt/Equity Ratio (1.0 pt max; 0 pt for Banks/NBFCs)
  // <0.5 = 1pt; 0.5 to 1.25 = 0.5pt; >1.25 = 0pt + Hard Stop.
  // Excluded from denominator for Banks/NBFCs (legacy /9 mode).
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'debtToEquity';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = isBankOrNbfc ? 0 : 1.0;

    let explanation = '';

    if (isBankOrNbfc) {
      explanation = 'Debt/Equity check excluded for Bank/NBFC sector (legacy 9-point mode).';
    } else {
      const debt = extractValue(f.totalDebt);
      const equity = extractValue(f.totalEquity);

      if (debt === null || equity === null) {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_DEBT_EQUITY_DATA_MISSING',
          ruleKey,
          message: 'Total Debt or Total Equity is missing; rule unscored',
          threshold: 'totalDebt and totalEquity required',
          actualValue: {
            totalDebt: debt ? debt.toNumber() : null,
            totalEquity: equity ? equity.toNumber() : null,
          },
          severity: 'medium',
          class: 'DATA_QUALITY_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        dataQualityWarnings.push(flag);
        explanation = 'Total Debt or Total Equity missing; unscored (0.0 / 1.0 pts).';
      } else if (equity.lessThanOrEqualTo(0)) {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_NEGATIVE_EQUITY',
          ruleKey,
          message: 'Total equity is negative or zero; financial distress',
          threshold: 'totalEquity > 0',
          actualValue: equity.toNumber(),
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        points = new Decimal(0);
        explanation = `Total Equity is negative (${equity.toString()}). HARD STOP triggered (0.0 / 1.0 pts).`;
      } else {
        const de = debt.dividedBy(equity);

        if (de.lessThan(0.5)) {
          points = new Decimal(1.0);
          explanation = `D/E ratio is ${de.toFixed(2)} (< 0.5); awarded 1.0 pt.`;
        } else if (de.lessThanOrEqualTo(1.25)) {
          points = new Decimal(0.5);
          explanation = `D/E ratio is ${de.toFixed(2)} (0.5 to 1.25); awarded 0.5 pt.`;
        } else {
          points = new Decimal(0);
          const flag = createRedFlag({
            flagKey: 'STAGE_A_DEBT_EQUITY_HIGH',
            ruleKey,
            message: 'Debt/Equity exceeds 1.25; high financial risk for non-financial company',
            threshold: 'D/E <= 1.25',
            actualValue: de.toNumber(),
            severity: 'critical',
            class: 'HARD_STOP',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          ruleFlags.push(flag);
          hardStops.push(flag);
          explanation = `D/E ratio is ${de.toFixed(2)} (> 1.25). HARD STOP triggered (0.0 / 1.0 pts).`;
        }
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        totalDebt: extractValue(f.totalDebt)?.toNumber() ?? null,
        totalEquity: extractValue(f.totalEquity)?.toNumber() ?? null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.totalDebt, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 7: Current Ratio (1.0 pt max)
  // >2 = 1pt; 1 to 2 = 0.5pt; <1 = 0pt + Hard Stop.
  // For Banks/NBFCs: mark as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'currentRatio';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const ca = extractValue(f.currentAssets);
    const cl = extractValue(f.currentLiabilities);

    let explanation = '';

    if (ca === null || cl === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_CURRENT_RATIO_DATA_MISSING',
        ruleKey,
        message: 'Current Assets or Current Liabilities is missing; rule unscored',
        threshold: 'currentAssets and currentLiabilities required',
        actualValue: {
          currentAssets: ca ? ca.toNumber() : null,
          currentLiabilities: cl ? cl.toNumber() : null,
        },
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Current Assets or Current Liabilities missing; unscored (0.0 / 1.0 pts).';
    } else if (cl.isZero()) {
      points = new Decimal(1.0);
      explanation = 'Current Liabilities is zero; awarded 1.0 pt.';
    } else {
      const cr = ca.dividedBy(cl);

      if (cr.greaterThan(2.0)) {
        points = new Decimal(1.0);
        explanation = `Current Ratio is ${cr.toFixed(2)} (> 2.0); awarded 1.0 pt.`;
      } else if (cr.greaterThanOrEqualTo(1.0)) {
        points = new Decimal(0.5);
        explanation = `Current Ratio is ${cr.toFixed(2)} (1.0 to 2.0); awarded 0.5 pt.`;
      } else {
        points = new Decimal(0);
        if (isBankOrNbfc) {
          const flag = createRedFlag({
            flagKey: 'STAGE_A_CURRENT_RATIO_UNSUITABLE_FOR_SECTOR',
            ruleKey,
            message: 'Current ratio is unsuitable for bank/NBFC sector; review required',
            threshold: 'N/A (bank review)',
            actualValue: cr.toNumber(),
            severity: 'medium',
            class: 'CONDITIONAL_WARNING',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          ruleFlags.push(flag);
          conditionalWarnings.push(flag);
          explanation = `Current Ratio is ${cr.toFixed(2)} (< 1.0). Marked as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED for Bank/NBFC (0.0 / 1.0 pts).`;
        } else {
          const flag = createRedFlag({
            flagKey: 'STAGE_A_CURRENT_RATIO_LOW',
            ruleKey,
            message: 'Current ratio below 1.0; potential liquidity stress',
            threshold: 'Current Ratio >= 1.0',
            actualValue: cr.toNumber(),
            severity: 'critical',
            class: 'HARD_STOP',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          ruleFlags.push(flag);
          hardStops.push(flag);
          explanation = `Current Ratio is ${cr.toFixed(2)} (< 1.0). HARD STOP triggered (0.0 / 1.0 pts).`;
        }
      }

      if (isBankOrNbfc && !cr.lessThan(1.0)) {
        explanation += ' (Note: Marked as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED for Bank/NBFC).';
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        currentAssets: ca ? ca.toNumber() : null,
        currentLiabilities: cl ? cl.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.currentAssets, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 8: Interest Coverage Ratio (1.0 pt max)
  // >10 = 1pt; 5 to 10 = 0.5pt; 3 to 5 = 0.25pt; <3 = 0pt + Hard Stop.
  // For Banks/NBFCs: mark as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'interestCoverage';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const ebit = extractValue(f.ebit);
    const interest = extractValue(f.interestExpense);

    let explanation = '';

    if (ebit === null || interest === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_INT_COVERAGE_DATA_MISSING',
        ruleKey,
        message: 'EBIT or Interest Expense is missing; rule unscored',
        threshold: 'ebit and interestExpense required',
        actualValue: {
          ebit: ebit ? ebit.toNumber() : null,
          interestExpense: interest ? interest.toNumber() : null,
        },
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'EBIT or Interest Expense missing; unscored (0.0 / 1.0 pts).';
    } else if (interest.lessThanOrEqualTo(0)) {
      if (ebit.greaterThan(0)) {
        points = new Decimal(1.0);
        explanation = 'Zero interest expense with positive EBIT (debt-free); awarded 1.0 pt.';
      } else {
        points = new Decimal(0);
        explanation = 'EBIT is non-positive; awarded 0.0 pts.';
      }
    } else {
      const ic = ebit.dividedBy(interest);

      if (ic.greaterThan(10)) {
        points = new Decimal(1.0);
        explanation = `Interest Coverage is ${ic.toFixed(2)} (> 10); awarded 1.0 pt.`;
      } else if (ic.greaterThanOrEqualTo(5)) {
        points = new Decimal(0.5);
        explanation = `Interest Coverage is ${ic.toFixed(2)} (5 to 10); awarded 0.5 pt.`;
      } else if (ic.greaterThanOrEqualTo(3)) {
        points = new Decimal(0.25);
        explanation = `Interest Coverage is ${ic.toFixed(2)} (3 to 5); awarded 0.25 pt.`;
      } else {
        points = new Decimal(0);
        if (isBankOrNbfc) {
          const flag = createRedFlag({
            flagKey: 'STAGE_A_INT_COVERAGE_UNSUITABLE_FOR_SECTOR',
            ruleKey,
            message: 'Interest coverage is unsuitable for bank/NBFC sector; review required',
            threshold: 'N/A (bank review)',
            actualValue: ic.toNumber(),
            severity: 'medium',
            class: 'CONDITIONAL_WARNING',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          ruleFlags.push(flag);
          conditionalWarnings.push(flag);
          explanation = `Interest Coverage is ${ic.toFixed(2)} (< 3). Marked as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED for Bank/NBFC (0.0 / 1.0 pts).`;
        } else {
          const flag = createRedFlag({
            flagKey: 'STAGE_A_INT_COVERAGE_LOW',
            ruleKey,
            message: 'Interest coverage below 3x; debt service risk elevated',
            threshold: 'Interest Coverage >= 3',
            actualValue: ic.toNumber(),
            severity: 'critical',
            class: 'HARD_STOP',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          ruleFlags.push(flag);
          hardStops.push(flag);
          explanation = `Interest Coverage is ${ic.toFixed(2)} (< 3). HARD STOP triggered (0.0 / 1.0 pts).`;
        }
      }

      if (isBankOrNbfc && !ic.lessThan(3)) {
        explanation += ' (Note: Marked as UNSUITABLE_FOR_SECTOR / REVIEW_REQUIRED for Bank/NBFC).';
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        ebit: ebit ? ebit.toNumber() : null,
        interestExpense: interest ? interest.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.interestExpense, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 9: P/E vs Industry (1.0 pt max)
  // x = companyPE / industryPE
  // 0.8 ≤ x ≤ 2 = 1pt; 2 < x ≤ 2.5 = 0.5pt; 2.5 < x ≤ 3 = 0.25pt;
  // x < 0.8 = 1pt + Conditional Warning (value-trap review);
  // x > 3 = 0pt + Hard Stop.
  // Negative/zero EPS = N/M (not a pass, 0 pts).
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'peVsIndustry';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const companyPeRaw = extractValue(f.peRatio);
    const epsRaw = extractValue(f.eps);
    const industryPeRaw =
      extractValue(f.industryPeRatio) ??
      (resolvedBenchmark?.peMedian !== undefined ? new Decimal(resolvedBenchmark.peMedian) : null);

    let explanation = '';

    if (epsRaw !== null && epsRaw.lessThanOrEqualTo(0)) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_PE_NOT_MEASURABLE',
        ruleKey,
        message: 'Negative or zero EPS; P/E ratio is not measurable (N/M)',
        threshold: 'EPS > 0',
        actualValue: epsRaw.toNumber(),
        severity: 'high',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      points = new Decimal(0);
      explanation = `Negative or zero EPS (${epsRaw.toString()}); P/E is N/M (not measurable; 0.0 / 1.0 pts).`;
    } else if (industryPeRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_BENCHMARK_MISSING',
        ruleKey,
        message: 'Industry P/E benchmark missing; cannot evaluate P/E vs industry',
        threshold: 'industryPeRatio benchmark required',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Industry P/E benchmark missing; rule unscored (0.0 / 1.0 pts).';
    } else if (companyPeRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_PE_DATA_MISSING',
        ruleKey,
        message: 'Company P/E ratio is missing; rule unscored',
        threshold: 'peRatio required',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'Company P/E ratio missing; rule unscored (0.0 / 1.0 pts).';
    } else if (companyPeRaw.lessThanOrEqualTo(0)) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_PE_NOT_MEASURABLE',
        ruleKey,
        message: 'Company P/E ratio is negative or zero (N/M)',
        threshold: 'peRatio > 0',
        actualValue: companyPeRaw.toNumber(),
        severity: 'high',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      points = new Decimal(0);
      explanation = `Company P/E is negative or zero (${companyPeRaw.toString()}); P/E is N/M (0.0 / 1.0 pts).`;
    } else {
      const x = companyPeRaw.dividedBy(industryPeRaw);

      if (x.lessThan(0.8)) {
        points = new Decimal(1.0);
        const flag = createRedFlag({
          flagKey: 'STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP',
          ruleKey,
          message: 'Company P/E below 0.8× industry; potential value trap — review required',
          threshold: 'x >= 0.8',
          actualValue: x.toNumber(),
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        conditionalWarnings.push(flag);
        explanation = `Company P/E (${companyPeRaw.toFixed(2)}) is ${x.toFixed(2)}x industry (${industryPeRaw.toFixed(2)}). x < 0.8: awarded 1.0 pt with CONDITIONAL value-trap review warning.`;
      } else if (x.lessThanOrEqualTo(2.0)) {
        points = new Decimal(1.0);
        explanation = `Company P/E is ${x.toFixed(2)}x industry (0.8 <= x <= 2.0); awarded 1.0 pt.`;
      } else if (x.lessThanOrEqualTo(2.5)) {
        points = new Decimal(0.5);
        explanation = `Company P/E is ${x.toFixed(2)}x industry (2.0 < x <= 2.5); awarded 0.5 pt.`;
      } else if (x.lessThanOrEqualTo(3.0)) {
        points = new Decimal(0.25);
        explanation = `Company P/E is ${x.toFixed(2)}x industry (2.5 < x <= 3.0); awarded 0.25 pt.`;
      } else {
        points = new Decimal(0);
        const flag = createRedFlag({
          flagKey: 'STAGE_A_PE_VS_INDUSTRY_HIGH',
          ruleKey,
          message: 'Company P/E exceeds 3× industry median; valuation risk extreme',
          threshold: 'x <= 3.0',
          actualValue: x.toNumber(),
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        hardStops.push(flag);
        valuationWarnings.push(flag);
        explanation = `Company P/E is ${x.toFixed(2)}x industry (> 3.0x). HARD STOP triggered (0.0 / 1.0 pts).`;
      }
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        companyPe: companyPeRaw ? companyPeRaw.toNumber() : null,
        industryPe: industryPeRaw ? industryPeRaw.toNumber() : null,
        eps: epsRaw ? epsRaw.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.peRatio, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Rule 10: Return on Assets (ROA) (1.0 pt max)
  // +0.5 if ROA ≥ industry minimum; +0.5 if 1Y ROA > 5Y avg ROA.
  // --------------------------------------------------------------------------
  {
    const ruleKey = 'roa';
    const ruleFlags: RedFlag[] = [];
    let points = new Decimal(0);
    const maxPts = 1.0;

    const roa1yRaw = extractValue(f.roa?.latestFy ?? f.roa);
    const roa5yRaw = extractValue(f.roa?.avg5y);
    const benchRoaMinRaw =
      extractValue(f.industryRoaMin) ??
      (resolvedBenchmark?.minRoa !== undefined ? new Decimal(resolvedBenchmark.minRoa) : null);

    let explanation = '';

    if (roa1yRaw === null) {
      const flag = createRedFlag({
        flagKey: 'STAGE_A_ROA_DATA_MISSING',
        ruleKey,
        message: 'ROA data missing for latest FY; rule unscored',
        threshold: 'roa.latestFy required',
        actualValue: null,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
      explanation = 'ROA data missing for latest FY; unscored (0.0 / 1.0 pts).';
    } else {
      const explParts: string[] = [];

      if (benchRoaMinRaw === null) {
        const flag = createRedFlag({
          flagKey: 'STAGE_A_BENCHMARK_MISSING',
          ruleKey,
          message: 'Industry minimum ROA benchmark missing; peer threshold unscored',
          threshold: 'industryRoaMin required',
          actualValue: null,
          severity: 'medium',
          class: 'DATA_QUALITY_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        ruleFlags.push(flag);
        dataQualityWarnings.push(flag);
        explParts.push('industry min benchmark missing (10a unscored)');
      } else {
        const roa1y = normalizeToPercentage(roa1yRaw, benchRoaMinRaw.toNumber());
        if (roa1y.greaterThanOrEqualTo(benchRoaMinRaw)) {
          points = points.plus(0.5);
          explParts.push(`1Y ROA (${roa1y.toFixed(2)}%) ≥ benchmark (${benchRoaMinRaw.toFixed(2)}%) (+0.5 pts)`);
        } else {
          explParts.push(`1Y ROA (${roa1y.toFixed(2)}%) < benchmark (${benchRoaMinRaw.toFixed(2)}%)`);
        }
      }

      if (roa5yRaw !== null) {
        const benchRef = benchRoaMinRaw ? benchRoaMinRaw.toNumber() : 0;
        const roa1y = normalizeToPercentage(roa1yRaw, benchRef);
        const roa5y = normalizeToPercentage(roa5yRaw, benchRef);

        if (roa1y.greaterThan(roa5y)) {
          points = points.plus(0.5);
          explParts.push(`1Y ROA exceeded 5Y avg (${roa5y.toFixed(2)}%) (+0.5 pts)`);
        } else {
          explParts.push(`1Y ROA did not exceed 5Y avg (${roa5y.toFixed(2)}%)`);
        }
      }

      explanation = `ROA: ${explParts.join('; ')}. Awarded ${points.toFixed(2)} / 1.0 pts.`;
    }

    ruleResults.push({
      ruleKey,
      points: points.toNumber(),
      maxPoints: maxPts,
      inputs: {
        roa1y: roa1yRaw ? roa1yRaw.toNumber() : null,
        roa5y: roa5yRaw ? roa5yRaw.toNumber() : null,
        industryRoaMin: benchRoaMinRaw ? benchRoaMinRaw.toNumber() : null,
      },
      explanation,
      redFlags: ruleFlags,
      dataQuality: extractProvenance(f.roa?.latestFy ?? f.netProfit, defaultProv),
      ruleSetVersion,
    });
  }

  // --------------------------------------------------------------------------
  // Aggregate Scores, Verdicts & Hard Gate
  // --------------------------------------------------------------------------
  let totalScoreDec = new Decimal(0);
  for (const r of ruleResults) {
    totalScoreDec = totalScoreDec.plus(r.points);
  }
  const totalPoints = roundDecimal(totalScoreDec, 2).toNumber();

  // Verdict Bands:
  // Non-financial (/10): ≥8.5 Exceptional | 7.5–<8.5 Excellent | 6.5–<7.5 Good | <6.5 Avoid.
  // Bank/NBFC (/9): ≥7.5 Exceptional | 6.5–<7.5 Excellent | 5.5–<6.5 Good | <5.5 Avoid.
  let verdictBand: StageAVerdictBand = 'AVOID';
  if (isBankOrNbfc) {
    if (totalPoints >= 7.5) {
      verdictBand = 'EXCEPTIONAL';
    } else if (totalPoints >= 6.5) {
      verdictBand = 'EXCELLENT';
    } else if (totalPoints >= 5.5) {
      verdictBand = 'GOOD';
    } else {
      verdictBand = 'AVOID';
    }
  } else {
    if (totalPoints >= 8.5) {
      verdictBand = 'EXCEPTIONAL';
    } else if (totalPoints >= 7.5) {
      verdictBand = 'EXCELLENT';
    } else if (totalPoints >= 6.5) {
      verdictBand = 'GOOD';
    } else {
      verdictBand = 'AVOID';
    }
  }

  // Hard Gate Evaluation:
  // Any hard-stop red flag blocks progression to Stage B regardless of total score.
  const hasHardStops = hardStops.length > 0;
  const scorePasses = totalPoints >= minPassScore;
  const gatePassed = !hasHardStops && scorePasses;
  const canProceedToStageB = gatePassed;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (hasHardStops || !scorePasses) {
    verdict = 'FAIL';
  } else if (conditionalWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const availability = input.dataAvailability ?? computeAvailability(f);

  const message = gatePassed
    ? `Stage A screening PASSED with ${totalPoints.toFixed(2)}/${maxPossibleScore} (${verdictBand}). Eligible for Stage B.`
    : hasHardStops
    ? `Stage A screening BLOCKED by ${hardStops.length} HARD STOP red flag(s). Score: ${totalPoints.toFixed(2)}/${maxPossibleScore}.`
    : `Stage A screening FAILED score threshold (${totalPoints.toFixed(2)}/${maxPossibleScore} < ${minPassScore}). Band: ${verdictBand}.`;

  return {
    stage: 'A',
    companyId: input.companyId,
    asOfDate: input.asOfDate,
    sector,
    status: 'COMPLETED',
    dataAvailability: availability,
    executedAt: new Date().toISOString(),
    ruleSetVersion,
    message,
    totalPoints,
    maxPoints: maxPossibleScore,
    maxPossibleScore,
    minPassScore,
    bankVariant: isBankOrNbfc,
    verdictBand,
    gatePassed,
    canProceedToStageB,
    unsuitableRules,
    ruleResults,
    verdict,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings,
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
  };
}
