/**
 * Maps CSV rows to domain DTOs (FinancialStatement, ShareholdingPoint, CorporateAction).
 * Handles unit conversions (CRORE, LAKH, MILLION, RAW) and date parsing.
 */

import type {
  FinancialStatement,
  ShareholdingPoint,
  CorporateAction,
  DataProvenance,
} from '@stock-assistant/contracts';
import type {
  StageAFinancials,
  StageADataAvailability,
  StageAInput,
  FinancialMetric,
} from '@stock-assistant/core';

/**
 * Parses a number from a string, returning null if invalid.
 */
function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Creates a default data provenance record.
 * Sets isMissing to true when the value is absent from the source.
 */
function createProvenance(
  source: string,
  reportedPeriod: string,
  unit: string = 'CRORE',
  isMissing: boolean = false
): DataProvenance {
  return {
    source,
    fetchedAt: new Date().toISOString(),
    reportedPeriod,
    currency: 'INR',
    unit: unit as any,
    adjustmentStatus: 'reported',
    quality: isMissing ? 'missing' : 'verified',
    isMissing,
  };
}

/**
 * Maps a validated CSV row to a FinancialStatement DTO.
 * Missing values are preserved as null (never coerced to zero).
 */
export function mapToFinancialStatement(
  row: Record<string, string | undefined>,
  source: string,
  reportedPeriod: string
): { statement: FinancialStatement | null; errors: string[] } {
  const errors: string[] = [];

  const symbol = row['symbol'];
  if (!symbol) {
    errors.push('Missing symbol');
    return { statement: null, errors };
  }

  const revenue = parseNumber(row['revenue']);
  const netProfit = parseNumber(row['netProfit']);
  const operatingProfit = parseNumber(row['operatingProfit']);
  const totalAssets = parseNumber(row['totalAssets']);
  const totalLiabilities = parseNumber(row['totalLiabilities']);
  const totalEquity = parseNumber(row['totalEquity']);
  const totalDebt = parseNumber(row['totalDebt']);
  const currentAssets = parseNumber(row['currentAssets']);
  const currentLiabilities = parseNumber(row['currentLiabilities']);
  const interestExpense = parseNumber(row['interestExpense']);
  const ebit = parseNumber(row['ebit']);
  const eps = parseNumber(row['eps']);
  const depreciationAmortization = parseNumber(row['depreciationAmortization']);
  const capitalExpenditure = parseNumber(row['capitalExpenditure']);
  const changeInWorkingCapital = parseNumber(row['changeInWorkingCapital']);
  const fcf = parseNumber(row['fcf']);

  if (revenue === null && netProfit === null) {
    errors.push('Both revenue and net profit are missing');
    return { statement: null, errors };
  }

  const statement: FinancialStatement = {
    id: '',
    companyId: symbol,
    periodType: 'Annual',
    fiscalYear: reportedPeriod,
    revenue: {
      value: revenue,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', revenue === null),
    },
    netProfit: {
      value: netProfit,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', netProfit === null),
    },
    operatingProfit: {
      value: operatingProfit,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', operatingProfit === null),
    },
    totalAssets: {
      value: totalAssets,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', totalAssets === null),
    },
    totalLiabilities: {
      value: totalLiabilities,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', totalLiabilities === null),
    },
    totalEquity: {
      value: totalEquity,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', totalEquity === null),
    },
    totalDebt: {
      value: totalDebt,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', totalDebt === null),
    },
    currentAssets: {
      value: currentAssets,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', currentAssets === null),
    },
    currentLiabilities: {
      value: currentLiabilities,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', currentLiabilities === null),
    },
    interestExpense: {
      value: interestExpense,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', interestExpense === null),
    },
    ebit: {
      value: ebit,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', ebit === null),
    },
    eps: {
      value: eps,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', eps === null),
    },
    depreciationAmortization: {
      value: depreciationAmortization,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', depreciationAmortization === null),
    },
    capitalExpenditure: {
      value: capitalExpenditure,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', capitalExpenditure === null),
    },
    changeInWorkingCapital: {
      value: changeInWorkingCapital,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', changeInWorkingCapital === null),
    },
    fcf: {
      value: fcf,
      provenance: createProvenance(source, reportedPeriod, 'CRORE', fcf === null),
    },
    createdAt: new Date().toISOString(),
  };

  return { statement, errors };
}

