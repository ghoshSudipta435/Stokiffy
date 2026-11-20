# Portfolio Risk and Exit Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-f-g-v1.0`

---

## 1. Purpose

Stage F translates a validated investment thesis into a **controlled trade plan** with position sizing, risk limits, and portfolio impact analysis. Stage G provides **monitoring, sell decisions, and post-trade review** to manage the position through exit.

**MVP Principle:** No broker integration. Trade plans record intended orders; execution is manual. No automatic sell orders.

---

## 2. Stage F — Buy Plan & Portfolio Risk

### 2.1 Default Risk Parameters (User-Configurable)

| Parameter | Default | Description | User Confirmation |
|-----------|---------|-------------|-------------------|
| Portfolio Risk per Trade | 1% | % of portfolio value risked on single trade | Required |
| Max Single-Stock Exposure | 10% | % of portfolio in one stock (post-trade) | Required |
| Max Sector Exposure | 30% | % of portfolio in one sector (post-trade) | Required |
| Min Risk/Reward | 1.5 | (Target - Entry) / (Entry - Stop) | Required |
| Max Position as % ADV | 5% | Position size ≤ 5% of avg daily volume | Required |

**All parameters editable in Settings; changes apply to new trade plans only.**

### 2.2 Position Sizing Formula

```
Risk Budget = Portfolio Value × Risk Percentage (e.g., 1%)
Risk per Share = Entry Price − Stop Price
Raw Quantity = Risk Budget ÷ Risk per Share
Adjusted Quantity = floor(Raw Quantity / Lot Size) × Lot Size
```

**Adjustments Applied (in order):**
1. **Lot Size:** Round down to nearest lot
2. **Liquidity Cap:** `MaxQty = floor(0.05 × AvgDailyVolume / LotSize) × LotSize`
3. **Cash Available:** `MaxQty = floor(AvailableCash / EntryPrice / LotSize) × LotSize`
4. **Gap Risk Buffer:** Widen stop by 1×ATR if high gap risk; recalculate

**Final Quantity = min(Adjusted Quantity, Liquidity Cap, Cash Cap)**

If Final Quantity = 0 → Trade plan **blocked**.

### 2.3 Trade Plan Data Model

```typescript
// packages/core/src/types/stage-f.ts

export interface PortfolioSnapshot {
  totalValue: number;                    // Current portfolio market value
  cash: number;                          // Available cash
  positions: Position[];                 // Current holdings
  sectorExposure: Record<string, number>; // Sector → market value
  asOfDate: string;
}

export interface Position {
  symbol: string;
  companyId: string;
  quantity: number;
  avgPrice: number;                      // Average buy price
  currentPrice: number;
  marketValue: number;
  sector: string;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

export interface TradePlan {
  id: string;                            // UUID
  companyId: string;
  symbol: string;
  
  // Thesis
  thesis: string;                        // 1-3 sentence investment thesis
  expectedHoldingPeriod: string;         // e.g., "12-24 months"
  entryRationale: string;                // Why now? Valuation + technical
  
  // Entry & Exit
  entryZone: { low: number; high: number };
  stopLoss: number;                      // Initial stop (invalidation)
  targets: number[];                     // Target 1, 2, 3...
  
  // Sizing
  positionSize: number;                  // Quantity (shares)
  entryPriceEst: number;                 // Mid-point of entry zone
  riskBudget: number;                    // Currency amount
  plannedLossAtStop: number;             // positionSize × (entryPriceEst - stopLoss)
  
  // Portfolio Impact
  portfolioExposurePct: number;          // Post-trade % of portfolio
  sectorExposurePct: number;             // Post-trade % of portfolio
  cashRemaining: number;                 // Post-trade
  
  // Risk Checks
  riskChecks: RiskCheckResult[];
  blocked: boolean;                      // Any check failed without override
  
  // Overrides
  overrides: OverrideRecord[];
  
  // Metadata
  status: 'draft' | 'ready' | 'executed' | 'cancelled' | 'expired';
  ruleSetVersion: string;
  valuationMaxBuyPrice: number;          // From Stage D
  technicalSetupId: string;              // From Stage E
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RiskCheckResult {
  check: 'risk_budget' | 'stock_concentration' | 'sector_concentration' | 'liquidity' | 'cash' | 'risk_reward' | 'stop_below_entry';
  passed: boolean;
  actualValue: number;
  limit: number;
  message: string;
}

export interface OverrideRecord {
  flagId: string;                        // e.g., STAGE_F_STOCK_CONCENTRATION
  reason: string;                        // Mandatory, min 50 chars
  overriddenBy: string;
  overriddenAt: string;
  beforeState: { portfolioExposurePct: number; sectorExposurePct: number };
  afterState: { portfolioExposurePct: number; sectorExposurePct: number };
}
```

