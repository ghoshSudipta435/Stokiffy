/**
 * Stage B (Deep Trend Analysis) Deterministic Scoring Engine
 *
 * Implements the 10-block (10.0 max points) deep trend analysis engine
 * covering quarterly YoY growth, 5Y annual trends, cash flow forensics,
 * working capital efficiency, capital productivity, and institutional shareholding.
 *
 * Pure TypeScript implementation using Decimal.js for exact arithmetic.
 * Zero external framework dependencies.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  StageBInput,
  StageBOutput,
  StageBRuleResult,
  StageBVerdictBand,
} from '../types/stage-b.js';
import type { RedFlag, DataProvenance } from '../types/base.js';
import {
  classifyQuarterlySalesYoY,
  classifyQuarterlyOpmYoY,
  classifyAnnual5YSeries,
  classifyNetProfitAndMargin,
  classifyReservesVsBorrowings,
  classifyCfoTrend,
  classifyDebtorDays,
  classifyRoceTrend,
  classifyShareholdingPattern,
} from './trend-classifier.js';

export interface StageBConfig {
  ruleSetVersion?: string | undefined;
  minPassScore?: number | undefined;
  publicHoldingThreshold?: number | undefined;
  enablePublicHoldingHardStop?: boolean | undefined;
  shareholdingChangeThreshold?: number | undefined;
}

const DEFAULT_RULE_SET_VERSION = 'stage-b-v1.0';
const DEFAULT_MIN_PASS_SCORE = 6.5;

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
    stage: 'B',
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
 * Evaluates Stage B deep trend analysis for a single company.
 * Deterministic pure function: StageBInput -> StageBOutput.
 */
