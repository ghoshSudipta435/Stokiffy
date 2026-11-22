/**
 * Stage D (Valuation Engine) Deterministic Implementation
 *
 * Implements 4 complementary valuation methods:
 * 1. M1 — P/E Valuation (Primary default for profitable non-financials)
 * 2. M2 — PEG Valuation (Growth-adjusted P/E)
 * 3. M3 — Price-to-Book (P/B) Valuation (Primary for Banks/NBFCs & asset-heavy firms)
 * 4. M4 — Simplified DCF Valuation (Labelled educational calculator with sensitivity & scenarios)
 *
 * Enforces 20% Margin of Safety, confidence gating (low confidence blocks BUY-READY),
 * and primary method routing by sector and business model without blind averaging.
 *
 * Pure TypeScript implementation using Decimal.js for exact arithmetic.
 * Zero external framework dependencies.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  Applicability,
  Confidence,
  StageDFinancials,
  StageDInput,
  StageDOutput,
  ValuationMethod,
  ValuationMethodResult,
} from '../types/stage-d.js';
import type { DataProvenance, RedFlag } from '../types/base.js';
import type { ScoringRuleResult } from '../types/scoring.js';

export interface StageDConfig {
  ruleSetVersion?: string | undefined;
  marginOfSafety?: number | undefined;
  dcfWaccRange?: [number, number] | undefined;
  terminalDependenceThreshold?: number | undefined;
}

export const DEFAULT_RULE_SET_VERSION = 'stage-d-v1.0';
export const DEFAULT_MARGIN_OF_SAFETY = 0.20; // 20%
export const DCF_EDUCATIONAL_LABEL = 'Simplified Educational Calculator — not a precise valuation';

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
    stage: 'D',
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

// ============================================================================
// Method 1: P/E Valuation
// ============================================================================
export function calculatePeValuation(params: {
  marketPrice: number;
  financials: StageDFinancials;
  sector: string;
  selectedFairPE?: number | undefined;
  assumedExitPE?: number | undefined;
  companyId: string;
  asOfDate: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): ValuationMethodResult {
  const flags: RedFlag[] = [];
  const reportedEps = params.financials.eps.reported;
  const normalisedEps = params.financials.eps.normalised ?? reportedEps;
  const forecastEps = params.financials.eps.forecast;
  const industryPe = params.financials.industryPeRatio;
  const sectorLower = (params.sector ?? '').toLowerCase();
  const isFinancial =
    sectorLower.includes('bank') ||
    sectorLower.includes('nbfc') ||
    sectorLower.includes('insurance') ||
    sectorLower.includes('financial');

  // Guard against missing or negative EPS
  if (normalisedEps === null || normalisedEps === undefined || Number.isNaN(normalisedEps)) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_NORMALISED_EARNINGS_UNAVAILABLE',
      ruleKey: 'valuationPE',
      message: 'Normalised EPS is unavailable; P/E valuation cannot be computed.',
      threshold: 'Normalised EPS > 0',
      actualValue: normalisedEps,
      severity: 'high',
      class: 'DATA_QUALITY_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'PE',
      fairValue: 0,
      assumptions: { reportedEps, normalisedEps, industryPe },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: 'P/E valuation is not applicable (N/M) due to missing normalised EPS.',
      asOfDate: params.asOfDate,
      flags,
    };
  }

  if (normalisedEps <= 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_EPS_NEGATIVE',
      ruleKey: 'valuationPE',
      message: `Reported or normalised EPS is non-positive (${normalisedEps}); P/E is not applicable (N/M).`,
      threshold: 'EPS > 0',
      actualValue: normalisedEps,
      expectedValue: '> 0',
      severity: 'high',
      class: 'DATA_QUALITY_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'PE',
      fairValue: 0,
      assumptions: { reportedEps, normalisedEps, industryPe },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation:
        'P/E valuation is not applicable (N/M) due to non-positive earnings (EPS <= 0). Never produce negative fair value.',
      asOfDate: params.asOfDate,
      flags,
    };
  }

  const selectedFairPE = params.selectedFairPE ?? industryPe ?? 20.0;
  const assumedExitPE = params.assumedExitPE ?? selectedFairPE;

  const fairValueDec = new Decimal(normalisedEps).mul(selectedFairPE);
  const fairValue = roundDecimal(fairValueDec, 2).toNumber();

  const companyPeDec = new Decimal(params.marketPrice).div(normalisedEps);
  const companyPe = roundDecimal(companyPeDec, 2).toNumber();

  const relativePeDec = industryPe > 0 ? companyPeDec.div(industryPe) : new Decimal(1);
  const relativePe = roundDecimal(relativePeDec, 2).toNumber();

  const overUnderPctDec = fairValueDec.isZero()
    ? new Decimal(0)
    : new Decimal(params.marketPrice).minus(fairValueDec).div(fairValueDec).mul(100);
  const overUnderPct = roundDecimal(overUnderPctDec, 2).toNumber();

  let targetPrice: number | undefined;
  if (forecastEps !== undefined && forecastEps > 0) {
    targetPrice = roundDecimal(new Decimal(forecastEps).mul(assumedExitPE), 2).toNumber();
  }

  // Warning when companyPE > 2 * industryPE
  if (industryPe > 0 && companyPe > 2 * industryPe) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_PE_EXPENSIVE',
      ruleKey: 'valuationPE',
      message: `Company P/E (${companyPe}x) exceeds 2x industry benchmark (${industryPe}x). High multiple requires growth context.`,
      threshold: `<= 2x industry P/E (${2 * industryPe}x)`,
      actualValue: companyPe,
      expectedValue: `<= ${2 * industryPe}`,
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);
  }

  const applicability: Applicability = isFinancial ? 'limited' : 'suitable';
  const confidence: Confidence = companyPe > 2 * industryPe ? 'medium' : 'high';

  const explanation =
    `P/E Valuation: Fair Value = ₹${fairValue.toFixed(2)} based on Normalised EPS ₹${normalisedEps.toFixed(2)} ` +
    `and Fair P/E ${selectedFairPE}x. Current Market Price ₹${params.marketPrice.toFixed(2)} implies P/E ${companyPe}x ` +
    `(Relative P/E ${relativePe}x vs Industry ${industryPe}x), representing ${overUnderPct >= 0 ? '+' : ''}${overUnderPct.toFixed(1)}% ` +
    `${overUnderPct >= 0 ? 'overvaluation' : 'undervaluation'}.` +
    (targetPrice ? ` Forecast Target Price: ₹${targetPrice.toFixed(2)} (Exit P/E ${assumedExitPE}x).` : '');

  const assumptions: Record<string, unknown> = {
    reportedEps,
    normalisedEps,
    industryPe,
    selectedFairPE,
    companyPe,
    relativePe,
    overUnderPct,
  };
  if (targetPrice !== undefined) {
    assumptions.forecastEps = forecastEps;
    assumptions.assumedExitPE = assumedExitPE;
    assumptions.targetPrice = targetPrice;
  }

  return {
    method: 'PE',
    fairValue,
    assumptions,
    applicability,
    confidence,
    explanation,
    asOfDate: params.asOfDate,
    flags,
  };
}

// ============================================================================
// Method 2: PEG Valuation
// ============================================================================
export function calculatePegValuation(params: {
  marketPrice: number;
  financials: StageDFinancials;
  sector: string;
  pegGrowthChoice?: 'historical' | 'forward' | 'custom' | undefined;
  customGrowthRate?: number | undefined;
  companyId: string;
  asOfDate: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): ValuationMethodResult {
  const flags: RedFlag[] = [];
  const reportedEps = params.financials.eps.reported;
  const normalisedEps = params.financials.eps.normalised ?? reportedEps;

  // Resolve growth rate
  let rawGrowth: number | undefined;
  if (params.customGrowthRate !== undefined) {
    rawGrowth = params.customGrowthRate;
  } else if (params.pegGrowthChoice === 'historical') {
    rawGrowth = params.financials.growthRate?.historical;
  } else if (params.pegGrowthChoice === 'forward') {
    rawGrowth = params.financials.growthRate?.forward ?? params.financials.growthRate?.historical;
  } else {
    rawGrowth = params.financials.growthRate?.forward ?? params.financials.growthRate?.historical;
  }

  if (normalisedEps === null || normalisedEps <= 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_EPS_NEGATIVE',
      ruleKey: 'valuationPEG',
      message: `EPS is non-positive (${normalisedEps}); PEG valuation is not applicable (N/M).`,
      threshold: 'EPS > 0',
      actualValue: normalisedEps,
      severity: 'high',
      class: 'DATA_QUALITY_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'PEG',
      fairValue: 0,
      assumptions: { normalisedEps, rawGrowth },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: 'PEG valuation is not applicable due to non-positive earnings (EPS <= 0).',
      asOfDate: params.asOfDate,
      flags,
    };
  }

  if (rawGrowth === undefined || rawGrowth === null || rawGrowth <= 0) {
    const flagKey =
      rawGrowth === undefined || rawGrowth === null
        ? 'STAGE_D_GROWTH_RATE_UNAVAILABLE'
        : 'STAGE_D_PEG_GROWTH_NON_POSITIVE';
    const flag = createRedFlag({
      flagKey,
      ruleKey: 'valuationPEG',
      message: `Earnings growth rate is ${rawGrowth === undefined ? 'unavailable' : `non-positive (${rawGrowth}%)`}; PEG is not applicable.`,
      threshold: 'Growth rate > 0%',
      actualValue: rawGrowth,
      expectedValue: '> 0%',
      severity: 'medium',
      class: 'DATA_QUALITY_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'PEG',
      fairValue: 0,
      assumptions: { normalisedEps, rawGrowth },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: 'PEG valuation is not applicable due to non-positive or missing earnings growth rate.',
      asOfDate: params.asOfDate,
      flags,
    };
  }

  // Normalize growth rate to percentage (e.g. 0.25 -> 25.0; 25.0 -> 25.0)
  const growthRatePct = rawGrowth > 0 && rawGrowth <= 1.0 ? rawGrowth * 100 : rawGrowth;

  const companyPeDec = new Decimal(params.marketPrice).div(normalisedEps);
  const companyPe = roundDecimal(companyPeDec, 2).toNumber();

  const pegDec = companyPeDec.div(growthRatePct);
  const peg = roundDecimal(pegDec, 2).toNumber();

  // Fair Value when PEG = 1.0 (P/E = growthRatePct)
  const fairValueDec = new Decimal(normalisedEps).mul(growthRatePct);
  const fairValue = roundDecimal(fairValueDec, 2).toNumber();

  let interpretation: 'potentially undervalued' | 'fair' | 'getting expensive' | 'overvalued';
  if (peg < 1.0) {
    interpretation = 'potentially undervalued';
  } else if (peg <= 1.5) {
    interpretation = 'fair';
  } else if (peg <= 2.0) {
    interpretation = 'getting expensive';
  } else {
    interpretation = 'overvalued';
  }

  if (peg > 2.0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_PEG_OVERVALUED',
      ruleKey: 'valuationPEG',
      message: `PEG ratio (${peg.toFixed(2)}) > 2.0 indicates earnings growth may be overpriced.`,
      threshold: '<= 2.0',
      actualValue: peg,
      expectedValue: '<= 1.5',
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);
  }

  const confidence: Confidence = peg > 2.0 ? 'medium' : 'high';
  const explanation =
    `PEG Valuation: Fair Value = ₹${fairValue.toFixed(2)} (at PEG = 1.0 based on ${growthRatePct.toFixed(1)}% earnings growth). ` +
    `Current Market Price ₹${params.marketPrice.toFixed(2)} implies P/E ${companyPe.toFixed(1)}x and PEG ${peg.toFixed(2)} ` +
    `(${interpretation}).`;

  return {
    method: 'PEG',
    fairValue,
    assumptions: {
      normalisedEps,
      growthRatePct,
      companyPe,
      peg,
      interpretation,
    },
    applicability: 'suitable',
    confidence,
    explanation,
    asOfDate: params.asOfDate,
    flags,
  };
}

// ============================================================================
// Method 3: Price-to-Book (P/B) Valuation
// ============================================================================
export function calculatePbValuation(params: {
  marketPrice: number;
  financials: StageDFinancials;
  sector: string;
  selectedFairPB?: number | undefined;
  companyId: string;
  asOfDate: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): ValuationMethodResult {
  const flags: RedFlag[] = [];
  const bvps = params.financials.bookValuePerShare;
  const sectorLower = (params.sector ?? '').toLowerCase();

  if (bvps === null || bvps === undefined || bvps <= 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_BOOK_VALUE_NEGATIVE',
      ruleKey: 'valuationPB',
      message: `Negative equity or non-positive Book Value per Share (BVPS = ₹${bvps}); P/B is not applicable.`,
      threshold: 'BVPS > 0',
      actualValue: bvps,
      expectedValue: '> 0',
      severity: 'high',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'PB',
      fairValue: 0,
      assumptions: { bookValuePerShare: bvps, sector: params.sector },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: 'P/B valuation is not applicable due to negative or zero book value per share.',
      asOfDate: params.asOfDate,
      flags,
    };
  }

  const pbDec = new Decimal(params.marketPrice).div(bvps);
  const pb = roundDecimal(pbDec, 2).toNumber();

  const isBank = sectorLower.includes('bank') || sectorLower.includes('nbfc') || sectorLower.includes('insurance');
  const isManufacturing = sectorLower.includes('manufacturing') || sectorLower.includes('metal') || sectorLower.includes('auto');
  const isRealEstate = sectorLower.includes('real estate') || sectorLower.includes('reit') || sectorLower.includes('property');
  const isAssetLight = sectorLower.includes('it') || sectorLower.includes('saas') || sectorLower.includes('service') || sectorLower.includes('tech');

  let defaultFairPb = 2.0;
  let expensiveThreshold = 3.0;
  let applicability: Applicability = 'suitable';
  let band: 'cheap' | 'fair' | 'reasonable' | 'expensive' = 'fair';

  if (isBank) {
    defaultFairPb = 1.8;
    expensiveThreshold = 3.0;
    applicability = 'suitable';
    if (pb < 1.5) band = 'cheap';
    else if (pb <= 2.0) band = 'fair';
    else if (pb <= 3.0) band = 'reasonable';
    else band = 'expensive';
  } else if (isManufacturing) {
    defaultFairPb = 2.0;
    expensiveThreshold = 3.0;
    applicability = 'suitable';
    if (pb < 1.5) band = 'cheap';
    else if (pb <= 3.0) band = 'fair';
    else band = 'expensive';
  } else if (isRealEstate) {
    defaultFairPb = 2.2;
    expensiveThreshold = 4.0;
    applicability = 'suitable';
    if (pb < 1.5) band = 'cheap';
    else if (pb <= 4.0) band = 'fair';
    else band = 'expensive';
  } else if (isAssetLight) {
    defaultFairPb = 3.0;
    expensiveThreshold = 5.0;
    applicability = 'limited'; // Intangibles dominate
    band = pb > 5.0 ? 'expensive' : 'fair';
  }

  const selectedFairPb = params.selectedFairPB ?? defaultFairPb;
  const fairValueDec = new Decimal(bvps).mul(selectedFairPb);
  const fairValue = roundDecimal(fairValueDec, 2).toNumber();

  if (pb > expensiveThreshold) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_PB_EXPENSIVE',
      ruleKey: 'valuationPB',
      message: `P/B ratio (${pb.toFixed(2)}x) exceeds sector expensive threshold (${expensiveThreshold.toFixed(1)}x).`,
      threshold: `<= ${expensiveThreshold.toFixed(1)}x`,
      actualValue: pb,
      expectedValue: `<= ${expensiveThreshold.toFixed(1)}x`,
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);
  }

  const confidence: Confidence = isAssetLight ? 'low' : pb > expensiveThreshold ? 'medium' : 'high';

  const explanation =
    `P/B Valuation: Fair Value = ₹${fairValue.toFixed(2)} based on BVPS ₹${bvps.toFixed(2)} and Fair P/B ${selectedFairPb.toFixed(1)}x. ` +
    `Current Market Price ₹${params.marketPrice.toFixed(2)} implies P/B ${pb.toFixed(2)}x (${band} in ${params.sector || 'sector'}).` +
    (isAssetLight ? ' (Note: P/B has limited applicability for asset-light firms with intangible moats).' : '');

  return {
    method: 'PB',
    fairValue,
    assumptions: {
      bookValuePerShare: bvps,
      pb,
      selectedFairPb,
      expensiveThreshold,
      band,
      sector: params.sector,
    },
    applicability,
    confidence,
    explanation,
    asOfDate: params.asOfDate,
    flags,
  };
}

// ============================================================================
// Method 4: Simplified DCF Valuation
// ============================================================================
export function calculateDcfValuation(params: {
  financials: StageDFinancials;
  companyId: string;
  asOfDate: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
  terminalDependenceThreshold?: number | undefined;
}): ValuationMethodResult {
  const flags: RedFlag[] = [];
  const dcfInputs = params.financials.dcfInputs;
  const sharesOutstanding = params.financials.sharesOutstanding;
  const netDebt = params.financials.netDebt ?? 0;

  if (!dcfInputs || sharesOutstanding <= 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_DCF_INPUTS_MISSING',
      ruleKey: 'valuationDCF',
      message: 'DCF projection inputs or valid diluted shares count are missing.',
      threshold: 'Valid dcfInputs and sharesOutstanding > 0 required',
      actualValue: { hasDcfInputs: !!dcfInputs, sharesOutstanding },
      severity: 'medium',
      class: 'DATA_QUALITY_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'DCF',
      fairValue: 0,
      assumptions: {},
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: `${DCF_EDUCATIONAL_LABEL}: DCF valuation cannot be computed due to missing projection inputs.`,
      asOfDate: params.asOfDate,
      flags,
    };
  }

  // Normalize WACC and terminal growth (e.g. 10 -> 0.10; 0.10 -> 0.10)
  let wacc = dcfInputs.wacc > 1.0 ? dcfInputs.wacc / 100 : dcfInputs.wacc;
  let gTerm = dcfInputs.terminalGrowth > 1.0 ? dcfInputs.terminalGrowth / 100 : dcfInputs.terminalGrowth;

  if (wacc <= 0 || wacc >= 1.0 || gTerm >= wacc) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE',
      ruleKey: 'valuationDCF',
      message: `DCF assumptions unreasonable: Terminal growth (${(gTerm * 100).toFixed(1)}%) >= WACC (${(wacc * 100).toFixed(1)}%) or WACC <= 0.`,
      threshold: 'WACC > terminalGrowth > 0',
      actualValue: { wacc, terminalGrowth: gTerm },
      severity: 'high',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);

    return {
      method: 'DCF',
      fairValue: 0,
      assumptions: { wacc, terminalGrowth: gTerm },
      applicability: 'unsuitable',
      confidence: 'low',
      explanation: `${DCF_EDUCATIONAL_LABEL}: Terminal growth rate >= WACC or WACC <= 0 produces infinite/invalid valuation.`,
      asOfDate: params.asOfDate,
      flags,
    };
  }

  const horizon = dcfInputs.horizon > 0 ? dcfInputs.horizon : 5;
  const fcfList = params.financials.fcf ?? [];
  const latestFcf = fcfList.length > 0 ? fcfList[fcfList.length - 1]! : 0;

  if (latestFcf <= 0) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_DCF_NEGATIVE_FCF',
      ruleKey: 'valuationDCF',
      message: `Latest Free Cash Flow is non-positive (₹${latestFcf}). Cash flow trajectory is unverified.`,
      threshold: 'Latest FCF > 0',
      actualValue: latestFcf,
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);
  }

  // Pure DCF Valuation Calculation Helper
  function runDcfMath(
    waccRate: number,
    gRate: number,
    fcfMultiplier: number = 1.0
  ): { fairValuePerShare: number; pvForecast: number; pvTerminal: number; enterpriseValue: number } {
    const revGrowths = dcfInputs?.revenueGrowth ?? [];
    let currentFcf = new Decimal(latestFcf > 0 ? latestFcf : 100).mul(fcfMultiplier);
    let pvForecastDec = new Decimal(0);

    for (let t = 1; t <= horizon; t++) {
      const gYear = revGrowths[t - 1] ?? (revGrowths.length > 0 ? revGrowths[revGrowths.length - 1]! : 0.10);
      const normalizedG = gYear > 1.0 ? gYear / 100 : gYear;
      currentFcf = currentFcf.mul(new Decimal(1).plus(normalizedG));

      const discountFactor = new Decimal(1).plus(waccRate).pow(t);
      const pvYear = currentFcf.div(discountFactor);
      pvForecastDec = pvForecastDec.plus(pvYear);
    }

    // Terminal Value
    const tvNumerator = currentFcf.mul(new Decimal(1).plus(gRate));
    const tvDenominator = new Decimal(waccRate).minus(gRate);
    const terminalValue = tvDenominator.greaterThan(0) ? tvNumerator.div(tvDenominator) : new Decimal(0);
    const terminalDiscount = new Decimal(1).plus(waccRate).pow(horizon);
    const pvTerminalDec = terminalDiscount.greaterThan(0) ? terminalValue.div(terminalDiscount) : new Decimal(0);

    const enterpriseValueDec = pvForecastDec.plus(pvTerminalDec);
    const equityValueDec = enterpriseValueDec.minus(netDebt);
    const fvPerShareDec = equityValueDec.greaterThan(0)
      ? equityValueDec.div(sharesOutstanding)
      : new Decimal(0);

    return {
      fairValuePerShare: roundDecimal(fvPerShareDec, 2).toNumber(),
      pvForecast: roundDecimal(pvForecastDec, 2).toNumber(),
      pvTerminal: roundDecimal(pvTerminalDec, 2).toNumber(),
      enterpriseValue: roundDecimal(enterpriseValueDec, 2).toNumber(),
    };
  }

  // Base Run
  const baseResult = runDcfMath(wacc, gTerm, 1.0);
  const fairValue = baseResult.fairValuePerShare;
  const tvDependence =
    baseResult.enterpriseValue > 0 ? baseResult.pvTerminal / baseResult.enterpriseValue : 0;

  const terminalDependenceThreshold = params.terminalDependenceThreshold ?? 0.75;
  if (tvDependence > terminalDependenceThreshold) {
    const flag = createRedFlag({
      flagKey: 'STAGE_D_DCF_TERMINAL_DEPENDENCE',
      ruleKey: 'valuationDCF',
      message: `Terminal Value constitutes ${(tvDependence * 100).toFixed(1)}% of total enterprise value (> ${(terminalDependenceThreshold * 100).toFixed(0)}%). High sensitivity to perpetuity growth.`,
      threshold: `<= ${(terminalDependenceThreshold * 100).toFixed(0)}%`,
      actualValue: roundDecimal(new Decimal(tvDependence).mul(100), 1).toNumber(),
      expectedValue: `<= ${(terminalDependenceThreshold * 100).toFixed(0)}%`,
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId: params.companyId,
      ruleSetVersion: params.ruleSetVersion,
      dataSnapshotId: params.dataSnapshotId,
    });
    flags.push(flag);
  }

  // Bear and Bull Scenarios
  // Bear: WACC + 1%, Terminal g - 1%, cash flows -20%
  const bearResult = runDcfMath(Math.min(wacc + 0.01, 0.20), Math.max(gTerm - 0.01, 0.01), 0.80);
  // Bull: WACC - 1%, Terminal g + 1%, cash flows +20%
  const bullResult = runDcfMath(Math.max(wacc - 0.01, 0.06), Math.min(gTerm + 0.01, wacc - 0.01), 1.20);

  const scenarios = {
    bear: bearResult.fairValuePerShare,
    base: baseResult.fairValuePerShare,
    bull: bullResult.fairValuePerShare,
  };

  // Sensitivity Matrix: WACC (-1%, base, +1%) vs Terminal g (-1%, base, +1%)
  const waccSteps = [
    { label: 'wacc_minus_1', rate: Math.max(wacc - 0.01, 0.06) },
    { label: 'wacc_base', rate: wacc },
    { label: 'wacc_plus_1', rate: Math.min(wacc + 0.01, 0.20) },
  ];
  const gSteps = [Math.max(gTerm - 0.01, 0.01), gTerm, Math.min(gTerm + 0.01, wacc - 0.005)];

  const sensitivity: Record<string, number[]> = {};
  for (const wStep of waccSteps) {
    sensitivity[wStep.label] = gSteps.map((gVal) => {
      if (gVal >= wStep.rate) return 0;
      return runDcfMath(wStep.rate, gVal, 1.0).fairValuePerShare;
    });
  }

  const confidence: Confidence = tvDependence > terminalDependenceThreshold || latestFcf <= 0 ? 'low' : 'medium';
  const explanation =
    `${DCF_EDUCATIONAL_LABEL}: Base Fair Value = ₹${fairValue.toFixed(2)}/share (Bear: ₹${scenarios.bear.toFixed(2)}, ` +
    `Bull: ₹${scenarios.bull.toFixed(2)}) based on ${horizon}Y horizon, WACC ${(wacc * 100).toFixed(1)}%, ` +
    `terminal growth ${(gTerm * 100).toFixed(1)}%, Net Debt ₹${netDebt}Cr, and Diluted Shares ${sharesOutstanding}Cr. ` +
    `Terminal value accounts for ${(tvDependence * 100).toFixed(1)}% of EV.`;

  return {
    method: 'DCF',
    fairValue,
    assumptions: {
      horizon,
      wacc,
      terminalGrowth: gTerm,
      latestFcf,
      netDebt,
      sharesOutstanding,
      tvDependence,
      pvForecast: baseResult.pvForecast,
      pvTerminal: baseResult.pvTerminal,
      enterpriseValue: baseResult.enterpriseValue,
    },
    applicability: 'suitable',
    confidence,
    explanation,
    asOfDate: params.asOfDate,
    scenarios,
    sensitivity,
    flags,
  };
}

// ============================================================================
// Primary Method Selection & Stage D Orchestration
// ============================================================================

export function selectPrimaryValuationMethod(params: {
  sector: string;
  businessModel: string;
  methods: ValuationMethodResult[];
  override?: ValuationMethod | undefined;
}): ValuationMethod {
  if (params.override) {
    return params.override;
  }

  const sectorLower = (params.sector ?? '').toLowerCase();
  const bmLower = (params.businessModel ?? '').toLowerCase();

  let preferred: ValuationMethod = 'PE';

  if (
    sectorLower.includes('bank') ||
    sectorLower.includes('nbfc') ||
    sectorLower.includes('insurance') ||
    sectorLower.includes('financial') ||
    sectorLower.includes('real estate')
  ) {
    preferred = 'PB';
  } else if (
    bmLower.includes('subscription') ||
    bmLower.includes('marketplace') ||
    bmLower.includes('growth') ||
    bmLower.includes('freemium')
  ) {
    preferred = 'PEG';
  } else if (
    bmLower.includes('commodity') ||
    bmLower.includes('heavy') ||
    bmLower.includes('cyclical')
  ) {
    preferred = 'DCF';
  } else {
    preferred = 'PE';
  }

  // Verify if preferred method is suitable; if unsuitable, fallback to first suitable
  const prefResult = params.methods.find((m) => m.method === preferred);
  if (prefResult && prefResult.applicability === 'suitable' && prefResult.fairValue > 0) {
    return preferred;
  }

  const fallback = params.methods.find((m) => m.applicability === 'suitable' && m.fairValue > 0);
  return fallback ? fallback.method : preferred;
}

/**
 * Evaluates Stage D Valuation for a single company across 4 complementary methods.
 * Deterministic pure function: StageDInput -> StageDOutput.
 */
