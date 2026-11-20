# Rule Validation Test Cases

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `test-cases-v1.0`

---

## 1. Purpose

Comprehensive test scenarios for every scoring threshold, boundary condition, missing data case, invalid data, hard-stop behaviour, bank/NBFC exceptions, valuation formulas, position sizing, and workflow progression.

**Principle:** Every test must have **explicit inputs** and **expected outputs**. Golden fixtures (TCS, HUL) only included if exact source inputs are available.

---

## 2. Test Organization

```
packages/core/test/
├── stage-a/
│   ├── sales-growth.test.ts
│   ├── profit-growth.test.ts
│   ├── opm.test.ts
│   ├── roe.test.ts
│   ├── roce.test.ts
│   ├── debt-equity.test.ts
│   ├── current-ratio.test.ts
│   ├── interest-coverage.test.ts
│   ├── pe-vs-industry.test.ts
│   ├── roa.test.ts
│   ├── bank-variant.test.ts
│   ├── edge-cases.test.ts
│   └── golden-fixtures.test.ts
├── stage-b/
│   ├── quarterly-sales.test.ts
│   ├── quarterly-opm.test.ts
│   ├── annual-sales.test.ts
│   ├── annual-opm.test.ts
│   ├── net-profit.test.ts
│   ├── reserves-borrowings.test.ts
│   ├── cfo-trend.test.ts
│   ├── debtor-days.test.ts
│   ├── roce-trend.test.ts
│   ├── shareholding.test.ts
│   ├── edge-cases.test.ts
│   └── golden-fixtures.test.ts
├── stage-c/
│   ├── business-model.test.ts
│   ├── moat-tests.test.ts
│   └── edge-cases.test.ts
├── stage-d/
│   ├── pe-valuation.test.ts
│   ├── peg-valuation.test.ts
│   ├── pb-valuation.test.ts
│   ├── dcf-valuation.test.ts
│   ├── margin-of-safety.test.ts
│   ├── multi-method.test.ts
│   └── edge-cases.test.ts
├── stage-e/
│   ├── pattern-detection.test.ts
│   ├── technical-context.test.ts
│   ├── entry-eligibility.test.ts
│   └── edge-cases.test.ts
├── stage-f/
│   ├── position-sizing.test.ts
│   ├── risk-checks.test.ts
│   ├── overrides.test.ts
│   └── edge-cases.test.ts
├── stage-g/
│   ├── alerts.test.ts
│   ├── sell-decisions.test.ts
│   ├── journal.test.ts
│   └── returns.test.ts
├── flags/
│   ├── hard-stop-enforcement.test.ts
│   ├── conditional-warning.test.ts
│   ├── data-quality.test.ts
│   ├── valuation-warning.test.ts
│   ├── override-audit.test.ts
│   └── workflow-gates.test.ts
└── property/
    ├── determinism.test.ts
    ├── score-bounds.test.ts
    ├── missing-data-never-passes.test.ts
    └── monotonicity.test.ts
```

---

## 3. Stage A Test Cases

### 3.1 Sales Growth (Rule Key: `STAGE_A_SALES_GROWTH`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-SG-01 | Both positive, latest > CAGR | latestYoY=15%, cagr5y=12% | 1.0 | None |
| A-SG-02 | Both positive, latest ≤ CAGR | latestYoY=10%, cagr5y=12% | 0.5 | None |
| A-SG-03 | Latest negative | latestYoY=-5%, cagr5y=10% | 0.0 | HARD_STOP: `STAGE_A_SALES_GROWTH_NEGATIVE` |
| A-SG-04 | CAGR negative | latestYoY=8%, cagr5y=-2% | 0.0 | HARD_STOP: `STAGE_A_SALES_GROWTH_NEGATIVE` |
| A-SG-05 | Both zero | latestYoY=0%, cagr5y=0% | 0.0 | HARD_STOP (not >0) |
| A-SG-06 | Missing prior FY | latestFy=1000, priorFy=missing | 0.0 | DATA_QUALITY: missing |
| A-SG-07 | Restated values used | latestFy=1000 (restated), priorFy=900 | 1.0 | DataQuality: restated |

### 3.2 Profit Growth (Rule Key: `STAGE_A_PROFIT_GROWTH`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-PG-01 | Both positive, latest > CAGR | latestYoY=20%, cagr5y=15% | 1.0 | None |
| A-PG-02 | Latest negative | latestYoY=-10%, cagr5y=12% | 0.0 | HARD_STOP: `STAGE_A_PROFIT_GROWTH_NEGATIVE` |
| A-PG-03 | One-off gain suspected | latestYoY=50%, cagr5y=15%, oneOff=true | 1.0 | CONDITIONAL: `STAGE_A_GROWTH_BASE_EFFECT` |
| A-PG-04 | Negative base year (CAGR undefined) | fy5yAgo=-100, latestFy=200 | 0.0 | DATA_QUALITY: missing |