### 2.4 Risk Checks (All Must Pass for `ready` Status)

| Check | Formula | Pass Condition | Block Type |
|-------|---------|----------------|------------|
| **Risk Budget** | `plannedLossAtStop ≤ portfolioValue × riskPct` | `passed` | HARD_STOP |
| **Stock Concentration** | `(existingValue + newValue) / portfolioValue ≤ maxStockPct` | `passed` | HARD_STOP |
| **Sector Concentration** | `(existingSectorValue + newValue) / portfolioValue ≤ maxSectorPct` | `passed` | HARD_STOP |
| **Liquidity** | `positionSize ≤ 0.05 × avgDailyVolume` | `passed` | CONDITIONAL_WARNING |
| **Cash** | `positionSize × entryPriceEst ≤ availableCash` | `passed` | HARD_STOP |
| **Risk/Reward** | `(target1 - entryPriceEst) / (entryPriceEst - stopLoss) ≥ minRR` | `passed` | HARD_STOP |
| **Stop Below Entry** | `stopLoss < entryPriceEst` | `passed` | HARD_STOP |

**If any HARD_STOP check fails → `blocked: true` → status cannot be `ready` without override.**

### 2.5 Trade Plan Lifecycle

```
DRAFT → (user edits) → READY → (user confirms execution) → EXECUTED
  ↓                                    ↓
CANCELLED                          EXPIRED (if not executed in 30 days)
```

- **Draft:** User can edit all fields
- **Ready:** All risk checks pass (or overridden); user can execute
- **Executed:** User records actual fill price/quantity; creates Position + JournalEntry
- **Cancelled:** User aborts; reason recorded
- **Expired:** Auto-transition after 30 days (configurable); reason: "Not executed"

### 2.6 Disclaimer

> **Stop-loss is not a guarantee.** Gaps, illiquidity, and market closures can cause execution beyond the stop price. The system shows planned loss at stop; actual loss may differ.

---

## 3. Stage G — Monitoring, Sell Decisions & Review

### 3.1 Monitoring Triggers

| Category | Triggers | Alert Type |
|----------|----------|------------|
| **Price** | Reaches entry zone | `price-entry-zone` |
| | Reaches target 1/2/3 | `price-target` |
| | Reaches stop/invalidation | `price-stop` |
| | Reaches fair value | `price-fair-value` |
| | Exceeds fair value × threshold | `price-overvalued` |
| **Fundamental** | New quarterly results | `fundamental-results` |
| | Sales/profit/OPM deterioration | `fundamental-deterioration` |
| | ROCE falling, cash conversion weak | `fundamental-deterioration` |
| | Debtor days rising > threshold | `fundamental-deterioration` |
| | Debt increase > threshold | `fundamental-deterioration` |
| | Governance/shareholding flags | `fundamental-governance` |
| **Thesis** | Key moat assumption broken | `thesis-broken` |
| | Major customer lost | `thesis-risk` |
| | Regulation change | `thesis-risk` |
| | Product economics deteriorate | `thesis-risk` |
| | Management credibility weakens | `thesis-risk` |
| **Portfolio** | Stock concentration breach | `portfolio-concentration` |
| | Sector concentration breach | `portfolio-concentration` |
| | Correlated exposure spike | `portfolio-correlation` |
| | Cash buffer low | `portfolio-drawdown` |
| | Portfolio drawdown > limit | `portfolio-drawdown` |

