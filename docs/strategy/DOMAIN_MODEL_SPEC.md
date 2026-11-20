# Domain Model Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `domain-model-v1.0`

---

## 1. Purpose

Define the **pure TypeScript domain interfaces** and **calculation boundaries** for the investment engine. All scoring, valuation, risk, and workflow logic lives in `packages/core` with **zero dependencies** on React, Next.js, database, or external AI.

---

## 2. Architectural Principles

| Principle | Implementation |
|-----------|----------------|
| **Pure Functions** | Scoring rules are pure: `Input → Output` with no side effects |
| **Determinism** | Same inputs + same ruleSetVersion = identical outputs |
| **No Framework Deps** | `packages/core` imports only `decimal.js`/`big.js` and internal types |
| **Configuration-Driven** | Thresholds, weights, benchmarks in YAML/JSON, not code |
| **Versioned Rule Sets** | Every calculation carries `ruleSetVersion` for reproducibility |
| **Data Provenance** | Every input carries source, timestamp, quality metadata |
| **Immutable Results** | Calculation outputs are frozen; overrides create new records |

---

## 3. Core Type Definitions

### 3.1 Base Types

```typescript
// packages/core/src/types/base.ts

export type ISODateString = string;           // ISO 8601
export type Currency = 'INR';
export type Unit = 'CRORE' | 'LAKH' | 'MILLION' | 'RAW' | 'PERCENTAGE' | 'RATIO';
export type AdjustmentStatus = 'reported' | 'restated' | 'estimated' | 'manual';
export type DataQuality = 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
export type EvidenceTag = 'verified-fact' | 'company-claim' | 'analyst-estimate' | 'inference' | 'news-report' | 'user-input';
export type Sector = 'non-financial' | 'bank' | 'nbfc' | 'insurance' | 'other-financial';

export interface DataProvenance {
  source: string;                              // e.g., 'manual-csv', 'screener-in', 'bse', 'nse', 'provider-x'
  fetchedAt: ISODateString;
  reportedPeriod: string;                      // e.g., 'FY2024', 'FY2024-Q3'
  currency: Currency;
  unit: Unit;
  adjustmentStatus: AdjustmentStatus;
  quality: DataQuality;
  isMissing: boolean;
  sourceDocumentRef?: string;                  // Filing URL, PDF page, etc.
}

export interface RedFlag {
  id: string;                                  // UUID v4
  flagKey: string;                             // e.g., "STAGE_A_ROE_BELOW_10"
  class: 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  ruleKey?: string;
  message: string;
  threshold: string;
  actualValue: unknown;
  expectedValue?: unknown;
  source: 'handwritten-notes' | 'blueprint' | 'engineering-default' | 'user-configured';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'RESOLVED' | 'EXPIRED';
  createdAt: ISODateString;
  acknowledgedAt?: ISODateString;
  acknowledgedBy?: string;
  acknowledgedReason?: string;
  overriddenAt?: ISODateString;
  overriddenBy?: string;
  overrideReason?: string;
  resolvedAt?: ISODateString;
  resolutionReason?: string;
  originalFlagId?: string;
  isOverride: boolean;
  companyId: string;
  analysisRunId: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
```

### 3.2 Scoring Rule Result (Universal Contract)

```typescript
// packages/core/src/types/scoring.ts

export interface ScoringRuleResult {
  ruleKey: string;                              // e.g., "STAGE_A_SALES_GROWTH"
  points: number;                               // Awarded (0 to maxPoints)
  maxPoints: number;                            // Maximum possible
  inputs: Record<string, unknown>;              // Raw values used
  explanation: string;                          // Human-readable rationale
  redFlags: RedFlag[];                          // Flags triggered by this rule
  dataQuality: DataProvenance;                  // Provenance for this rule's inputs
  ruleSetVersion: string;                       // e.g., "stage-a-v1.0"
}

export interface StageScore {
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  totalPoints: number;
  maxPoints: number;
  ruleResults: ScoringRuleResult[];
  verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  hardStops: RedFlag[];
  conditionalWarnings: RedFlag[];
  dataQualityWarnings: RedFlag[];
  valuationWarnings: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
  dataSnapshotId: string;                       // Links to stored input snapshot
}
```

---

## 4. Stage-Specific Domain Models

### 4.1 Stage A — Quick Screening