### 3.3 Operating Profit Margin (Rule Key: `STAGE_A_OPM`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-OPM-01 | Both > benchmark, 1Y > 5Y | opm1y=25%, opm5y=22%, bench=18% | 1.0 | None |
| A-OPM-02 | Both > benchmark, 1Y ≤ 5Y | opm1y=20%, opm5y=22%, bench=18% | 0.5 | None |
| A-OPM-03 | 1Y below benchmark | opm1y=15%, opm5y=22%, bench=18% | 0.0 | None |
| A-OPM-04 | Benchmark missing | opm1y=25%, opm5y=22%, bench=missing | 0.0 | DATA_QUALITY: `STAGE_A_BENCHMARK_MISSING_OPM` |
| A-OPM-05 | Negative OPM | opm1y=-5%, bench=18% | 0.0 | None |

### 3.4 ROE (Rule Key: `STAGE_A_ROE`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-ROE-01 | ≥20%, 1Y > 5Y | roe1y=25%, roe5y=22% | 1.0 | None |
| A-ROE-02 | ≥20%, 1Y ≤ 5Y | roe1y=22%, roe5y=25% | 0.5 | None |
| A-ROE-03 | 10-20%, 1Y > 5Y | roe1y=18%, roe5y=15% | 0.75 | None |
| A-ROE-04 | 10-20%, 1Y ≤ 5Y | roe1y=15%, roe5y=18% | 0.25 | None |
| A-ROE-05 | <10% | roe1y=8%, roe5y=12% | 0.0 | HARD_STOP: `STAGE_A_ROE_BELOW_10` |
| A-ROE-06 | High ROE, high D/E | roe1y=25%, roe5y=20%, de=1.5 | 1.0 | CONDITIONAL: `STAGE_A_ROE_LEVERAGE_DRIVEN` |
| A-ROE-07 | Negative equity | equity=-100, profit=50 | 0.0 | DATA_QUALITY: missing |

### 3.5 ROCE (Rule Key: `STAGE_A_ROCE`)

*Identical test cases to ROE with rule key `STAGE_A_ROCE` and flag `STAGE_A_ROCE_BELOW_10`*

### 3.6 Debt/Equity (Rule Key: `STAGE_A_DEBT_EQUITY`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-DE-01 | D/E < 0.5 | debt=100, equity=300 | 1.0 | None |
| A-DE-02 | D/E = 0.5 (boundary) | debt=100, equity=200 | **DECISION NEEDED** | — |
| A-DE-03 | 0.5 < D/E < 1.25 | debt=150, equity=200 | 0.5 | None |
| A-DE-04 | D/E = 1.25 (boundary) | debt=125, equity=100 | **DECISION NEEDED** | — |
| A-DE-05 | D/E > 1.25 | debt=200, equity=100 | 0.0 | HARD_STOP: `STAGE_A_DEBT_EQUITY_HIGH` |
| A-DE-06 | Zero debt | debt=0, equity=500 | 1.0 | None |
| A-DE-07 | Negative equity | debt=100, equity=-50 | 0.0 | DATA_QUALITY: missing |
| A-DE-08 | Bank sector | sector=bank | N/A | DATA_QUALITY: `STAGE_A_BANK_DEBT_EQUITY_NA` |

### 3.7 Current Ratio (Rule Key: `STAGE_A_CURRENT_RATIO`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-CR-01 | > 2.0 | ca=500, cl=200 | 1.0 | None |
| A-CR-02 | = 2.0 (boundary) | ca=400, cl=200 | 1.0 | None |
| A-CR-03 | 1.0 < CR < 2.0 | ca=300, cl=200 | 0.5 | None |
| A-CR-04 | = 1.0 (boundary) | ca=200, cl=200 | 0.5 | None |
| A-CR-05 | < 1.0 | ca=150, cl=200 | 0.0 | HARD_STOP: `STAGE_A_CURRENT_RATIO_LOW` |
| A-CR-06 | Structural negative WC | cr=0.8, sector=retail | 0.0 | CONDITIONAL: `STAGE_A_CURRENT_RATIO_STRUCTURAL` |
| A-CR-07 | Bank sector | sector=bank, cr=0.9 | 0.5 | DATA_QUALITY: `STAGE_A_BANK_CURRENT_RATIO_UNSUITABLE` |

### 3.8 Interest Coverage (Rule Key: `STAGE_A_INT_COVERAGE`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-IC-01 | > 10 | ebit=500, interest=20 | 1.0 | None |
| A-IC-02 | 5-10 | ebit=300, interest=40 | 0.5 | None |
| A-IC-03 | 3-5 | ebit=150, interest=40 | 0.25 | None |
| A-IC-04 | < 3 | ebit=80, interest=40 | 0.0 | HARD_STOP: `STAGE_A_INT_COVERAGE_LOW` |
| A-IC-05 | Zero interest | ebit=100, interest=0 | 1.0 | None |
| A-IC-06 | Negative EBIT | ebit=-50, interest=20 | 0.0 | DATA_QUALITY: missing |
| A-IC-07 | Bank sector | sector=bank | N/A | DATA_QUALITY: `STAGE_A_BANK_INT_COV_UNSUITABLE` |

