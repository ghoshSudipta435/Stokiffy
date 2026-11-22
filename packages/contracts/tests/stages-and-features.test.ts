/**
 * Comprehensive Zod contract tests for Watchlists, RuleSets, Valuations (Stage D),
 * Trade Plans (Stage F), and Monitoring/Journal (Stage G).
 */

import { describe, it, expect } from 'vitest';
import {
  // Watchlists
  CreateWatchlistRequestSchema,
  UpdateWatchlistRequestSchema,
  AddWatchlistItemRequestSchema,
  UpdateWatchlistItemRequestSchema,
  WatchlistSchema,
  WatchlistComparisonResponseSchema,
  // RuleSets
  IndustryBenchmarkSchema,
  RiskLimitsSchema,
  RuleSetSchema,
  UpsertRuleSetDraftRequestSchema,
  PublishRuleSetRequestSchema,
  UpdateBenchmarksRequestSchema,
  UpdateRiskLimitsRequestSchema,
  // Valuations / Stage D
  StageDFinancialsSchema,
  StageDInputSchema,
  ValuationMethodResultSchema,
  StageDOutputSchema,
  ValuationRequestSchema,
  StageDResponseSchema,
  // Trade Plans / Stage F
  RiskCheckTypeSchema,
  RiskCheckResultSchema,
  OverrideRecordSchema,
  PositionSizingResultSchema,
  TradePlanFullSchema,
  CreateTradePlanRequestSchema,
  UpdateTradePlanRequestSchema,
  TradePlanOverrideRequestSchema,
  StageFInputSchema,
  StageFOutputSchema,
  StageFResponseSchema,
  // Monitoring / Stage G
  AlertTypeSchema,
  AlertSchema,
  AcknowledgeAlertRequestSchema,
  ListAlertsQuerySchema,
  CorporateActionRecordSchema,
  PostTradeReviewSchema,
  JournalEntrySchema,
  CreateJournalEntryRequestSchema,
  AppendJournalReviewRequestSchema,
  SellDecisionSchema,
  StageGInputSchema,
  StageGOutputSchema,
  StageGResponseSchema,
  RedFlagSchema,
} from '../src/index.js';

const mockMeta = {
  requestId: 'req-123',
  timestamp: '2026-11-20T10:00:00Z',
  version: '1.0.0',
};

describe('Watchlists Contracts', () => {
  it('validates a valid CreateWatchlistRequest', () => {
    const valid = {
      name: 'Bluechips 2026',
      description: 'Top Indian large-cap equities',
      color: '#10B981',
      icon: 'star',
    };
    const parsed = CreateWatchlistRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects CreateWatchlistRequest with empty name', () => {
    const invalid = { name: '' };
    const parsed = CreateWatchlistRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates AddWatchlistItemRequest with optional targetPrice and notes', () => {
    const valid = {
      companyId: 'comp-tcs',
      notes: 'Accumulate near support at 3450',
      targetPrice: 3800,
    };
    const parsed = AddWatchlistItemRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates UpdateWatchlistItemRequest with null targetPrice', () => {
    const valid = {
      notes: 'Cleared target',
      targetPrice: null,
    };
    const parsed = UpdateWatchlistItemRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates complete WatchlistSchema with nested items', () => {
    const valid = {
      id: 'wl-123',
      userId: 'user-1',
      name: 'High ROCE Compounders',
      description: 'ROCE > 25%',
      color: '#6366F1',
      icon: 'trending-up',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
      itemCount: 1,
      items: [
        {
          id: 'wli-1',
          watchlistId: 'wl-123',
          companyId: 'comp-1',
          notes: 'Stage A & B passed',
          targetPrice: 3200,
          addedAt: '2026-11-20T10:05:00Z',
          company: {
            id: 'comp-1',
            symbol: 'TCS',
            name: 'Tata Consultancy Services',
            sector: 'non-financial',
            currentPrice: 3450,
          },
        },
      ],
    };
    const parsed = WatchlistSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates WatchlistComparisonResponseSchema across multi-stage metrics', () => {
    const responsePayload = {
      success: true as const,
      meta: mockMeta,
      data: {
        watchlistId: 'wl-123',
        watchlistName: 'Quality Compounders',
        comparedAt: '2026-11-20T12:00:00Z',
        items: [
          {
            companyId: 'comp-1',
            symbol: 'TCS',
            name: 'Tata Consultancy Services',
            sector: 'non-financial',
            currentPrice: 3500,
            peRatio: 26.5,
            pbRatio: 11.2,
            rocePct: 45.2,
            roePct: 38.1,
            operatingMarginPct: 24.8,
            stageAScore: 9.0,
            stageBScore: 8.5,
            stageCScore: 8.0,
            fairValue: 3600,
            maxBuyPrice: 3060,
            technicalSetupQuality: 'A' as const,
            gatePassed: true,
            activeAlertsCount: 0,
            targetPrice: 3800,
          },
        ],
      },
    };
    const parsed = WatchlistComparisonResponseSchema.safeParse(responsePayload);
    expect(parsed.success).toBe(true);
  });
});

