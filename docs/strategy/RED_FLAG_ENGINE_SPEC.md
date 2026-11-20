# Red Flag Engine Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `red-flag-engine-v1.0`

---

## 1. Purpose

The Red Flag Engine classifies, tracks, and enforces risk signals across all investment stages. It ensures that:
- Hard stops **block** pipeline progression
- Conditional warnings **require explicit review** before progression
- Data quality issues are **never silently passed**
- Overrides create **immutable audit records** without erasing original flags
- Valuation warnings **block BUY-READY** but allow research

---

## 2. Flag Taxonomy

### 2.1 Four Flag Classes

| Class | Severity | Blocks Progression? | User Action Required | Auto-Clear? |
|-------|----------|---------------------|----------------------|-------------|
| **HARD_STOP** | Critical | **YES** — next stage cannot start | Override only (audited) | Never |
| **CONDITIONAL_WARNING** | High | **YES** — by default | Review + explicit decision (acknowledge/override) | On acknowledgment |
| **DATA_QUALITY_WARNING** | Medium | **YES** — marks result incomplete | Acknowledge data limitation | On data refresh |
| **VALUATION_WARNING** | Medium-High | Blocks **BUY-READY** only | Review assumptions; may proceed to research | On re-valuation |

### 2.2 Flag Lifecycle

```
CREATED → ACTIVE → [ACKNOWLEDGED/OVERRIDDEN] → RESOLVED (if condition clears)
                ↓
           EXPIRED (if data refresh clears condition)
```

- **CREATED:** Engine detects condition; flag instantiated with timestamp, value, threshold
- **ACTIVE:** Flag blocks progression per its class rules
- **ACKNOWLEDGED:** User reviews CONDITIONAL_WARNING/DATA_QUALITY; records decision; flag stays visible but progression allowed
- **OVERRIDDEN:** User overrides HARD_STOP/VALUATION_WARNING; requires reason, creates audit record; original flag preserved
- **RESOLVED:** On re-run, condition no longer met; flag marked resolved with resolution timestamp
- **EXPIRED:** Data refresh shows condition cleared; flag auto-resolved

**Critical:** Original flag is **never deleted or hidden**. Override creates a parallel record linking to original.

---

## 3. Flag Data Model

```typescript
// packages/core/src/types/red-flags.ts

export type FlagClass = 
  | 'HARD_STOP' 
  | 'CONDITIONAL_WARNING' 
  | 'DATA_QUALITY_WARNING' 
  | 'VALUATION_WARNING';

export type FlagSource = 
  | 'handwritten-notes' 
  | 'blueprint' 
  | 'engineering-default' 
  | 'user-configured';

export interface RedFlag {
  id: string;                           // UUID v4
  flagKey: string;                      // e.g., "STAGE_A_ROE_BELOW_10"
  class: FlagClass;
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  ruleKey?: string;                     // Scoring rule that triggered it
  message: string;                      // Human-readable
  threshold: string;                    // e.g., "< 10%", "> 1.25", "x > 3"
  actualValue: unknown;                 // The value that triggered it
  expectedValue?: unknown;              // What would pass
  source: FlagSource;
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  // Lifecycle
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'RESOLVED' | 'EXPIRED';
  createdAt: string;                    // ISO 8601
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedReason?: string;
  overriddenAt?: string;
  overriddenBy?: string;
  overrideReason?: string;
  resolvedAt?: string;
  resolutionReason?: string;            // 'condition_cleared' | 'data_refreshed' | 'manual'
  
  // Audit
  originalFlagId?: string;              // If this is an override record, links to original
  isOverride: boolean;                  // True for override records
  
  // Context
  companyId: string;
  analysisRunId: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
}

export interface FlagAcknowledgment {
  flagId: string;
  userId: string;
  reason: string;                       // Free text explanation
  decision: 'acknowledge' | 'override'; // For CONDITIONAL/DATA_QUALITY: acknowledge; for HARD_STOP/VALUATION: override
  timestamp: string;
}

export interface FlagOverride extends FlagAcknowledgment {
  // Override-specific: only for HARD_STOP and VALUATION_WARNING
  beforeState: {
    stageStatus: 'BLOCKED' | 'PASSED';
    score?: number;
  };
  afterState: {
    stageStatus: 'OVERRIDDEN_PASSED';
    score?: number;
  };
}
```