### 3.9 P/E vs Industry (Rule Key: `STAGE_A_PE_VS_INDUSTRY`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-PE-01 | 0.8 ≤ x ≤ 2.0 | coPe=20, indPe=15 (x=1.33) | 1.0 | None |
| A-PE-02 | 2.0 < x ≤ 2.5 | coPe=40, indPe=15 (x=2.67) | 0.5 | None |
| A-PE-03 | 2.5 < x ≤ 3.0 | coPe=48, indPe=15 (x=3.2) | 0.25 | None |
| A-PE-04 | x > 3.0 | coPe=50, indPe=15 (x=3.33) | 0.0 | HARD_STOP: `STAGE_A_PE_VS_INDUSTRY_HIGH` |
| A-PE-05 | x < 0.8 | coPe=10, indPe=15 (x=0.67) | 1.0 | CONDITIONAL: `STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP` |
| A-PE-06 | Negative EPS | eps=-5, price=100 | 0.0 | DATA_QUALITY: missing |
| A-PE-07 | Zero EPS | eps=0, price=100 | 0.0 | DATA_QUALITY: missing |
| A-PE-08 | Industry P/E missing | coPe=20, indPe=missing | 0.0 | DATA_QUALITY: `STAGE_A_BENCHMARK_MISSING_PE` |

### 3.10 ROA (Rule Key: `STAGE_A_ROA`)

| Test ID | Description | Inputs | Expected Points | Expected Flags |
|---------|-------------|--------|-----------------|----------------|
| A-ROA-01 | ≥ benchmark, 1Y > 5Y | roa1y=18%, roa5y=15%, bench=12% | 1.0 | None |
| A-ROA-02 | ≥ benchmark, 1Y ≤ 5Y | roa1y=15%, roa5y=18%, bench=12% | 0.5 | None |
| A-ROA-03 | < benchmark | roa1y=10%, bench=12% | 0.0 | None |
| A-ROA-04 | Benchmark missing | roa1y=18%, roa5y=15%, bench=missing | 0.5 max | DATA_QUALITY: `STAGE_A_BENCHMARK_MISSING_ROA` |

### 3.11 Bank/NBFC Legacy Variant

| Test ID | Description | Inputs | Expected Max Score | Expected Verdict |
|---------|-------------|--------|-------------------|------------------|
| A-BANK-01 | All 9 rules ideal | All passing | 9.0 | Exceptional (≥7.5) |
| A-BANK-02 | D/E excluded | sector=bank | 9 rules scored | D/E not in ruleResults |
| A-BANK-03 | CR & IC marked unsuitable | sector=bank | 9 rules scored | unsuitableRules includes CR, IC |
| A-BANK-04 | Score 7.0 | Mixed | 7.0 | Excellent (≥6.5) |
| A-BANK-05 | Score 5.0 | Poor | 5.0 | Avoid (<5.5) |

### 3.12 Verdict Calculation

| Test ID | Sector | Score | Hard Stops | Expected Verdict |
|---------|--------|-------|------------|------------------|
| A-VER-01 | Non-fin | 9.0 | None | Exceptional |
| A-VER-02 | Non-fin | 8.0 | None | Excellent |
| A-VER-03 | Non-fin | 7.0 | None | Good |
| A-VER-04 | Non-fin | 6.0 | None | Avoid |
| A-VER-05 | Non-fin | 9.0 | 1 hard stop | FAIL |
| A-VER-06 | Bank | 8.0 | None | Exceptional |
| A-VER-07 | Bank | 6.0 | None | Good |
| A-VER-08 | Bank | 5.0 | None | Avoid |

---

## 4. Stage B Test Cases

### 4.1 Quarterly Sales YoY (Rule Key: `STAGE_B_Q_SALES`)

| Test ID | Description | Quarterly YoY Series (8Q) | Expected Points | Expected Flags |
|---------|-------------|---------------------------|-----------------|----------------|
| B-QS-01 | All positive | [5,8,12,10,15,18,20,22]% | 1.0 | None |
| B-QS-02 | 7 positive, 1 small negative | [5,8,-2,10,15,18,20,22]% | 0.75 | CONDITIONAL: `STAGE_B_Q_SALES_FLUCTUATING` |
| B-QS-03 | 6 positive, 2 negative | [5,-3,12,-1,15,18,20,22]% | 0.0 | HARD_STOP: `STAGE_B_Q_SALES_TREND_FAIL` |
| B-QS-04 | Flat (all ~0%) | [1,0,1,0,1,0,1,0]% | 0.0 | HARD_STOP |
| B-QS-05 | Only 6 quarters | [5,8,12,10,15,18]% | 1.0 | DATA_QUALITY: `INSUFFICIENT_QUARTERS` |