describe('Rule Sets & Benchmarks Contracts', () => {
  it('validates IndustryBenchmarkSchema with database and extended fields', () => {
    const valid = {
      industry: 'IT services',
      opmMinPct: 0.22,
      opmMaxPct: 0.28,
      typicalPE: 20,
      minRoaPct: 0.20,
      sourceNote: 'Historical 10Y Indian IT median',
      minOperatingMargin: 0.22,
      maxOperatingMargin: 0.28,
    };
    const parsed = IndustryBenchmarkSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('applies default risk limits in RiskLimitsSchema', () => {
    const parsed = RiskLimitsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.riskBudgetPerTradePct).toBe(1.0);
      expect(parsed.data.maxStockExposurePct).toBe(10.0);
      expect(parsed.data.maxSectorExposurePct).toBe(25.0);
      expect(parsed.data.minRiskReward).toBe(2.0);
      expect(parsed.data.lotSize).toBe(1);
      expect(parsed.data.cashBufferPct).toBe(5.0);
    }
  });

  it('validates RuleSetSchema with status and benchmarks', () => {
    const valid = {
      id: 'rs-1',
      version: 'v1.0.0',
      name: 'Production Core Rules',
      description: 'Standard rules for Indian equities',
      status: 'published' as const,
      rules: {
        stageA: { minRoce: 15, maxDebtToEquity: 1.0 },
      },
      benchmarks: [
        {
          industry: 'Pharma',
          opmMinPct: 0.25,
          opmMaxPct: 0.35,
          typicalPE: 25,
        },
      ],
      publishedAt: '2026-11-20T00:00:00Z',
      publishedBy: 'admin',
      createdAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-20T00:00:00Z',
    };
    const parsed = RuleSetSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates UpsertRuleSetDraftRequestSchema', () => {
    const valid = {
      version: 'v2.0.0-draft',
      name: 'Enhanced Quality Rules',
      description: 'Tightened promoter pledge thresholds',
      rules: { stageA: { maxPledgePct: 5 } },
      riskLimits: { riskBudgetPerTradePct: 0.75 },
    };
    const parsed = UpsertRuleSetDraftRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

describe('Valuations (Stage D) Contracts', () => {
  const mockRedFlag = {
    id: 'rf-1',
    flagKey: 'HIGH_PE',
    stage: 'D' as const,
    message: 'PE ratio exceeds industry historical 90th percentile',
    threshold: 'PE <= 30',
    actualValue: 35.5,
    source: 'blueprint' as const,
    severity: 'medium' as const,
    status: 'ACTIVE' as const,
    class: 'VALUATION_WARNING' as const,
    companyId: 'comp-1',
    ruleSetVersion: 'v1.0.0',
    isOverride: false,
    createdAt: '2026-11-20T10:00:00Z',
  };

  it('validates RedFlagSchema', () => {
    const parsed = RedFlagSchema.safeParse(mockRedFlag);
    expect(parsed.success).toBe(true);
  });

  it('validates StageDFinancialsSchema', () => {
    const financials = {
      eps: { reported: 120, normalised: 115, forecast: 130 },
      bookValuePerShare: 450,
      fcf: [1000, 1200, 1400, 1600, 1800],
      netDebt: -500,
      sharesOutstanding: 10000000,
      industryPeRatio: 25,
      growthRate: { historical: 15.5, forward: 14.0 },
      dcfInputs: {
        horizon: 5,
        wacc: 0.115,
        terminalGrowth: 0.05,
      },
    };
    const parsed = StageDFinancialsSchema.safeParse(financials);
    expect(parsed.success).toBe(true);
  });

  it('validates StageDInputSchema', () => {
    const input = {
      companyId: 'comp-1',
      asOfDate: '2026-11-20T10:00:00Z',
      marketPrice: 3200,
      financials: {
        eps: { reported: 120 },
        bookValuePerShare: 450,
        fcf: [1000],
        netDebt: 0,
        sharesOutstanding: 10000000,
        industryPeRatio: 25,
      },
      sector: 'non-financial',
      businessModel: 'IT Services',
      selectedFairPE: 24,
      marginOfSafety: 0.15,
      primaryMethodOverride: 'PE' as const,
    };
    const parsed = StageDInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('validates StageDOutputSchema and StageDResponseSchema', () => {
    const output = {
      stage: 'D' as const,
      companyId: 'comp-1',
      asOfDate: '2026-11-20T10:00:00Z',
      executedAt: '2026-11-20T10:00:00Z',
      score: 8.5,
      maxScore: 10.0,
      verdict: 'Good',
      methods: [
        {
          method: 'PE' as const,
          fairValue: 3400,
          assumptions: { pe: 24, normalisedEps: 120 },
          applicability: 'suitable' as const,
          confidence: 'high' as const,
          explanation: 'Consistent earnings justify standard P/E multiple.',
          asOfDate: '2026-11-20',
          flags: [],
        },
      ],
      primaryMethod: 'PE' as const,
      selectedFairValue: 3400,
      valuationRange: { low: 3100, high: 3700 },
      maxBuyPrice: 2890,
      marginOfSafetyPct: 15.0,
      buyReady: true,
      gatePassed: true,
      canProceedToStageE: true,
      overallConfidence: 'high' as const,
      valuationWarnings: [],
      flags: [],
      ruleResults: [],
    };
    const parsedOutput = StageDOutputSchema.safeParse(output);
    expect(parsedOutput.success).toBe(true);

    const parsedResponse = StageDResponseSchema.safeParse({
      success: true as const,
      data: output,
      meta: mockMeta,
    });
    expect(parsedResponse.success).toBe(true);
  });
});

describe('Trade Plans (Stage F) Contracts', () => {
  it('validates CreateTradePlanRequestSchema and rejects stopPrice >= entryPrice', () => {
    const valid = {
      companyId: 'comp-1',
      entryPrice: 3200,
      stopPrice: 3000,
      thesis: 'Strong competitive advantage and reasonable valuation margin of safety.',
      invalidationCondition: 'Break of key structural swing low at 2980 on daily close.',
      targets: [3600, 4000],
    };
    expect(CreateTradePlanRequestSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      ...valid,
      stopPrice: 3300, // Invalid: stop >= entry
    };
    const invalidParsed = CreateTradePlanRequestSchema.safeParse(invalid);
    expect(invalidParsed.success).toBe(false);
  });

  it('validates TradePlanOverrideRequestSchema with reason requirement', () => {
    const valid = {
      flagId: 'rf-stop-budget',
      reason: 'Portfolio cash position higher than usual, approved by PM',
      overriddenBy: 'portfolio_manager_1',
    };
    expect(TradePlanOverrideRequestSchema.safeParse(valid).success).toBe(true);

    const invalidShortReason = {
      flagId: 'rf-stop-budget',
      reason: 'ok', // < 10 characters
      overriddenBy: 'pm',
    };
    expect(TradePlanOverrideRequestSchema.safeParse(invalidShortReason).success).toBe(false);
  });

  it('validates StageFOutputSchema and StageFResponseSchema', () => {
    const output = {
      stage: 'F' as const,
      companyId: 'comp-1',
      symbol: 'TCS',
      tradePlan: {
        id: 'tp-1',
        companyId: 'comp-1',
        symbol: 'TCS',
        thesis: 'Robust cash flows and margin expansion narrative.',
        expectedHoldingPeriod: '6-12 months',
        entryRationale: 'Breakout above consolidation with volume',
        entryZone: { low: 3180, high: 3220 },
        stopLoss: 3000,
        targets: [3600, 3900],
        positionSize: 50,
        entryPriceEst: 3200,
        riskBudget: 10000,
        plannedLossAtStop: 10000,
        portfolioExposurePct: 8.0,
        sectorExposurePct: 15.0,
        cashRemaining: 50000,
        riskChecks: [
          {
            check: 'risk_budget' as const,
            passed: true,
            actualValue: 1.0,
            limit: 1.0,
            message: 'Within 1.0% trade risk budget',
          },
        ],
        blocked: false,
        overrides: [],
        status: 'ready' as const,
        ruleSetVersion: 'v1.0.0',
        valuationMaxBuyPrice: 3300,
        technicalSetupId: 'ts-1',
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        createdBy: 'user-1',
      },
      positionSizing: {
        rawQuantity: 50,
        adjustedQuantity: 50,
        positionSize: 50,
        entryPriceEst: 3200,
        riskBudget: 10000,
        riskPerShare: 200,
        plannedPositionValue: 160000,
        plannedLossAtStop: 10000,
        actualRiskPct: 1.0,
        postTradeStockExposurePct: 8.0,
        postTradeSectorExposurePct: 15.0,
        cashRemaining: 50000,
        estimatedFees: 160,
        limitingFactor: 'risk_budget' as const,
      },
      riskChecks: [
        {
          check: 'risk_budget' as const,
          passed: true,
          actualValue: 1.0,
          limit: 1.0,
          message: 'Passed',
        },
      ],
      blocked: false,
      gatePassed: true,
      canProceedToStageG: true,
      canApprovePlan: true,
      disclaimer: 'Execution requires manual verification',
      score: 9.0,
      maxScore: 10.0,
      verdict: 'Exceptional',
      flags: [],
      ruleResults: [],
    };

    expect(StageFOutputSchema.safeParse(output).success).toBe(true);
    expect(
      StageFResponseSchema.safeParse({
        success: true as const,
        data: output,
        meta: mockMeta,
      }).success
    ).toBe(true);
  });
});

describe('Monitoring & Stage G Contracts', () => {
  it('validates AlertSchema across valid alert types', () => {
    const alert = {
      id: 'alt-1',
      companyId: 'comp-1',
      symbol: 'TCS',
      type: 'price-entry-zone' as const,
      severity: 'info' as const,
      message: 'Stock entered entry zone [3180, 3220]',
      triggeredAt: '2026-11-20T10:30:00Z',
      data: { currentPrice: 3205 },
    };
    expect(AlertSchema.safeParse(alert).success).toBe(true);
  });

  it('validates AcknowledgeAlertRequestSchema', () => {
    const valid = {
      alertId: 'alt-1',
      acknowledgedBy: 'trader_1',
      notes: 'Reviewed and confirmed setup',
    };
    expect(AcknowledgeAlertRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('validates CreateJournalEntryRequestSchema with trade action', () => {
    const entry = {
      tradePlanId: 'tp-1',
      symbol: 'TCS',
      companyId: 'comp-1',
      date: '2026-11-20T11:00:00Z',
      action: 'buy' as const,
      quantity: 50,
      price: 3202.5,
      fees: 160,
      taxes: 45,
      reason: 'Stage F execution limit orders filled at average price 3202.5',
    };
    expect(CreateJournalEntryRequestSchema.safeParse(entry).success).toBe(true);
  });

  it('validates AppendJournalReviewRequestSchema for post-trade reviews', () => {
    const reviewPayload = {
      review: {
        rulesWorked: ['Technical support held', 'Margin of safety protected downside'],
        assumptionsFailed: ['Quarterly export growth was lower than modeled'],
        executionQuality: 'good' as const,
        slippage: 2.5,
        behaviouralNotes: 'Did not chase past maximum buy price',
        lesson: 'Factor in seasonal currency fluctuations for IT sector',
        reviewedAt: '2026-11-20T15:00:00Z',
        reviewedBy: 'user-1',
      },
    };
    expect(AppendJournalReviewRequestSchema.safeParse(reviewPayload).success).toBe(true);
  });

  it('validates SellDecisionSchema for exit framework recommendations', () => {
    const decision = {
      id: 'sd-1',
      companyId: 'comp-1',
      symbol: 'TCS',
      tradePlanId: 'tp-1',
      trigger: 'price-target' as const,
      decision: 'trim' as const,
      recommendedAction: 'TRIM_CANDIDATE' as const,
      reason: 'First target reached (3600); take 50% profit off the table',
      quantity: 25,
      price: 3610,
      decidedAt: '2026-11-20T14:00:00Z',
      decidedBy: 'system',
      originalThesisSnapshot: 'Initial thesis intact with target 1 achieved',
    };
    expect(SellDecisionSchema.safeParse(decision).success).toBe(true);
  });

  it('validates StageGOutputSchema and StageGResponseSchema', () => {
    const output = {
      stage: 'G' as const,
      activeAlerts: [],
      pendingReviews: [],
      journalEntries: [],
      portfolioHealth: {
        concentrationOk: true,
        drawdownOk: true,
        cashBufferOk: true,
        correlationRisk: 'low' as const,
        currentDrawdownPct: 2.1,
        cashPct: 15.0,
      },
      openPositions: [],
      calculatedAt: '2026-11-20T16:00:00Z',
      ruleSetVersion: 'v1.0.0',
      score: 9.5,
      maxScore: 10.0,
      verdict: 'Good',
      flags: [],
      ruleResults: [],
    };
    expect(StageGOutputSchema.safeParse(output).success).toBe(true);
    expect(
      StageGResponseSchema.safeParse({
        success: true as const,
        data: output,
        meta: mockMeta,
      }).success
    ).toBe(true);
  });
});
