# Stage B Scoring Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-b-v1.0`

---

## 1. Purpose

Stage B performs deep trend analysis over quarterly (≈2 years / 8+ quarters) and annual (5 years) horizons. It validates the consistency and quality of growth, margins, balance sheet, cash flows, ratios, and shareholding patterns. Total score: 10 points.

**Gate to Stage C:** No hard flags AND score ≥ 6.5/10 (proposed default, requires approval).

---

## 2. Scoring Allocation Summary

| Block | Item | Max Points | Hard Flag Conditions |
|-------|------|------------|---------------------|
| **Quarterly (2 pts)** | Sales YoY | 1.0 | Flat or declining pattern |
| | OPM YoY | 1.0 | Consistently falling |
| **P&L — 5Y (3 pts)** | Sales 5Y | 1.0 | Declining |
| | OPM 5Y | 1.0 | Declining |
| | Net Profit | 1.0 | Profit falling OR (profit rising but margin falling) |
| **Balance Sheet (1 pt)** | Reserves vs Borrowings | 1.0 | Pattern not in {up/down, up/flat, up/up, flat/flat} |
| **Cash Flows (1 pt)** | CFO Trend | 1.0 | Falling (per net-profit rubric) |
| **Ratios (2 pts)** | Debtor Days | 1.0 | >120 days OR >50% rise in 5Y |
| | ROCE Trend | 1.0 | Falling |
| **Shareholding (1 pt)** | Pattern | 1.0 | Public rising while promoter/FII/DII falling; Public ≥ 50% |

**Total: 10 points**

---

## 3. Quarterly Trend Rules (2 Points)

### 3.1 Quarterly Sales YoY (1.0 point)

**Data Requirement:** Minimum 8 comparable quarters (YoY to reduce seasonality).

**Trend Classification:**

| Pattern | Points | Flag |
|---------|--------|------|
| Consistently rising (all quarters YoY > 0) | 1.0 | None |
| Rising overall with fluctuations (majority up, ≤1 decline) | 0.75 | CONDITIONAL: `STAGE_B_Q_SALES_FLUCTUATING` |
| Flat or other adverse pattern | 0.0 | **HARD_STOP: `STAGE_B_Q_SALES_TREND_FAIL`** |

**Algorithm:**
```
For each quarter i: salesYoY[i] = (Sales_Q[i] - Sales_Q[i-4]) / Sales_Q[i-4]
Count quarters with salesYoY > 0
If all > 0: 1.0
Else if (positive_count >= 6 of 8) && (negative_count <= 1): 0.75 + CONDITIONAL
Else: 0.0 + HARD_STOP
```

**Edge Cases:**
- Fewer than 8 quarters → DATA_QUALITY_WARNING: `insufficient_quarters`; score with available
- Restated quarterly → use latest; flag `adjustmentStatus: 'restated'`
- Seasonal business → YoY comparison handles this; note in explanation

---

### 3.2 Quarterly OPM YoY (1.0 point)

**Data Requirement:** Same 8 quarters as sales.

**Trend Classification:**

| Pattern | Points | Flag |
|---------|--------|------|
| Increasing (each quarter OPM > prior YoY quarter) | 1.0 | None |
| Mostly constant with occasional rise | 0.75 | None |
| Constant (flat) | 0.5 | None |
| Mostly constant with a few declines | 0.25 | CONDITIONAL: `STAGE_B_Q_OPM_SOME_DECLINES` |
| Consistently falling | 0.0 | **HARD_STOP: `STAGE_B_Q_OPM_TREND_FAIL`** |

**Algorithm:**
```
opmYoY[i] = OPM_Q[i] - OPM_Q[i-4]  (percentage point change)
If all opmYoY > 0: 1.0
Else if (positive_count >= 5) && (negative_count <= 1) && (max_negative < threshold): 0.75
Else if (max_abs_change < 1% for all): 0.5
Else if (negative_count <= 2) && (positive_count >= 3): 0.25 + CONDITIONAL
Else: 0.0 + HARD_STOP
```

**Note:** "Consistently falling" = majority of quarters show declining OPM YoY.

---

## 4. Annual 5-Year P&L Rules (3 Points)

### 4.1 Sales 5-Year Trend (1.0 point)

