# Stage A Scoring Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-a-v1.0`

---

## 1. Purpose

Stage A is the quick screening gate. It evaluates 10 financial quality metrics for non-financial companies (9 for banks/NBFCs legacy) and produces a score out of 10 (or 9). A company must pass the minimum score threshold **and** have zero hard-stop red flags to proceed to Stage B.

---

## 2. Scoring Rules — Non-Financial Companies (10 Points)

### Rule 1: Sales Growth (1.0 point max)

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 1a | Latest FY YoY growth > 0 **AND** 5Y CAGR > 0 | +0.5 |
| 1b | Latest FY YoY growth > 5Y CAGR | +0.5 |

**Formula:**
```
Latest FY YoY = (Sales_LatestFY - Sales_PriorFY) / Sales_PriorFY
5Y CAGR = (Sales_LatestFY / Sales_FY_5YearsAgo)^(1/5) - 1
```

**Required Inputs:**
- `sales.latestFy` (number, INR CRORE)
- `sales.priorFy` (number, INR CRORE)
- `sales.fy5yAgo` (number, INR CRORE)

**Hard Stop (HARD_STOP):** `STAGE_A_SALES_GROWTH_NEGATIVE`
- Triggered if Latest FY YoY < 0 **OR** 5Y CAGR < 0
- Message: "Sales growth negative in latest FY or 5Y CAGR; fundamental deterioration"

**Edge Cases:**
- Missing prior FY sales → DATA_QUALITY_WARNING, rule unscored (0 points)
- Restated sales → use latest restated values; flag `adjustmentStatus: 'restated'`
- Negative sales (rare) → treat as missing; DATA_QUALITY_WARNING

---

### Rule 2: Profit Growth (1.0 point max)

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 2a | Latest FY YoY growth > 0 **AND** 5Y CAGR > 0 | +0.5 |
| 2b | Latest FY YoY growth > 5Y CAGR | +0.5 |

**Formula:** Same as sales growth, applied to net profit.

**Required Inputs:**
- `profit.latestFy`, `profit.priorFy`, `profit.fy5yAgo` (INR CRORE)

**Hard Stop (HARD_STOP):** `STAGE_A_PROFIT_GROWTH_NEGATIVE`
- Triggered if Latest FY YoY < 0 **OR** 5Y CAGR < 0
- Message: "Profit growth negative in latest FY or 5Y CAGR; check for one-off items"

**Conditional Warning:** `STAGE_A_GROWTH_BASE_EFFECT`
- If user suspects exceptional base effect (e.g., COVID year, one-off gain)
- Requires written explanation before progression

**Edge Cases:**
- One-off gains/losses → CONDITIONAL_WARNING; user must normalize or acknowledge
- Negative profit in base year → CAGR undefined; DATA_QUALITY_WARNING

---

### Rule 3: Operating Profit Margin (1.0 point max)

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 3a | 1Y OPM > Industry Minimum **AND** 5Y Average OPM > Industry Minimum | +0.5 |
| 3b | 3a satisfied **AND** 1Y OPM > 5Y Average OPM | +0.5 |

**Formula:**
```
OPM = Operating Profit / Revenue
1Y OPM = OPM_LatestFY
5Y Avg OPM = Mean(OPM_LatestFY, OPM_FY-1, ..., OPM_FY-4)
```

**Required Inputs:**
- `operatingProfit.latestFy`, `operatingProfit.fy5yAgo` (INR CRORE)
- `revenue.latestFy`, `revenue.fy5yAgo` (INR CRORE)
- `industryOpmMin` (number, percentage) — **from benchmark table**

**No Hard Stop** in source rules.

**Data Quality Warning:** `STAGE_A_BENCHMARK_MISSING`
- If `industryOpmMin` unavailable → sub-rules 3a/3b unscored (0 points)
- Message: "Industry OPM benchmark missing; cannot score margin vs peers"

**Edge Cases:**
- Industry benchmark not defined for sector → unscored, not failed
- OPM negative → 3a fails (negative < any positive benchmark)
- Restated operating profit → use restated; flag accordingly