### 4.2 Quarterly OPM YoY (Rule Key: `STAGE_B_Q_OPM`)

| Test ID | Description | OPM YoY Change (pp) | Expected Points | Expected Flags |
|---------|-------------|---------------------|-----------------|----------------|
| B-QO-01 | All increasing | [0.5,0.8,1.0,0.7,1.2,1.5,1.8,2.0] | 1.0 | None |
| B-QO-02 | Mostly constant, occasional rise | [0.1,0.1,0.5,0.1,0.1,0.6,0.1,0.1] | 0.75 | None |
| B-QO-03 | Constant | [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1] | 0.5 | None |
| B-QO-04 | Few declines | [0.2,-0.1,0.3,-0.2,0.4,0.1,0.2,0.1] | 0.25 | CONDITIONAL: `STAGE_B_Q_OPM_SOME_DECLINES` |
| B-QO-05 | Consistently falling | [-0.2,-0.3,-0.1,-0.4,-0.2,-0.3,-0.1,-0.2] | 0.0 | HARD_STOP: `STAGE_B_Q_OPM_TREND_FAIL` |

### 4.3 Annual Sales 5Y (Rule Key: `STAGE_B_5Y_SALES`)

| Test ID | Description | Sales Series (5Y Cr) | Expected Points | Expected Flags |
|---------|-------------|----------------------|-----------------|----------------|
| B-5YS-01 | Consistently up | [1000,1200,1400,1600,1800] | 1.0 | None |
| B-5YS-02 | Up with flat | [1000,1200,1200,1400,1600] | 0.75 | None |
| B-5YS-03 | Up with dip | [1000,1200,1100,1400,1600] | 0.5 | None |
| B-5YS-04 | Flat | [1000,1000,1000,1000,1000] | 0.25 | None |
| B-5YS-05 | Declining | [1800,1600,1400,1200,1000] | 0.0 | HARD_STOP: `STAGE_B_5Y_SALES_DECLINING` |

### 4.4 Net Profit & Margin (Rule Key: `STAGE_B_NET_PROFIT`)

| Test ID | Description | Profit Trend | Margin Trend | Expected Points | Expected Flags |
|---------|-------------|--------------|--------------|-----------------|----------------|
| B-NP-01 | Rising, margin rising | [100,120,150,180,200] | [10,11,12,13,14]% | 1.0 | None |
| B-NP-02 | Rising, margin constant | [100,120,150,180,200] | [12,12,12,12,12]% | 0.75 | None |
| B-NP-03 | Rising, margin fluctuating | [100,120,150,180,200] | [12,11,13,12,14]% | 0.5 | None |
| B-NP-04 | Rising, margin falling | [100,120,150,180,200] | [15,14,13,12,11]% | 0.0 | HARD_STOP: `STAGE_B_NET_PROFIT_TREND_FAIL` |
| B-NP-05 | Profit falling | [200,180,150,120,100] | [14,13,12,11,10]% | 0.0 | HARD_STOP |

### 4.5 Reserves vs Borrowings (Rule Key: `STAGE_B_RESERVES_BORROWINGS`)

| Test ID | Description | Reserves Δ | Borrowings Δ | Expected Points | Expected Flags |
|---------|-------------|------------|--------------|-----------------|----------------|
| B-RB-01 | Reserves up, borrowings down | +500 | -200 | 1.0 | None |
| B-RB-02 | Reserves up, borrowings flat | +500 | +10 | 0.75 | None |
| B-RB-03 | Both up | +500 | +200 | 0.5 | None |
| B-RB-04 | Both flat | +10 | +5 | 0.25 | None |
| B-RB-05 | Reserves down | -100 | -50 | 0.0 | HARD_STOP: `STAGE_B_RESERVES_BORROWINGS_FAIL` |

### 4.6 CFO Trend (Rule Key: `STAGE_B_CFO_TREND`)

*Same rubric as Net Profit, applied to CFO*

| Test ID | Description | CFO Series | CFO Margin Trend | Expected Points | Expected Flags |
|---------|-------------|------------|------------------|-----------------|----------------|
| B-CFO-01 | Rising, margin rising | [150,180,220,250,280] | Rising | 1.0 | None |
| B-CFO-02 | CFO-PAT divergence 25% | CFO=800, PAT=1000 (5Y cum) | — | 1.0 | DATA_QUALITY: `STAGE_B_CFO_PAT_DIVERGENCE` |

### 4.7 Debtor Days (Rule Key: `STAGE_B_DEBTOR_DAYS`)