**Data Requirement:** 5 full fiscal years, consistent accounting periods.

| Pattern | Points | Flag |
|---------|--------|------|
| Consistently up (each year > prior) | 1.0 | None |
| Up overall with flat periods (no declines) | 0.75 | None |
| Up overall with a dip (1 decline, recovery) | 0.5 | None |
| Flat (no meaningful growth) | 0.25 | None |
| Declining (net lower than 5Y ago) | 0.0 | **HARD_STOP: `STAGE_B_5Y_SALES_DECLINING`** |

**Algorithm:**
```
sales_5y_ago = Sales[0], sales_latest = Sales[4]
If sales_latest > sales_5y_ago:
  Count year-over-year increases
  If all 4 transitions up: 1.0
  Else if 0 declines: 0.75
  Else if 1 decline: 0.5
Else if sales_latest ≈ sales_5y_ago (±5%): 0.25
Else: 0.0 + HARD_STOP
```

---

### 4.2 OPM 5-Year Trend (1.0 point)

**Same rubric as Sales 5Y, applied to OPM %.**

| Pattern | Points | Flag |
|---------|--------|------|
| Consistently up | 1.0 | None |
| Up with flat periods | 0.75 | None |
| Up with a dip | 0.5 | None |
| Flat | 0.25 | None |
| Declining | 0.0 | **HARD_STOP: `STAGE_B_5Y_OPM_DECLINING`** |

---

### 4.3 Net Profit & Margin (1.0 point)

**Combined assessment of profit growth and margin trend.**

| Condition | Points | Flag |
|-----------|--------|------|
| Profit rising **AND** net margin rising | 1.0 | None |
| Profit rising **AND** net margin constant | 0.75 | None |
| Profit rising **AND** net margin fluctuating | 0.5 | None |
| Profit rising **BUT** margin falling | 0.0 | **HARD_STOP: `STAGE_B_NET_PROFIT_TREND_FAIL`** |
| Profit falling (regardless of margin) | 0.0 | **HARD_STOP: `STAGE_B_NET_PROFIT_TREND_FAIL`** |

**Formula:**
```
Net Margin = Net Profit / Revenue
Profit Rising = NetProfit_Latest > NetProfit_5Y_Ago
Margin Trend = compare NetMargin_Latest vs NetMargin_5Y_Ago
```

**Forensic Check (Recommended):** Compare cumulative CFO vs cumulative PAT over 5 years. Significant divergence (>20%) → DATA_QUALITY_WARNING: `STAGE_B_CFO_PAT_DIVERGENCE`.

---

## 5. Balance Sheet — Reserves vs Borrowings (1 Point)

**Data:** 5-year annual series for Reserves (Retained Earnings + Other Reserves) and Total Borrowings (Long-term + Short-term).

| Pattern | Points | Flag |
|---------|--------|------|
| Reserves Up **AND** Borrowings Down | 1.0 | None |
| Reserves Up **AND** Borrowings Flat (±5%) | 0.75 | None |
| Reserves Up **AND** Borrowings Up | 0.5 | None |
| Reserves Flat **AND** Borrowings Flat | 0.25 | None |
| Any other pattern (Reserves Down, or Borrowings Up sharply) | 0.0 | **HARD_STOP: `STAGE_B_RESERVES_BORROWINGS_FAIL`** |

**Algorithm:**
```
reserves_trend = Reserves_Latest - Reserves_5Y_Ago
borrowings_trend = Borrowings_Latest - Borrowings_5Y_Ago

If reserves_trend > 0 && borrowings_trend < 0: 1.0
Else if reserves_trend > 0 && abs(borrowings_trend) < 5%: 0.75
Else if reserves_trend > 0 && borrowings_trend > 0: 0.5
Else if abs(reserves_trend) < 5% && abs(borrowings_trend) < 5%: 0.25
Else: 0.0 + HARD_STOP
```

**Note:** "Flat" = change within ±5% over 5 years.

---

## 6. Cash Flows — CFO Trend (1 Point)

**Apply the Net Profit trend rubric (Section 4.3) to Cash Flow from Operations (CFO).**