---

### Rule 4: Return on Equity — ROE (1.0 point max)

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 4a | Latest FY ROE ≥ 20% | +0.5 |
| 4b | Latest FY ROE 10% – <20% | +0.25 |
| 4c | Latest FY ROE < 10% | +0.0 |
| 4d | 1Y ROE > 5Y Average ROE | +0.5 |

**Formula:**
```
ROE = Net Profit / Average Shareholders' Equity
5Y Avg ROE = Mean(ROE_LatestFY, ROE_FY-1, ..., ROE_FY-4)
```

**Required Inputs:**
- `roe.latestFy` (percentage)
- `roe.avg5y` (percentage)

**Hard Stop (HARD_STOP):** `STAGE_A_ROE_BELOW_10`
- Triggered if Latest FY ROE < 10%
- Message: "ROE below 10% threshold; review leverage and buybacks"

**Conditional Warning:** `STAGE_A_ROE_LEVERAGE_DRIVEN`
- If ROE ≥ 20% but Debt/Equity > 1.0 (suggesting leverage-driven ROE)
- Message: "High ROE may be leverage-driven; verify sustainability"

**Edge Cases:**
- Negative equity → ROE undefined; DATA_QUALITY_WARNING
- Buybacks inflating ROE → CONDITIONAL_WARNING
- 5Y avg unavailable → 4d unscored (0.5 pts max for 4a/4b/4c only)

---

### Rule 5: Return on Capital Employed — ROCE (1.0 point max)

**Identical scoring to ROE (per notes).**

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 5a | Latest FY ROCE ≥ 20% | +0.5 |
| 5b | Latest FY ROCE 10% – <20% | +0.25 |
| 5c | Latest FY ROCE < 10% | +0.0 |
| 5d | 1Y ROCE > 5Y Average ROCE | +0.5 |

**Formula:**
```
ROCE = EBIT / (Total Assets - Current Liabilities)
     = EBIT / (Equity + Non-Current Liabilities)
```

**Required Inputs:**
- `roce.latestFy` (percentage)
- `roce.avg5y` (percentage)

**Hard Stop (HARD_STOP):** `STAGE_A_ROCE_BELOW_10`
- Triggered if Latest FY ROCE < 10%
- Message: "ROCE below 10% threshold; compare with ROE for leverage analysis"

**Conditional Warning:** (same as ROE leverage check)

**Cross-Check:** If ROE >> ROCE significantly, flag potential leverage distortion.

---

### Rule 6: Debt-to-Equity Ratio (1.0 point max)

| Condition | Points |
|-----------|--------|
| D/E < 0.5 | 1.0 |
| 0.5 ≤ D/E ≤ 1.25 | 0.5 |
| D/E > 1.25 | 0.0 |

**Formula:**
```
D/E = Total Debt / Total Equity
Total Debt = Long-term Borrowings + Short-term Borrowings + Current Portion of Long-term Debt
Total Equity = Share Capital + Reserves & Surplus
```

**Required Inputs:**
- `totalDebt` (INR CRORE)
- `totalEquity` (INR CRORE)

**Hard Stop (HARD_STOP):** `STAGE_A_DEBT_EQUITY_HIGH`
- Triggered if D/E > 1.25
- Message: "Debt/Equity exceeds 1.25; high financial risk for non-financial company"

**Boundary Decision Required:** **Are boundaries inclusive?**
- Option A: `<0.5` / `0.5–1.25` / `>1.25` (recommended)
- Option B: `≤0.5` / `0.5<×≤1.25` / `>1.25`

**Bank/NBFC:** **REMOVED** from scoring (legacy 9-point variant). Mark as "not applicable".

**Edge Cases:**
- Negative equity → D/E undefined; DATA_QUALITY_WARNING
- Zero debt → D/E = 0; scores 1.0
- Off-balance-sheet obligations → not captured; CONDITIONAL_WARNING if known

---

### Rule 7: Current Ratio (1.0 point max)