| Test ID | Description | Debtor Days (5Y) | Expected Points | Expected Flags |
|---------|-------------|------------------|-----------------|----------------|
| B-DD-01 | Consistently falling | [60,55,50,45,40] | 1.0 | None |
| B-DD-02 | Almost constant | [45,46,45,46,45] | 0.75 | None |
| B-DD-03 | Fluctuating | [40,50,45,55,42] | 0.5 | None |
| B-DD-04 | Rising | [40,45,50,55,60] | 0.0 | CONDITIONAL: `STAGE_B_DEBTOR_DAYS_RISING` |
| B-DD-05 | > 120 days latest | [80,90,100,110,130] | 0.0 | HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH` |
| B-DD-06 | > 50% rise in 5Y | [40,45,50,55,65] (62.5% rise) | 0.0 | HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH` |

### 4.8 ROCE Trend (Rule Key: `STAGE_B_ROCE_TREND`)

| Test ID | Description | ROCE Series (5Y) | Expected Points | Expected Flags |
|---------|-------------|------------------|-----------------|----------------|
| B-RT-01 | Consistently rising | [18,20,22,24,26]% | 1.0 | None |
| B-RT-02 | Maintained high | [25,25,25,25,25]% | 0.75 | None |
| B-RT-03 | Rising fluctuating | [18,22,20,24,23]% | 0.5 | None |
| B-RT-04 | Falling | [26,24,22,20,18]% | 0.0 | HARD_STOP: `STAGE_B_ROCE_TREND_FALLING` |

### 4.9 Shareholding (Rule Key: `STAGE_B_SHAREHOLDING`)

| Test ID | Description | Promoter | FII+DII | Public | Expected Points | Expected Flags |
|---------|-------------|----------|---------|--------|-----------------|----------------|
| B-SH-01 | Ideal | Up | Up | Down | 1.0 | None |
| B-SH-02 | Up/Flat/Down | Up | Flat | Down | 0.75 | None |
| B-SH-03 | Up/Down/Down | Up | Down | Down | 0.75 | None |
| B-SH-04 | Flat/Up/Down | Flat | Up | Down | 0.5 | None |
| B-SH-05 | Up/Down/Up (incomplete) | Up | Down | Up | 0.0 | CONDITIONAL: `STAGE_B_SHAREHOLDING_INCOMPLETE` |
| B-SH-06 | Public rising, inst falling | Down | Down | Up | 0.0 | HARD_STOP: `STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL` |
| B-SH-07 | Public ≥ 50% | Any | Any | 52% | 0.0 | HARD_STOP: `STAGE_B_PUBLIC_HOLDING_GE_50` |
| B-SH-08 | Promoter pledge 25% | — | — | — | (normal) | CONDITIONAL: `STAGE_B_PROMOTER_PLEDGE_HIGH` |

### 4.10 Stage B Gate

| Test ID | Score | Hard Flags | Expected Gate Result |
|---------|-------|------------|----------------------|
| B-GATE-01 | 8.0 | None | PASS (proceed to C) |
| B-GATE-02 | 7.0 | None | PASS (≥6.5) |
| B-GATE-03 | 6.0 | None | FAIL (<6.5) |
| B-GATE-04 | 9.0 | 1 hard stop | FAIL |
| B-GATE-05 | 7.0 | 1 conditional unacked | FAIL (requires acknowledgment) |

---

## 5. Stage C Test Cases

### 5.1 Moat Tests

| Test ID | Test Results (1-5) | Moat Score | Moat Pass | Flags |
|---------|-------------------|------------|-----------|-------|
| C-MOAT-01 | [P,P,P,P,P] | 5 | Yes | None |
| C-MOAT-02 | [P,P,P,F,F] | 3 | Yes | None |
| C-MOAT-03 | [F,P,P,P,P] | 4 | **No** (Test 1 fail) | `STAGE_C_MOAT_TEST1_FAIL` |
| C-MOAT-04 | [P,F,F,F,F] | 1 | No | `STAGE_C_MOAT_SCORE_BELOW_3` |
| C-MOAT-05 | [U,P,P,P,P] (U=uncertain) | 4 | No | `STAGE_C_MOAT_TEST1_UNCERTAIN` |
| C-MOAT-06 | [P,P,P,P,P] but Test 3 evidence='inference' only | 5 | No | `STAGE_C_EVIDENCE_MISSING` |

### 5.2 Business Model

| Test ID | Questions Answered | Evidence Each | Expected |
|---------|-------------------|---------------|----------|
| C-BM-01 | 3/3 | ≥1 direct each | businessModelComplete=true |
| C-BM-02 | 2/3 | — | businessModelComplete=false, FLAG |

---

## 6. Stage D Test Cases

### 6.1 P/E Valuation