```typescript
// packages/core/src/types/stage-a.ts

export interface StageAFinancials {
  sales: { latestFy: number; priorFy: number; fy5yAgo: number; cagr5y: number };
  profit: { latestFy: number; priorFy: number; fy5yAgo: number; cagr5y: number };
  operatingProfit: { latestFy: number; fy5yAgo: number };
  revenue: { latestFy: number; fy5yAgo: number };
  netProfit: { latestFy: number; fy5yAgo: number };
  totalDebt: number;
  totalEquity: number;
  currentAssets: number;
  currentLiabilities: number;
  interestExpense: number;
  ebit: number;
  eps: number;
  peRatio: number;
  industryPeRatio: number;
  roa: { latestFy: number; avg5y: number };
  industryRoaMin?: number;
  roe: { latestFy: number; avg5y: number };
  roce: { latestFy: number; avg5y: number };
  opm: { latestFy: number; avg5y: number };
  industryOpmMin?: number;
}

export interface StageAInput {
  companyId: string;
  asOfDate: ISODateString;
  financials: StageAFinancials;
  sector: Sector;
  dataProvenance: Record<keyof StageAFinancials, DataProvenance>;
}

export interface StageAOutput extends StageScore {
  stage: 'A';
  sector: Sector;
  maxPossibleScore: number;                     // 10 or 9
  minPassScore: number;                         // 6.5 or 5.5
  bankVariant: boolean;                         // True if bank/NBFC legacy scoring
  unsuitableRules?: string[];                   // e.g., ["debtToEquity", "currentRatio", "interestCoverage"]
}
```

### 4.2 Stage B — Deep Trend Analysis

```typescript
// packages/core/src/types/stage-b.ts

export interface QuarterlyPoint {
  period: string;                               // 'FY2024-Q3'
  salesYoY: number;                             // Percentage
  opmYoY: number;                               // Percentage points
  dataQuality: DataProvenance;
}

export interface AnnualPoint {
  period: string;                               // 'FY2024'
  sales: number;                                // INR Crore
  opm: number;                                  // Percentage
  netProfit: number;
  netMargin: number;
  reserves: number;
  borrowings: number;
  cfo: number;
  pat: number;
  debtorDays: number;
  roce: number;
  dataQuality: DataProvenance;
}

export interface ShareholdingPoint {
  period: string;
  promoterPct: number;
  fiiPct: number;
  diiPct: number;
  publicPct: number;
  promoterPledgePct?: number;
  dataQuality: DataProvenance;
}

export type TrendClassification = 
  | 'consistently_rising' 
  | 'rising_with_fluctuations' 
  | 'mostly_constant_occasional_rise'
  | 'constant'
  | 'mostly_constant_few_declines'
  | 'consistently_falling'
  | 'up_with_flat_periods'
  | 'up_with_dip'
  | 'flat'
  | 'declining'
  | 'maintained_high'
  | 'rising_fluctuating';

export interface StageBInput {
  companyId: string;
  asOfDate: ISODateString;
  quarterly: QuarterlyPoint[];                  // Min 8
  annual: AnnualPoint[];                        // Min 5
  shareholding: ShareholdingPoint[];            // Min 8
  dataProvenance: DataProvenance;
}

export interface StageBRuleResult extends ScoringRuleResult {
  trendClassification?: TrendClassification;
  supportingData?: {
    periodCount: number;
    positivePeriods: number;
    negativePeriods: number;
    flatPeriods: number;
  };
}

export interface StageBOutput extends StageScore {
  stage: 'B';
  ruleResults: StageBRuleResult[];
  quarterlyAnalysis: {
    salesTrend: TrendClassification;
    opmTrend: TrendClassification;
  };
  annualAnalysis: {
    sales5yTrend: TrendClassification;
    opm5yTrend: TrendClassification;
    netProfitTrend: TrendClassification;
    reservesBorrowingsTrend: TrendClassification;
    cfoTrend: TrendClassification;
    debtorDaysTrend: TrendClassification;
    roceTrend: TrendClassification;
  };
  shareholdingAnalysis: {
    latestPattern: { promoter: 'up'|'down'|'flat'; fiiDii: 'up'|'down'|'flat'; public: 'up'|'down'|'flat' };
    score: number;
    hardFlags: string[];
  };
  forensicFlags: string[];                      // e.g., 'CFO_PAT_DIVERGENCE'
}
```

### 4.3 Stage C — Business Model & Moat