| Condition | Points |
|-----------|--------|
| Current Ratio > 2.0 | 1.0 |
| 1.0 ≤ Current Ratio ≤ 2.0 | 0.5 |
| Current Ratio < 1.0 | 0.0 |

**Formula:**
```
Current Ratio = Current Assets / Current Liabilities
```

**Required Inputs:**
- `currentAssets` (INR CRORE)
- `currentLiabilities` (INR CRORE)

**Hard Stop (HARD_STOP):** `STAGE_A_CURRENT_RATIO_LOW`
- Triggered if Current Ratio < 1.0
- Message: "Current ratio below 1.0; potential liquidity stress"

**Boundary Decision:** Current Ratio exactly 1.0 → scores 0.5 (falls in 1–2 band). Hard flag is strictly < 1.0.

**Caution:** Business models with structurally negative working capital (e.g., retail, some platforms) may have CR < 1 normally. → CONDITIONAL_WARNING: `STAGE_A_CURRENT_RATIO_STRUCTURAL`

**Bank/NBFC:** **Marked "unsuitable/review required"** — not a reliable bank liquidity measure.

---

### Rule 8: Interest Coverage Ratio (1.0 point max)

| Condition | Points |
|-----------|--------|
| Interest Coverage > 10 | 1.0 |
| 5 ≤ Interest Coverage ≤ 10 | 0.5 |
| 3 ≤ Interest Coverage < 5 | 0.25 |
| Interest Coverage < 3 | 0.0 |

**Formula:**
```
Interest Coverage = EBIT / Interest Expense
```

**Required Inputs:**
- `ebit` (INR CRORE)
- `interestExpense` (INR CRORE)

**Hard Stop (HARD_STOP):** `STAGE_A_INT_COVERAGE_LOW`
- Triggered if Interest Coverage < 3
- Message: "Interest coverage below 3x; debt service risk elevated"

**Bank/NBFC:** **Marked "unsuitable/review required"** — not a standard bank solvency measure.

**Edge Cases:**
- Zero interest expense → Interest Coverage = Infinity; scores 1.0
- Negative EBIT → Interest Coverage negative; scores 0, DATA_QUALITY_WARNING
- Capitalized interest → use total interest cost if available

---

### Rule 9: P/E vs Industry (1.0 point max)

**Formula:**
```
x = Company P/E ÷ Industry P/E
```

| Condition | Points | Notes |
|-----------|--------|-------|
| 0.8 ≤ x ≤ 2.0 | 1.0 | Reasonable valuation |
| 2.0 < x ≤ 2.5 | 0.5 | Moderately expensive |
| 2.5 < x ≤ 3.0 | 0.25 | Expensive |
| x < 0.8 | 1.0 | **Plus mandatory value-trap review** |
| x > 3.0 | 0.0 | **Hard valuation flag** |

**Required Inputs:**
- `peRatio` (company P/E, number)
- `industryPeRatio` (industry median P/E, number)

**Hard Stop (HARD_STOP):** `STAGE_A_PE_VS_INDUSTRY_HIGH`
- Triggered if x > 3.0
- Message: "Company P/E exceeds 3× industry median; valuation risk extreme"

**Conditional Warning:** `STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP`
- Triggered if x < 0.8
- Message: "Company P/E below 0.8× industry; potential value trap — review required"
- **Mandatory review** before progression (per notes)

**Data Quality Warning:**
- Negative/zero EPS → P/E not measurable (N/M) → rule unscored, DATA_QUALITY_WARNING
- Industry P/E unavailable → rule unscored, `STAGE_A_BENCHMARK_MISSING`

**Industry P/E Source v1:** Static note-derived table (editable). Later: dated peer median with source.

---

### Rule 10: Return on Assets — ROA (1.0 point max)

| Sub-Rule | Condition | Points |
|----------|-----------|--------|
| 10a | Latest FY ROA ≥ Industry Minimum ROA | +0.5 |
| 10b | 1Y ROA > 5Y Average ROA | +0.5 |

**Formula:**
```
ROA = Net Profit / Total Assets
5Y Avg ROA = Mean(ROA_LatestFY, ..., ROA_FY-4)
```