| Condition | Points | Flag |
|-----------|--------|------|
| CFO rising & CFO margin rising | 1.0 | None |
| CFO rising & CFO margin constant | 0.75 | None |
| CFO rising & CFO margin fluctuating | 0.5 | None |
| CFO rising but CFO margin falling | 0.0 | **HARD_STOP: `STAGE_B_CFO_TREND_FAIL`** |
| CFO falling | 0.0 | **HARD_STOP: `STAGE_B_CFO_TREND_FAIL`** |

**CFO Margin = CFO / Revenue**

**Forensic Cross-Check (Required):**
```
Cumulative_CFO_5Y = Sum(CFO for 5 years)
Cumulative_PAT_5Y = Sum(PAT for 5 years)
Divergence = |Cumulative_CFO - Cumulative_PAT| / Cumulative_PAT
If Divergence > 20%: DATA_QUALITY_WARNING: `STAGE_B_CFO_PAT_DIVERGENCE`
```

**Rationale:** Persistent CFO < PAT suggests aggressive accruals or poor cash conversion.

---

## 7. Ratios (2 Points)

### 7.1 Debtor Days (1.0 point)

**Formula:**
```
Debtor Days = (Trade Receivables / Revenue) * 365
```
Use annual data for 5 years.

| Trend | Points | Flag |
|-------|--------|------|
| Consistently falling | 1.0 | None |
| Almost constant (±5%) | 0.75 | None |
| Fluctuating | 0.5 | None |
| Rising | 0.0 | CONDITIONAL: `STAGE_B_DEBTOR_DAYS_RISING` |
| **> 120 days (latest year)** | 0.0 | **HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH`** |
| **> 50% rise over 5 years** | 0.0 | **HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH`** |

**Hard Stop Conditions (Either triggers):**
1. Latest year Debtor Days > 120
2. (DebtorDays_Latest - DebtorDays_5Y_Ago) / DebtorDays_5Y_Ago > 50%

---

### 7.2 ROCE Trend (1.0 point)

**Same rubric as Sales 5Y, applied to ROCE %.**

| Trend | Points | Flag |
|-------|--------|------|
| Consistently rising | 1.0 | None |
| Maintained (flat, high level) | 0.75 | None |
| Rising but fluctuating | 0.5 | None |
| Falling | 0.0 | **HARD_STOP: `STAGE_B_ROCE_TREND_FALLING`** |

**Algorithm:**
```
roce_trend = ROCE_Latest - ROCE_5Y_Ago
If roce_trend > 0 && all yearly transitions >= 0: 1.0
Else if roce_trend >= -1% && roce_trend <= 1% && ROCE_Latest > 15%: 0.75
Else if roce_trend > 0 && some declines: 0.5
Else: 0.0 + HARD_STOP
```

**Note:** "Maintained" implies ROCE stays at a high level (e.g., >15%) without significant decline.

---

## 8. Shareholding Pattern (1 Point)

### 8.1 Quarterly Shareholding Data

**Data Requirement:** Quarterly history (minimum 8 quarters) for:
- Promoter Holding %
- FII Holding %
- DII Holding %
- Public Holding %
- Promoter Pledge % (recommended)

### 8.2 Scoring Table (Per Latest Quarter vs Prior Trend)

| Promoter | FII + DII | Public | Points | Notes |
|----------|-----------|--------|--------|-------|
| Up | Up | Down | 1.00 | Ideal |
| Up | Flat | Down | 0.75 | |
| Up | Down | Down | 0.75 | |
| Flat | Up | Down | 0.50 | |
| Up | Down | Up | 0.00 | Incomplete rule — **REVIEW REQUIRED** |
| Down | Down | Up | **HARD_STOP** | Public rising while all institutional falling |
| Any | Any | ≥ 50% | **HARD_STOP** | Public ≥ 50% (configurable threshold) |

**"Up/Down/Flat" Definition (Quarter-over-Quarter):**
- Up: Change > +0.5%
- Down: Change < -0.5%
- Flat: Change between -0.5% and +0.5%

**Incomplete Pattern Handling:**
- Row "Up / Down / Up" scores 0.0 and triggers CONDITIONAL_WARNING: `STAGE_B_SHAREHOLDING_INCOMPLETE`
- Requires user review and explanation

### 8.3 Additional Shareholding Checks (Recommended — Not in Original Notes)

