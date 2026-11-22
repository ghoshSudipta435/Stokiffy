/**
 * Golden Fixture Full-Lifecycle Regression Tests
 *
 * Verifies the deterministic, sequential execution of the complete
 * Stage A -> B -> C -> D -> E -> F -> G pipeline across 3 realistic Indian-equity fixtures:
 *
 * 1. Fixture 1 — Quality IT Leader (TCS-style):
 *    - Full 7-stage chain:
 *      * Stage A: Quick Screening (>= 8.5/10, gatePassed, canProceedToStageB)
 *      * Stage B: Deep Trend Analysis (>= 6.5/10, gatePassed, canProceedToStageC)
 *      * Stage C: Business Model & Moat (>= 3.0/5.0, Test 1 Non-Copyability passed, gatePassed)
 *      * Stage D: Valuation Engine (MOS >= 20%, high/medium confidence, gatePassed)
 *      * Stage E: Technical Entry & Timing (confirmed bullish setup inside buy zone, gatePassed)
 *      * Stage F: Buy Plan & Sizing (risk budget <= 1%, stock <= 10%, sector <= 30%, gatePassed)
 *      * Stage G: Monitoring & Exit (clean P&L attribution, no stop breach alerts, HOLD decision)
 *
 * 2. Fixture 2 — Private Bank (HDFCBANK-style):
 *    - Bank mode (/9 max score, D/E excluded, CR/IC flagged UNSUITABLE_FOR_SECTOR)
 *    - Stage D primary valuation automatically routes to P/B (sector: 'bank')
 *    - Bank-specific gate behavior and MOS
 *
 * 3. Fixture 3 — Distressed High-Debt Company:
 *    - Stage A fails with multiple hard stops (D/E > 1.25, ROE < 10%, CR < 1.0, IC < 3.0)
 *    - Strict gate enforcement: gatePassed = false, canProceedToStageB = false
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageA,
  scoreStageB,
  scoreStageC,
  scoreStageD,
  scoreStageE,
  scoreStageF,
  scoreStageG,
  calculatePositionPnL,
  evaluateAlerts,
  evaluateSellDecision,
  type StageAInput,
  type StageBInput,
  type StageCInput,
  type StageDInput,
  type StageEInput,
  type StageFInput,
  type StageGInput,
  type OhlcvBar,
  type PortfolioSnapshot,
  type PositionWithThesis,
  type EvidenceItem,
  type BusinessModelAnswer,
  type MoatTestResult,
} from '../src/index.js';

// ============================================================================
// Fixture 1: Quality IT Leader (TCS-style)
// ============================================================================

function createTcsStageAInput(): StageAInput {
  return {
    companyId: 'comp_tcs_in',
    asOfDate: '2024-03-31T00:00:00.000Z',
    sector: 'non-financial',
    industry: 'IT services',
    financials: {
      revenue: 240893, // ~2.4 Lakh Cr
      netProfit: 46099, // ~46k Cr (PAT margin ~19%)
      operatingProfit: 62500, // OPM ~26%
      totalAssets: 145000,
      totalLiabilities: 45000,
      totalEquity: 100000,
      totalDebt: 5000, // D/E = 0.05
      currentAssets: 80000,
      currentLiabilities: 32000, // CR = 2.5
      interestExpense: 300,
      ebit: 61000, // IC = 203.3
      eps: 126.5,
      peRatio: 26.5, // Industry PE is 28
      salesGrowth: {
        latestYoY: 13.5,
        cagr5y: 11.2,
      },
      profitGrowth: {
        latestYoY: 14.8,
        cagr5y: 12.0,
      },
      opm: {
        latestFy: 26.0,
        avg5y: 25.5,
      },
      roe: {
        latestFy: 48.0,
        avg5y: 42.0,
      },
      roce: {
        latestFy: 58.0,
        avg5y: 52.0,
      },
      roa: {
        latestFy: 32.0,
        avg5y: 30.0,
      },
    },
    dataSnapshotId: 'snap_tcs_stage_a',
  };
}

function createTcsStageBInput(): StageBInput {
  return {
    companyId: 'comp_tcs_in',
    asOfDate: '2024-03-31T00:00:00.000Z',
    quarterly: [
      { period: 'FY2022-Q1', salesYoY: 12.0, opmYoY: 1.0 },
      { period: 'FY2022-Q2', salesYoY: 13.5, opmYoY: 0.8 },
      { period: 'FY2022-Q3', salesYoY: 14.0, opmYoY: 1.2 },
      { period: 'FY2022-Q4', salesYoY: 12.5, opmYoY: 0.9 },
      { period: 'FY2023-Q1', salesYoY: 15.0, opmYoY: 1.1 },
      { period: 'FY2023-Q2', salesYoY: 14.2, opmYoY: 1.0 },
      { period: 'FY2023-Q3', salesYoY: 16.0, opmYoY: 1.3 },
      { period: 'FY2023-Q4', salesYoY: 15.5, opmYoY: 1.2 },
    ],
    annual: [
      {
        period: 'FY2020',
        sales: 156949,
        opm: 25.0,
        netProfit: 29820,
        netMargin: 19.0,
        reserves: 84000,
        borrowings: 0,
        cfo: 32000,
        pat: 29820,
        debtorDays: 28,
        roce: 45.0,
      },
      {
        period: 'FY2021',
        sales: 164177,
        opm: 25.3,
        netProfit: 31686,
        netMargin: 19.3,
        reserves: 86000,
        borrowings: 0,
        cfo: 35000,
        pat: 31686,
        debtorDays: 26,
        roce: 47.0,
      },
      {
        period: 'FY2022',
        sales: 191754,
        opm: 25.6,
        netProfit: 37775,
        netMargin: 19.7,
        reserves: 89000,
        borrowings: 0,
        cfo: 40000,
        pat: 37775,
        debtorDays: 24,
        roce: 50.0,
      },
      {
        period: 'FY2023',
        sales: 225458,
        opm: 25.8,
        netProfit: 45091,
        netMargin: 20.0,
        reserves: 92000,
        borrowings: 0,
        cfo: 46000,
        pat: 45091,
        debtorDays: 22,
        roce: 54.0,
      },
      {
        period: 'FY2024',
        sales: 240893,
        opm: 26.0,
        netProfit: 49383,
        netMargin: 20.5,
        reserves: 96000,
        borrowings: 0,
        cfo: 51000,
        pat: 49383,
        debtorDays: 20,
        roce: 58.0,
      },
    ],
    shareholding: [
      {
        period: '2022-Q1',
        promoterPct: 71.5,
        fiiPct: 12.5,
        diiPct: 9.0,
        publicPct: 7.0,
        promoterPledgePct: 0.0,
      },
      {
        period: '2022-Q2',
        promoterPct: 71.6,
        fiiPct: 12.6,
        diiPct: 9.0,
        publicPct: 6.8,
        promoterPledgePct: 0.0,
      },
      {
        period: '2022-Q3',
        promoterPct: 71.8,
        fiiPct: 12.7,
        diiPct: 9.1,
        publicPct: 6.4,
        promoterPledgePct: 0.0,
      },
      {
        period: '2022-Q4',
        promoterPct: 71.9,
        fiiPct: 12.8,
        diiPct: 9.1,
        publicPct: 6.2,
        promoterPledgePct: 0.0,
      },
      {
        period: '2023-Q1',
        promoterPct: 72.0,
        fiiPct: 12.8,
        diiPct: 9.2,
        publicPct: 6.0,
        promoterPledgePct: 0.0,
      },
      {
        period: '2023-Q2',
        promoterPct: 72.1,
        fiiPct: 12.9,
        diiPct: 9.2,
        publicPct: 5.8,
        promoterPledgePct: 0.0,
      },
      {
        period: '2023-Q3',
        promoterPct: 72.2,
        fiiPct: 13.0,
        diiPct: 9.3,
        publicPct: 5.5,
        promoterPledgePct: 0.0,
      },
      {
        period: '2024-Q1',
        promoterPct: 72.8,
        fiiPct: 13.8,
        diiPct: 9.5,
        publicPct: 3.9,
        promoterPledgePct: 0.0,
      },
    ],
    dataSnapshotId: 'snap_tcs_stage_b',
  };
}

function createTcsStageCInput(): StageCInput {
  const directEvidence = (id: string, note: string): EvidenceItem => ({
    id,
    description: note,
    source: 'https://bseindia.com/annual-reports/tcs-fy24.pdf',
    sourceType: 'filing',
    date: '2024-03-31T00:00:00.000Z',
    tags: ['verified-fact'],
    relevance: 'direct',
  });

  const businessModel: BusinessModelAnswer[] = [
    {
      questionId: 'value-creation',
      answer: 'Global end-to-end digital transformation, cloud migration, and mission-critical enterprise engineering.',
      evidence: [directEvidence('bm-1', 'Over 600,000 engineers serving 50+ Fortune 100 enterprise clients.')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      questionId: 'value-capture',
      answer: 'High switching costs and long-term multi-year master services agreements yielding 26% operating margins.',
      evidence: [directEvidence('bm-2', 'Consistently delivers 25-27% EBIT margin over a 15-year period.')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      questionId: 'scalability',
      answer: 'Global delivery network spanning 55 countries with exceptional graduate training and AI conversion.',
      evidence: [directEvidence('bm-3', 'Demonstrated operating leverage across 150k+ Cr to 240k+ Cr expansion.')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
  ];

  const moatTests: MoatTestResult[] = [
    {
      testId: 1,
      question: 'Can competitors easily copy the business?',
      answer: 'no',
      passes: true,
      evidence: [directEvidence('t1', 'Decades of proprietary institutional client context and enterprise trust.')],
      confidence: 'high',
      rationale: 'Deep integration into core banking and airline operations makes duplication virtually impossible.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      testId: 2,
      question: 'Can the advantage last 10+ years?',
      answer: 'yes',
      passes: true,
      evidence: [directEvidence('t2', '98% recurring enterprise revenue with average client tenure > 10 years.')],
      confidence: 'high',
      rationale: 'Strategic client partnerships continuously expand into next-generation tech architectures.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      testId: 3,
      question: 'Has ROE been high & consistent for 10+ years?',
      answer: 'yes',
      passes: true,
      evidence: [directEvidence('t3', '10Y average ROE exceeds 40% with zero long-term financial leverage.')],
      confidence: 'high',
      rationale: 'Immaculate capital allocation with 100%+ free cash flow returned via buybacks and dividends.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      testId: 4,
      question: 'Can the company raise prices without losing customers?',
      answer: 'yes',
      passes: true,
      evidence: [directEvidence('t4', 'Realised billing rate increases during digital transformation contracts.')],
      confidence: 'high',
      rationale: 'Value-based pricing for mission-critical digital modernization insulates from cost cuts.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
    {
      testId: 5,
      question: 'Is market share stable or growing over 5+ years?',
      answer: 'yes',
      passes: true,
      evidence: [directEvidence('t5', 'Consistently gained market share among top global IT service providers.')],
      confidence: 'high',
      rationale: 'Total contract value (TCV) bookings reached record $42.7B in FY24.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'lead-analyst',
    },
  ];

  return {
    companyId: 'comp_tcs_in',
    asOfDate: '2024-03-31T00:00:00.000Z',
    businessModelCategory: 'BRANDED_MANUFACTURING',
    moatTypes: ['SWITCHING_COST', 'BRAND'],
    businessModel,
    moatTests,
    roeHistory10y: [38, 40, 42, 41, 43, 44, 40, 42, 48, 50],
    dataSnapshotId: 'snap_tcs_stage_c',
  };
}

function createTcsStageDInput(marketPrice = 3200): StageDInput {
  return {
    companyId: 'comp_tcs_in',
    asOfDate: '2024-03-31T00:00:00.000Z',
    marketPrice,
    sector: 'IT services',
    businessModel: 'Branded Manufacturing',
    financials: {
      eps: {
        reported: 126.5,
        normalised: 135.0,
        forecast: 150.0,
      },
      bookValuePerShare: 275.0,
      fcf: [38000, 42000, 46000],
      netDebt: -15000, // Net cash
      sharesOutstanding: 3.61, // 3.61 billion shares (~361 crore)
      industryPeRatio: 28.0,
      growthRate: {
        historical: 12.0,
        forward: 14.0,
      },
      dcfInputs: {
        horizon: 5,
        revenueGrowth: [0.12, 0.12, 0.11, 0.10, 0.10],
        operatingMargin: [0.26, 0.26, 0.26, 0.26, 0.26],
        taxRate: 0.25,
        reinvestmentRate: 0.20,
        wacc: 0.11, // 11%
        terminalGrowth: 0.04, // 4%
      },
    },
    selectedFairPE: 30.0, // 135 * 30 = 4050 Fair Value
    dataSnapshotId: 'snap_tcs_stage_d',
  };
}

function createTcsStageEBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 3400;

  // 25 days of orderly pullback from 3400 to ~3150
  for (let i = 1; i <= 25; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    const open = price;
    price -= 10;
    const close = price;
    bars.push({
      date: `2024-03-${dayStr}T00:00:00.000Z`,
      open,
      high: open + 5,
      low: close - 5,
      close,
      volume: 150000,
      adjusted: true,
    });
  }

  // Bullish Engulfing pattern at support level
  // C1: Small bearish candle
  bars.push({
    date: '2024-03-26T00:00:00.000Z',
    open: 3170,
    high: 3175,
    low: 3140,
    close: 3145,
    volume: 120000,
    adjusted: true,
  });
  // C2: Long Bullish Engulfing candle
  bars.push({
    date: '2024-03-27T00:00:00.000Z',
    open: 3135,
    high: 3215,
    low: 3125,
    close: 3210,
    volume: 380000,
    adjusted: true,
  });
  // C3: Follow-through confirmation candle
  bars.push({
    date: '2024-03-28T00:00:00.000Z',
    open: 3215,
    high: 3245,
    low: 3205,
    close: 3230,
    volume: 250000,
    adjusted: true,
  });

  return bars;
}

// ============================================================================
// Fixture 2: Private Bank (HDFCBANK-style)
// ============================================================================

function createBankStageAInput(): StageAInput {
  return {
    companyId: 'comp_hdfc_bank',
    asOfDate: '2024-03-31T00:00:00.000Z',
    sector: 'bank',
    industry: 'Banks',
    financials: {
      revenue: 160000,
      netProfit: 64000,
      operatingProfit: 85000,
      totalAssets: 3600000,
      totalLiabilities: 3150000,
      totalEquity: 450000,
      totalDebt: 2800000, // D/E is 6.22 (normal for banks, excluded in bank mode)
      currentAssets: 350000,
      currentLiabilities: 700000, // CR is 0.50 (normal for banks, unsuitable without hard stop)
      interestExpense: 75000,
      ebit: 160000, // IC = 2.13 (unsuitable without hard stop)
      eps: 84.5,
      peRatio: 18.5,
      salesGrowth: {
        latestYoY: 22.0,
        cagr5y: 18.5,
      },
      profitGrowth: {
        latestYoY: 28.0,
        cagr5y: 20.0,
      },
      opm: {
        latestFy: 53.0,
        avg5y: 50.0,
      },
      roe: {
        latestFy: 17.5,
        avg5y: 16.8,
      },
      roce: {
        latestFy: 14.2,
        avg5y: 13.5,
      },
      roa: {
        latestFy: 1.95, // >= bank benchmark min 1.0%
        avg5y: 1.90,
      },
    },
    dataSnapshotId: 'snap_hdfc_stage_a',
  };
}

function createBankStageDInput(): StageDInput {
  return {
    companyId: 'comp_hdfc_bank',
    asOfDate: '2024-03-31T00:00:00.000Z',
    marketPrice: 1450,
    sector: 'bank',
    businessModel: 'Lending / Banking',
    financials: {
      eps: {
        reported: 84.5,
        normalised: 85.0,
        forecast: 98.0,
      },
      bookValuePerShare: 590.0,
      fcf: [40000, 48000, 56000],
      netDebt: 0,
      sharesOutstanding: 7.6, // 7.6 billion shares
      industryPeRatio: 18.0,
      growthRate: {
        historical: 18.0,
        forward: 16.0,
      },
      dcfInputs: {
        horizon: 5,
        revenueGrowth: [0.15, 0.15, 0.14, 0.14, 0.13],
        operatingMargin: [0.50, 0.50, 0.50, 0.50, 0.50],
        taxRate: 0.25,
        reinvestmentRate: 0.25,
        wacc: 0.11,
        terminalGrowth: 0.04,
      },
    },
    selectedFairPB: 3.2, // 590 * 3.2 = 1888 Fair Value
    dataSnapshotId: 'snap_hdfc_stage_d',
  };
}

// ============================================================================
// Fixture 3: Distressed High-Debt Company
// ============================================================================

function createDistressedStageAInput(): StageAInput {
  return {
    companyId: 'comp_distressed_co',
    asOfDate: '2024-03-31T00:00:00.000Z',
    sector: 'non-financial',
    industry: 'Commodity Chemicals',
    financials: {
      revenue: 8000,
      netProfit: 200,
      operatingProfit: 600,
      totalAssets: 35000,
      totalLiabilities: 28000,
      totalEquity: 7000,
      totalDebt: 17500, // D/E = 2.5 (> 1.25 HARD STOP)
      currentAssets: 3000,
      currentLiabilities: 4500, // CR = 0.67 (< 1.0 HARD STOP)
      interestExpense: 1200,
      ebit: 1400, // IC = 1.17 (< 3.0 HARD STOP)
      eps: 2.8,
      peRatio: 45.0,
      salesGrowth: {
        latestYoY: -12.0,
        cagr5y: -4.0,
      },
      profitGrowth: {
        latestYoY: -45.0,
        cagr5y: -18.0,
      },
      opm: {
        latestFy: 7.5,
        avg5y: 11.0,
      },
      roe: {
        latestFy: 2.8, // < 10% HARD STOP
        avg5y: 4.5,
      },
      roce: {
        latestFy: 4.0, // < 10% HARD STOP
        avg5y: 5.5,
      },
      roa: {
        latestFy: 0.5,
        avg5y: 1.2,
      },
    },
    dataSnapshotId: 'snap_distressed_stage_a',
  };
}

// ============================================================================
// Vitest Test Suite
// ============================================================================

describe('End-to-End Golden Fixtures — Full Lifecycle Regression', () => {
  // ==========================================================================
  // Test 1: Quality IT Leader (TCS-Style) Full Sequential Pipeline A -> G
  // ==========================================================================
  describe('Fixture 1: Quality IT Leader (TCS-Style) — Sequential Stage A -> G Chain', () => {
    it('executes the full Stage A through Stage G pipeline sequentially with deterministic pass gates', () => {
      // ----------------------------------------------------------------------
      // Stage A: Quick Screening
      // ----------------------------------------------------------------------
      const inputA = createTcsStageAInput();
      const outputA = scoreStageA(inputA);

      expect(outputA.stage).toBe('A');
      expect(outputA.totalPoints).toBeGreaterThanOrEqual(8.5);
      expect(outputA.gatePassed).toBe(true);
      expect(outputA.canProceedToStageB).toBe(true);
      expect(outputA.hardStops).toHaveLength(0);
      expect(outputA.verdict).toBe('PASS');

      // ----------------------------------------------------------------------
      // Stage B: Deep Trend Analysis
      // ----------------------------------------------------------------------
      const inputB = createTcsStageBInput();
      const outputB = scoreStageB(inputB);

      expect(outputB.stage).toBe('B');
      expect(outputB.totalPoints).toBeGreaterThanOrEqual(6.5);
      expect(outputB.gatePassed).toBe(true);
      expect(outputB.canProceedToStageC).toBe(true);
      expect(outputB.hardStops).toHaveLength(0);

      // ----------------------------------------------------------------------
      // Stage C: Business Model & Competitive Advantage (Moat)
      // ----------------------------------------------------------------------
      const inputC = createTcsStageCInput();
      const outputC = scoreStageC(inputC);

      expect(outputC.stage).toBe('C');
      expect(outputC.totalPoints).toBeGreaterThanOrEqual(3.0);
      // Verify Test 1 (Non-Copyability) passed
      const test1 = outputC.tests.find((t) => t.testId === 1);
      expect(test1).toBeDefined();
      expect(test1?.passes).toBe(true);
      expect(outputC.gatePassed).toBe(true);
      expect(outputC.canProceedToStageD).toBe(true);
      expect(outputC.hardStops).toHaveLength(0);
      expect(outputC.businessModelComplete).toBe(true);

      // ----------------------------------------------------------------------
      // Stage D: Valuation Engine
      // ----------------------------------------------------------------------
      const marketPrice = 3200;
      const inputD = createTcsStageDInput(marketPrice);
      const outputD = scoreStageD(inputD);

      expect(outputD.stage).toBe('D');
      expect(outputD.selectedFairValue).toBeGreaterThan(marketPrice);
      // 4050 Fair Value * 0.80 = 3240 max buy price
      expect(outputD.maxBuyPrice).toBeGreaterThanOrEqual(marketPrice);
      expect(outputD.marginOfSafetyPct).toBeGreaterThanOrEqual(20.0);
      expect(outputD.gatePassed).toBe(true);
      expect(outputD.canProceedToStageE).toBe(true);
      expect(['high', 'medium']).toContain(outputD.overallConfidence);
      expect(outputD.hardStops).toHaveLength(0);

      // ----------------------------------------------------------------------
      // Stage E: Technical Entry & Timing
      // ----------------------------------------------------------------------
      const inputE: StageEInput = {
        companyId: inputA.companyId,
        asOfDate: '2024-03-28T00:00:00.000Z',
        adjustedOhlcvDaily: createTcsStageEBars(),
        valuationMaxBuyPrice: outputD.maxBuyPrice,
        selectedFairValue: outputD.selectedFairValue,
        minRiskReward: 1.5,
      };
      const outputE = scoreStageE(inputE);

      expect(outputE.stage).toBe('E');
      expect(outputE.eligible).toBe(true);
      expect(outputE.gatePassed).toBe(true);
      expect(outputE.canProceedToStageF).toBe(true);
      expect(outputE.priceData.inBuyZone).toBe(true);
      expect(outputE.bestSetup).toBeDefined();
      expect(outputE.bestSetup?.pattern.name).toBe('bullish-engulfing');
      expect(outputE.bestSetup?.pattern.confirmation).toBe(true);
      expect(outputE.bestSetup?.invalidationLevel).toBeLessThan(outputE.priceData.currentPrice);
      expect(outputE.bestSetup?.riskReward).toBeGreaterThanOrEqual(1.5);
      expect(outputE.hardStops).toHaveLength(0);

      // ----------------------------------------------------------------------
      // Stage F: Buy Plan, Position Sizing & Portfolio Risk Controls
      // ----------------------------------------------------------------------
      const portfolio: PortfolioSnapshot = {
        totalValue: 1_000_000, // 10 Lakhs
        cash: 300_000, // 3 Lakhs cash
        positions: [
          {
            symbol: 'INFY',
            companyId: 'comp_infy',
            quantity: 50,
            avgPrice: 1400,
            currentPrice: 1500,
            marketValue: 75_000,
            sector: 'IT services',
            unrealisedPnl: 5000,
            unrealisedPnlPct: 0.0714,
          },
        ],
        sectorExposure: {
          'IT services': 75_000,
        },
        asOfDate: '2024-03-28T00:00:00.000Z',
      };

      const bestSetup = outputE.bestSetup!;
      const entryPrice = outputE.priceData.currentPrice; // 3230
      const stopLoss = bestSetup.stopLoss; // 3125

      const inputF: StageFInput = {
        companyId: inputA.companyId,
        symbol: 'TCS',
        sector: 'IT services',
        portfolio,
        valuationMaxBuyPrice: outputD.maxBuyPrice,
        technicalSetup: {
          id: 'setup_tcs_golden',
          pattern: bestSetup.pattern,
          entryZone: bestSetup.entryZone,
          invalidationLevel: bestSetup.invalidationLevel,
          stopLoss,
          targets: [3600, 3900],
          riskReward: bestSetup.riskReward,
          inBuyZone: true,
          contextScore: bestSetup.contextScore,
        },
        tradePlanDraft: {
          symbol: 'TCS',
          thesis: 'Market leader in IT services with 26% OPM, 48% ROE, and strong enterprise lock-in.',
          entryRationale: 'Confirmed bullish engulfing inside valuation buy zone with favorable R:R.',
          expectedHoldingPeriod: '12-24 months',
          entryZone: bestSetup.entryZone,
          entryPriceEst: entryPrice,
          stopLoss,
          targets: [3600, 3900],
          valuationMaxBuyPrice: outputD.maxBuyPrice,
        },
        riskConfig: {
          riskPerTradePct: 0.01, // 1% risk = 10,000
          maxStockExposurePct: 0.10, // 10% stock cap = 100,000
          maxSectorExposurePct: 0.30, // 30% sector cap = 300,000
          minRiskReward: 1.5,
          lotSize: 1,
        },
      };

      const outputF = scoreStageF(inputF);

      expect(outputF.stage).toBe('F');
      expect(outputF.blocked).toBe(false);
      expect(outputF.gatePassed).toBe(true);
      expect(outputF.canProceedToStageG).toBe(true);
      expect(outputF.positionSizing.positionSize).toBeGreaterThan(0);
      expect(outputF.positionSizing.plannedLossAtStop).toBeLessThanOrEqual(10_000);
      expect(outputF.positionSizing.postTradeStockExposurePct).toBeLessThanOrEqual(0.10);
      expect(outputF.positionSizing.postTradeSectorExposurePct).toBeLessThanOrEqual(0.30);
      expect(outputF.hardStops).toHaveLength(0);

      // ----------------------------------------------------------------------
      // Stage G: Monitoring, Sell/Trim Decisions & P&L Attribution
      // ----------------------------------------------------------------------
      const plannedQuantity = outputF.positionSizing.positionSize;
      const tcsMarketValue = plannedQuantity * 3350;
      const tcsPosition: PositionWithThesis = {
        symbol: 'TCS',
        companyId: inputA.companyId,
        quantity: plannedQuantity,
        avgPrice: entryPrice,
        currentPrice: 3350, // Price advances cleanly after entry
        marketValue: tcsMarketValue,
        sector: 'IT services',
        unrealisedPnl: plannedQuantity * (3350 - entryPrice),
        unrealisedPnlPct: (3350 - entryPrice) / entryPrice,
        thesis: inputF.tradePlanDraft?.thesis || '',
        stopLoss,
        targets: [3600, 3900],
        entryDate: '2024-03-28T00:00:00.000Z',
        daysHeld: 15,
        unrealisedReturnPct: (3350 - entryPrice) / entryPrice,
        alertCount: 0,
        fairValue: outputD.selectedFairValue,
        maxBuyPrice: outputD.maxBuyPrice,
        tradePlanId: 'tp_tcs_fixture_01',
        thesisStatus: 'intact',
      };

      const updatedPortfolio: PortfolioSnapshot = {
        totalValue: 1_500_000,
        cash: 500_000,
        positions: [
          {
            symbol: 'INFY',
            companyId: 'comp_infy',
            quantity: 50,
            avgPrice: 1400,
            currentPrice: 1500,
            marketValue: 75_000,
            sector: 'IT services',
            unrealisedPnl: 5000,
            unrealisedPnlPct: 0.0714,
          },
          tcsPosition,
        ],
        sectorExposure: {
          'IT services': 75_000 + tcsMarketValue,
        },
        asOfDate: '2024-04-15T00:00:00.000Z',
      };

      // 1. P&L attribution
      const pnlResult = calculatePositionPnL([
        {
          id: 'trade_tcs_buy_01',
          tradePlanId: 'tp_tcs_fixture_01',
          date: '2024-03-28T00:00:00.000Z',
          action: 'buy',
          quantity: plannedQuantity,
          price: entryPrice,
          fees: 50,
          taxes: 20,
          reason: 'Stage F execution',
          ruleTriggers: [],
          createdAt: '2024-03-28T00:00:00.000Z',
        },
      ], 3350, 'TCS');

      expect(pnlResult.unrealisedPnl).toBeGreaterThan(0);
      expect(pnlResult.weightedAvgCostBasis).toBeGreaterThan(0);
      expect(pnlResult.isClosed).toBe(false);

      // 2. Monitoring alerts check
      const alerts = evaluateAlerts({
        positions: [tcsPosition],
        portfolio: updatedPortfolio,
        currentPrices: { TCS: 3350 },
      });
      // At 3350, stop loss (3125) is NOT breached, target 1 (3600) is NOT reached
      expect(alerts.filter((a) => a.severity === 'critical')).toHaveLength(0);

      // 3. Sell decision recommendation
      const sellDecision = evaluateSellDecision({
        alerts,
        position: tcsPosition,
        portfolio: updatedPortfolio,
      });
      expect(sellDecision.decision).toBe('hold');

      // 4. Full Stage G scoring run
      const inputG: StageGInput = {
        portfolio: updatedPortfolio,
        openPositions: [tcsPosition],
        currentPrices: { TCS: 3350 },
        asOfDate: '2024-04-15T00:00:00.000Z',
      };
      const outputG = scoreStageG(inputG);

      expect(outputG.stage).toBe('G');
      expect(outputG.portfolioHealth.drawdownOk).toBe(true);
      expect(outputG.portfolioHealth.cashBufferOk).toBe(true);
      expect(outputG.portfolioHealth.concentrationOk).toBe(true);
      expect(outputG.activeAlerts.filter((a) => a.severity === 'critical')).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Test 2: Private Bank (HDFCBANK-Style) Mode & P/B Routing
  // ==========================================================================
  describe('Fixture 2: Private Bank (HDFCBANK-Style) — Sector Mode & Valuation Routing', () => {
    it('executes Stage A in bank mode (/9 max score) and routes Stage D primary method to P/B', () => {
      // ----------------------------------------------------------------------
      // Stage A in Bank Mode
      // ----------------------------------------------------------------------
      const inputA = createBankStageAInput();
      const outputA = scoreStageA(inputA);

      expect(outputA.stage).toBe('A');
      // Max possible score for banks must be 9 (D/E excluded)
      expect(outputA.maxPossibleScore).toBe(9.0);
      expect(outputA.unsuitableRules).toContain('currentRatio');
      expect(outputA.unsuitableRules).toContain('interestCoverage');
      // Crucial: CR and IC must NOT trigger hard stops for banks
      expect(outputA.hardStops.some((f) => f.flagKey === 'STAGE_A_CURRENT_RATIO_LOW')).toBe(false);
      expect(outputA.hardStops.some((f) => f.flagKey === 'STAGE_A_INT_COVERAGE_LOW')).toBe(false);
      expect(outputA.hardStops.some((f) => f.flagKey === 'STAGE_A_DEBT_EQUITY_HIGH')).toBe(false);
      expect(outputA.gatePassed).toBe(true);
      expect(outputA.canProceedToStageB).toBe(true);
      // When conditional warnings are present without hard stops, verdict is CONDITIONAL
      expect(['PASS', 'CONDITIONAL']).toContain(outputA.verdict);

      // ----------------------------------------------------------------------
      // Stage D Valuation Engine: Bank Routing to P/B
      // ----------------------------------------------------------------------
      const inputD = createBankStageDInput();
      const outputD = scoreStageD(inputD);

      expect(outputD.stage).toBe('D');
      // Sector 'bank' must automatically select 'PB' as primary valuation method
      expect(outputD.primaryMethod).toBe('PB');
      expect(outputD.selectedFairValue).toBeGreaterThan(inputD.marketPrice);
      expect(outputD.gatePassed).toBe(true);
      expect(outputD.canProceedToStageE).toBe(true);
      expect(outputD.marginOfSafetyPct).toBeGreaterThanOrEqual(20.0);
    });
  });

  // ==========================================================================
  // Test 3: Distressed High-Debt Company — Hard Stop Gate Blocking
  // ==========================================================================
  describe('Fixture 3: Distressed High-Debt Company — Hard Stop Gate Blocking', () => {
    it('blocks gate progression in Stage A due to excessive debt, weak interest coverage, and low ROE', () => {
      const inputA = createDistressedStageAInput();
      const outputA = scoreStageA(inputA);

      expect(outputA.stage).toBe('A');
      expect(outputA.gatePassed).toBe(false);
      expect(outputA.canProceedToStageB).toBe(false);
      expect(outputA.verdict).toBe('FAIL');
      expect(outputA.hardStops.length).toBeGreaterThanOrEqual(2);

      // Verify specific hard stop flag keys are triggered
      const hardStopKeys = outputA.hardStops.map((f) => f.flagKey);
      expect(hardStopKeys).toContain('STAGE_A_DEBT_EQUITY_HIGH');
      expect(hardStopKeys).toContain('STAGE_A_ROE_BELOW_10');
      expect(hardStopKeys).toContain('STAGE_A_CURRENT_RATIO_LOW');
      expect(hardStopKeys).toContain('STAGE_A_INT_COVERAGE_LOW');
    });
  });
});