```typescript
// packages/core/src/types/stage-c.ts

export interface EvidenceItem {
  id: string;
  description: string;
  source: string;
  sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
  date: ISODateString;
  tags: EvidenceTag[];
  relevance: 'direct' | 'supporting' | 'contextual';
}

export interface BusinessModelAnswer {
  questionId: 'value-creation' | 'value-capture' | 'scalability';
  answer: string;
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  tags: EvidenceTag[];
  completedAt: ISODateString;
  completedBy: string;
}

export interface MoatTestResult {
  testId: 1 | 2 | 3 | 4 | 5;
  question: string;
  answer: 'yes' | 'no' | 'uncertain';
  passes: boolean;                              // Test 1: passes = (answer === 'no')
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  completedAt: ISODateString;
  completedBy: string;
}

export interface StageCInput {
  companyId: string;
  asOfDate: ISODateString;
  businessModel: BusinessModelAnswer[];         // 3 questions
  moatTests: MoatTestResult[];                  // 5 tests
  dataProvenance: DataProvenance;
}

export interface StageCOutput {
  stage: 'C';
  moatScore: number;                            // 0-5
  moatPass: boolean;                            // score >= 3 AND test1.passes
  businessModelComplete: boolean;               // All 3 questions answered with evidence
  tests: MoatTestResult[];
  overallConfidence: 'high' | 'medium' | 'low';
  flags: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
```

### 4.4 Stage D — Valuation

```typescript
// packages/core/src/types/stage-d.ts

export type ValuationMethod = 'PE' | 'PEG' | 'PB' | 'DCF';
export type Applicability = 'suitable' | 'limited' | 'unsuitable';
export type Confidence = 'high' | 'medium' | 'low';

export interface ValuationMethodResult {
  method: ValuationMethod;
  fairValue: number;                            // Per share
  assumptions: Record<string, unknown>;         // All inputs used
  applicability: Applicability;
  confidence: Confidence;
  explanation: string;
  asOfDate: ISODateString;
  scenarios?: { bear: number; base: number; bull: number };
  sensitivity?: Record<string, number[]>;       // For DCF
  flags: RedFlag[];
}

export interface StageDInput {
  companyId: string;
  asOfDate: ISODateString;
  marketPrice: number;
  financials: {
    eps: { reported: number; normalised?: number; forecast?: number };
    bookValuePerShare: number;
    fcf: number[];                              // Historical FCF series
    netDebt: number;
    sharesOutstanding: number;
    industryPeRatio: number;
    growthRate?: { historical: number; forward?: number };
    dcfInputs?: {
      horizon: number;
      revenueGrowth: number[];
      operatingMargin: number[];
      taxRate: number;
      reinvestmentRate: number;
      wacc: number;
      terminalGrowth: number;
    };
  };
  sector: string;
  businessModel: string;
  dataProvenance: DataProvenance;
}

export interface StageDOutput {
  stage: 'D';
  methods: ValuationMethodResult[];
  primaryMethod: ValuationMethod;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number;                          // Primary fairValue × 0.80
  marginOfSafetyPct: number;
  buyReady: boolean;                            // MOS ≥ 20% AND confidence ≠ low AND no valuationWarnings
  valuationWarnings: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
```

### 4.5 Stage E — Technical Analysis

```typescript
// packages/core/src/types/stage-e.ts

export type PatternName = 
  | 'bullish-engulfing' | 'hammer' | 'inverted-hammer' 
  | 'morning-star' | 'dragonfly-doji' | 'three-white-soldiers'
  | 'bearish-engulfing' | 'evening-star' | 'shooting-star';

export interface OhlcvBar {
  date: ISODateString;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted: boolean;
}

export interface CandlestickPattern {
  name: PatternName;
  detectedAt: ISODateString;
  timeframe: 'daily' | 'weekly';
  candles: OhlcvBar[];
  confirmation: boolean;
  confirmationCandle?: OhlcvBar;
  context: PatternContext;
  qualityScore: number;                         // 0-1
}

export interface PatternContext {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  trendDuration: number;
  supportLevel?: number;
  resistanceLevel?: number;
  distanceToSupportPct?: number;
  distanceToResistancePct?: number;
  volumeSpike: boolean;
  volumeTrend: 'increasing' | 'decreasing' | 'flat';
  nearMovingAverage?: '20' | '50' | '200';
  maTrend: 'rising' | 'falling' | 'flat';
  atr: number;
  gapRisk: 'low' | 'medium' | 'high';
}

export interface TechnicalSetup {
  pattern: CandlestickPattern;
  entryZone: { low: number; high: number };
  invalidationLevel: number;
  stopLoss: number;
  targets: number[];
  riskReward: number;
  inBuyZone: boolean;
  contextScore: number;
}

export interface StageEInput {
  companyId: string;
  asOfDate: ISODateString;
  adjustedOhlcvDaily: OhlcvBar[];               // Min 200
  adjustedOhlcvWeekly: OhlcvBar[];              // Min 100
  valuationMaxBuyPrice: number;
  dataProvenance: DataProvenance;
}

export interface StageEOutput {
  stage: 'E';
  setups: TechnicalSetup[];
  eligible: boolean;
  bestSetup?: TechnicalSetup;
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
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
```