export function scoreStageD(input: StageDInput, config?: StageDConfig): StageDOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const marginOfSafetyRatio = config?.marginOfSafety ?? input.marginOfSafety ?? DEFAULT_MARGIN_OF_SAFETY;
  const companyId = input.companyId;

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'engine-derived',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'VALUATION_ANALYSIS',
    currency: 'INR',
    unit: 'CRORE',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  // Run all 4 methods
  const peResult = calculatePeValuation({
    marketPrice: input.marketPrice,
    financials: input.financials,
    sector: input.sector,
    selectedFairPE: input.selectedFairPE,
    assumedExitPE: input.assumedExitPE,
    companyId,
    asOfDate: input.asOfDate,
    ruleSetVersion,
    dataSnapshotId: input.dataSnapshotId,
  });

  const pegResult = calculatePegValuation({
    marketPrice: input.marketPrice,
    financials: input.financials,
    sector: input.sector,
    pegGrowthChoice: input.pegGrowthChoice,
    customGrowthRate: input.customGrowthRate,
    companyId,
    asOfDate: input.asOfDate,
    ruleSetVersion,
    dataSnapshotId: input.dataSnapshotId,
  });

  const pbResult = calculatePbValuation({
    marketPrice: input.marketPrice,
    financials: input.financials,
    sector: input.sector,
    selectedFairPB: input.selectedFairPB,
    companyId,
    asOfDate: input.asOfDate,
    ruleSetVersion,
    dataSnapshotId: input.dataSnapshotId,
  });

  const dcfResult = calculateDcfValuation({
    financials: input.financials,
    companyId,
    asOfDate: input.asOfDate,
    ruleSetVersion,
    dataSnapshotId: input.dataSnapshotId,
    terminalDependenceThreshold: config?.terminalDependenceThreshold ?? 0.75,
  });

  const methods: ValuationMethodResult[] = [peResult, pegResult, pbResult, dcfResult];

  // Route Primary Method
  const primaryMethod = selectPrimaryValuationMethod({
    sector: input.sector,
    businessModel: input.businessModel,
    methods,
    override: input.primaryMethodOverride,
  });

  const primaryResult = methods.find((m) => m.method === primaryMethod) ?? peResult;
  const selectedFairValue = primaryResult.fairValue;

  // Compute Valuation Range from suitable methods
  const suitableFvs = methods
    .filter((m) => m.applicability === 'suitable' && m.fairValue > 0)
    .map((m) => m.fairValue);

  const fallbackFvs = methods.filter((m) => m.fairValue > 0).map((m) => m.fairValue);
  const rangeValues = suitableFvs.length > 0 ? suitableFvs : fallbackFvs.length > 0 ? fallbackFvs : [selectedFairValue];

  const valuationRange = {
    low: Math.min(...rangeValues),
    high: Math.max(...rangeValues),
  };

  // Margin of Safety Calculations
  let maxBuyPrice = 0;
  let marginOfSafetyPct = 0;

  if (selectedFairValue > 0) {
    const maxBuyPriceDec = new Decimal(selectedFairValue).mul(new Decimal(1).minus(marginOfSafetyRatio));
    maxBuyPrice = roundDecimal(maxBuyPriceDec, 2).toNumber();

    const mosPctDec = new Decimal(selectedFairValue)
      .minus(input.marketPrice)
      .div(selectedFairValue)
      .mul(100);
    marginOfSafetyPct = roundDecimal(mosPctDec, 2).toNumber();
  }

  // Overall Confidence Assessment
  let overallConfidence: Confidence = primaryResult.confidence;
  if (primaryResult.applicability === 'limited') {
    overallConfidence = 'low';
  } else if (valuationRange.high > 2.2 * valuationRange.low && suitableFvs.length >= 2) {
    // Cross-checks strongly diverge
    if (overallConfidence === 'high') overallConfidence = 'medium';
  }

  // Aggregate Flags
  const allFlags = methods.flatMap((m) => m.flags);
  const valuationWarnings = allFlags.filter((f) => f.class === 'VALUATION_WARNING');
  const dataQualityWarnings = allFlags.filter((f) => f.class === 'DATA_QUALITY_WARNING');
  const conditionalWarnings = allFlags.filter((f) => f.class === 'CONDITIONAL_WARNING');
  const hardStops = allFlags.filter((f) => f.class === 'HARD_STOP');

  // Insufficient MOS warning
  const requiredMosPct = marginOfSafetyRatio * 100;
  if (selectedFairValue > 0 && marginOfSafetyPct < requiredMosPct) {
    const mosFlag = createRedFlag({
      flagKey: 'STAGE_D_MOS_INSUFFICIENT',
      ruleKey: 'marginOfSafetyGate',
      message: `Current market price ₹${input.marketPrice.toFixed(2)} provides only ${marginOfSafetyPct.toFixed(1)}% margin of safety (minimum ${requiredMosPct.toFixed(0)}% required; Max Buy Price ₹${maxBuyPrice.toFixed(2)}).`,
      threshold: `>= ${requiredMosPct.toFixed(0)}%`,
      actualValue: marginOfSafetyPct,
      expectedValue: `>= ${requiredMosPct.toFixed(0)}%`,
      severity: 'medium',
      class: 'VALUATION_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    valuationWarnings.push(mosFlag);
    allFlags.push(mosFlag);
  }

  // Stage D Gate:
  // marketPrice <= maxBuyPrice AND confidence !== 'low' AND zero hardStops AND selectedFairValue > 0
  const pricePasses = selectedFairValue > 0 && input.marketPrice <= maxBuyPrice;
  const confidencePasses = overallConfidence !== 'low';
  const noHardStops = hardStops.length === 0;

  const buyReady = pricePasses && confidencePasses && noHardStops;
  const gatePassed = buyReady;
  const canProceedToStageE = gatePassed;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (selectedFairValue <= 0 || primaryResult.applicability === 'unsuitable') {
    verdict = 'FAIL';
  } else if (!gatePassed) {
    verdict = 'FAIL';
  } else if (valuationWarnings.length > 0 || dataQualityWarnings.length > 0 || conditionalWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const message = gatePassed
    ? `Stage D valuation PASSED with Primary Method ${primaryMethod}. Fair Value: ₹${selectedFairValue.toFixed(2)}, ` +
      `Max Buy Price: ₹${maxBuyPrice.toFixed(2)}, MOS: ${marginOfSafetyPct.toFixed(1)}%. Eligible for Stage E entry planning.`
    : selectedFairValue <= 0
    ? `Stage D valuation FAILED: Primary method ${primaryMethod} produced no valid fair value.`
    : !confidencePasses
    ? `Stage D valuation BLOCKED by LOW confidence rating despite ${(marginOfSafetyPct).toFixed(1)}% nominal MOS.`
    : `Stage D valuation FAILED 20% margin of safety requirement (Market Price ₹${input.marketPrice.toFixed(2)} > Max Buy Price ₹${maxBuyPrice.toFixed(2)}; MOS: ${marginOfSafetyPct.toFixed(1)}%).`;

  // Standard rule results representation
  const ruleResults: ScoringRuleResult[] = methods.map((m) => ({
    ruleKey: `valuation_${m.method}`,
    points: m.applicability === 'suitable' ? 1.0 : m.applicability === 'limited' ? 0.5 : 0.0,
    maxPoints: 1.0,
    inputs: m.assumptions,
    explanation: m.explanation,
    redFlags: m.flags,
    dataQuality: defaultProv,
    ruleSetVersion,
  }));

  return {
    stage: 'D',
    companyId: input.companyId,
    asOfDate: input.asOfDate,
    executedAt: new Date().toISOString(),
    ruleSetVersion,
    message,
    totalPoints: buyReady ? 1.0 : 0.0,
    maxPoints: 1.0,
    methods,
    primaryMethod,
    selectedFairValue,
    valuationRange,
    maxBuyPrice,
    marginOfSafetyPct,
    buyReady,
    gatePassed,
    canProceedToStageE,
    overallConfidence,
    valuationWarnings,
    flags: allFlags,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    ruleResults,
    verdict,
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
  };
}

/**
 * Interface alias for ScoringEngine.valueStageD compatibility.
 */
export const valueStageD = scoreStageD;
export const evaluateStageD = scoreStageD;