| Check | Warning Type | Flag ID |
|-------|--------------|---------|
| Promoter Pledge > 20% | CONDITIONAL | `STAGE_B_PROMOTER_PLEDGE_HIGH` |
| Promoter Pledge Rising QoQ | CONDITIONAL | `STAGE_B_PROMOTER_PLEDGE_RISING` |
| Promoter Holding Dilution > 2% in quarter | CONDITIONAL | `STAGE_B_PROMOTER_DILUTION` |
| Preferential Allotment / Warrants / QIP / ESOP | CONDITIONAL | `STAGE_B_DILUTION_EVENT` |
| Sudden FII/DII Drop > 5% in quarter | CONDITIONAL | `STAGE_B_INSTITUTIONAL_EXIT` |

---

## 9. Data Requirements & Quality

| Data Type | Minimum | Preferred | Quality Flags |
|-----------|---------|-----------|---------------|
| Quarterly Sales/OPM | 8 quarters | 12 quarters | `insufficient_quarters` if <8 |
| Annual 5Y P&L/BS/CF | 5 years | 10 years | `insufficient_history` if <5 |
| Quarterly Shareholding | 8 quarters | 12 quarters | `insufficient_quarters` |
| Restated Values | Flagged | — | `adjustmentStatus: 'restated'` |
| Data Age | < 3 months (Q) / < 12 months (A) | Current | `stale` if older |

**Consolidated vs Standalone:** Use consolidated by default where meaningful. Allow standalone as secondary comparison. Tag each data point.

---

## 10. Gate to Stage C

**Proposed Default (Requires Approval):**
- No HARD_STOP flags active
- Total Score ≥ 6.5 / 10

**If Gate Fails:**
- Stage C cannot be initiated via API
- UI shows blocking flags with values, thresholds, and source dates
- Override possible with audit trail (reason, timestamp, user)

---

## 11. Missing Data Behaviour

| Scenario | Handling |
|----------|----------|
| < 8 quarters available | Score with available; DATA_QUALITY_WARNING; max confidence reduced |
| Missing quarter in middle | Interpolate? **No** — mark gap, DATA_QUALITY_WARNING |
| Shareholding not summing to 100% | DATA_QUALITY_WARNING: `inconsistent`; score 0 for shareholding block |
| CFO not reported | Rule unscored; DATA_QUALITY_WARNING: `missing` |
| Debtor days > 365 | DATA_QUALITY_WARNING: `implausible`; rule unscored |

**Never** infer a pass from missing data.

---

## 12. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Quarterly sales: 7 up, 1 down (small) | 0.75 + CONDITIONAL (fluctuating) |
| Quarterly OPM: flat for 6 quarters, up 2 | 0.75 (mostly constant with occasional rise) |
| 5Y Sales: up 4 years, down 1 year (recovery) | 0.5 (up with a dip) |
| Reserves up 10%, Borrowings up 8% | 0.5 (both up) |
| Debtor days: 115 → 118 (rise <50%, <120) | 0.5 (fluctuating) or 0.25 (mostly constant with few declines) — **needs precise rubric** |
| ROCE: 22% → 20% → 21% → 19% → 18% | Falling trend → HARD_STOP |
| Shareholding: Promoter 50%→51%, FII 20%→19%, Public 30%→30% | Promoter Up, FII Down, Public Flat → not in table → CONDITIONAL_REVIEW |
| Public holding 49.9% | No hard flag (threshold is ≥50%) |
| Promoter pledge data missing | CONDITIONAL_WARNING (recommended check unavailable) |

---

## 13. Configuration (Externalized)

