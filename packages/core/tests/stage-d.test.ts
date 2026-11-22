/**
 * Stage D (Valuation Engine) Vitest Unit Tests
 *
 * Verifies:
 * 1. M1 — P/E Valuation:
 *    - Formula: relativePE = companyPE / industryPE, fairValue = normalizedEPS * selectedFairPE
 *    - Over/undervaluation % calculation
 *    - Target price calculation from forecast EPS and exit PE
 *    - Negative or zero EPS -> unsuitable with DATA_QUALITY_WARNING (never produces negative fair value)
 *    - Warning when companyPE > 2 * industryPE (STAGE_D_PE_EXPENSIVE)
 * 2. M2 — PEG Valuation:
 *    - Formula: PEG = PE / growthRatePct (e.g. PE 34, growth 50% -> PEG = 0.68)
 *    - Bands: < 1.0 (undervalued), 1.0-1.5 (fair), 1.5-2.0 (getting expensive), > 2.0 (overvalued + warning)
 *    - Unsuitable when EPS <= 0 or growth <= 0
 * 3. M3 — P/B Valuation:
 *    - Sector bands:
 *      * Banks: < 1.5 cheap, 1.5-2.0 fair, 2.0-3.0 reasonable, > 3.0 expensive warning
 *      * Manufacturing: < 1.5 cheap, 1.5-3.0 fair, > 3.0 expensive warning
 *      * Real Estate: < 1.5 cheap, 1.5-4.0 fair, > 4.0 expensive warning
 *      * Asset-Light: limited applicability note
 *    - Unsuitable when BVPS <= 0 (negative equity)
 * 4. M4 — Simplified DCF Valuation:
 *    - WACC discounting of FCF + Gordon Growth terminal value - net debt / shares
 *    - Scenarios: Bear, Base, Bull
 *    - Sensitivity Matrix: 3x3 grid (WACC vs Terminal Growth)
 *    - Guardrails: terminalGrowth >= WACC or WACC <= 0 flags STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE
 *    - High terminal value dependence (> 70%) flags STAGE_D_DCF_TERMINAL_DEPENDENCE
 *    - Negative FCF flags STAGE_D_DCF_NEGATIVE_FCF
 * 5. Margin of Safety & Stage D Gate:
 *    - 20% Margin of Safety: maxBuyPrice = fairValue * 0.80
 *    - Exact boundary: marketPrice === maxBuyPrice passes; marketPrice > maxBuyPrice fails
 *    - Low-confidence valuation blocks gatePassed even when discount > 20%
 *    - Zero hard stops requirement
 * 6. Primary Method Routing:
 *    - Banks/NBFCs route to P/B
 *    - Subscription / Marketplace routes to PEG
 *    - Commodity / Heavy routes to DCF
 *    - Default / IT routes to P/E
 *    - User override support
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageD,
  valueStageD,
  calculatePeValuation,
  calculatePegValuation,
  calculatePbValuation,
  calculateDcfValuation,
  DCF_EDUCATIONAL_LABEL,
  type StageDInput,
  type StageDFinancials,
} from '../src/index.js';

function createStandardFinancials(): StageDFinancials {
  return {
    eps: {
      reported: 50.0,
      normalised: 50.0,
      forecast: 60.0,
    },
    bookValuePerShare: 200.0,
    fcf: [80, 90, 100],
    netDebt: 0,
    sharesOutstanding: 10, // 10 crore shares
    industryPeRatio: 25.0,
    growthRate: {
      historical: 25.0,
      forward: 25.0,
    },
    dcfInputs: {
      horizon: 5,
      revenueGrowth: [0.08, 0.08, 0.08, 0.08, 0.08],
      operatingMargin: [0.20, 0.20, 0.20, 0.20, 0.20],
      taxRate: 0.25,
      reinvestmentRate: 0.30,
      wacc: 0.12, // 12%
      terminalGrowth: 0.04, // 4%
    },
  };
}

function createHealthyStageDInput(marketPrice = 1000): StageDInput {
  return {
    companyId: 'TEST_INFY',
    asOfDate: '2024-03-31T00:00:00.000Z',
    marketPrice,
    sector: 'IT Services',
    businessModel: 'Branded Manufacturing',
    financials: createStandardFinancials(),
    dataSnapshotId: 'snap_stage_d_001',
  };
}

describe('Stage D — Valuation Engine', () => {
  // ==========================================================================
  // 1. Method 1 — P/E Valuation Tests
  // ==========================================================================
  describe('M1 — P/E Valuation', () => {
    it('calculates P/E fair value, relative P/E, over/undervaluation % and target price', () => {
      const financials = createStandardFinancials();
      const result = calculatePeValuation({
        marketPrice: 1000,
        financials,
        sector: 'IT Services',
        selectedFairPE: 25,
        assumedExitPE: 25,
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      // Fair Value = 50 (EPS) * 25 (Fair PE) = 1250
      expect(result.fairValue).toBe(1250.0);
      expect(result.applicability).toBe('suitable');
      expect(result.confidence).toBe('high');
      expect(result.assumptions.companyPe).toBe(20.0); // 1000 / 50
      expect(result.assumptions.relativePe).toBe(0.8); // 20 / 25
      expect(result.assumptions.overUnderPct).toBe(-20.0); // (1000 - 1250) / 1250 * 100 = -20%
      expect(result.assumptions.targetPrice).toBe(1500.0); // 60 (forecast EPS) * 25 (exit PE)
      expect(result.flags).toHaveLength(0);
    });

    it('marks P/E unsuitable with DATA_QUALITY_WARNING when EPS is negative or zero (never produces negative fair value)', () => {
      const financials = createStandardFinancials();
      financials.eps.normalised = -10.0;

      const result = calculatePeValuation({
        marketPrice: 500,
        financials,
        sector: 'IT Services',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.fairValue).toBe(0);
      expect(result.applicability).toBe('unsuitable');
      expect(result.confidence).toBe('low');
      const epsFlag = result.flags.find((f) => f.flagKey === 'STAGE_D_EPS_NEGATIVE');
      expect(epsFlag).toBeDefined();
      expect(epsFlag?.class).toBe('DATA_QUALITY_WARNING');
    });

    it('emits STAGE_D_PE_EXPENSIVE when company P/E exceeds 2x industry benchmark', () => {
      const financials = createStandardFinancials();
      financials.eps.normalised = 10.0;
      financials.industryPeRatio = 20.0;
      // Market Price = 500 -> Company PE = 500 / 10 = 50x (> 2 * 20x = 40x)

      const result = calculatePeValuation({
        marketPrice: 500,
        financials,
        sector: 'Consumer',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.assumptions.companyPe).toBe(50.0);
      const expensiveFlag = result.flags.find((f) => f.flagKey === 'STAGE_D_PE_EXPENSIVE');
      expect(expensiveFlag).toBeDefined();
      expect(expensiveFlag?.class).toBe('VALUATION_WARNING');
      expect(result.confidence).toBe('medium');
    });
  });

  // ==========================================================================
  // 2. Method 2 — PEG Valuation Tests
  // ==========================================================================
  describe('M2 — PEG Valuation', () => {
    it('calculates PEG correctly (P/E 34, growth 50% -> PEG = 0.68) and flags undervalued', () => {
      const financials = createStandardFinancials();
      financials.eps.normalised = 20.0; // Market price 680 -> PE = 34
      financials.growthRate = { historical: 50.0, forward: 50.0 };

      const result = calculatePegValuation({
        marketPrice: 680,
        financials,
        sector: 'Tech',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.assumptions.companyPe).toBe(34.0);
      expect(result.assumptions.peg).toBe(0.68);
      expect(result.assumptions.interpretation).toBe('potentially undervalued');
      expect(result.fairValue).toBe(1000.0); // 20 * 50
      expect(result.flags).toHaveLength(0);
    });

    it('identifies PEG overvalued bands (> 2.0) and emits STAGE_D_PEG_OVERVALUED', () => {
      const financials = createStandardFinancials();
      financials.eps.normalised = 10.0;
      financials.growthRate = { historical: 15.0, forward: 15.0 };
      // Market Price = 400 -> PE = 40; PEG = 40 / 15 = 2.67

      const result = calculatePegValuation({
        marketPrice: 400,
        financials,
        sector: 'Tech',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.assumptions.companyPe).toBe(40.0);
      expect(result.assumptions.peg).toBe(2.67);
      expect(result.assumptions.interpretation).toBe('overvalued');
      const pegOvervaluedFlag = result.flags.find((f) => f.flagKey === 'STAGE_D_PEG_OVERVALUED');
      expect(pegOvervaluedFlag).toBeDefined();
    });

    it('marks PEG unsuitable when growth rate is <= 0 or missing', () => {
      const financials = createStandardFinancials();
      financials.growthRate = { historical: 0 };

      const result = calculatePegValuation({
        marketPrice: 500,
        financials,
        sector: 'Tech',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.fairValue).toBe(0);
      expect(result.applicability).toBe('unsuitable');
      expect(result.flags.some((f) => f.flagKey === 'STAGE_D_PEG_GROWTH_NON_POSITIVE')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Method 3 — Price-to-Book (P/B) Valuation Tests
  // ==========================================================================
  describe('M3 — P/B Valuation', () => {
    it('evaluates Bank P/B bands correctly (< 1.5 cheap, 1.5-2.0 fair, 2.0-3.0 reasonable, > 3.0 expensive)', () => {
      const financials = createStandardFinancials();
      financials.bookValuePerShare = 100.0;

      // Price = 180 -> PB = 1.8 (fair)
      const resFair = calculatePbValuation({
        marketPrice: 180,
        financials,
        sector: 'Banks',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });
      expect(resFair.assumptions.band).toBe('fair');
      expect(resFair.fairValue).toBe(180.0); // 100 * 1.8 default

      // Price = 350 -> PB = 3.5 (expensive warning)
      const resExp = calculatePbValuation({
        marketPrice: 350,
        financials,
        sector: 'Banks',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });
      expect(resExp.assumptions.band).toBe('expensive');
      expect(resExp.flags.some((f) => f.flagKey === 'STAGE_D_PB_EXPENSIVE')).toBe(true);
    });

    it('marks P/B limited for asset-light sectors with low confidence note', () => {
      const financials = createStandardFinancials();
      const result = calculatePbValuation({
        marketPrice: 1000,
        financials,
        sector: 'IT Services',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.applicability).toBe('limited');
      expect(result.confidence).toBe('low');
      expect(result.explanation).toContain('limited applicability for asset-light firms');
    });

    it('marks P/B unsuitable when book value per share is non-positive', () => {
      const financials = createStandardFinancials();
      financials.bookValuePerShare = -50.0;

      const result = calculatePbValuation({
        marketPrice: 100,
        financials,
        sector: 'Manufacturing',
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.fairValue).toBe(0);
      expect(result.applicability).toBe('unsuitable');
      expect(result.flags.some((f) => f.flagKey === 'STAGE_D_BOOK_VALUE_NEGATIVE')).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Method 4 — Simplified DCF Valuation Tests
  // ==========================================================================
  describe('M4 — Simplified DCF Valuation', () => {
    it('calculates DCF fair value, scenarios (bear/base/bull), and sensitivity matrix with educational label', () => {
      const financials = createStandardFinancials();
      const result = calculateDcfValuation({
        financials,
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.fairValue).toBeGreaterThan(0);
      expect(result.explanation).toContain(DCF_EDUCATIONAL_LABEL);

      // Scenarios: bear < base < bull
      expect(result.scenarios).toBeDefined();
      expect(result.scenarios!.bear).toBeLessThan(result.scenarios!.base);
      expect(result.scenarios!.base).toBeLessThan(result.scenarios!.bull);

      // Sensitivity Matrix
      expect(result.sensitivity).toBeDefined();
      expect(result.sensitivity!['wacc_minus_1']).toHaveLength(3);
      expect(result.sensitivity!['wacc_base']).toHaveLength(3);
      expect(result.sensitivity!['wacc_plus_1']).toHaveLength(3);
    });

    it('guards against invalid DCF assumptions (terminalGrowth >= WACC or WACC <= 0)', () => {
      const financials = createStandardFinancials();
      financials.dcfInputs!.wacc = 0.08;
      financials.dcfInputs!.terminalGrowth = 0.08; // g == WACC

      const result = calculateDcfValuation({
        financials,
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      expect(result.fairValue).toBe(0);
      expect(result.applicability).toBe('unsuitable');
      expect(result.flags.some((f) => f.flagKey === 'STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE')).toBe(true);
    });

    it('flags high terminal value dependence when terminal value constitutes > 70% of enterprise value', () => {
      const financials = createStandardFinancials();
      financials.fcf = [10]; // Low explicit cash flow
      financials.dcfInputs!.terminalGrowth = 0.06;
      financials.dcfInputs!.wacc = 0.08; // Narrow spread drives high terminal value

      const result = calculateDcfValuation({
        financials,
        companyId: 'TEST_01',
        asOfDate: '2024-03-31T00:00:00.000Z',
        ruleSetVersion: 'stage-d-v1.0',
      });

      const dependenceFlag = result.flags.find((f) => f.flagKey === 'STAGE_D_DCF_TERMINAL_DEPENDENCE');
      expect(dependenceFlag).toBeDefined();
      expect(result.confidence).toBe('low');
    });
  });

  // ==========================================================================
  // 5. Margin of Safety & Stage D Gate Tests
  // ==========================================================================
  describe('Margin of Safety & Stage D Gate', () => {
    it('passes gate at exact 20% margin of safety boundary (marketPrice === maxBuyPrice)', () => {
      // Fair value = 1250 -> maxBuyPrice = 1250 * 0.80 = 1000
      const input = createHealthyStageDInput(1000);
      const output = scoreStageD(input);

      expect(output.selectedFairValue).toBe(1250.0);
      expect(output.maxBuyPrice).toBe(1000.0);
      expect(output.marginOfSafetyPct).toBe(20.0);
      expect(output.buyReady).toBe(true);
      expect(output.gatePassed).toBe(true);
      expect(output.canProceedToStageE).toBe(true);
      expect(output.verdict).toBe('PASS');
    });

    it('fails gate when market price is just above max buy price (e.g. ₹1001 vs ₹1000)', () => {
      const input = createHealthyStageDInput(1001);
      const output = scoreStageD(input);

      expect(output.selectedFairValue).toBe(1250.0);
      expect(output.maxBuyPrice).toBe(1000.0);
      expect(output.marginOfSafetyPct).toBeLessThan(20.0);
      expect(output.buyReady).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageE).toBe(false);
      expect(output.verdict).toBe('FAIL');

      const mosFlag = output.valuationWarnings.find((f) => f.flagKey === 'STAGE_D_MOS_INSUFFICIENT');
      expect(mosFlag).toBeDefined();
    });

    it('blocks gate when overall confidence is low even if margin of safety is well above 20%', () => {
      const input = createHealthyStageDInput(250); // MOS > 50%
      // Force primary method to have low confidence (by making DCF primary with > 75% terminal dependence)
      input.primaryMethodOverride = 'DCF';
      input.financials.fcf = [100];
      input.financials.dcfInputs!.wacc = 0.08;
      input.financials.dcfInputs!.terminalGrowth = 0.065; // ~91% terminal dependence -> low confidence

      const output = scoreStageD(input);

      expect(output.marginOfSafetyPct).toBeGreaterThan(20.0);
      expect(output.overallConfidence).toBe('low');
      expect(output.buyReady).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageE).toBe(false);
      expect(output.verdict).toBe('FAIL');
      expect(output.message).toContain('BLOCKED by LOW confidence');
    });

    it('works identically via valueStageD interface alias', () => {
      const input = createHealthyStageDInput(1000);
      const out1 = scoreStageD(input);
      const out2 = valueStageD(input);

      expect(out1.maxBuyPrice).toBe(out2.maxBuyPrice);
      expect(out1.buyReady).toBe(out2.buyReady);
      expect(out1.gatePassed).toBe(out2.gatePassed);
    });
  });

  // ==========================================================================
  // 6. Sector & Business Model Routing Tests
  // ==========================================================================
  describe('Primary Method Routing', () => {
    it('routes Banks and NBFCs to P/B as primary valuation method', () => {
      const input = createHealthyStageDInput(150);
      input.sector = 'Banks';
      input.businessModel = 'Asset-Heavy';

      const output = scoreStageD(input);
      expect(output.primaryMethod).toBe('PB');
    });

    it('routes Subscription and Marketplace business models to PEG', () => {
      const input = createHealthyStageDInput(500);
      input.sector = 'Consumer Tech';
      input.businessModel = 'Subscription';

      const output = scoreStageD(input);
      expect(output.primaryMethod).toBe('PEG');
    });

    it('routes Commodity Manufacturing to DCF', () => {
      const input = createHealthyStageDInput(500);
      input.sector = 'Metals';
      input.businessModel = 'Commodity Manufacturing';

      const output = scoreStageD(input);
      expect(output.primaryMethod).toBe('DCF');
    });

    it('falls back to suitable method when preferred method is unsuitable (e.g. negative EPS)', () => {
      const input = createHealthyStageDInput(100);
      input.sector = 'IT Services'; // Preferred is PE
      input.financials.eps.normalised = -10.0; // PE is unsuitable!

      const output = scoreStageD(input);
      // PE is unsuitable, so primary falls back to first suitable method (PB or DCF)
      expect(output.primaryMethod).not.toBe('PE');
      expect(output.methods.find((m) => m.method === output.primaryMethod)?.applicability).toBe('suitable');
    });
  });

  // ==========================================================================
  // 7. Invariants & Valuation Range Tests
  // ==========================================================================
  describe('Invariants & Range', () => {
    it('constructs valuation range with low <= high across suitable methods', () => {
      const input = createHealthyStageDInput(1000);
      const output = scoreStageD(input);

      expect(output.valuationRange.low).toBeGreaterThan(0);
      expect(output.valuationRange.high).toBeGreaterThanOrEqual(output.valuationRange.low);
      expect(output.methods).toHaveLength(4);
    });

    it('produces deterministic output across consecutive invocations', () => {
      const input = createHealthyStageDInput(1000);
      const run1 = scoreStageD(input);
      const run2 = scoreStageD(input);

      expect(run1.maxBuyPrice).toBe(run2.maxBuyPrice);
      expect(run1.marginOfSafetyPct).toBe(run2.marginOfSafetyPct);
      expect(run1.selectedFairValue).toBe(run2.selectedFairValue);
      expect(run1.buyReady).toBe(run2.buyReady);
      expect(run1.gatePassed).toBe(run2.gatePassed);
    });
  });
});