---

## 4. Stage A Flags (Complete Matrix)

### 4.1 Hard Stops (Non-Financial)

| Flag ID | Rule | Condition | Threshold | Source |
|---------|------|-----------|-----------|--------|
| `STAGE_A_SALES_GROWTH_NEGATIVE` | Sales Growth | Latest FY YoY < 0 OR 5Y CAGR < 0 | < 0% | handwritten-notes |
| `STAGE_A_PROFIT_GROWTH_NEGATIVE` | Profit Growth | Latest FY YoY < 0 OR 5Y CAGR < 0 | < 0% | handwritten-notes |
| `STAGE_A_ROE_BELOW_10` | ROE | Latest FY ROE < 10% | < 10% | handwritten-notes |
| `STAGE_A_ROCE_BELOW_10` | ROCE | Latest FY ROCE < 10% | < 10% | handwritten-notes |
| `STAGE_A_DEBT_EQUITY_HIGH` | D/E | D/E > 1.25 | > 1.25 | handwritten-notes |
| `STAGE_A_CURRENT_RATIO_LOW` | Current Ratio | Current Ratio < 1.0 | < 1.0 | handwritten-notes |
| `STAGE_A_INT_COVERAGE_LOW` | Interest Coverage | Interest Coverage < 3 | < 3 | handwritten-notes |
| `STAGE_A_PE_VS_INDUSTRY_HIGH` | P/E vs Industry | x = Co P/E ÷ Ind P/E > 3 | > 3 | handwritten-notes |

### 4.2 Conditional Warnings (Non-Financial)

| Flag ID | Rule | Condition | Threshold | Source |
|---------|------|-----------|-----------|--------|
| `STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP` | P/E vs Industry | x < 0.8 | < 0.8 | handwritten-notes |
| `STAGE_A_GROWTH_BASE_EFFECT` | Sales/Profit Growth | Suspected one-off base effect | User-flagged | engineering-default |
| `STAGE_A_ROE_LEVERAGE_DRIVEN` | ROE | ROE ≥ 20% AND D/E > 1.0 | Leverage check | engineering-default |
| `STAGE_A_CURRENT_RATIO_STRUCTURAL` | Current Ratio | CR < 1 but structural negative WC | Sector-specific | engineering-default |

### 4.3 Data Quality Warnings (Non-Financial)

| Flag ID | Rule | Condition | Source |
|---------|------|-----------|--------|
| `STAGE_A_BENCHMARK_MISSING_OPM` | OPM | Industry OPM min unavailable | engineering-default |
| `STAGE_A_BENCHMARK_MISSING_ROA` | ROA | Industry ROA min unavailable | engineering-default |
| `STAGE_A_BENCHMARK_MISSING_PE` | P/E vs Industry | Industry P/E unavailable | engineering-default |
| `STAGE_A_DATA_STALE` | Any | Data > 12 months old | engineering-default |
| `STAGE_A_DATA_MISSING` | Any | Required input missing | engineering-default |
| `STAGE_A_DATA_INCONSISTENT` | Any | Restated values, mismatched units | engineering-default |

### 4.4 Bank/NBFC Specific

| Flag ID | Rule | Condition | Class | Notes |
|---------|------|-----------|-------|-------|
| `STAGE_A_BANK_DEBT_EQUITY_NA` | D/E | Bank sector — ratio not applicable | DATA_QUALITY_WARNING | Display "unsuitable" |
| `STAGE_A_BANK_CURRENT_RATIO_UNSUITABLE` | Current Ratio | Bank sector — not reliable measure | DATA_QUALITY_WARNING | Display "review required" |
| `STAGE_A_BANK_INT_COV_UNSUITABLE` | Interest Coverage | Bank sector — not standard measure | DATA_QUALITY_WARNING | Display "review required" |

---

## 5. Stage B Flags (Complete Matrix)

### 5.1 Hard Stops