| Test ID | Inputs | Expected Fair Value | Applicability | Confidence |
|---------|--------|---------------------|---------------|------------|
| D-PE-01 | normEPS=50, fairPE=25 | 1250 | suitable | high |
| D-PE-02 | normEPS=50, fairPE=25, price=1100 | 1250 | suitable | high |
| D-PE-03 | eps=-5 (negative) | N/M | unsuitable | N/A |
| D-PE-04 | CoPE=40, IndPE=15 (x=2.67) | — | limited | medium |
| D-PE-05 | Cyclical: peak EPS=80, mid-cycle=50 | 1250 (mid-cycle) | limited | medium |

### 6.2 PEG

| Test ID | P/E | Growth Rate | PEG | Band | Applicability |
|---------|-----|-------------|-----|------|---------------|
| D-PEG-01 | 34 | 50% | 0.68 | undervalued | suitable |
| D-PEG-02 | 40 | 15% | 2.67 | overvalued | suitable |
| D-PEG-03 | 20 | -5% | N/M | N/A | unsuitable |
| D-PEG-04 | 25 | 0% | N/M | N/A | unsuitable |

### 6.3 P/B

| Test ID | Price | BVPS | Sector | P/B | Band |
|---------|-------|------|--------|-----|------|
| D-PB-01 | 200 | 100 | Bank | 2.0 | fair |
| D-PB-02 | 400 | 100 | Bank | 4.0 | expensive |
| D-PB-03 | 150 | 100 | Manufacturing | 1.5 | cheap/fair boundary |
| D-PB-04 | 100 | -50 (neg equity) | Any | N/M | unsuitable |

### 6.4 DCF

| Test ID | Inputs | Expected Fair Value | Flags |
|---------|--------|---------------------|-------|
| D-DCF-01 | FCF=100Cr, g=12%, WACC=10%, gT=5%, 5Y, NetDebt=0, Shares=10Cr | ~1450 | None |
| D-DCF-02 | Terminal value 80% of total | — | `STAGE_D_DCF_TERMINAL_DEPENDENCE` |
| D-DCF-03 | WACC=6% (too low) | — | `STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE` |
| D-DCF-04 | FCF negative 2 of 5 years | — | `STAGE_D_DCF_UNSTABLE_CASH_FLOW` |

### 6.5 Margin of Safety & BuyReady

| Test ID | Primary FV | Price | MOS | Confidence | Valuation Warnings | BuyReady |
|---------|------------|-------|-----|------------|-------------------|----------|
| D-MOS-01 | 1000 | 750 | 25% | high | None | **Yes** |
| D-MOS-02 | 1000 | 850 | 15% | high | None | No (MOS<20%) |
| D-MOS-03 | 1000 | 750 | 25% | low | None | No (confidence=low) |
| D-MOS-04 | 1000 | 750 | 25% | high | 1 warning | No (warning blocks) |
| D-MOS-05 | 1000 | 750 | 25% | high | 1 warning overridden | **Yes** (with override) |

### 6.6 Multi-Method

| Test ID | Methods Available | Primary Selected | Range | Cross-Check |
|---------|------------------|------------------|-------|-------------|
| D-MM-01 | PE(suitable), PEG(suitable), PB(limited), DCF(suitable) | PE (sector=FMCG) | [900, 1200] | PEG supports, PB limited |
| D-MM-02 | PE(unsuitable), PEG(unsuitable), PB(suitable), DCF(suitable) | PB (sector=Bank) | [180, 220] | DCF cross-check |
| D-MM-03 | PE=1200, PEG=800, PB=1000, DCF=1100 | PE | [800, 1200] | Wide range → confidence=low |

---

## 7. Stage E Test Cases

### 7.1 Pattern Detection

| Test ID | Pattern | OHLCV Structure | Detected | QualityScore |
|---------|---------|-----------------|----------|--------------|
| E-PD-01 | Bullish Engulfing | C1: bearish, C2: bullish engulfs | Yes | 0.95 |
| E-PD-02 | Hammer | Long lower shadow, small body | Yes | 0.90 |
| E-PD-03 | Morning Star | 3-candle structure valid | Yes | 0.92 |
| E-PD-04 | Three White Soldiers | 3 bullish, each opens in prior body | Yes | 0.88 |
| E-PD-05 | Bearish Engulfing | C1: bullish, C2: bearish engulfs | Yes | 0.95 |

### 7.2 Technical Context

| Test ID | Context | contextScore |
|---------|---------|--------------|
| E-TC-01 | Downtrend, at support, volume spike, near 20MA rising | 0.9 |
| E-TC-02 | Uptrend, at resistance, low volume | 0.3 |
| E-TC-03 | Sideways, no clear levels | 0.5 |

### 7.3 Entry Eligibility

| Test ID | Pattern Confirmed | In Buy Zone | R:R ≥ 1.5 | Invalidation < Entry | Eligible |
|---------|------------------|-------------|-----------|---------------------|----------|
| E-EL-01 | Yes | Yes | 2.0 | Yes | **Yes** |
| E-EL-02 | No | Yes | 2.0 | Yes | No (unconfirmed) |
| E-EL-03 | Yes | No (price > maxBuy) | 2.0 | Yes | No (outside zone) |
| E-EL-04 | Yes | Yes | 1.2 | Yes | No (R:R low) |
| E-EL-05 | Yes | Yes | 2.0 | No (stop ≥ entry) | No (invalid) |