### 4.6 Stage F — Trade Plan

```typescript
// packages/core/src/types/stage-f.ts

export interface PortfolioSnapshot {
  totalValue: number;
  cash: number;
  positions: Position[];
  sectorExposure: Record<string, number>;
  asOfDate: ISODateString;
}

export interface Position {
  symbol: string;
  companyId: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  sector: string;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

export type RiskCheckType = 
  | 'risk_budget' | 'stock_concentration' | 'sector_concentration' 
  | 'liquidity' | 'cash' | 'risk_reward' | 'stop_below_entry';

export interface RiskCheckResult {
  check: RiskCheckType;
  passed: boolean;
  actualValue: number;
  limit: number;
  message: string;
}

export interface OverrideRecord {
  flagId: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: ISODateString;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}

export type TradePlanStatus = 'draft' | 'ready' | 'executed' | 'cancelled' | 'expired';

export interface TradePlan {
  id: string;
  companyId: string;
  symbol: string;
  thesis: string;
  expectedHoldingPeriod: string;
  entryRationale: string;
  entryZone: { low: number; high: number };
  stopLoss: number;
  targets: number[];
  positionSize: number;
  entryPriceEst: number;
  riskBudget: number;
  plannedLossAtStop: number;
  portfolioExposurePct: number;
  sectorExposurePct: number;
  cashRemaining: number;
  riskChecks: RiskCheckResult[];
  blocked: boolean;
  overrides: OverrideRecord[];
  status: TradePlanStatus;
  ruleSetVersion: string;
  valuationMaxBuyPrice: number;
  technicalSetupId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: string;
  executedAt?: ISODateString;
  executedPrice?: number;
  executedQuantity?: number;
}

export interface StageFInput {
  companyId: string;
  tradePlanDraft: Partial<TradePlan>;
  portfolio: PortfolioSnapshot;
  riskConfig: {
    riskPerTradePct: number;
    maxStockExposurePct: number;
    maxSectorExposurePct: number;
    minRiskReward: number;
    maxPositionPctOfADV: number;
  };
  valuationMaxBuyPrice: number;
  technicalSetup: TechnicalSetup;
}

export interface StageFOutput {
  stage: 'F';
  tradePlan: TradePlan;
  riskChecks: RiskCheckResult[];
  blocked: boolean;
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
```

### 4.7 Stage G — Monitoring & Exit