| Flag ID | Rule | Condition | Threshold | Source |
|---------|------|-----------|-----------|--------|
| `STAGE_B_Q_SALES_TREND_FAIL` | Q Sales YoY | Not consistently rising | Flat/declining pattern | handwritten-notes |
| `STAGE_B_Q_OPM_TREND_FAIL` | Q OPM YoY | Consistently falling | Majority falling | handwritten-notes |
| `STAGE_B_5Y_SALES_DECLINING` | Sales 5Y | Net declining over 5Y | Latest < 5Y ago | handwritten-notes |
| `STAGE_B_5Y_OPM_DECLINING` | OPM 5Y | Net declining over 5Y | Latest < 5Y ago | handwritten-notes |
| `STAGE_B_NET_PROFIT_TREND_FAIL` | Net Profit | Profit falling OR (rising but margin falling) | See rubric | handwritten-notes |
| `STAGE_B_RESERVES_BORROWINGS_FAIL` | Reserves vs Borrowings | Pattern not in {up/down, up/flat, up/up, flat/flat} | Other patterns | handwritten-notes |
| `STAGE_B_CFO_TREND_FAIL` | CFO Trend | CFO falling OR (rising but margin falling) | See rubric | handwritten-notes |
| `STAGE_B_DEBTOR_DAYS_HIGH` | Debtor Days | Latest > 120 OR 5Y rise > 50% | >120 days or >50% | handwritten-notes |
| `STAGE_B_ROCE_TREND_FALLING` | ROCE Trend | Falling over 5Y | Net decline | handwritten-notes |
| `STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL` | Shareholding | Public ↑ AND Promoter/FII/DII all ↓ | Pattern match | handwritten-notes |
| `STAGE_B_PUBLIC_HOLDING_GE_50` | Shareholding | Public holding ≥ 50% | ≥ 50% | handwritten-notes (configurable) |

### 5.2 Conditional Warnings

| Flag ID | Rule | Condition | Source |
|---------|------|-----------|--------|
| `STAGE_B_Q_SALES_FLUCTUATING` | Q Sales | Rising with fluctuations | handwritten-notes |
| `STAGE_B_Q_OPM_SOME_DECLINES` | Q OPM | Mostly constant with few declines | handwritten-notes |
| `STAGE_B_DEBTOR_DAYS_RISING` | Debtor Days | Rising (but not hard flag) | handwritten-notes |
| `STAGE_B_SHAREHOLDING_INCOMPLETE` | Shareholding | Pattern not in scoring table (e.g., Up/Down/Up) | handwritten-notes |
| `STAGE_B_PROMOTER_PLEDGE_HIGH` | Promoter Pledge | > 20% | engineering-default |
| `STAGE_B_PROMOTER_PLEDGE_RISING` | Promoter Pledge | Rising QoQ | engineering-default |
| `STAGE_B_PROMOTER_DILUTION` | Promoter Holding | Dilution > 2% QoQ | engineering-default |
| `STAGE_B_DILUTION_EVENT` | Shareholding | Preferential allotment/warrants/QIP/ESOP | engineering-default |
| `STAGE_B_INSTITUTIONAL_EXIT` | FII/DII | Drop > 5% in quarter | engineering-default |

### 5.3 Data Quality Warnings

| Flag ID | Condition | Source |
|---------|-----------|--------|
| `STAGE_B_INSUFFICIENT_QUARTERS` | < 8 quarters available | engineering-default |
| `STAGE_B_INSUFFICIENT_YEARS` | < 5 annual years available | engineering-default |
| `STAGE_B_QUARTERLY_GAP` | Missing quarter in sequence | engineering-default |
| `STAGE_B_SHAREHOLDING_INCONSISTENT` | Holdings don't sum to ~100% | engineering-default |
| `STAGE_B_CFO_PAT_DIVERGENCE` | Cumulative CFO vs PAT divergence > 20% | engineering-default |
| `STAGE_B_DATA_STALE` | Quarterly > 3 mo / Annual > 12 mo | engineering-default |
| `STAGE_B_IMPLausIBLE_DEBTOR_DAYS` | Debtor days > 365 | engineering-default |

---

## 6. Stage C Flags