**Required Inputs:**
- `roa.latestFy` (percentage)
- `roa.avg5y` (percentage)
- `industryRoaMin` (percentage) — **from benchmark table**

**No Hard Stop** in source rules.

**Data Quality Warning:** `STAGE_A_BENCHMARK_MISSING`
- If `industryRoaMin` unavailable → 10a unscored (0.5 pts max)

**Benchmark Table (Note-Derived v1):**
| Industry | Minimum ROA |
|----------|-------------|
| IT Services | 20% |
| FMCG | 15% |
| Banks | 0.8% |
| Manufacturing | 8% |
| Capital Intensive | 5% |
| Others | Not specified |

---

## 3. Bank/NBFC Legacy Scoring (9 Points)

| Rule | Metric | Max Points | Status |
|------|--------|------------|--------|
| 1 | Sales Growth | 1.0 | Same as non-financial |
| 2 | Profit Growth | 1.0 | Same as non-financial |
| 3 | Operating Profit Margin | 1.0 | Same; benchmark required |
| 4 | ROE | 1.0 | Same scoring |
| 5 | ROCE | 1.0 | Same scoring |
| 6 | **DEBT/EQUITY** | — | **REMOVED** |
| 7 | Current Ratio | 1.0 | **Marked "unsuitable/review required"** |
| 8 | Interest Coverage | 1.0 | **Marked "unsuitable/review required"** |
| 9 | P/E vs Industry | 1.0 | Same scoring |
| 10 | ROA | 1.0 | Same scoring |

**Verdict Bands (Bank/NBFC):**
| Score | Verdict |
|-------|---------|
| ≥ 7.5 | Exceptional |
| ≥ 6.5 | Excellent |
| ≥ 5.5 | Good |
| < 5.5 | Avoid |

**Gate to Stage B:** No hard flags AND score ≥ 5.5/9

**Critical:** Current Ratio and Interest Coverage are included for legacy continuity but **must be displayed with "unsuitable/review required" badge**. Do not treat as reliable bank health measures.

**Future:** Dedicated Bank/NBFC Scorecard required (CAR, NPA, PCR, NIM, CASA, Credit Cost, LCR, Asset Quality Trends).

---

## 4. Verdict Calculation

```typescript
function calculateStageAVerdict(score: number, sector: Sector, hardStops: RedFlag[]): Verdict {
  if (hardStops.length > 0) return 'FAIL'; // Hard stop always fails
  
  const maxScore = sector === 'bank' || sector === 'nbfc' ? 9 : 10;
  const minPass = sector === 'bank' || sector === 'nbfc' ? 5.5 : 6.5;
  
  if (score >= minPass + 2.0) return 'EXCEPTIONAL'; // ≥8.5 / ≥7.5
  if (score >= minPass + 1.0) return 'EXCELLENT';    // ≥7.5 / ≥6.5
  if (score >= minPass) return 'GOOD';               // ≥6.5 / ≥5.5
  return 'AVOID';
}
```

**Important:** A score ≥ threshold **does not override** a hard stop. Both conditions must be satisfied.

---

## 5. Missing Data Behaviour

| Missing Input | Rule Impact | Flag |
|---------------|-------------|------|
| Any required financial value | Rule unscored (0 points) | DATA_QUALITY_WARNING: `missing` |
| Industry benchmark (OPM, ROA, P/E) | Sub-rule unscored | DATA_QUALITY_WARNING: `benchmark_missing` |
| 5Y history incomplete (<5 years) | CAGR/avg uses available years; flag stale | DATA_QUALITY_WARNING: `insufficient_history` |
| Data > 12 months old (annual) / > 3 months (quarterly) | Normal scoring | DATA_QUALITY_WARNING: `stale` |
| Restated values | Use latest restated | DataQuality.adjustmentStatus = 'restated' |

**Never** infer a pass from missing data. Missing = unscored = 0 points for that sub-rule.

---

## 6. Edge Cases Summary