```typescript
// packages/core/src/types/stage-g.ts

export type AlertType = 
  | 'price-entry-zone' | 'price-target' | 'price-stop' | 'price-fair-value' | 'price-overvalued'
  | 'fundamental-results' | 'fundamental-deterioration' | 'fundamental-governance'
  | 'thesis-broken' | 'thesis-risk'
  | 'portfolio-concentration' | 'portfolio-drawdown' | 'portfolio-correlation';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  companyId?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: ISODateString;
  acknowledgedAt?: ISODateString;
  acknowledgedBy?: string;
  data: Record<string, unknown>;
  relatedTradePlanId?: string;
}

export interface SellDecision {
  id: string;
  companyId: string;
  tradePlanId: string;
  trigger: AlertType;
  decision: 'sell' | 'trim' | 'hold';
  reason: string;
  quantity?: number;
  price?: number;
  decidedAt: ISODateString;
  decidedBy: string;
  originalThesisSnapshot: string;
  portfolioSnapshot: PortfolioSnapshot;
}

export type TradeAction = 'buy' | 'trim' | 'sell';

export interface CorporateAction {
  type: 'dividend' | 'split' | 'bonus' | 'rights' | 'buyback';
  date: ISODateString;
  ratio?: string;
  amount?: number;
}

export interface PostTradeReview {
  rulesWorked: string[];
  assumptionsFailed: string[];
  executionQuality: 'good' | 'fair' | 'poor';
  slippage: number;
  behaviouralNotes: string;
  lesson: string;
  reviewedAt: ISODateString;
  reviewedBy: string;
}

export interface JournalEntry {
  id: string;
  tradePlanId: string;
  date: ISODateString;
  action: TradeAction;
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  reason: string;
  ruleTriggers: string[];
  portfolioContext: PortfolioSnapshot;
  realisedPnl?: number;
  unrealisedPnl?: number;
  returnPct?: number;
  corporateActions: CorporateAction[];
  review?: PostTradeReview;
}

export interface PositionWithThesis extends Position {
  thesis: string;
  stopLoss: number;
  targets: number[];
  entryDate: ISODateString;
  daysHeld: number;
  unrealisedReturnPct: number;
  alertCount: number;
}

export interface StageGInput {
  portfolio: PortfolioSnapshot;
  alerts: Alert[];
  openPositions: PositionWithThesis[];
  tradeHistory: JournalEntry[];
}

export interface StageGOutput {
  stage: 'G';
  activeAlerts: Alert[];
  pendingReviews: SellDecision[];
  journalEntries: JournalEntry[];
  portfolioHealth: {
    concentrationOk: boolean;
    drawdownOk: boolean;
    cashBufferOk: boolean;
    correlationRisk: 'low' | 'medium' | 'high';
  };
  calculatedAt: ISODateString;
}
```

---

## 5. Engine Interfaces (Pure Functions)

```typescript
// packages/core/src/engine/interfaces.ts

export interface ScoringEngine {
  // Stage A
  scoreStageA(input: StageAInput): StageAOutput;
  
  // Stage B
  scoreStageB(input: StageBInput): StageBOutput;
  
  // Stage C
  assessStageC(input: StageCInput): StageCOutput;
  
  // Stage D
  valueStageD(input: StageDInput): StageDOutput;
  
  // Stage E
  analyzeStageE(input: StageEInput): StageEOutput;
  
  // Stage F
  planStageF(input: StageFInput): StageFOutput;
  
  // Stage G
  monitorStageG(input: StageGInput): StageGOutput;
}

export interface FlagEngine {
  evaluateStageGate(
    stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    flags: RedFlag[],
    overrides: OverrideRecord[]
  ): StageGateResult;
  
  applyOverride(
    flag: RedFlag,
    request: OverrideRequest
  ): { updatedFlag: RedFlag; overrideRecord: OverrideRecord };
  
  acknowledgeFlag(
    flag: RedFlag,
    request: AcknowledgmentRequest
  ): RedFlag;
}

export interface StageGateResult {
  canProceed: boolean;
  blockedBy: RedFlag[];
  requiresAcknowledgment: RedFlag[];
  overrides: OverrideRecord[];
}

export interface OverrideRequest {
  flagId: string;
  userId: string;
  reason: string;
  decision: 'acknowledge' | 'override';
}

export interface AcknowledgmentRequest {
  flagId: string;
  userId: string;
  reason: string;
}
```

---

## 6. Calculation Boundaries

| Package | Responsibility | Dependencies |
|---------|----------------|--------------|
| `packages/core/src/stage-a` | Stage A scoring rules | `decimal.js`, types |
| `packages/core/src/stage-b` | Stage B trend analysis | `decimal.js`, types |
| `packages/core/src/stage-c` | Stage C moat assessment | types |
| `packages/core/src/stage-d` | Stage D valuation methods | `decimal.js`, types |
| `packages/core/src/stage-e` | Stage E pattern detection | `decimal.js`, types |
| `packages/core/src/stage-f` | Stage F position sizing | `decimal.js`, types |
| `packages/core/src/stage-g` | Stage G monitoring | types |
| `packages/core/src/flags` | Red flag engine | types |
| `packages/core/src/config` | Rule set loading/validation | `js-yaml`, `zod` |

**Forbidden in `packages/core`:**
- ❌ `react`, `next`, `prisma`, `@prisma/client`
- ❌ Database queries, HTTP calls, file I/O
- ❌ `Date.now()`, `Math.random()`, external APIs
- ❌ Console logging (use provided logger interface)

**Allowed:**
- ✅ `decimal.js` / `big.js` for financial math
- ✅ Pure TypeScript, standard library
- ✅ Internal types and config

---

## 7. Configuration Schema