```yaml
# config/stage-b-v1.0.yaml
stageB:
  version: "1.0"
  maxScore: 10
  minPassScore: 6.5  # REQUIRES APPROVAL
  quarterly:
    minQuarters: 8
    salesYoY:
      consistentlyRising: { points: 1.0, condition: "all_positive" }
      risingWithFluctuations: { points: 0.75, condition: "positive>=6 && negative<=1" }
      hardStop: { condition: "otherwise", flagId: "STAGE_B_Q_SALES_TREND_FAIL" }
    opmYoY:
      increasing: { points: 1.0, condition: "all_positive" }
      mostlyConstantOccasionalRise: { points: 0.75, condition: "positive>=5 && negative<=1" }
      constant: { points: 0.5, condition: "max_abs_change<1%" }
      mostlyConstantFewDeclines: { points: 0.25, condition: "negative<=2", flag: "STAGE_B_Q_OPM_SOME_DECLINES" }
      hardStop: { condition: "consistently_falling", flagId: "STAGE_B_Q_OPM_TREND_FAIL" }
  annual:
    minYears: 5
    sales5y:
      consistentlyUp: { points: 1.0, condition: "all_transitions_up" }
      upWithFlatPeriods: { points: 0.75, condition: "no_declines" }
      upWithDip: { points: 0.5, condition: "one_decline" }
      flat: { points: 0.25, condition: "net_change_within_5%" }
      hardStop: { condition: "net_declining", flagId: "STAGE_B_5Y_SALES_DECLINING" }
    opm5y: { same_rubric_as: "sales5y", hardStopFlag: "STAGE_B_5Y_OPM_DECLINING" }
    netProfit:
      profitAndMarginRising: { points: 1.0 }
      profitRisingMarginConstant: { points: 0.75 }
      profitRisingMarginFluctuating: { points: 0.5 }
      hardStop: { condition: "profit_falling || (profit_rising && margin_falling)", flagId: "STAGE_B_NET_PROFIT_TREND_FAIL" }
  balanceSheet:
    reservesVsBorrowings:
      reservesUpBorrowingsDown: { points: 1.0 }
      reservesUpBorrowingsFlat: { points: 0.75, flatThreshold: 0.05 }
      reservesUpBorrowingsUp: { points: 0.5 }
      bothFlat: { points: 0.25, flatThreshold: 0.05 }
      hardStop: { condition: "otherwise", flagId: "STAGE_B_RESERVES_BORROWINGS_FAIL" }
  cashFlows:
    cfoTrend: { same_rubric_as: "netProfit", hardStopFlag: "STAGE_B_CFO_TREND_FAIL" }
    cfoPatDivergence:
      threshold: 0.20
      flagId: "STAGE_B_CFO_PAT_DIVERGENCE"
  ratios:
    debtorDays:
      consistentlyFalling: { points: 1.0 }
      almostConstant: { points: 0.75, threshold: 0.05 }
      fluctuating: { points: 0.5 }
      rising: { points: 0.0, flag: "STAGE_B_DEBTOR_DAYS_RISING" }
      hardStop: 
        - condition: "latest > 120", flagId: "STAGE_B_DEBTOR_DAYS_HIGH"
        - condition: "rise_5y > 0.50", flagId: "STAGE_B_DEBTOR_DAYS_HIGH"
    roceTrend:
      consistentlyRising: { points: 1.0 }
      maintained: { points: 0.75, condition: "flat_high_level", highLevel: 15 }
      risingFluctuating: { points: 0.5 }
      hardStop: { condition: "falling", flagId: "STAGE_B_ROCE_TREND_FALLING" }
  shareholding:
    minQuarters: 8
    changeThreshold: 0.005  # 0.5% for Up/Down/Flat
    scoringTable:
      - { promoter: "up", fiiDii: "up", public: "down", points: 1.0 }
      - { promoter: "up", fiiDii: "flat", public: "down", points: 0.75 }
      - { promoter: "up", fiiDii: "down", public: "down", points: 0.75 }
      - { promoter: "flat", fiiDii: "up", public: "down", points: 0.5 }
      - { promoter: "up", fiiDii: "down", public: "up", points: 0.0, flag: "STAGE_B_SHAREHOLDING_INCOMPLETE" }
    hardStops:
      - condition: "promoter!='up' && fiiDii!='up' && public='up'", flagId: "STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL"
      - condition: "public >= 0.50", flagId: "STAGE_B_PUBLIC_HOLDING_GE_50", configurable: true
    recommendedChecks:
      - { check: "promoter_pledge_pct", warningThreshold: 20, flagId: "STAGE_B_PROMOTER_PLEDGE_HIGH" }
      - { check: "promoter_pledge_trend", flagId: "STAGE_B_PROMOTER_PLEDGE_RISING" }
      - { check: "promoter_dilution_qoq", threshold: 0.02, flagId: "STAGE_B_PROMOTER_DILUTION" }
      - { check: "institutional_exit_qoq", threshold: 0.05, flagId: "STAGE_B_INSTITUTIONAL_EXIT" }
```