| Flag ID | Class | Condition | Source |
|---------|-------|-----------|--------|
| `STAGE_C_MOAT_TEST1_FAIL` | CONDITIONAL_WARNING | Test 1 (non-copyability) answered 'Yes' or 'Uncertain' | engineering-default (proposed) |
| `STAGE_C_MOAT_SCORE_BELOW_3` | CONDITIONAL_WARNING | Moat score < 3/5 | engineering-default (proposed) |
| `STAGE_C_EVIDENCE_MISSING` | DATA_QUALITY_WARNING | Moat test answer without supporting evidence | engineering-default |
| `STAGE_C_UNSUBSTANTIATED_CLAIM` | DATA_QUALITY_WARNING | Conclusion tagged 'inference' without verification | engineering-default |

**Note:** Stage C has no HARD_STOPs in proposed design — failed moat tests are conditional warnings requiring review.

---

## 7. Stage D Flags (Valuation)

### 7.1 Valuation Warnings

| Flag ID | Method | Condition | Class | Source |
|---------|--------|-----------|-------|--------|
| `STAGE_D_PE_EXPENSIVE` | P/E | Company P/E > 2× Industry P/E | VALUATION_WARNING | handwritten-notes |
| `STAGE_D_PE_VALUE_TRAP` | P/E | x < 0.8 (already in Stage A) | VALUATION_WARNING | handwritten-notes |
| `STAGE_D_PEG_OVERVALUED` | PEG | PEG > 2 | VALUATION_WARNING | handwritten-notes |
| `STAGE_D_PB_EXPENSIVE` | P/B | Exceeds sector expensive band | VALUATION_WARNING | handwritten-notes |
| `STAGE_D_DCF_TERMINAL_DEPENDENCE` | DCF | Terminal value > 70% of total value | VALUATION_WARNING | engineering-default |
| `STAGE_D_DCF_UNSTABLE_CASH_FLOW` | DCF | FCF volatile / negative | VALUATION_WARNING | engineering-default |
| `STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE` | DCF | WACC/terminal growth outside range | VALUATION_WARNING | engineering-default |
| `STAGE_D_LOW_CONFIDENCE` | Any | Confidence = Low on primary method | VALUATION_WARNING | engineering-default |
| `STAGE_D_MARGIN_OF_SAFETY_INSUFFICIENT` | All | Market price > 80% of fair value | VALUATION_WARNING | handwritten-notes |

### 7.2 Data Quality Warnings

| Flag ID | Condition | Source |
|---------|-----------|--------|
| `STAGE_D_EPS_NEGATIVE` | Negative/zero EPS → P/E, PEG N/M | engineering-default |
| `STAGE_D_NORMALISED_EARNINGS_UNAVAILABLE` | Cannot normalize for exceptionals | engineering-default |
| `STAGE_D_PEER_MEDIAN_UNAVAILABLE` | No industry P/E for relative valuation | engineering-default |
| `STAGE_D_BOOK_VALUE_NEGATIVE` | Negative equity → P/B N/M | engineering-default |
| `STAGE_D_DCF_INPUTS_MISSING` | Required DCF inputs missing | engineering-default |

---

## 8. Stage E Flags (Technical)

| Flag ID | Class | Condition | Source |
|---------|-------|-----------|--------|
| `STAGE_E_PATTERN_UNCONFIRMED` | CONDITIONAL_WARNING | Candlestick pattern detected but next candle not confirmed | engineering-default |
| `STAGE_E_PATTERN_OUT_OF_CONTEXT` | CONDITIONAL_WARNING | Pattern at wrong location (e.g., hammer in uptrend) | engineering-default |
| `STAGE_E_OVEREXTENDED` | CONDITIONAL_WARNING | Price far above moving averages / at strong resistance | engineering-default |
| `STAGE_E_GAP_RISK_HIGH` | DATA_QUALITY_WARNING | Earnings/date near with history of gaps | engineering-default |
| `STAGE_E_PRICE_OUTSIDE_BUY_ZONE` | HARD_STOP (for entry) | Current price > maxBuyPrice from valuation | engineering-default |

---

## 9. Stage F Flags (Portfolio Risk)