```typescript
// packages/core/src/config/schema.ts

export interface RuleSetConfig {
  version: string;
  stageA: StageAConfig;
  stageB: StageBConfig;
  stageC: StageCConfig;
  stageD: StageDConfig;
  stageE: StageEConfig;
  stageF: StageFConfig;
  stageG: StageGConfig;
  redFlags: RedFlagConfig;
  benchmarks: BenchmarkConfig;
}

export interface StageAConfig {
  nonFinancial: { maxScore: number; minPassScore: number; rules: Record<string, RuleConfig> };
  bankNbfcLegacy: { maxScore: number; minPassScore: number; excludedRules: string[]; unsuitableRules: string[] };
}

export interface RuleConfig {
  weight: number;
  subRules?: SubRuleConfig[];
  hardStop?: { condition: string; flagId: string };
  conditionalWarning?: { condition: string; flagId: string };
}

export interface SubRuleConfig {
  key: string;
  condition: string;                    // Expression evaluable by expr-eval or similar
  points: number;
}

export interface BenchmarkConfig {
  industryOpmMin: Record<string, number>;
  industryPe: Record<string, number>;
  industryRoaMin: Record<string, number>;
  pbBands: Record<string, { cheap: number; fair: [number, number]; reasonable?: [number, number]; expensive: number }>;
}
```

---

## 8. Data Snapshot & Reproducibility

```typescript
// packages/core/src/types/snapshot.ts

export interface AnalysisSnapshot {
  id: string;                             // UUID
  companyId: string;
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  input: unknown;                         // Full input object (serialized)
  output: unknown;                        // Full output object (serialized)
  ruleSetVersion: string;
  configHash: string;                     // SHA256 of rule set config
  createdAt: ISODateString;
  createdBy: string;
}

export interface DataSnapshot {
  id: string;
  companyId: string;
  asOfDate: ISODateString;
  financials: Record<string, unknown>;
  marketData: Record<string, unknown>;
  provenance: Record<string, DataProvenance>;
  capturedAt: ISODateString;
}
```

**Reproducibility Guarantee:**
```
Given: AnalysisSnapshot.input + RuleSetConfig (by version)
When: ScoringEngine.scoreStageX(input)
Then: Output === AnalysisSnapshot.output (bitwise identical)
```

---

## 9. Decimal Precision Rules

| Calculation Type | Library | Precision | Rounding |
|------------------|---------|-----------|----------|
| Ratios (P/E, D/E, ROE, etc.) | `decimal.js` | 10 decimal places | Half-up |
| Currency (INR) | `decimal.js` | 2 decimal places (paise) | Half-up |
| Percentages | `decimal.js` | 4 decimal places (basis points) | Half-up |
| Share quantities | `big.js` | Integer (floor) | Floor |
| CAGR | `decimal.js` | 6 decimal places | Half-up |

**Never use native `number` for financial calculations.**

---

## 10. Versioning Strategy

| Artifact | Version Format | Example |
|----------|----------------|---------|
| Rule Set | `stage-{letter}-v{major}.{minor}` | `stage-a-v1.0`, `stage-d-v1.2` |
| Engine Code | SemVer | `1.0.0`, `1.1.0` |
| Config File | Same as rule set | `stage-a-v1.0.yaml` |
| Analysis Run | `run-{stage}-{timestamp}-{uuid}` | `run-A-20261115T103000Z-a1b2c3d4` |

**Backward Compatibility:**
- Minor version: New rules added, existing unchanged → old snapshots reproducible
- Major version: Breaking changes → old snapshots require migration or archival

---

## 11. Test Interface Contracts

```typescript
// packages/core/src/testing/contracts.ts

export interface TestFixture<Input, Output> {
  name: string;
  description: string;
  input: Input;
  expectedOutput: Partial<Output>;      // Key fields to verify
  expectedFlags?: string[];             // Flag keys expected
  ruleSetVersion: string;
  configOverrides?: Partial<RuleSetConfig>;
}

export interface GoldenFixture {
  company: string;                       // e.g., 'TCS', 'HUL'
  source: 'handwritten-notes' | 'blueprint' | 'manual';
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  inputs: Record<string, unknown>;
  expectedScore?: number;
  expectedFlags: string[];
  notes: string;
}
```

**Golden Fixtures Rule:** Only include TCS/HUL if **exact source inputs are available**. Never fabricate expected inputs.

---

*End of Domain Model Specification*