### 3.2 Alert Data Model

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
  triggeredAt: string;              // ISO 8601
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  data: Record<string, unknown>;    // Trigger values, thresholds, context
  relatedTradePlanId?: string;
}
```

### 3.3 Sell/Trim Decision Framework (Proposed Defaults)

| Trigger | Severity | Suggested Workflow |
|---------|----------|-------------------|
| **Original thesis invalidated** | Critical | Prompt immediate review; show broken assumption; require explicit hold/exit decision |
| **Hard fundamental red flag appears** | Critical | High-priority review; do not auto-sell; show flag details |
| **Stop/invalidation price reached** | Critical | Show risk-plan breach; user-configured action (sell/trim/hold); execution manual |
| **Price reaches fair value / target** | Warning | Review expected return, updated fundamentals, valuation; consider trim/hold |
| **Price materially exceeds fair value** | Warning | Flag overvaluation; show updated MOS + scenarios; no forced sale |
| **No thesis progress / opportunity cost** | Info | Scheduled review prompt; no arbitrary time-based selling |

**No automatic sell orders in MVP.** Every decision requires explicit user action.

### 3.4 Sell Decision Data Model

```typescript
export interface SellDecision {
  id: string;
  companyId: string;
  tradePlanId: string;
  trigger: AlertType;
  decision: 'sell' | 'trim' | 'hold';
  reason: string;                      // Mandatory
  quantity?: number;                   // For trim: shares to sell
  price?: number;                      // Limit price (optional)
  decidedAt: string;
  decidedBy: string;
  originalThesisSnapshot: string;      // Copy of thesis at buy time
  portfolioSnapshot: PortfolioSnapshot; // Context at decision
}
```

### 3.5 Trade Journal

```typescript
export interface JournalEntry {
  id: string;
  tradePlanId: string;
  date: string;                        // Execution date
  action: 'buy' | 'trim' | 'sell';
  quantity: number;
  price: number;                       // Executed price
  fees: number;                        // Brokerage, STT, stamp duty, etc.
  taxes: number;                       // STT, capital gains if applicable
  reason: string;                      // Linked to alert/decision
  ruleTriggers: string[];              // e.g., ["STAGE_G_STOP_HIT", "STAGE_G_THESIS_INVALIDATED"]
  portfolioContext: PortfolioSnapshot; // Snapshot at execution
  realisedPnl?: number;                // For trim/sell
  unrealisedPnl?: number;              // For buy/trim (remaining)
  returnPct?: number;                  // TWR for portfolio, MWR for trade
  corporateActions: CorporateAction[];
  review?: PostTradeReview;            // Added after position closed
}

export interface CorporateAction {
  type: 'dividend' | 'split' | 'bonus' | 'rights' | 'buyback';
  date: string;
  ratio?: string;                      // e.g., "1:1" for bonus
  amount?: number;                     // Dividend per share
}

export interface PostTradeReview {
  rulesWorked: string[];               // Which rules/assumptions validated
  assumptionsFailed: string[];         // Which assumptions proved wrong
  executionQuality: 'good' | 'fair' | 'poor';
  slippage: number;                    // Executed vs planned price
  behaviouralNotes: string;            // Emotional/psychological factors
  lesson: string;                      // Key takeaway
  reviewedAt: string;
  reviewedBy: string;
}
```

### 3.6 Return Calculation Methods

| Method | Use Case | Formula |
|--------|----------|---------|
| **Time-Weighted Return (TWR)** | Portfolio performance | Chain sub-period returns: `(1+r1)×(1+r2)×... - 1` |
| **Money-Weighted Return (MWR / IRR)** | Individual trade performance | IRR of cash flows (buys, sells, dividends) |

**Decision Required:** Which method for what?
- **Recommendation:** TWR for portfolio-level reporting; MWR for individual trade journal

### 3.7 Immutability Rule

> **Original decision snapshots are preserved.** No hindsight edits to historical rationale. Post-trade review is additive — it links to the original trade plan and journal entry but cannot modify them.

---

## 4. Portfolio Health Dashboard (Stage G Output)

```typescript
export interface StageGOutput {
  stage: 'G';
  activeAlerts: Alert[];
  pendingReviews: SellDecision[];      // Awaiting user decision
  journalEntries: JournalEntry[];
  portfolioHealth: {
    concentrationOk: boolean;          // No stock > 10%, sector > 30%
    drawdownOk: boolean;               // Portfolio drawdown < limit
    cashBufferOk: boolean;             // Cash > minimum buffer
    correlationRisk: 'low' | 'medium' | 'high';
  };
  openPositions: PositionWithThesis[];
  calculatedAt: string;
}

export interface PositionWithThesis extends Position {
  thesis: string;
  stopLoss: number;
  targets: number[];
  entryDate: string;
  daysHeld: number;
  unrealisedReturnPct: number;
  alertCount: number;
}
```

---

## 5. Missing Data Behaviour

| Scenario | Handling |
|----------|----------|
| Portfolio snapshot missing | Stage F blocked; DATA_QUALITY_WARNING |
| Price feed stale > 1 day | Alerts may be delayed; DATA_QUALITY_WARNING |
| Corporate action data missing | Journal entry incomplete; flag |
| Tax/fee calculation unavailable | Use estimates; flag `estimated_fees` |
| Benchmark for RS missing | Relative strength unavailable; flag |

---

## 6. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Stop hit but price recovers same day | Alert triggered; user decides (sell/trim/hold) |
| Multiple alerts same day | All shown; user can batch-decide |
| Trim decision: partial quantity | Journal records trim; position updated; remaining shares keep original thesis |
| Corporate action (split/bonus) | Quantity/price adjusted; journal records action; cost basis updated |
| Dividend received | Journal records dividend; realised P&L includes dividend |
| Portfolio drawdown limit hit | All new trade plans blocked; existing positions flagged for review |
| Sector reclassification | Sector exposure recalculated; alerts if breach |
| User changes risk parameters mid-trade | Applies to new plans only; existing plans unchanged |

---

## 7. Configuration

```yaml
# config/stage-f-g-v1.0.yaml
stageF:
  version: "1.0"
  defaults:
    riskPerTradePct: 0.01        # 1%
    maxStockExposurePct: 0.10    # 10%
    maxSectorExposurePct: 0.30   # 30%
    minRiskReward: 1.5
    maxPositionPctOfADV: 0.05    # 5%
    tradePlanExpiryDays: 30
  lotSizes:
    # Exchange-specific; loaded from master data
  gapRisk:
    atrMultiplier: 1.0           # Widen stop by 1×ATR if high gap risk
  