| Edge Case | Handling |
|-----------|----------|
| D/E exactly 0.5 or 1.25 | **DECISION NEEDED** — Option A: 0.5→1.0pt, 1.25→0.5pt |
| Current Ratio exactly 1.0 | 0.5 pts (band 1–2); hard flag is <1 |
| Negative/zero EPS | P/E = N/M; rule unscored, DATA_QUALITY_WARNING |
| Negative equity | ROE/ROCE/D/E undefined; DATA_QUALITY_WARNING |
| One-off profit/loss | CONDITIONAL_WARNING; user must normalize or acknowledge |
| Structural negative WC (CR<1) | CONDITIONAL_WARNING; not auto-fail |
| Bank sector | Legacy 9-pt; CR & IntCov marked unsuitable |
| Cyclical peak earnings | CONDITIONAL_WARNING on P/E, ROE, ROCE |

---

## 7. Data Provenance Requirements

Every Stage A input must carry:

```typescript
interface StageADataProvenance {
  source: 'manual-csv' | 'screener-in' | 'bse' | 'nse' | 'provider-x';
  fetchedAt: string;           // ISO 8601
  reportedPeriod: string;      // e.g., 'FY2024'
  currency: 'INR';
  unit: 'CRORE' | 'LAKH' | 'RAW';
  adjustmentStatus: 'reported' | 'restated' | 'estimated' | 'manual';
  quality: 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
  sourceDocumentRef?: string;  // Filing URL, PDF page, annual report link
}
```

---

## 8. Test Fixtures (Reference)

**TCS Example (from notes: 8.5/10)** — *Exact inputs required for regression test*
- Sales growth: +0.5 (both positive) +0.5 (latest > 5Y) = 1.0
- Profit growth: +0.5 +0.5 = 1.0
- OPM: +0.5 (both > benchmark) +0.5 (1Y > 5Y) = 1.0
- ROE: ≥20% (0.5) + 1Y > 5Y (0.5) = 1.0
- ROCE: ≥20% (0.5) + 1Y > 5Y (0.5) = 1.0
- D/E: <0.5 = 1.0
- Current Ratio: >2 = 1.0
- Interest Coverage: >10 = 1.0
- P/E vs Industry: 0.8≤x≤2 = 1.0
- ROA: ≥industry min (0.5) + 1Y > 5Y (0.5) = 1.0
- **Total: 10.0** (but notes say 8.5 — **inputs needed to reconcile**)

**HUL Example (from notes: 8.5/10)** — *Exact inputs required*

**Action:** Preserve these as regression targets **only after exact input values and rule interpretation are recorded**. A target score without source data is not a valid test fixture.

---

## 9. Configuration (Externalized)

All thresholds, weights, and benchmarks must be in configuration (JSON/YAML), not hard-coded:

```yaml
# config/stage-a-v1.0.yaml
stageA:
  version: "1.0"
  nonFinancial:
    maxScore: 10
    minPassScore: 6.5
    rules:
      salesGrowth:
        weight: 1.0
        subRules:
          - key: "bothPositive"
            condition: "latestYoY > 0 && cagr5y > 0"
            points: 0.5
          - key: "latestExceedsCagr"
            condition: "latestYoY > cagr5y"
            points: 0.5
        hardStop:
          condition: "latestYoY < 0 || cagr5y < 0"
          flagId: "STAGE_A_SALES_GROWTH_NEGATIVE"
      # ... all 10 rules
  bankNbfcLegacy:
    maxScore: 9
    minPassScore: 5.5
    excludedRules: ["debtToEquity"]
    unsuitableRules: ["currentRatio", "interestCoverage"]
  benchmarks:
    industryOpmMin:
      "IT Services": 22
      "Pharma": 25
      "FMCG": 18
      # ...
    industryPe:
      "IT Services": 20
      "Pharma": 25
      # ...
    industryRoaMin:
      "IT Services": 20
      "FMCG": 15
      "Banks": 0.8
      "Manufacturing": 8
      "Capital Intensive": 5
```

---

*End of Stage A Scoring Specification*