/**
 * Maps a validated CSV row to a ShareholdingPoint DTO.
 */
export function mapToShareholdingPoint(
  row: Record<string, string | undefined>,
  _source: string,
  reportedPeriod: string
): { shareholding: ShareholdingPoint | null; errors: string[] } {
  const errors: string[] = [];

  const symbol = row['symbol'];
  if (!symbol) {
    errors.push('Missing symbol');
    return { shareholding: null, errors };
  }

  const promoterPct = parseNumber(row['promoterPct']);
  const fiiPct = parseNumber(row['fiiPct']);
  const diiPct = parseNumber(row['diiPct']);
  const publicPct = parseNumber(row['publicPct']);
  const promoterPledgePct = parseNumber(row['promoterPledgePct']);

  if (
    promoterPct === null ||
    fiiPct === null ||
    diiPct === null ||
    publicPct === null
  ) {
    errors.push('Missing required shareholding percentages');
    return { shareholding: null, errors };
  }

  const shareholding: ShareholdingPoint = {
    id: '',
    companyId: symbol,
    period: reportedPeriod,
    promoterPct,
    fiiPct,
    diiPct,
    publicPct,
    promoterPledgePct: promoterPledgePct ?? undefined,
    dataQuality: 'verified',
    createdAt: new Date().toISOString(),
  };

  return { shareholding, errors: [] };
}

/**
 * Maps a validated CSV row to a CorporateAction DTO.
 */
export function mapToCorporateAction(
  row: Record<string, string | undefined>,
  _source: string
): { action: CorporateAction | null; errors: string[] } {
  const errors: string[] = [];

  const symbol = row['symbol'];
  if (!symbol) {
    errors.push('Missing symbol');
    return { action: null, errors };
  }

  const type = row['type'];
  if (!type || !['dividend', 'split', 'bonus', 'rights', 'buyback'].includes(type)) {
    errors.push('Missing or invalid corporate action type');
    return { action: null, errors };
  }

  const date = row['date'];
  if (!date) {
    errors.push('Missing date');
    return { action: null, errors };
  }

  const action: CorporateAction = {
    id: '',
    companyId: symbol,
    type: type as any,
    date,
    ratio: row['ratio'],
    amount: parseNumber(row['amount']) ?? undefined,
    createdAt: new Date().toISOString(),
  };

  return { action, errors: [] };
}

/**
 * Creates a FinancialMetric with nullable value and provenance.
 * Missing values are preserved as null (never coerced to zero).
 */
function createFinancialMetric(
  value: number | null,
  source: string,
  reportedPeriod: string,
  unit: string = 'CRORE'
): FinancialMetric {
  return {
    value,
    provenance: {
      source,
      fetchedAt: new Date().toISOString(),
      reportedPeriod,
      currency: 'INR',
      unit: unit as any,
      adjustmentStatus: 'reported',
      quality: value === null ? 'missing' : 'verified',
      isMissing: value === null,
    },
  };
}

/**
 * Computes data availability report for Stage A financials.
 */
function computeDataAvailability(financials: StageAFinancials): StageADataAvailability {
  const fields: Array<{ path: string; metric: FinancialMetric }> = [];
  
  function collectMetrics(obj: any, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && 'value' in value && 'provenance' in value) {
        fields.push({ path, metric: value as FinancialMetric });
      } else if (value && typeof value === 'object') {
        collectMetrics(value, path);
      }
    }
  }
  
  collectMetrics(financials);
  
  const totalMetrics = fields.length;
  const presentMetrics = fields.filter(f => f.metric.value !== null).length;
  const missingMetrics = totalMetrics - presentMetrics;
  const incompleteMetrics = fields.filter(f => f.metric.value === null).map(f => f.path);
  const qualityWarnings = fields
    .filter(f => f.metric.provenance.quality !== 'verified')
    .map(f => `${f.path}: ${f.metric.provenance.quality}`);
  
  return {
    totalMetrics,
    presentMetrics,
    missingMetrics,
    incompleteMetrics,
    qualityWarnings,
    coverageRatio: totalMetrics > 0 ? presentMetrics / totalMetrics : 0,
  };
}

/**
 * Maps a validated CSV row to a canonical Stage A input structure.
 * Preserves missing values as null with provenance.
 * Returns data availability report alongside the mapped financials.
 */