| Flag ID | Class | Condition | Source |
|---------|-------|-----------|--------|
| `STAGE_F_RISK_BUDGET_EXCEEDED` | HARD_STOP | Position risk > portfolio risk budget | engineering-default |
| `STAGE_F_STOCK_CONCENTRATION` | HARD_STOP | Post-trade stock exposure > 10% (configurable) | engineering-default |
| `STAGE_F_SECTOR_CONCENTRATION` | HARD_STOP | Post-trade sector exposure > 30% (configurable) | engineering-default |
| `STAGE_F_LIQUIDITY_INSUFFICIENT` | CONDITIONAL_WARNING | Position > 5% of avg daily volume | engineering-default |
| `STAGE_F_STOP_EQUALS_ENTRY` | HARD_STOP | Stop price ≥ entry price (zero/negative risk) | engineering-default |
| `STAGE_F_CASH_INSUFFICIENT` | HARD_STOP | Trade exceeds available cash | engineering-default |

---

## 10. Stage G Flags (Monitoring)

| Flag ID | Class | Condition | Source |
|---------|-------|-----------|--------|
| `STAGE_G_THESIS_INVALIDATED` | HARD_STOP (review) | Key moat assumption broken | engineering-default |
| `STAGE_G_HARD_FUNDAMENTAL_FLAG` | HARD_STOP (review) | New Stage A/B hard flag on held position | engineering-default |
| `STAGE_G_STOP_HIT` | CONDITIONAL_WARNING | Price reached stop/invalidation level | engineering-default |
| `STAGE_G_FAIR_VALUE_REACHED` | CONDITIONAL_WARNING | Price ≥ fair value | engineering-default |
| `STAGE_G_OVERVALUED` | VALUATION_WARNING | Price > fair value + threshold | engineering-default |
| `STAGE_G_CONCENTRATION_BREACH` | CONDITIONAL_WARNING | Portfolio/sector limits exceeded | engineering-default |
| `STAGE_G_DRAWDOWN_LIMIT` | CONDITIONAL_WARNING | Portfolio drawdown > threshold | engineering-default |
| `STAGE_G_NO_THESIS_PROGRESS` | CONDITIONAL_WARNING | Scheduled review overdue | engineering-default |

---

## 11. Flag Enforcement Logic

### 11.1 Stage Gate Enforcement

```typescript
// packages/core/src/engine/flag-enforcement.ts

export interface StageGateResult {
  canProceed: boolean;
  blockedBy: RedFlag[];           // Active flags blocking progression
  requiresAcknowledgment: RedFlag[]; // Conditional/Data quality needing review
  overrides: FlagOverride[];      // Applied overrides for this stage
}

export function evaluateStageGate(
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
  flags: RedFlag[],
  overrides: FlagOverride[]
): StageGateResult {
  const activeFlags = flags.filter(f => f.status === 'ACTIVE' && f.stage === stage);
  const stageOverrides = overrides.filter(o => o.flagId.startsWith(`STAGE_${stage}_`));
  
  // Hard stops block unless overridden
  const hardStops = activeFlags.filter(f => f.class === 'HARD_STOP');
  const unoverriddenHardStops = hardStops.filter(hs => 
    !stageOverrides.some(o => o.flagId === hs.id)
  );
  
  // Conditional warnings block unless acknowledged
  const conditionals = activeFlags.filter(f => f.class === 'CONDITIONAL_WARNING');
  const unacknowledgedConditionals = conditionals.filter(c => 
    c.status !== 'ACKNOWLEDGED' && c.status !== 'OVERRIDDEN'
  );
  
  // Data quality warnings mark incomplete
  const dataQuality = activeFlags.filter(f => f.class === 'DATA_QUALITY_WARNING');
  const unacknowledgedDQ = dataQuality.filter(dq => 
    dq.status !== 'ACKNOWLEDGED' && dq.status !== 'OVERRIDDEN'
  );
  
  // Valuation warnings block BUY-READY (Stage D/F gate)
  const valuationWarnings = activeFlags.filter(f => f.class === 'VALUATION_WARNING');
  const unoverriddenValuation = valuationWarnings.filter(vw => 
    !stageOverrides.some(o => o.flagId === vw.id)
  );
  
  const blockedBy = [
    ...unoverriddenHardStops,
    ...unacknowledgedConditionals,
    ...unacknowledgedDQ,
  ];
  
  // For Stage D/F: valuation warnings also block
  const buyReadyBlocked = (stage === 'D' || stage === 'F') 
    ? [...blockedBy, ...unoverriddenValuation] 
    : blockedBy;
  
  return {
    canProceed: buyReadyBlocked.length === 0,
    blockedBy: buyReadyBlocked,
    requiresAcknowledgment: [...unacknowledgedConditionals, ...unacknowledgedDQ],
    overrides: stageOverrides,
  };
}
```