export function scoreStageB(input: StageBInput, config?: StageBConfig): StageBOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const minPassScore = config?.minPassScore ?? DEFAULT_MIN_PASS_SCORE;
  const companyId = input.companyId;
  const maxPossibleScore = 10.0;

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'engine-derived',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'TREND_ANALYSIS',
    currency: 'INR',
    unit: 'CRORE',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  const ruleResults: StageBRuleResult[] = [];
  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];
  const dataQualityWarnings: RedFlag[] = [];
  const forensicFlags: string[] = [];

  // ==========================================================================
  // Rule 1: Quarterly Sales YoY (1.0 pt)
  // ==========================================================================
  const qSalesRes = classifyQuarterlySalesYoY(input.quarterly ?? []);
  {
    const ruleFlags: RedFlag[] = [];
    if (qSalesRes.isHardStop && qSalesRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: qSalesRes.hardStopFlag,
        ruleKey: 'quarterlySalesYoY',
        message: qSalesRes.explanation,
        threshold: 'positive YoY in all or majority quarters',
        actualValue: qSalesRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (qSalesRes.isConditional && qSalesRes.conditionalFlag) {
      const flag = createRedFlag({
        flagKey: qSalesRes.conditionalFlag,
        ruleKey: 'quarterlySalesYoY',
        message: qSalesRes.explanation,
        threshold: 'consistently rising quarters',
        actualValue: qSalesRes.supportingData,
        severity: 'medium',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      conditionalWarnings.push(flag);
    }
    if (qSalesRes.isDataQualityWarning && qSalesRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: qSalesRes.dataQualityFlag,
        ruleKey: 'quarterlySalesYoY',
        message: 'Fewer than 8 quarters available for quarterly sales YoY analysis',
        threshold: 'quarterlyCount >= 8',
        actualValue: qSalesRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'quarterlySalesYoY',
      points: qSalesRes.points,
      maxPoints: qSalesRes.maxPoints,
      inputs: { quarterlyCount: input.quarterly?.length ?? 0 },
      explanation: qSalesRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: qSalesRes.trend,
      supportingData: qSalesRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 2: Quarterly OPM YoY (1.0 pt)
  // ==========================================================================
  const qOpmRes = classifyQuarterlyOpmYoY(input.quarterly ?? []);
  {
    const ruleFlags: RedFlag[] = [];
    if (qOpmRes.isHardStop && qOpmRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: qOpmRes.hardStopFlag,
        ruleKey: 'quarterlyOpmYoY',
        message: qOpmRes.explanation,
        threshold: 'non-falling quarterly OPM',
        actualValue: qOpmRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (qOpmRes.isConditional && qOpmRes.conditionalFlag) {
      const flag = createRedFlag({
        flagKey: qOpmRes.conditionalFlag,
        ruleKey: 'quarterlyOpmYoY',
        message: qOpmRes.explanation,
        threshold: 'constant or expanding OPM',
        actualValue: qOpmRes.supportingData,
        severity: 'medium',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      conditionalWarnings.push(flag);
    }
    if (qOpmRes.isDataQualityWarning && qOpmRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: qOpmRes.dataQualityFlag,
        ruleKey: 'quarterlyOpmYoY',
        message: 'Fewer than 8 quarters available for quarterly OPM YoY analysis',
        threshold: 'quarterlyCount >= 8',
        actualValue: qOpmRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'quarterlyOpmYoY',
      points: qOpmRes.points,
      maxPoints: qOpmRes.maxPoints,
      inputs: { quarterlyCount: input.quarterly?.length ?? 0 },
      explanation: qOpmRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: qOpmRes.trend,
      supportingData: qOpmRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 3: Annual P&L — Sales, 5Y (1.0 pt)
  // ==========================================================================
  const salesSeries = (input.annual ?? []).map(a => a.sales);
  const sales5yRes = classifyAnnual5YSeries(
    salesSeries,
    'Sales',
    'STAGE_B_5Y_SALES_DECLINING'
  );
  {
    const ruleFlags: RedFlag[] = [];
    if (sales5yRes.isHardStop && sales5yRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: sales5yRes.hardStopFlag,
        ruleKey: 'sales5y',
        message: sales5yRes.explanation,
        threshold: 'latest sales >= 5Y ago sales',
        actualValue: sales5yRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (sales5yRes.isDataQualityWarning && sales5yRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: sales5yRes.dataQualityFlag,
        ruleKey: 'sales5y',
        message: 'Fewer than 5 years of annual sales data available',
        threshold: 'annualCount >= 5',
        actualValue: sales5yRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'sales5y',
      points: sales5yRes.points,
      maxPoints: sales5yRes.maxPoints,
      inputs: { seriesLength: salesSeries.length },
      explanation: sales5yRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: sales5yRes.trend,
      supportingData: sales5yRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 4: Annual P&L — OPM, 5Y (1.0 pt)
  // ==========================================================================
  const opmSeries = (input.annual ?? []).map(a => a.opm);
  const opm5yRes = classifyAnnual5YSeries(
    opmSeries,
    'OPM',
    'STAGE_B_5Y_OPM_DECLINING'
  );
  {
    const ruleFlags: RedFlag[] = [];
    if (opm5yRes.isHardStop && opm5yRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: opm5yRes.hardStopFlag,
        ruleKey: 'opm5y',
        message: opm5yRes.explanation,
        threshold: 'latest OPM >= 5Y ago OPM',
        actualValue: opm5yRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (opm5yRes.isDataQualityWarning && opm5yRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: opm5yRes.dataQualityFlag,
        ruleKey: 'opm5y',
        message: 'Fewer than 5 years of annual OPM data available',
        threshold: 'annualCount >= 5',
        actualValue: opm5yRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'opm5y',
      points: opm5yRes.points,
      maxPoints: opm5yRes.maxPoints,
      inputs: { seriesLength: opmSeries.length },
      explanation: opm5yRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: opm5yRes.trend,
      supportingData: opm5yRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 5: Annual P&L — Net Profit & Margin (1.0 pt)
  // ==========================================================================
  const profitSeries = (input.annual ?? []).map(a => a.netProfit ?? a.pat);
  const marginSeries = (input.annual ?? []).map(a => {
    if (a.netMargin !== undefined && a.netMargin !== null) return a.netMargin;
    if (a.sales && a.netProfit) {
      return Number(((a.netProfit / a.sales) * 100).toFixed(2));
    }
    return null;
  });
  const netProfitRes = classifyNetProfitAndMargin(profitSeries, marginSeries);
  {
    const ruleFlags: RedFlag[] = [];
    if (netProfitRes.isHardStop && netProfitRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: netProfitRes.hardStopFlag,
        ruleKey: 'netProfitMargin',
        message: netProfitRes.explanation,
        threshold: 'profit rising and margin not falling',
        actualValue: netProfitRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (netProfitRes.isDataQualityWarning && netProfitRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: netProfitRes.dataQualityFlag,
        ruleKey: 'netProfitMargin',
        message: 'Insufficient 5Y data for Net Profit and Margin trend',
        threshold: 'annualCount >= 5',
        actualValue: netProfitRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'netProfitMargin',
      points: netProfitRes.points,
      maxPoints: netProfitRes.maxPoints,
      inputs: { seriesLength: profitSeries.length },
      explanation: netProfitRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: netProfitRes.trend,
      supportingData: netProfitRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 6: Balance Sheet — Reserves vs Borrowings (1.0 pt)
  // ==========================================================================
  const reservesSeries = (input.annual ?? []).map(a => a.reserves ?? null);
  const borrowingsSeries = (input.annual ?? []).map(a => a.borrowings ?? null);
  const reservesBorrowingsRes = classifyReservesVsBorrowings(reservesSeries, borrowingsSeries);
  {
    const ruleFlags: RedFlag[] = [];
    if (reservesBorrowingsRes.isHardStop && reservesBorrowingsRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: reservesBorrowingsRes.hardStopFlag,
        ruleKey: 'reservesBorrowings',
        message: reservesBorrowingsRes.explanation,
        threshold: 'reserves up or flat, borrowings not outpacing reserves',
        actualValue: reservesBorrowingsRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (reservesBorrowingsRes.isDataQualityWarning && reservesBorrowingsRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: reservesBorrowingsRes.dataQualityFlag,
        ruleKey: 'reservesBorrowings',
        message: 'Reserves or Borrowings 5Y data incomplete',
        threshold: 'annualCount >= 5',
        actualValue: reservesBorrowingsRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'reservesBorrowings',
      points: reservesBorrowingsRes.points,
      maxPoints: reservesBorrowingsRes.maxPoints,
      inputs: { seriesLength: reservesSeries.length },
      explanation: reservesBorrowingsRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: reservesBorrowingsRes.trend,
      supportingData: reservesBorrowingsRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 7: Cash Flow — CFO Trend & Forensic Check (1.0 pt)
  // ==========================================================================
  const cfoSeries = (input.annual ?? []).map(a => a.cfo ?? null);
  const patSeries = (input.annual ?? []).map(a => a.pat ?? a.netProfit ?? null);
  const cfoRes = classifyCfoTrend(cfoSeries, salesSeries, patSeries);
  {
    const ruleFlags: RedFlag[] = [];
    if (cfoRes.isHardStop && cfoRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: cfoRes.hardStopFlag,
        ruleKey: 'cfoTrend',
        message: cfoRes.explanation,
        threshold: 'CFO rising and CFO margin not falling',
        actualValue: cfoRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (cfoRes.isForensicWarning && cfoRes.forensicFlag) {
      const flag = createRedFlag({
        flagKey: cfoRes.forensicFlag,
        ruleKey: 'cfoTrend',
        message: `Cumulative 5Y CFO (${cfoRes.cumulativeCfo}) diverges significantly from PAT (${cfoRes.cumulativePat}) (ratio: ${cfoRes.cfoPatRatio?.toFixed(2)}). Potential aggressive revenue recognition or working capital leakage.`,
        threshold: 'CFO / PAT >= 0.70',
        actualValue: cfoRes.cfoPatRatio,
        severity: 'high',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      conditionalWarnings.push(flag);
      forensicFlags.push(cfoRes.forensicFlag);
    }
    if (cfoRes.isDataQualityWarning && cfoRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: cfoRes.dataQualityFlag,
        ruleKey: 'cfoTrend',
        message: 'CFO 5Y data incomplete',
        threshold: 'annualCount >= 5',
        actualValue: cfoRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'cfoTrend',
      points: cfoRes.points,
      maxPoints: cfoRes.maxPoints,
      inputs: {
        seriesLength: cfoSeries.length,
        cumulativeCfo: cfoRes.cumulativeCfo,
        cumulativePat: cfoRes.cumulativePat,
      },
      explanation: cfoRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: cfoRes.trend,
      supportingData: cfoRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 8: Ratios — Debtor Days (1.0 pt)
  // ==========================================================================
  const debtorDaysSeries = (input.annual ?? []).map(a => a.debtorDays ?? null);
  const debtorDaysRes = classifyDebtorDays(debtorDaysSeries);
  {
    const ruleFlags: RedFlag[] = [];
    if (debtorDaysRes.isHardStop && debtorDaysRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: debtorDaysRes.hardStopFlag,
        ruleKey: 'debtorDays',
        message: debtorDaysRes.explanation,
        threshold: 'debtor days <= 120 and 5Y rise <= 50%',
        actualValue: debtorDaysRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (debtorDaysRes.isConditional && debtorDaysRes.conditionalFlag) {
      const flag = createRedFlag({
        flagKey: debtorDaysRes.conditionalFlag,
        ruleKey: 'debtorDays',
        message: debtorDaysRes.explanation,
        threshold: 'non-rising debtor days',
        actualValue: debtorDaysRes.supportingData,
        severity: 'medium',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      conditionalWarnings.push(flag);
    }
    if (debtorDaysRes.isDataQualityWarning && debtorDaysRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: debtorDaysRes.dataQualityFlag,
        ruleKey: 'debtorDays',
        message: 'Debtor Days data incomplete',
        threshold: 'annualCount >= 5',
        actualValue: debtorDaysRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'debtorDays',
      points: debtorDaysRes.points,
      maxPoints: debtorDaysRes.maxPoints,
      inputs: { seriesLength: debtorDaysSeries.length },
      explanation: debtorDaysRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: debtorDaysRes.trend,
      supportingData: debtorDaysRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 9: Ratios — ROCE Trend (1.0 pt)
  // ==========================================================================
  const roceSeries = (input.annual ?? []).map(a => a.roce ?? null);
  const roceRes = classifyRoceTrend(roceSeries);
  {
    const ruleFlags: RedFlag[] = [];
    if (roceRes.isHardStop && roceRes.hardStopFlag) {
      const flag = createRedFlag({
        flagKey: roceRes.hardStopFlag,
        ruleKey: 'roceTrend',
        message: roceRes.explanation,
        threshold: 'non-falling ROCE',
        actualValue: roceRes.supportingData,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }
    if (roceRes.isDataQualityWarning && roceRes.dataQualityFlag) {
      const flag = createRedFlag({
        flagKey: roceRes.dataQualityFlag,
        ruleKey: 'roceTrend',
        message: 'ROCE 5Y data incomplete',
        threshold: 'annualCount >= 5',
        actualValue: roceRes.supportingData.periodCount,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'roceTrend',
      points: roceRes.points,
      maxPoints: roceRes.maxPoints,
      inputs: { seriesLength: roceSeries.length },
      explanation: roceRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: roceRes.trend,
      supportingData: roceRes.supportingData,
    });
  }

  // ==========================================================================
  // Rule 10: Shareholding Pattern (1.0 pt)
  // ==========================================================================
  const shareholdingRes = classifyShareholdingPattern(input.shareholding ?? [], {
    publicHoldingThreshold: config?.publicHoldingThreshold,
    enablePublicHoldingHardStop: config?.enablePublicHoldingHardStop,
    changeThreshold: config?.shareholdingChangeThreshold,
  });
  {
    const ruleFlags: RedFlag[] = [];
    for (const hf of shareholdingRes.hardFlags) {
      const flag = createRedFlag({
        flagKey: hf,
        ruleKey: 'shareholdingPattern',
        message: shareholdingRes.explanation,
        threshold: hf === 'STAGE_B_PUBLIC_HOLDING_GE_50' ? 'public holding < 50%' : 'institutions not exiting while public increases',
        actualValue: shareholdingRes.pattern,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      hardStops.push(flag);
    }

    for (const cf of shareholdingRes.conditionalFlags) {
      const flag = createRedFlag({
        flagKey: cf,
        ruleKey: 'shareholdingPattern',
        message: shareholdingRes.explanation,
        threshold: 'institutional accumulation and low promoter pledge',
        actualValue: shareholdingRes.pattern,
        severity: 'high',
        class: 'CONDITIONAL_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      conditionalWarnings.push(flag);
    }

    for (const dq of shareholdingRes.dataQualityFlags) {
      const flag = createRedFlag({
        flagKey: dq,
        ruleKey: 'shareholdingPattern',
        message: 'Shareholding quarterly data has fewer than 8 quarters or is incomplete',
        threshold: 'quarterCount >= 8',
        actualValue: input.shareholding?.length ?? 0,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      ruleFlags.push(flag);
      dataQualityWarnings.push(flag);
    }

    ruleResults.push({
      ruleKey: 'shareholdingPattern',
      points: shareholdingRes.points,
      maxPoints: shareholdingRes.maxPoints,
      inputs: {
        quartersCount: input.shareholding?.length ?? 0,
        pattern: shareholdingRes.pattern,
      },
      explanation: shareholdingRes.explanation,
      redFlags: ruleFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      trendClassification: shareholdingRes.pattern.public === 'down' ? 'consistently_rising' : 'declining',
      supportingData: {
        periodCount: input.shareholding?.length ?? 0,
        positivePeriods: shareholdingRes.pattern.promoter === 'up' ? 1 : 0,
        negativePeriods: shareholdingRes.pattern.promoter === 'down' ? 1 : 0,
        flatPeriods: shareholdingRes.pattern.promoter === 'flat' ? 1 : 0,
      },
    });
  }

  // ==========================================================================
  // Aggregate Scores, Verdicts & Hard Gate
  // ==========================================================================
  let totalScoreDec = new Decimal(0);
  for (const r of ruleResults) {
    totalScoreDec = totalScoreDec.plus(r.points);
  }
  const totalPoints = roundDecimal(totalScoreDec, 2).toNumber();

  let verdictBand: StageBVerdictBand = 'AVOID';
  if (totalPoints >= 8.5) {
    verdictBand = 'EXCEPTIONAL';
  } else if (totalPoints >= 7.5) {
    verdictBand = 'EXCELLENT';
  } else if (totalPoints >= 6.5) {
    verdictBand = 'GOOD';
  } else {
    verdictBand = 'AVOID';
  }

  // Stage B Gate: Zero Hard Stops AND score >= minPassScore (default 6.5)
  const hasHardStops = hardStops.length > 0;
  const scorePasses = totalPoints >= minPassScore;
  const gatePassed = !hasHardStops && scorePasses;
  const canProceedToStageC = gatePassed;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (hasHardStops || !scorePasses) {
    verdict = 'FAIL';
  } else if (conditionalWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const message = gatePassed
    ? `Stage B trend analysis PASSED with ${totalPoints.toFixed(2)}/${maxPossibleScore} (${verdictBand}). Eligible for Stage C.`
    : hasHardStops
    ? `Stage B trend analysis BLOCKED by ${hardStops.length} HARD STOP red flag(s). Score: ${totalPoints.toFixed(2)}/${maxPossibleScore}.`
    : `Stage B screening FAILED score threshold (${totalPoints.toFixed(2)}/${maxPossibleScore} < ${minPassScore}). Band: ${verdictBand}.`;

  return {
    stage: 'B',
    companyId: input.companyId,
    asOfDate: input.asOfDate,
    executedAt: new Date().toISOString(),
    ruleSetVersion,
    message,
    totalPoints,
    maxPoints: maxPossibleScore,
    maxPossibleScore,
    minPassScore,
    verdictBand,
    gatePassed,
    canProceedToStageC,
    ruleResults,
    verdict,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings: [],
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
    quarterlyAnalysis: {
      salesTrend: qSalesRes.trend,
      opmTrend: qOpmRes.trend,
    },
    annualAnalysis: {
      sales5yTrend: sales5yRes.trend,
      opm5yTrend: opm5yRes.trend,
      netProfitTrend: netProfitRes.trend,
      reservesBorrowingsTrend: reservesBorrowingsRes.trend,
      cfoTrend: cfoRes.trend,
      debtorDaysTrend: debtorDaysRes.trend,
      roceTrend: roceRes.trend,
    },
    shareholdingAnalysis: {
      latestPattern: shareholdingRes.pattern,
      score: shareholdingRes.points,
      hardFlags: shareholdingRes.hardFlags,
    },
    forensicFlags,
  };
}