export function mapToStageAInput(
  row: Record<string, string | undefined>,
  source: string,
  reportedPeriod: string,
  sector: 'non-financial' | 'bank' | 'nbfc' | 'insurance' | 'other-financial' = 'non-financial'
): { input: StageAInput | null; errors: string[] } {
  const errors: string[] = [];

  const symbol = row['symbol'];
  if (!symbol) {
    errors.push('Missing symbol');
    return { input: null, errors };
  }

  // Parse all financial metrics from CSV row
  const revenue = parseNumber(row['revenue']);
  const netProfit = parseNumber(row['netProfit']);
  const operatingProfit = parseNumber(row['operatingProfit']);
  const totalAssets = parseNumber(row['totalAssets']);
  const totalLiabilities = parseNumber(row['totalLiabilities']);
  const totalEquity = parseNumber(row['totalEquity']);
  const totalDebt = parseNumber(row['totalDebt']);
  const currentAssets = parseNumber(row['currentAssets']);
  const currentLiabilities = parseNumber(row['currentLiabilities']);
  const interestExpense = parseNumber(row['interestExpense']);
  const ebit = parseNumber(row['ebit']);
  const eps = parseNumber(row['eps']);
  const peRatio = parseNumber(row['peRatio']);
  const industryPeRatio = parseNumber(row['industryPeRatio']);
  
  // Profitability ratios
  const roaLatestFy = parseNumber(row['roaLatestFy']);
  const roaAvg5y = parseNumber(row['roaAvg5y']);
  const industryRoaMin = parseNumber(row['industryRoaMin']);
  const roeLatestFy = parseNumber(row['roeLatestFy']);
  const roeAvg5y = parseNumber(row['roeAvg5y']);
  const roceLatestFy = parseNumber(row['roceLatestFy']);
  const roceAvg5y = parseNumber(row['roceAvg5y']);
  
  // Margin
  const opmLatestFy = parseNumber(row['opmLatestFy']);
  const opmAvg5y = parseNumber(row['opmAvg5y']);
  const industryOpmMin = parseNumber(row['industryOpmMin']);

  const financials: StageAFinancials = {
    revenue: createFinancialMetric(revenue, source, reportedPeriod),
    netProfit: createFinancialMetric(netProfit, source, reportedPeriod),
    operatingProfit: createFinancialMetric(operatingProfit, source, reportedPeriod),
    totalAssets: createFinancialMetric(totalAssets, source, reportedPeriod),
    totalLiabilities: createFinancialMetric(totalLiabilities, source, reportedPeriod),
    totalEquity: createFinancialMetric(totalEquity, source, reportedPeriod),
    totalDebt: createFinancialMetric(totalDebt, source, reportedPeriod),
    currentAssets: createFinancialMetric(currentAssets, source, reportedPeriod),
    currentLiabilities: createFinancialMetric(currentLiabilities, source, reportedPeriod),
    interestExpense: createFinancialMetric(interestExpense, source, reportedPeriod),
    ebit: createFinancialMetric(ebit, source, reportedPeriod),
    eps: createFinancialMetric(eps, source, reportedPeriod),
    peRatio: createFinancialMetric(peRatio, source, reportedPeriod),
    industryPeRatio: createFinancialMetric(industryPeRatio, source, reportedPeriod),
    roa: {
      latestFy: createFinancialMetric(roaLatestFy, source, reportedPeriod),
      avg5y: createFinancialMetric(roaAvg5y, source, reportedPeriod),
    },
    industryRoaMin: createFinancialMetric(industryRoaMin, source, reportedPeriod),
    roe: {
      latestFy: createFinancialMetric(roeLatestFy, source, reportedPeriod),
      avg5y: createFinancialMetric(roeAvg5y, source, reportedPeriod),
    },
    roce: {
      latestFy: createFinancialMetric(roceLatestFy, source, reportedPeriod),
      avg5y: createFinancialMetric(roceAvg5y, source, reportedPeriod),
    },
    opm: {
      latestFy: createFinancialMetric(opmLatestFy, source, reportedPeriod),
      avg5y: createFinancialMetric(opmAvg5y, source, reportedPeriod),
    },
    industryOpmMin: createFinancialMetric(industryOpmMin, source, reportedPeriod),
  };

  const dataAvailability = computeDataAvailability(financials);

  const input: StageAInput = {
    companyId: symbol,
    asOfDate: new Date().toISOString(),
    financials,
    sector,
    dataAvailability,
  };

  return { input, errors: [] };
}