---

## 8. Stage F Test Cases

### 8.1 Position Sizing

| Test ID | Portfolio | Risk% | Entry | Stop | Raw Qty | Lot | ADV Cap | Cash Cap | Final Qty |
|---------|-----------|-------|-------|------|---------|-----|---------|----------|-----------|
| F-PS-01 | 1Cr | 1% | 100 | 95 | 2000 | 1 | 50000 | 1Cr | 2000 |
| F-PS-02 | 1Cr | 1% | 100 | 95 | 2000 | 100 | 50000 | 1Cr | 2000 |
| F-PS-03 | 1Cr | 1% | 100 | 95 | 2000 | 1 | 1000 (5% ADV) | 1Cr | 1000 |
| F-PS-04 | 1Cr | 1% | 100 | 95 | 2000 | 1 | 50000 | 50000 | 500 |
| F-PS-05 | 1Cr | 1% | 100 | 100 | Div/0 | — | — | — | 0 (blocked) |

### 8.2 Risk Checks

| Test ID | Check | Actual | Limit | Passed | Blocked |
|---------|-------|--------|-------|--------|---------|
| F-RC-01 | Risk Budget | 1L | 1L | Yes | No |
| F-RC-02 | Stock Concentration | 11% | 10% | No | **Yes** |
| F-RC-03 | Sector Concentration | 32% | 30% | No | **Yes** |
| F-RC-04 | Liquidity | 20% ADV | 5% ADV | No | Conditional |
| F-RC-05 | Cash | 2L | 1L | No | **Yes** |
| F-RC-06 | Risk/Reward | 1.2 | 1.5 | No | **Yes** |
| F-RC-07 | Stop Below Entry | 100 | <100 | No | **Yes** |

### 8.3 Overrides

| Test ID | Failed Check | Override Reason Length | Override Accepted | Result |
|---------|--------------|------------------------|-------------------|--------|
| F-OV-01 | Stock Concentration | 60 chars | Yes | Ready with override record |
| F-OV-02 | Stock Concentration | 30 chars | No (rejected) | Still blocked |
| F-OV-03 | Risk Budget | 60 chars | Yes | Ready with override record |

---

## 9. Stage G Test Cases

### 9.1 Alerts

| Test ID | Trigger | Alert Type | Severity | Auto-Acknowledge |
|---------|---------|------------|----------|------------------|
| G-AL-01 | Price hits stop | price-stop | critical | No |
| G-AL-02 | Quarterly results out | fundamental-results | info | No |
| G-AL-03 | ROCE falling | fundamental-deterioration | warning | No |
| G-AL-04 | Thesis broken | thesis-broken | critical | No |
| G-AL-05 | Portfolio drawdown 16% | portfolio-drawdown | critical | No |

### 9.2 Sell Decisions

| Test ID | Trigger | Decision | Journal Entry | Position After |
|---------|---------|----------|---------------|----------------|
| G-SD-01 | Stop hit | Sell | action=sell, qty=all | Closed |
| G-SD-02 | Thesis broken | Hold | action=none | Unchanged |
| G-SD-03 | Fair value reached | Trim 50% | action=trim, qty=50% | Halved |
| G-SD-04 | Overvalued 30% | Hold | action=none | Unchanged |

### 9.3 Returns

| Test ID | Cash Flows | Method | Expected Return |
|---------|------------|--------|-----------------|
| G-RT-01 | Buy 100@100, Sell 100@120 | MWR | 20% |
| G-RT-02 | Buy 100@100, Trim 50@110, Sell 50@120 | MWR | IRR of [-10000, +5500, +6000] |
| G-RT-03 | Portfolio: multiple trades | TWR | Chain sub-period returns |

---

## 10. Red Flag Engine Test Cases

| Test ID | Scenario | Expected |
|---------|----------|----------|
| RF-01 | Stage A: ROE 8% → HARD_STOP created | Gate blocks; flag ACTIVE |
| RF-02 | Stage A: HARD_STOP overridden with reason | Flag OVERRIDDEN; override record; gate passes |
| RF-03 | Stage A: HARD_STOP acknowledged (wrong action) | Error: requires override |
| RF-04 | Stage B: CONDITIONAL unacked | Gate blocks until acknowledged |
| RF-05 | Stage B: CONDITIONAL acknowledged with reason | Flag ACKNOWLEDGED; gate passes |
| RF-06 | Stage D: VALUATION_WARNING | Stage D passes; Stage F (BuyReady) blocks |
| RF-07 | Stage D: VALUATION_WARNING overridden | Stage F passes; override record |
| RF-08 | Stage A: Missing data → DATA_QUALITY | Rule unscored; flag ACTIVE; gate blocks |
| RF-09 | Data refresh clears condition | Flag RESOLVED/EXPIRED |
| RF-10 | Override reason < 50 chars | Rejected |
| RF-11 | Multiple hard stops | Each requires separate override |
| RF-12 | Audit trail: original + override both queryable | Both returned, linked by originalFlagId |