### 11.2 Override Rules

```typescript
export interface OverrideRequest {
  flagId: string;
  userId: string;
  reason: string;              // Mandatory, min 50 chars
  decision: 'acknowledge' | 'override';
}

export function applyOverride(
  flag: RedFlag,
  request: OverrideRequest,
  currentStageStatus: 'BLOCKED' | 'PASSED',
  currentScore?: number
): { updatedFlag: RedFlag; overrideRecord: FlagOverride } {
  // Validate
  if (flag.class === 'HARD_STOP' && request.decision !== 'override') {
    throw new Error('HARD_STOP requires override decision, not acknowledgment');
  }
  if (flag.class === 'VALUATION_WARNING' && request.decision !== 'override') {
    throw new Error('VALUATION_WARNING requires override decision');
  }
  if (flag.class === 'CONDITIONAL_WARNING' && request.decision === 'override') {
    throw new Error('CONDITIONAL_WARNING uses acknowledgment, not override');
  }
  if (flag.class === 'DATA_QUALITY_WARNING' && request.decision === 'override') {
    throw new Error('DATA_QUALITY_WARNING uses acknowledgment, not override');
  }
  if (!request.reason || request.reason.length < 50) {
    throw new Error('Override reason must be at least 50 characters');
  }
  
  const now = new Date().toISOString();
  
  // Create override record (immutable)
  const overrideRecord: FlagOverride = {
    flagId: flag.id,
    userId: request.userId,
    reason: request.reason,
    decision: request.decision,
    timestamp: now,
    beforeState: { stageStatus: currentStageStatus, score: currentScore },
    afterState: { 
      stageStatus: 'OVERRIDDEN_PASSED', 
      score: currentScore 
    },
  };
  
  // Update original flag (preserved)
  const updatedFlag: RedFlag = {
    ...flag,
    status: request.decision === 'override' ? 'OVERRIDDEN' : 'ACKNOWLEDGED',
    acknowledgedAt: now,
    acknowledgedBy: request.userId,
    acknowledgedReason: request.reason,
    overriddenAt: request.decision === 'override' ? now : undefined,
    overriddenBy: request.decision === 'override' ? request.userId : undefined,
    overrideReason: request.decision === 'override' ? request.reason : undefined,
  };
  
  return { updatedFlag, overrideRecord };
}
```

**Key Principles:**
1. Original flag **never modified** in a way that loses history — status transitions are append-only
2. Override creates **new immutable record** linking to original flag
3. Override reason **mandatory** and substantive (min 50 chars)
4. Override does **not change score** — only permits progression
5. All overrides visible in audit trail and on company research page

---

## 12. Missing Data Never Auto-Passes

```typescript
export function validateDataCompleteness(
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
  inputs: Record<string, unknown>,
  requiredFields: string[]
): RedFlag[] {
  const flags: RedFlag[] = [];
  
  for (const field of requiredFields) {
    const value = inputs[field];
    if (value === null || value === undefined || value === '') {
      flags.push(createFlag({
        flagKey: `${stage}_${field.toUpperCase()}_MISSING`,
        class: 'DATA_QUALITY_WARNING',
        stage,
        message: `Required field '${field}' is missing; analysis incomplete`,
        threshold: 'present',
        actualValue: null,
        source: 'engineering-default',
        severity: 'medium',
      }));
    }
  }
  
  return flags;
}
```

**Rule:** Any missing required input → DATA_QUALITY_WARNING → stage result marked `INCOMPLETE` → gate blocks until acknowledged or data provided.

---

## 13. Flag Display Requirements (UI Contract)