stageG:
  version: "1.0"
  alerts:
    priceOvervaluedThreshold: 1.20  # Price > 120% of fair value
    concentrationCheckFrequency: "daily"
    drawdownLimitPct: 0.15          # 15% portfolio drawdown limit
    cashBufferMinPct: 0.05          # 5% minimum cash
  sellFramework:
    thesisInvalidated: "immediate_review"
    hardFundamentalFlag: "high_priority_review"
    stopHit: "user_configured_action"
    fairValueReached: "review_trim_hold"
    overvalued: "flag_and_scenario"
    noProgress: "scheduled_review"
  returns:
    portfolioMethod: "TWR"
    tradeMethod: "MWR"
  journal:
    requirePostTradeReview: true
    reviewDeadlineDays: 30
```

---

## 8. Test Scenarios

### Stage F Tests

| Test ID | Scenario | Expected |
|---------|----------|----------|
| F-01 | Portfolio 1Cr, risk 1%, entry 100, stop 95 → Qty 2000 | Ready; riskBudget=1L; loss=1L |
| F-02 | Same, stock already 9% → new 11% | Blocked; STOCK_CONCENTRATION |
| F-03 | Same, sector already 28% → new 32% | Blocked; SECTOR_CONCENTRATION |
| F-04 | Stop = entry (95) | Blocked; STOP_BELOW_ENTRY failed |
| F-05 | Risk/reward = 1.2 (< 1.5) | Blocked; RISK_REWARD failed |
| F-06 | Cash 50k, trade needs 2L | Blocked; CASH failed |
| F-07 | Illiquid: ADV 10k, qty 2000 = 20% ADV | Conditional; LIQUIDITY warning |
| F-08 | Override stock concentration with reason | Ready with override record |
| F-09 | Override reason < 50 chars | Rejected |
| F-10 | Trade plan expires after 30 days | Status → EXPIRED |

### Stage G Tests

| Test ID | Scenario | Expected |
|---------|----------|----------|
| G-01 | Stop hit → user sells | Journal: sell; position closed; review prompted |
| G-02 | Thesis broken → user holds | Alert acknowledged; position kept; review logged |
| G-03 | Fair value reached → user trims 50% | Journal: trim; position halved; remaining keeps thesis |
| G-04 | Overvalued 30% → user holds | Valuation warning; review scheduled |
| G-05 | Portfolio drawdown 16% (>15%) | All new plans blocked; existing flagged |
| G-06 | Split 1:1 → qty doubles, price halves | Position updated; journal records split |
| G-07 | Dividend received | Journal: dividend; realised P&L includes it |
| G-08 | Post-trade review completed | Review attached to journal; immutable |

---

## 9. Decisions Requiring Approval

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Default risk per trade | 1% vs 2% vs configurable | 1% default |
| 2 | Max stock exposure | 10% vs 15% vs configurable | 10% default |
| 3 | Max sector exposure | 30% vs 25% vs configurable | 30% default |
| 4 | Min risk/reward | 1.5 vs 2.0 vs configurable | 1.5 default |
| 5 | Liquidity cap % of ADV | 5% vs 10% vs configurable | 5% default |
| 6 | Return method: portfolio | TWR vs MWR | TWR |
| 7 | Return method: trade | MWR vs TWR | MWR |
| 8 | Trade plan expiry | 30 days vs 60 vs configurable | 30 days |
| 9 | Drawdown limit | 15% vs 20% vs configurable | 15% |
| 10 | Cash buffer minimum | 5% vs 10% vs configurable | 5% |
| 11 | Post-trade review mandatory? | Yes vs optional | Yes |
| 12 | Stop-loss guarantee disclaimer | Prominent vs standard | Prominent on every trade plan |

---

*End of Portfolio Risk and Exit Specification*