---

## 11. Property-Based Tests

| Test ID | Property | Description |
|---------|----------|-------------|
| PROP-01 | Determinism | Same input + same ruleSetVersion → identical output (1000 runs) |
| PROP-02 | Score Bounds | All rule points ∈ [0, maxPoints]; total ∈ [0, maxScore] |
| PROP-03 | Missing Never Passes | Any missing required input → rule points = 0, DATA_QUALITY flag |
| PROP-04 | Hard Stop Immutability | HARD_STOP flag never auto-resolves without data change |
| PROP-05 | Override Preserves Original | After override, original flag.status ≠ 'ACTIVE' but originalFlagId preserved |
| PROP-06 | Bank Variant Max 9 | Bank sector → sum of maxPoints = 9 |
| PROP-07 | Valuation Range | Range.low ≤ Range.high; both from suitable methods only |
| PROP-08 | Position Size Integer | Final quantity is integer multiple of lot size |
| PROP-09 | Risk Budget | plannedLossAtStop ≤ portfolioValue × riskPct (if not overridden) |
| PROP-10 | Journal Immutability | PostTradeReview cannot modify original JournalEntry fields |

---

## 12. Golden Fixtures (Only With Exact Inputs)

| Fixture | Company | Stage | Source | Status |
|---------|---------|-------|--------|--------|
| GF-01 | TCS | A | Handwritten notes (8.5/10) | **PENDING: Exact inputs needed** |
| GF-02 | HUL | A | Handwritten notes (8.5/10) | **PENDING: Exact inputs needed** |
| GF-03 | [User Portfolio] | A→G | Manual entry | **PENDING: User provides** |

**Rule:** Do not commit golden fixtures without verified source inputs. Placeholder tests marked `PENDING_INPUTS`.

---

## 13. Test Execution Requirements

| Requirement | Tool | Command |
|-------------|------|---------|
| Unit Tests | Vitest | `pnpm test:core` |
| Property Tests | fast-check | `pnpm test:property` |
| Integration Tests | Vitest + Testcontainers | `pnpm test:integration` |
| Golden Fixtures | Vitest | `pnpm test:golden` |
| CI Pipeline | GitHub Actions | `.github/workflows/test.yml` |

**Coverage Targets:**
- Lines: ≥ 90%
- Branches: ≥ 85%
- Functions: ≥ 90%
- Statements: ≥ 90%

---

## 14. Test Data Management

```typescript
// Test data factory pattern
export function createStageAInput(overrides: Partial<StageAInput> = {}): StageAInput {
  return {
    companyId: 'TEST-COMPANY',
    asOfDate: '2026-11-15T00:00:00Z',
    financials: {
      sales: { latestFy: 1000, priorFy: 900, fy5yAgo: 600, cagr5y: 0.107 },
      profit: { latestFy: 200, priorFy: 180, fy5yAgo: 100, cagr5y: 0.149 },
      operatingProfit: { latestFy: 250, fy5yAgo: 150 },
      revenue: { latestFy: 1000, fy5yAgo: 600 },
      netProfit: { latestFy: 200, fy5yAgo: 100 },
      totalDebt: 100,
      totalEquity: 500,
      currentAssets: 400,
      currentLiabilities: 150,
      interestExpense: 10,
      ebit: 250,
      eps: 50,
      peRatio: 20,
      industryPeRatio: 15,
      roa: { latestFy: 0.15, avg5y: 0.12 },
      industryRoaMin: 0.08,
      roe: { latestFy: 0.25, avg5y: 0.22 },
      roce: { latestFy: 0.28, avg5y: 0.24 },
      opm: { latestFy: 0.25, avg5y: 0.22 },
      industryOpmMin: 0.18,
    },
    sector: 'non-financial',
    dataProvenance: createFullProvenance('manual-csv'),
    ...overrides,
  };
}
```

---

## 15. Decisions Needed Before Test Finalization

| # | Decision | Impact on Tests |
|---|----------|-----------------|
| 1 | D/E boundary inclusivity | A-DE-02, A-DE-04 expected points |
| 2 | Stage B pass threshold | B-GATE-03 pass/fail |
| 3 | PEG growth rate source | D-PEG-01/02 growth input |
| 4 | Moat scoring rules | C-MOAT-01 through 06 pass/fail |
| 5 | DCF in MVP | D-DCF-01 through 04 included/excluded |
| 6 | Return method | G-RT-01 through 03 expected values |

---

*End of Rule Validation Test Cases*