Every flag must display:
- Flag ID and class badge (color-coded: 🔴 HARD_STOP, 🟠 CONDITIONAL, 🟡 DATA_QUALITY, 🟣 VALUATION)
- Human-readable message
- Threshold vs actual value
- Source (handwritten-notes / blueprint / engineering-default / user-configured)
- Timestamp (created, acknowledged, overridden, resolved)
- For overrides: reason, user, before/after state
- Action buttons per class:
  - HARD_STOP: "Override" (requires reason) | "View Details"
  - CONDITIONAL_WARNING: "Acknowledge" (requires reason) | "Override" (if permitted)
  - DATA_QUALITY_WARNING: "Acknowledge" | "Refresh Data"
  - VALUATION_WARNING: "Override" (requires reason) | "Re-run Valuation"

---

## 14. Configuration

```yaml
# config/red-flags-v1.0.yaml
redFlags:
  version: "1.0"
  publicHoldingThreshold: 0.50  # Configurable; default 50%
  debtorDaysHardStop: 120
  debtorDaysRiseThreshold: 0.50
  promoterPledgeWarningThreshold: 0.20
  institutionalExitThreshold: 0.05
  promoterDilutionThreshold: 0.02
  cfoPatDivergenceThreshold: 0.20
  dcfTerminalDependenceThreshold: 0.70
  minimumOverrideReasonLength: 50
  stageGates:
    A:
      hardStopsBlock: true
      conditionalsBlock: true
      dataQualityBlocks: true
    B:
      hardStopsBlock: true
      conditionalsBlock: true
      dataQualityBlocks: true
    C:
      hardStopsBlock: false  # No hard stops in Stage C
      conditionalsBlock: true
      dataQualityBlocks: true
    D:
      hardStopsBlock: true
      conditionalsBlock: true
      dataQualityBlocks: true
      valuationWarningsBlockBuyReady: true
    E:
      hardStopsBlock: true
      conditionalsBlock: true
      dataQualityBlocks: true
    F:
      hardStopsBlock: true
      conditionalsBlock: true
      dataQualityBlocks: true
      valuationWarningsBlockBuyReady: true
    G:
      hardStopsBlock: false  # Monitoring doesn't gate
      conditionalsBlock: false
      dataQualityBlocks: false
```

---

## 15. Test Scenarios

| Test ID | Scenario | Expected |
|---------|----------|----------|
| RF-01 | Stage A: ROE 8% → HARD_STOP created | Gate blocks; flag ACTIVE |
| RF-02 | Stage A: ROE 8% → user overrides with reason | Flag OVERRIDDEN; override record created; gate passes |
| RF-03 | Stage A: ROE 8% → user acknowledges (wrong action) | Error: HARD_STOP requires override |
| RF-03 | Stage B: Debtor days 130 → HARD_STOP | Gate blocks |
| RF-04 | Stage B: Shareholding Up/Down/Up → CONDITIONAL | Gate blocks until acknowledged |
| RF-05 | Stage B: User acknowledges CONDITIONAL with reason | Flag ACKNOWLEDGED; gate passes |
| RF-06 | Stage D: PEG 2.5 → VALUATION_WARNING | Stage D passes; Stage F (BUY-READY) blocks |
| RF-07 | Stage D: VALUATION_WARNING overridden | Stage F passes; override record created |
| RF-08 | Stage A: Missing industry P/E → DATA_QUALITY | Rule unscored; flag ACTIVE; gate blocks until acknowledged |
| RF-09 | Data refresh clears condition (ROE now 12%) | Flag RESOLVED; status EXPIRED; auto-clears |
| RF-10 | Override reason < 50 chars | Rejected with error |
| RF-11 | Multiple hard stops — all must be overridden | Each requires separate override record |
| RF-12 | Audit trail: original flag + override both visible | Query returns both records linked by originalFlagId |

---

## 16. Integration Points

| Component | Interaction |
|-----------|-------------|
| Scoring Engine | Emits flags during rule evaluation |
| Stage Gate API | Calls `evaluateStageGate()` before allowing next stage |
| Override API | `POST /api/v1/flags/{id}/override` → creates override record |
| Acknowledgment API | `POST /api/v1/flags/{id}/acknowledge` → updates flag status |
| Audit Log | All flag transitions written to `audit_events` table |
| UI | Fetches flags for company; displays per class with actions |
| Data Refresh Job | On re-run, resolves flags where condition cleared |

---

*End of Red Flag Engine Specification*