---

## 14. TypeScript Domain Types

```typescript
// packages/core/src/types/stage-b.ts

export interface QuarterlyPoint {
  period: string;           // 'FY2024-Q3'
  salesYoY: number;         // percentage
  opmYoY: number;           // percentage points
  dataQuality: DataQualityInfo;
}

export interface AnnualPoint {
  period: string;           // 'FY2024'
  sales: number;            // INR Crore
  opm: number;              // percentage
  netProfit: number;        // INR Crore
  netMargin: number;        // percentage
  reserves: number;         // INR Crore
  borrowings: number;       // INR Crore
  cfo: number;              // INR Crore
  pat: number;              // INR Crore
  debtorDays: number;       // days
  roce: number;             // percentage
  dataQuality: DataQualityInfo;
}

export interface ShareholdingPoint {
  period: string;           // 'FY2024-Q3'
  promoterPct: number;
  fiiPct: number;
  diiPct: number;
  publicPct: number;
  promoterPledgePct?: number;
  dataQuality: DataQualityInfo;
}

export interface StageBInput {
  companyId: string;
  asOfDate: string;
  quarterly: QuarterlyPoint[];      // min 8
  annual: AnnualPoint[];            // min 5
  shareholding: ShareholdingPoint[]; // min 8
  dataProvenance: DataProvenance;
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

export interface StageBRuleResult extends ScoringRuleResult {
  trendClassification?: TrendClassification;
  supportingData?: {
    quarterlyCount: number;
    annualCount: number;
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
  forensicFlags: string[];  // e.g., CFO-PAT divergence
}
```

---

## 15. Test Scenarios (Summary)

| Test ID | Scenario | Expected Score | Flags |
|---------|----------|----------------|-------|
| B-01 | All ideal trends | 10.0 | None |
| B-02 | Quarterly sales flat | 9.0 (0 for Q-Sales) | HARD_STOP: Q_SALES_TREND_FAIL |
| B-03 | Quarterly OPM falling | 9.0 (0 for Q-OPM) | HARD_STOP: Q_OPM_TREND_FAIL |
| B-04 | 5Y Sales declining | 9.0 (0 for 5Y-Sales) | HARD_STOP: 5Y_SALES_DECLINING |
| B-05 | 5Y OPM declining | 9.0 (0 for 5Y-OPM) | HARD_STOP: 5Y_OPM_DECLINING |
| B-06 | Profit rising, margin falling | 9.0 (0 for Net Profit) | HARD_STOP: NET_PROFIT_TREND_FAIL |
| B-07 | Reserves down, borrowings up | 9.0 (0 for Reserves) | HARD_STOP: RESERVES_BORROWINGS_FAIL |
| B-08 | Debtor days 130 | 9.0 (0 for Debtor Days) | HARD_STOP: DEBTOR_DAYS_HIGH |
| B-09 | Debtor days rose 60% in 5Y | 9.0 (0 for Debtor Days) | HARD_STOP: DEBTOR_DAYS_HIGH |
| B-10 | ROCE trend falling | 9.0 (0 for ROCE Trend) | HARD_STOP: ROCE_TREND_FALLING |
| B-11 | Public rising, inst falling | 9.0 (0 for Shareholding) | HARD_STOP: PUBLIC_RISE_INST_FALL |
| B-12 | Public holding 52% | 9.0 (0 for Shareholding) | HARD_STOP: PUBLIC_HOLDING_GE_50 |
| B-13 | Shareholding Up/Down/Up | 9.0 (0 for Shareholding) | CONDITIONAL: SHAREHOLDING_INCOMPLETE |
| B-14 | Promoter pledge 25% rising | 10.0 | CONDITIONAL: PROMOTER_PLEDGE_HIGH |
| B-15 | FII drops 8% QoQ | 10.0 | CONDITIONAL: INSTITUTIONAL_EXIT |
| B-16 | Only 6 quarters | Reduced confidence | DATA_QUALITY: INSUFFICIENT_QUARTERS |
| B-17 | CFO-PAT divergence 25% | 10.0 | DATA_QUALITY: CFO_PAT_DIVERGENCE |

---

*End of Stage B Scoring Specification*