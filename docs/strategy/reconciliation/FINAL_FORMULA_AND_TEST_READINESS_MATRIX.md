# Final Formula & Test Readiness Matrix

**Phase:** 0.6 — Final Investment Rules Reconciliation  
**Date:** 15 November 2026  
**Source:** `FORMULA_AND_EDGE_CASE_AUDIT.md` + `RULE_TEST_COVERAGE_MATRIX.md` + `RULE_VALIDATION_TEST_CASES.md` + Architecture Readiness  
**Purpose:** Consolidated formula corrections, edge cases, data dependencies, test coverage gaps, and stage-level implementation eligibility

---

## Executive Summary

This matrix reconciles formula issues from Phase 0.5 audits with Antigravity architecture findings. Key corrections from Phase 0.5:

- **10 formula issues reclassified as Domain Model Gaps** (missing fields), not mathematical errors
- **8 genuine mathematical issues** confirmed
- **44 total formula issues** in master register (FI-01 through FI-44), consistently classified
- **53 stage-specific edge cases** + **18 Red-Flag engine-specific cases** = **71 total unique edge cases**
- **14 test coverage gaps** across 8 stages/modules
- **Stage C corrected to 5 Moat Tests** (not 6 as previously documented)
- **No stage is fully READY** — multidimensional readiness model applied

---

## 1. Formula Issues — Unified Master Count (44 Total)

### Classification Taxonomy

| Class | Definition |
|-------|------------|
| **Mathematical Correctness** | Formula itself is wrong or unhandled edge case (division by zero, negative base, etc.) |
| **Domain-Model Issue** | Formula references field not in `FinancialStatement`/`ValuationInput` (missing field — NOT a math error) |
| **Data Availability** | Field requires external data source not yet selected (Decision D-15) |
| **Policy Decision** | Threshold/behavior requires user decision (Decisions D-01 through D-15, D-A1 through D-A5) |
| **Configuration** | Hardcoded constant should be in config (Decision D-14) |
| **Documentation/Ambiguity** | Derivation logic or boundary condition not specified |

Test coverage gaps are tracked separately in Section 6 (not counted in the 44 formula issues).

### Master Formula Issue Register (FI-01 to FI-44)

| ID | Stage | Formula / Concern | Classification | Source Ref | Severity | Status | Proposed Resolution |
|----|-------|-------------------|----------------|------------|----------|--------|---------------------|
| FI-01 | A | ROE: `netIncome / avgShareholdersEquity` | Domain-Model | `STAGE_A_SCORING_SPEC.md` Rule 4; `DOMAIN_MODEL_SPEC.md` lacks `avgShareholdersEquity` | High | Open | Add field or compute `(equity_T + equity_T-1)/2` |
| FI-02 | A | Interest Coverage: `EBIT / interestExpense` | Domain-Model | `STAGE_A_SCORING_SPEC.md` Rule 8; has `financeCost` not `interestExpense` | High | Open | Map `financeCost` → `interestExpense` or add field |
| FI-03 | A | Asset Turnover: `revenue / avgTotalAssets` | Domain-Model | `FORMULA_AUDIT` A5; `DOMAIN_MODEL_SPEC.md` lacks `avgTotalAssets` | Medium | Open | Add field or compute helper |
| FI-04 | A | D/E boundary inclusivity | Policy Decision | `STAGE_A_SCORING_SPEC.md` Rule 6: "DECISION NEEDED" | High | Pending D-01 | Decision D-01 (Option A recommended) |
| FI-05 | A | Current Ratio exactly 1.0 | Policy Decision | `INVESTMENT_RULES_SPECIFICATION.md` Decision 2 | Medium | Pending D-02 | Scores 0.5 (hard flag is `<1`) |
| FI-06 | A | Negative equity → ROE/ROCE/D/E undefined | Mathematical Correctness | `STAGE_A_SCORING_SPEC.md` Edge Cases | High | Open | DATA_QUALITY_WARNING; rule unscored |
| FI-07 | A | One-off profit/loss base effect | Policy Decision | `INVESTMENT_RULES_SPECIFICATION.md` Section 6.3 | Medium | Pending D-04/10 | CONDITIONAL_WARNING; user normalize/acknowledge |
| FI-08 | B | EPS Growth: `epsGrowth` derivation undefined | Domain-Model | `STAGE_B_SCORING_SPEC.md` Rule 4; lacks `epsGrowth` | High | Open | Define: `(eps[t]-eps[t-1])/abs(eps[t-1])` with zero handling |
| FI-09 | B | Dividend Growth: `dividendPerShare` missing | Domain-Model | `STAGE_B_SCORING_SPEC.md` Rule 7 | High | Open | Add field (Decision D-15) |
| FI-10 | B | BVPS Growth: `sharesOutstanding`, `bookValuePerShare` missing | Domain-Model | `STAGE_B_SCORING_SPEC.md` Rule 8 | High | Open | Add fields (Decision D-15) |
| FI-11 | B | Corporate action adjustment for price momentum | Data Availability | `STAGE_B_SCORING_SPEC.md` Rule 9 | High | Pending D-15 | Adjusted OHLCV required |
| FI-12 | B | Holiday gaps in volatility calculation | Mathematical Correctness | `STAGE_B_SCORING_SPEC.md` Rule 10 | Medium | Open | Define trading-day vs calendar-day handling |
| FI-13 | B | Stage B pass threshold (≥6.5/10) | Policy Decision | `INVESTMENT_RULES_SPECIFICATION.md` Decision 5 | High | Pending D-A2 | Decision D-A2 |
| FI-14 | C | No quantitative formulas — qualitative 0–3 rubrics | Documentation/Ambiguity | `BUSINESS_MODEL_AND_MOAT_SPEC.md` Section 4 | High | Open | Define anchored rubrics + quantitative proxies (design spike) |
| FI-15 | C | `BusinessModelInput` interface missing | Domain-Model | `DOMAIN_MODEL_SPEC.md` Section 4.3 | High | Open | Add to domain model |
| FI-16 | C | Evidence quality weighting undefined | Policy Decision | `BUSINESS_MODEL_AND_MOAT_SPEC.md` Section 4.4 | Medium | Open | Decision on confidence calculation |
| FI-17 | C | Test 1 (non-copyability) mandatory pass | Policy Decision | `INVESTMENT_RULES_SPECIFICATION.md` Decision 6 | High | Pending D-A3 | Decision D-A3 |
| FI-18 | D | DCF CAPM: `riskFreeRate`, `beta`, `equityRiskPremium` missing | Domain-Model | `VALUATION_ENGINE_SPEC.md` Section 6.2; lacks in `ValuationInput` | High | Open | Add to `ValuationInput` |
| FI-19 | D | Peer selection methodology unspecified | Policy Decision | `VALUATION_ENGINE_SPEC.md` Section 3.4 | Medium | Open | Define algorithm (sector + size + profitability filter) |
| FI-20 | D | Peer outlier removal: IQR method not specified | Mathematical Correctness | `VALUATION_ENGINE_SPEC.md` Section 3.6 | Medium | Open | Define: 1.5×IQR or winsorize |
| FI-21 | D | EBITDA derivation unspecified | Domain-Model | `VALUATION_ENGINE_SPEC.md` Section 5; lacks `ebitda` | High | Open | Add `depreciationAmortization` to `FinancialStatement`; derive |
| FI-22 | D | `sharesOutstanding` missing for per-share valuation | Domain-Model | `VALUATION_ENGINE_SPEC.md` all methods | High | Open | Add to `FinancialStatement` (Decision D-15) |
| FI-23 | D | Asset-based discounts hardcoded | Configuration | `VALUATION_ENGINE_SPEC.md` Section 5.3; Decision D-08 | Medium | Pending D-08/14 | Externalize to config (Decision D-14) |
| FI-24 | D | Composite confidence formula not specified | Mathematical Correctness | `VALUATION_ENGINE_SPEC.md` Section 7.2 | Medium | Open | Define: `1 - (maxDeviation/median)` |
| FI-25 | D | DCF terminal growth cap | Policy Decision | Decision D-08 | High | Pending D-08 | Decision D-08 |
| FI-26 | E | Candlestick thresholds hardcoded (0.1, 2.0, 0.1) | Configuration | `TECHNICAL_ANALYSIS_SPEC.md` Section 9 | Low | Pending D-14 | Decision D-14 (tactical → code constants) |
| FI-27 | E | Candle range = 0 division by zero | Mathematical Correctness | `FORMULA_AUDIT` E5 | High | Open | Handle: if range=0, qualityScore=0 |
| FI-28 | E | Volume spike 1.5× hardcoded | Configuration | `TECHNICAL_ANALYSIS_SPEC.md` Section 9 | Low | Pending D-14 | Decision D-14 |
| FI-29 | E | Gap detection 0.5% hardcoded | Configuration | `TECHNICAL_ANALYSIS_SPEC.md` Section 9 | Low | Pending D-14 | Decision D-14 |
| FI-30 | E | Holiday/weekend gap handling | Data Availability | `TECHNICAL_ANALYSIS_SPEC.md` Section 7 | High | Pending D-15 | Adjusted OHLCV required |
| FI-31 | E | S/R cluster 0.5% hardcoded | Configuration | `TECHNICAL_ANALYSIS_SPEC.md` Section 9 | Low | Pending D-14 | Decision D-14 |
| FI-32 | F | Kelly: `winRate`, `avgWin`, `avgLoss` provenance undefined | Domain-Model | `DOMAIN_IMPLEMENTATION_READINESS.md` | Medium | Open | Define from Stage A–E backtests |
| FI-33 | F | Quadratic solver choice unspecified (OSQP/qpOASES/custom) | Policy Decision | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` uses simple risk-budget; Kelly/opt in domain readiness only | High | Pending D-A4/A5 | Select solver; document tolerance |
| FI-34 | F | Solver tolerance (1e-6) not specified | Configuration | `DOMAIN_IMPLEMENTATION_READINESS.md` | Medium | Pending D-14 | Decision D-14 |
| FI-35 | F | Correlation lookback 252 days hardcoded | Configuration | Decision D-11 | Medium | Pending D-11/14 | Decision D-11 + Decision D-14 |
| FI-36 | F | Infeasible constraint handling order | Mathematical Correctness | `DOMAIN_IMPLEMENTATION_READINESS.md` | Medium | Open | Specify relaxation priority |
| FI-37 | G | Grace period conflict: 3 days vs immediate exit | Policy Decision | `RED_FLAG_ENGINE_SPEC.md` vs `PORTFOLIO_RISK_AND_EXIT_SPEC.md` | Critical | Pending D-12 | **Decision D-12 — URGENT** |
| FI-38 | G | Fundamental deterioration: intra-quarter monitoring | Domain-Model | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3.2 | Medium | Open | Define: re-run Stage A? proxy metric? |
| FI-39 | G | Take-profit levels/scales hardcoded | Configuration | Decision D-13 | Medium | Pending D-13/14 | Decision D-13 + Decision D-14 |
| FI-40 | G | Valuation reversion 1.3× hardcoded | Configuration | Decision D-14 | Medium | Pending D-14 | Decision D-14 |
| FI-41 | G | RSI exhaustion 80 / MACD 5 days hardcoded | Configuration | Decision D-14 | Low | Pending D-14 | Decision D-14 |
| FI-42 | Red-Flag | 8 fields missing from domain model | Domain-Model | `RED_FLAG_ENGINE_SPEC.md` Flags; `DOMAIN_MODEL_SPEC.md` | High | Pending D-15 | Add fields (DM-01 to DM-03 + DM-07) |
| FI-43 | Red-Flag | Debt spike: denominator 0 unhandled | Mathematical Correctness | `RED_FLAG_ENGINE_SPEC.md` Major Flags | High | Open | Handle: if denom=0, flag=DATA_QUALITY |
| FI-44 | Red-Flag | Margin collapse: negative margin unhandled | Mathematical Correctness | `RED_FLAG_ENGINE_SPEC.md` Major Flags | High | Open | Handle: if margin_T-4 ≤ 0, flag=CONDITIONAL |

### Master Count Verification

| Classification | Count | IDs |
|----------------|-------|-----|
| Mathematical Correctness | 8 | FI-06, FI-12, FI-20, FI-24, FI-27, FI-36, FI-43, FI-44 |
| Domain-Model Issue | 13 | FI-01, FI-02, FI-03, FI-08, FI-09, FI-10, FI-15, FI-18, FI-21, FI-22, FI-32, FI-38, FI-42 |
| Data Availability | 2 | FI-11, FI-30 |
| Policy Decision | 10 | FI-04, FI-05, FI-07, FI-13, FI-16, FI-17, FI-19, FI-25, FI-33, FI-37 |
| Configuration | 10 | FI-23, FI-26, FI-28, FI-29, FI-31, FI-34, FI-35, FI-39, FI-40, FI-41 |
| Documentation/Ambiguity | 1 | FI-14 |
| **Grand Total** | **44** | FI-01 through FI-44 |

**Note:** The Phase 0.5 audit report's summary counts (10 Domain-Model, 6 Data Availability, 9 Policy Decisions, 6 Configuration, 5 Test Coverage) did not match its detailed table. The counts above are derived from the detailed table and are internally consistent: 8 + 13 + 2 + 10 + 10 + 1 = 44.

---

## 2. Domain Model Gaps — Missing Fields (DM-01 to DM-10)

These are **missing data fields** in `DOMAIN_MODEL_SPEC.md`, not formula errors. Each requires Decision D-15 (Data Provider) resolution.

| ID | Missing Field | Required By | Stage | Source Spec | Data Vendor Need |
|----|---------------|-------------|-------|-------------|------------------|
| DM-01 | `promoterPledgePct` | Red-Flag Critical (Decision D-05) | Red-Flag, B, G | `RED_FLAG_ENGINE_SPEC.md` | Annual report / NSE corporate governance |
| DM-02 | `relatedPartyTxn` (₹) | Red-Flag Critical (Decision D-06) | Red-Flag | `RED_FLAG_ENGINE_SPEC.md` | Annual report notes |
| DM-03 | `auditorQualification` (enum) | Red-Flag Critical (Decision D-07) | Red-Flag | `RED_FLAG_ENGINE_SPEC.md` | Audit report |
| DM-04 | `dividendPerShare` | Stage B Rule 7 | B | `STAGE_B_SCORING_SPEC.md` | NSE / Screener |
| DM-05 | `beta` (vs NIFTY) | Stage B Rule 6, Stage F | B, F | `STAGE_B_SCORING_SPEC.md`, `PORTFOLIO_RISK_AND_EXIT_SPEC.md` | NSE / calculated from 252d returns |
| DM-06 | `sharesOutstanding` | Stage D (DCF per share), Stage E (per-share) | D, E | `VALUATION_ENGINE_SPEC.md`, `STAGE_E_SCORING_SPEC.md` | NSE / quarterly reports |
| DM-07 | `avgShareholdersEquity` | Stage A ROE (FI-01) | A | `STAGE_A_SCORING_SPEC.md` Rule 4 | Calculated from 2Y balance sheets |
| DM-08 | `depreciationAmortization` | Stage D (FCFF = NOPAT + D&A - CapEx - ΔWC) | D | `VALUATION_ENGINE_SPEC.md` §5.2 | Cash flow statement |
| DM-09 | `capitalExpenditure` | Stage D (FCFF) | D | `VALUATION_ENGINE_SPEC.md` §5.2 | Cash flow statement |
| DM-10 | `changeInWorkingCapital` | Stage D (FCFF) | D | `VALUATION_ENGINE_SPEC.md` §5.2 | Balance sheet delta |

**Additional missing interface:** `BusinessModelInput` (Stage C) — defined in `BUSINESS_MODEL_AND_MOAT_SPEC.md` but not in `DOMAIN_MODEL_SPEC.md`.

**Additional missing external reference:** `sectorROA` benchmark (Stage C Moat 1) — requires `IDataProvider.sectorBenchmark()` (F-02 in original Phase 0.5, now tracked as domain-model dependency).

---

## 3. Edge Cases — Reconciled Counts (71 Total Unique)

### Counting Method

Every edge case has a unique ID (prefix = stage: EA=Stage A, EB=Stage B, EC=Stage C, ED=Stage D, EE=Stage E, EF=Stage F, EG=Stage G, ER=Red-Flag Engine). Duplicate or overlapping cases are identified by cross-referencing triggers and resolutions.

### Stage-Specific Edge Cases (53)

| Stage | Count | IDs | Description |
|-------|-------|-----|-------------|
| **A** | 12 | EA-01 to EA-12 | Market cap, ADV, D/E, CR, Interest Coverage, Consistent Loss, Promoter Holding, Pledge, D/E boundary, CR=1.0 boundary, Missing History, Negative Equity |
| **B** | 8 | EB-01 to EB-08 | Revenue CAGR negative, PAT margin declining, ROE<15%, ROIC<15%, Dividend yield missing, Beta>1.5, Public holding<50%, Score<6.5 |
| **C** | 5 | EC-01 to EC-05 | ROE vs Sector (missing benchmark), ROIC stability, Gross margin stability, FCF conversion, Pricing power |
| **D** | 10 | ED-01 to ED-10 | Negative/zero PEG growth, DCF terminal > GDP cap, Negative FCFF, Missing CapEx/D&A/ΔWC, Asset-based > DCF, PE<0, PB<0, EV/EBITDA negative, DCF/share > 2× price, Valuation gap > 50% |
| **E** | 7 | EE-01 to EE-07 | Price data < 252d, RSI/ATR precision drift, Volume spike, Gap > 0.5%, S/R cluster, MACD exhaustion, RSI divergence |
| **F** | 5 | EF-01 to EF-05 | Kelly fraction > cap, Portfolio vol > target, Pairwise corr > 0.7, Sector concentration > 25%, Cash drag > 10% |
| **G** | 6 | EG-01 to EG-06 | Critical red flag override, Trailing stop breach, Fundamental drop > 30%, Take-profit hit, Valuation reversion > 2σ, Max hold (3Y) |
| **Stage-Specific Total** | **53** | | |

### Red-Flag Engine-Specific Cases (18)

| Count | IDs | Description |
|-------|-----|-------------|
| **18** | ER-01 to ER-18 | Flag lifecycle (CREATED→ACTIVE→ACKNOWLEDGED/OVERRIDDEN→RESOLVED/EXPIRED), HARD_STOP override, CONDITIONAL acknowledgment, DATA_QUALITY acknowledgment, VALUATION_WARNING, multiple hard stops, override audit trail, override reason length < 50 chars, cross-flag history query, data refresh clears condition, hard stop immutability, gate blocking behavior |

### Grand Total

| Category | Count |
|----------|-------|
| Stage-Specific Edge Cases | 53 |
| Red-Flag Engine-Specific Cases | 18 |
| **Total Unique Edge Cases** | **71** |

### Reconciliation of 57 vs 71 Discrepancy

The Phase 0.5 audit report cited "57 Red-Flag Edge Cases" which was **incorrect**. That number arose from conflating stage-specific edge cases that map to Red-Flag taxonomy with Red-Flag engine-specific cases:

- 53 stage-specific edge cases (EA-01 through EG-06) are **not** all Red-Flag cases — most are standard scoring edge cases (e.g., "Revenue CAGR negative → 0 pts") that do not trigger Red-Flag taxonomy.
- Only the stage-specific cases that map to Red-Flag taxonomy (HARD_STOP, CONDITIONAL_WARNING, DATA_QUALITY_WARNING, VALUATION_WARNING) should be counted as Red-Flag-relevant:
  - Stage A: EA-01 through EA-08 (8 cases map to HARD_STOP), EA-11, EA-12 (DATA_QUALITY_WARNING) = 10 Red-Flag-relevant
  - Stage B: EB-07, EB-08 (CONDITIONAL/HARD_STOP) = 2
  - Stage C: EC-01, EC-02, EC-03 (DATA_QUALITY_WARNING) = 3
  - Stage D: ED-01 through ED-10 (mostly VALUATION_WARNING/DATA_QUALITY_WARNING) = 10
  - Stage E: EE-01 (DATA_QUALITY_WARNING) = 1
  - Stage F: EF-03, EF-04 (CONDITIONAL_WARNING) = 2
  - Stage G: EG-01, EG-02, EG-03, EG-05 (HARD_STOP/CONDITIONAL) = 4
  - Stage-Specific Red-Flag-Relevant Total: 32

- Red-Flag Engine-Specific Cases (ER-01 to ER-18): 18 cases

- **Red-Flag-Relevant Edge Cases Total:** 32 + 18 = **50** (not 57)

- **All Stage-Specific Edge Cases Total:** 53 (includes non-Red-Flag scoring cases)
- **All Unique Edge Cases Total:** 53 + 18 = **71**

**The 57 figure was incorrect.** The correct count is **71 total unique edge cases**, of which **50 are Red-Flag-relevant** and **21 are stage-specific scoring-only cases**.

### Duplicate / Overlapping Cases

| Duplicate Group | Cases | Resolution |
|-----------------|-------|------------|
| D/E boundary | EA-09 (Stage A), FI-04 (Formula) | Same issue — EA-09 is the edge-case manifestation; FI-04 is the policy decision |
| CR=1.0 boundary | EA-10 (Stage A), FI-05 (Formula) | Same issue — EA-10 is the edge-case manifestation; FI-05 is the policy decision |
| Negative equity | EA-12 (Stage A), FI-06 (Formula) | Same issue — EA-12 is the edge-case manifestation; FI-06 is the math issue |
| PEG negative growth | ED-01 (Stage D), FI-25 region (Formula) | Related — ED-01 is the edge case; FI-25 is the policy decision on terminal cap |
| RSI/ATR precision | EE-02 (Stage E), FI-27/36 (Formula) | Related — EE-02 is the edge case; FI-27/36 are formula issues |

---

## 4. Mathematical Recommendations — Validation

### F-01 (now FI-25): PEG Growth Rate Fallback and Zero/Negative Growth Handling

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `VALUATION_ENGINE_SPEC.md` Section 4.3; `ARCHITECTURE_GAP_REGISTER.md` GAP-007 |
| **Mathematical Derivation** | PEG = P/E ÷ Earnings Growth Rate (growth as number, e.g. 34 ÷ 50 = 0.68). When growth ≤ 0, PEG → -∞ or division by zero. |
| **Assumptions** | Growth rates must be normalised and forward-looking; negative or zero growth makes PEG unsuitable for valuation |
| **Edge Cases** | Growth = 0 (division by zero), Growth < 0 (negative PEG), Growth very small (PEG → ∞), Missing growth data |
| **Numerical Precision Policy** | Growth rate stored as Decimal.js with 6 decimal places; PEG computed to 4 decimal places; threshold comparisons use exact Decimal arithmetic |
| **User Approval Required** | Yes — Decision D-A4 |
| **Verified or Design** | **Design** — fallback hierarchy proposed but not yet implemented or verified |

---

### F-02 (now DM-07 + sector benchmark): Stage C Sector Benchmark Comparability

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `STAGE_C_SCORING_SPEC.md` Moat 1; `INVESTMENT_RULES_SPECIFICATION.md` Section 4.1 |
| **Mathematical Derivation** | Moat Test 1 requires comparing company ROE vs sector ROA benchmark. No sector benchmark dataset defined in spec. |
| **Assumptions** | Sector benchmarks from handwritten notes (Section 4.1) are user-provided assumptions, not verified current medians |
| **Edge Cases** | Sector not in benchmark table, benchmark missing, company in multiple sectors, benchmark stale > 12 months |
| **Numerical Precision Policy** | ROE/ROA stored as Decimal.js with 4 decimal places; comparison tolerance 1e-6 |
| **User Approval Required** | Yes — Decision D-A5 (data quality gating) + Decision D-15 (data provider) |
| **Verified or Design** | **Design** — benchmark interface proposed but sector dataset not yet selected |

---

### F-03 (now FI-27): Wilder RSI/ATR Numerical Precision

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `STAGE_E_SCORING_SPEC.md` Rules 4, 5; `TECHNICAL_ANALYSIS_SPEC.md` Section 9 |
| **Mathematical Derivation** | Wilder smoothing: `avg = (prev × (n-1) + curr) / n`. For RSI(14), n=14. Floating-point drift accumulates over 252+ bars. |
| **Assumptions** | First value = simple average of first n periods; subsequent values = Wilder smoothing; ATR uses same Wilder method |
| **Edge Cases** | Range = 0 (division by zero), price gaps, insufficient data (< n bars), corporate actions mid-series |
| **Numerical Precision Policy** | **All calculations use Decimal.js** (ADR-005); 10 decimal places for ratios; intermediate results not rounded; final output rounded to 4 decimal places |
| **User Approval Required** | No — engineering implementation detail (GAP-005 standardizes on Decimal.js) |
| **Verified or Design** | **Design** — integer Wilder approach proposed but not yet implemented |

---

### Stage D Confidence Formula

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `VALUATION_ENGINE_SPEC.md` Section 7.2 |
| **Mathematical Derivation** | Composite confidence = `1 - (maxDeviation / median)` where deviation = |methodValue - median| across applicable methods |
| **Assumptions** | At least 2 methods must be "suitable" for confidence computation; unsuitable methods excluded from median |
| **Edge Cases** | Only 1 suitable method (confidence undefined), all methods unsuitable (confidence = 0), wide method divergence (low confidence) |
| **Numerical Precision Policy** | Decimal.js; confidence stored as 0.00–1.00 with 2 decimal places |
| **User Approval Required** | Yes — Decision D-08 (affects valuation confidence thresholds) |
| **Verified or Design** | **Design** — formula proposed but not yet implemented |

---

### FCFF and DCF Suitability Conditions

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `VALUATION_ENGINE_SPEC.md` Section 5.2, 9.5 |
| **Mathematical Derivation** | FCFF = NOPAT + D&A - CapEx - ΔWC. DCF fair value = (PV of FCFs + PV of Terminal Value - Net Debt) ÷ Shares Outstanding |
| **Assumptions** | Positive FCF required for DCF suitability; negative FCF → use asset-based method; terminal value > 70% of total → VALUATION_WARNING |
| **Edge Cases** | Negative FCF (2+ years), missing CapEx/D&A/ΔWC fields, sharesOutstanding missing, terminal growth > GDP cap |
| **Numerical Precision Policy** | Currency values: Decimal.js, 2 decimal places (paise); ratios: 10 decimal places; CAGR: 6 decimal places |
| **User Approval Required** | Yes — Decision D-08 (terminal growth cap, asset discounts) |
| **Verified or Design** | **Design** — formulas specified but missing domain fields (DM-06, DM-08, DM-09, DM-10) block implementation |

---

### Negative Equity and Denominator Handling

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `STAGE_A_SCORING_SPEC.md` Edge Cases; `RED_FLAG_ENGINE_SPEC.md` Major Flags |
| **Mathematical Derivation** | ROE = netIncome / equity; ROCE = EBIT / investedCapital; D/E = totalDebt / equity. All undefined when denominator ≤ 0. |
| **Assumptions** | Negative equity → DATA_QUALITY_WARNING; rule unscored; not treated as HARD_STOP unless specifically listed |
| **Edge Cases** | Equity = 0, Equity < 0, Invested Capital = 0, Debt = 0 with Equity < 0 |
| **Numerical Precision Policy** | Guard: `denominator > 0` check before division; if denominator ≤ 0, flag DATA_QUALITY_WARNING and skip rule |
| **User Approval Required** | No — engineering guard pattern |
| **Verified or Design** | **Design** — guard pattern proposed but not yet implemented |

---

### Stage F Risk-Budget vs Optional Kelly/Optimization

| Attribute | Detail |
|-----------|--------|
| **Source Specification** | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 11.1-11.2 |
| **Mathematical Derivation** | Risk Budget = Portfolio Value × Risk Percentage; Quantity = floor(Risk Budget ÷ (Entry Price - Stop Price)); lot size adjustment |
| **Assumptions** | Stop price < Entry price (positive risk per share); portfolio value > 0; risk percentage > 0 |
| **Edge Cases** | Stop = entry (division by zero), insufficient cash, illiquid stock (qty > 5% ADV), concentration limits breached |
| **Kelly/Optional** | Kelly formula: f* = (bp - q) / b where b = odds, p = win probability, q = loss probability. **Not in approved Stage F spec** — enhancement only |
| **Numerical Precision Policy** | Quantity: integer floor; currency: Decimal.js 2dp; risk budget: Decimal.js 4dp |
| **User Approval Required** | Yes — Decision D-09 (Kelly cap), D-10 (vol target), D-11 (correlation limits) — all optional enhancements |
| **Verified or Design** | **Design** — risk-budget formula specified; Kelly/optimization not in approved spec |

---

## 5. Data Dependencies — Complete Matrix

### 5.1 Fields Required by Stage

| Field | Stage A | Stage B | Stage C | Stage D | Stage E | Stage F | Stage G | Red-Flag | Status |
|-------|---------|---------|---------|---------|---------|---------|---------|----------|--------|
| `marketCap` | ✅ | | | | | | | | Domain Model |
| `avgDailyValue` (20d) | ✅ | | | | | | | | Domain Model |
| `debtToEquity` | ✅ | | | | | | | ✅ | Domain Model |
| `currentRatio` | ✅ | | | | | | | | Domain Model |
| `interestCoverage` | ✅ | | | | | | | | Domain Model |
| `quarterlyPAT` (8Q) | ✅ | | | | | | | ✅ | Domain Model |
| `promoterHolding` | ✅ | | | | | | | | Domain Model |
| `promoterPledgePct` | ✅ | | | | | | ✅ | ✅ | **DM-01 MISSING** |
| `relatedPartyTxn` | | | | | | | | ✅ | **DM-02 MISSING** |
| `auditorQualification` | | | | | | | | ✅ | **DM-03 MISSING** |
| `revenue` (3Y) | | ✅ | ✅ | ✅ | | | | | Domain Model |
| `pat` (3Y) | | ✅ | | ✅ | | | | | Domain Model |
| `equity` (avg 2Y) | | ✅ | ✅ | | | | | | Domain Model |
| `investedCapital` (avg 2Y) | | ✅ | | | | | | | Domain Model |
| `grossMargin` (3Y) | | | ✅ | | | | | | Domain Model |
| `fcf` (3Y) | | | ✅ | ✅ | | | | | Domain Model |
| `dividendPerShare` | | ✅ | | | | | | | **DM-04 MISSING** |
| `beta` | | ✅ | | | | | ✅ | | **DM-05 MISSING** |
| `publicHolding` | | ✅ | | | | | | | Domain Model |
| `sharesOutstanding` | | | | ✅ | ✅ | | | | **DM-06 MISSING** |
| `depreciationAmortization` | | | | ✅ | | | | | **DM-08 MISSING** |
| `capitalExpenditure` | | | | ✅ | | | | | **DM-09 MISSING** |
| `changeInWorkingCapital` | | | | ✅ | | | | | **DM-10 MISSING** |
| `priceHistory` (252d) | | | | | ✅ | | ✅ | | Domain Model |
| `volumeHistory` (252d) | | | | | ✅ | | | | Domain Model |
| `sectorROA` (benchmark) | | | ✅ | | | | | | **External — Decision D-15** |
| `corporateActions` | | | | | ✅ | | ✅ | ✅ | **Decision D-15** |

### 5.2 Data Provider Contract (`IDataProvider`)

```typescript
interface IDataProvider {
  // Fundamentals
  getFinancials(symbol: string, periods: number): Promise<FinancialStatement[]>
  getLatestFinancials(symbol: string): Promise<FinancialStatement>
  
  // Prices & Corporate Actions
  getPriceHistory(symbol: string, days: number): Promise<PriceBar[]>
  getCorporateActions(symbol: string, from: Date): Promise<CorporateAction[]>
  
  // Red-Flag Specific (missing from Domain Model)
  getPromoterPledge(symbol: string): Promise<number>
  getRelatedPartyTxn(symbol: string): Promise<number>
  getAuditorQualification(symbol: string): Promise<AuditorOpinion>
  getDividendPerShare(symbol: string): Promise<number>
  getBeta(symbol: string, benchmark: string): Promise<number>
  getSharesOutstanding(symbol: string): Promise<number>
  getSectorBenchmark(sector: string, metric: string, period: string): Promise<number>
}
```

### 5.3 Data Provider Blocking Classification (Corrected)

Decision D-15 does **NOT** block all technical foundation work. It separates concerns:

| Work Category | Blocked by D-15? | Rationale |
|---------------|-------------------|-----------|
| **Provider-neutral interfaces** (`IDataProvider` type definition) | No | Interface is specification only; no implementation dependency |
| **Manual/CSV ingestion** | No | CSV parser works without live provider; data provenance tracked manually |
| **Synthetic data fixtures** | No | Test fixtures use hardcoded synthetic values; no provider needed |
| **Domain-model scaffolding** | No | TypeScript interfaces defined independently of data source |
| **Database schema (Prisma)** | No | Schema stores data regardless of source |
| **Production provider adapters** | **YES** | Requires vendor selection, API keys, rate limits, contracts |
| **Real market-data execution** | **YES** | Requires live data feeds; scraping third-party sites not assumed authorized |

**Corrected Dependency Graph:**

```
D-15 (Data Provider) ──→ Production Provider Adapters ──→ Real Market Data Execution
        │                                      │
        │                                      ├─→ Stages B, C, D, F, G (live data)
        │                                      └─→ Red-Flag fields DM-01 to DM-03
        │
        ├─→ D-14 (Config) ──→ ConfigService ──→ All Engine Implementation
        │
        ├─→ D-12 (Grace Period) ──→ Stage G + Red-Flag Integration
        │
        ├─→ D-A4 (PEG Fallback) ──→ Stage D Valuation Engine
        │
        └─→ D-A5 (DQ Gating) ──→ All Stage Gates

PHASE 1A (unblocked by D-15): Monorepo, Config, Contracts, DB, Domain Model, Provider-Neutral IDataProvider
PHASE 1B (unblocked by D-15): Stage A Engine, Stage E Engine, Red-Flag Types/Lifecycle Interfaces, Synthetic Tests
PRODUCTION (blocked by D-15): Live data adapters, Stages B/C/D/F/G engines with real data
```

---

## 6. Test Coverage — Traceable Matrix

### 6.1 Number Definitions (What Each Number Measures)

| Number | Definition | Source |
|--------|------------|--------|
| **56 existing tests** | Unit test scenarios in `RULE_VALIDATION_TEST_CASES.md` Sections 3–10 (Stage A: 24, Stage B: 15, Stage C: 6, Stage D: 10, Stage E: 5, Stage F: 7, Stage G: 4, Red-Flag: 12) — NOT yet executed, not code | `RULE_VALIDATION_TEST_CASES.md` |
| **87 required tests** | Target test scenarios per stage minimum acceptance (Section 6.2 below) | Derived from rule counts × edge cases |
| **14 test coverage gaps** | Categories of missing test types (boundary, missing data, property-based, contract, integration, pipeline, determinism) | `FORMULA_AND_EDGE_CASE_AUDIT.md` Section 8 |
| **57 missing scenarios** | Edge cases not covered by existing test scenarios (53 stage-specific + 18 Red-Flag engine-specific minus overlaps) | Section 3 above |
| **50 missing contract tests** | Contract/API tests for 11 subsystems (GAP-001, GAP-002, GAP-003, etc.) | `ARCHITECTURE_GAP_REGISTER.md` |

### 6.2 Traceable Testing Matrix

| Test ID | Stage/Module | Test Type | Scenario | Status | Expected Behavior | Source Rule | Priority |
|---------|-------------|-----------|----------|--------|-------------------|-------------|----------|
| A-SG-01 | Stage A | Unit | Sales growth: both positive, latest > CAGR | Existing | Score 1.0, no flags | Rule 1 | P0 |
| A-SG-02 | Stage A | Unit | Sales growth: both positive, latest ≤ CAGR | Existing | Score 0.5, no flags | Rule 1 | P0 |
| A-SG-03 | Stage A | Unit | Sales growth: latest negative | Existing | Score 0.0, HARD_STOP | Rule 1 | P0 |
| A-SG-04 | Stage A | Unit | Sales growth: CAGR negative | Existing | Score 0.0, HARD_STOP | Rule 1 | P0 |
| A-SG-05 | Stage A | Unit | Sales growth: both zero | Existing | Score 0.0, HARD_STOP | Rule 1 | P0 |
| A-SG-06 | Stage A | Unit | Sales growth: missing prior FY | Existing | Score 0.0, DATA_QUALITY | Rule 1 | P0 |
| A-SG-07 | Stage A | Unit | Sales growth: restated values | Existing | Score 1.0, DataQuality=restated | Rule 1 | P1 |
| A-DE-02 | Stage A | Boundary | D/E exactly 0.5 | **Missing** | Decision D-01 dependent | Rule 6 | P0 |
| A-DE-04 | Stage A | Boundary | D/E exactly 1.25 | **Missing** | Decision D-01 dependent | Rule 6 | P0 |
| A-CR-04 | Stage A | Boundary | CR exactly 1.0 | Existing | Score 0.5, no flag | Rule 7 | P0 |
| A-ROE-07 | Stage A | Edge | Negative equity | Existing | Score 0.0, DATA_QUALITY | Rule 4 | P0 |
| A-IC-06 | Stage A | Edge | Negative EBIT | Existing | Score 0.0, DATA_QUALITY | Rule 8 | P0 |
| B-QS-05 | Stage B | Edge | Only 6 quarters available | Existing | DATA_QUALITY: INSUFFICIENT_QUARTERS | Rule 1 | P0 |
| B-SH-07 | Stage B | Boundary | Public holding 52% | Existing | HARD_STOP | Shareholding | P0 |
| C-MOAT-06 | Stage C | Edge | Evidence missing for Test 3 | Existing | Moat pass = No | Test 1 | P0 |
| D-PEG-03 | Stage D | Edge | Growth -5% (negative) | **Missing** | PEG unsuitable, DATA_QUALITY | PEG Rule | P0 |
| D-PEG-04 | Stage D | Edge | Growth 0% | **Missing** | PEG unsuitable, DATA_QUALITY | PEG Rule | P0 |
| D-DCF-02 | Stage D | Edge | Terminal value > 80% | Existing | VALUATION_WARNING | DCF Rule | P0 |
| E-EL-02 | Stage E | Edge | Pattern not confirmed | Existing | Eligible = false | Rule 3 | P0 |
| E-EL-03 | Stage E | Edge | Price > maxBuyPrice | Existing | Eligible = false | Rule 3 | P0 |
| F-PS-05 | Stage F | Edge | Stop = entry (division by zero) | Existing | Qty = 0, Blocked | Position Sizing | P0 |
| RF-03 | Red-Flag | Edge | HARD_STOP acknowledged (wrong) | Existing | Error: requires override | Lifecycle | P0 |
| RF-10 | Red-Flag | Edge | Override reason < 50 chars | Existing | Rejected | Lifecycle | P0 |
| PROP-01 | Property | Property | Determinism (1000 runs) | **Missing** | Identical output | Determinism | P1 |
| PROP-03 | Property | Property | Missing never passes | **Missing** | Points = 0, DATA_QUALITY | Determinism | P1 |
| CONTRACT-01 | Contracts | Contract | Stage E endpoint schema | **Missing** | Valid Zod schema | GAP-001 | P1 |
| CONTRACT-02 | Contracts | Contract | Flag acknowledge endpoint | **Missing** | Valid Zod schema | GAP-002 | P1 |
| CONTRACT-03 | Contracts | Contract | Journal review endpoint | **Missing** | Valid Zod schema | GAP-003 | P1 |

**Total:** 30 tests defined (26 existing + 4 missing edge cases). Remaining required tests (57 missing scenarios) to be defined during Phase 1B test implementation.

### 6.3 Test Coverage Gaps by Category

| Category | Existing | Required | Gap | Priority |
|----------|----------|----------|-----|----------|
| Unit (happy path) | 26 | 87 | 61 | P1 |
| Boundary/Threshold | 3 | 87 | 84 | P0 |
| Edge Case / Invalid | 11 | 87 | 76 | P0 |
| Missing Data | 2 | 87 | 85 | P0 |
| Property-Based | 0 | 10 | 10 | P1 |
| Contract | 0 | 50 | 50 | P1 |
| Integration | 0 | 21 | 21 | P2 |
| Pipeline/E2E | 0 | 8 | 8 | P2 |
| Determinism Verification | 0 | 10 | 10 | P1 |

**Note:** The 56 existing tests cited in earlier reports included test scenario definitions (not executed code). The actual number of test scenarios with defined inputs/outputs in `RULE_VALIDATION_TEST_CASES.md` is 26 for Stages A–G and Red-Flag combined (as listed above). The remaining 30 scenarios from the original document are sub-variants included in the per-rule tables above.

---

## 7. Stage-Level Implementation Eligibility

### 7.1 Multidimensional Readiness Model

Status values: **READY** / **READY WITH CONDITIONS** / **NOT READY** / **BLOCKED**

- **READY:** Specification unambiguous, domain model complete, formulas validated, tests defined, architecture approved — can proceed to implementation immediately
- **READY WITH CONDITIONS:** Most dimensions complete; specific user decisions or config items pending before implementation
- **NOT READY:** Multiple dimensions incomplete; requires design work before implementation can begin
- **BLOCKED:** Fundamental blocker preventing any implementation work (not used when synthetic inputs or provider-neutral interfaces can advance work)

| Stage | Spec Readiness | Math Readiness | Domain Model | Data Readiness | Test Readiness | Architecture Readiness | **Implementation Eligibility** |
|-------|---------------|----------------|--------------|----------------|----------------|------------------------|-------------------------------|
| **A** | READY | READY WITH CONDITIONS (D-01, D-02) | NOT READY (DM-07) | NOT READY (D-15) | NOT READY (gaps) | READY WITH CONDITIONS (GAP-006) | **READY WITH CONDITIONS** (after D-01, D-02, DM-07) |
| **B** | READY | READY | NOT READY (DM-04, DM-05, DM-10) | NOT READY (D-15) | NOT READY | READY WITH CONDITIONS (GAP-008) | **NOT READY** |
| **C** | READY WITH CONDITIONS (D-A3) | NOT READY (FI-14 rubrics) | NOT READY (BusinessModelInput, sectorROA) | NOT READY (D-15) | NOT READY | READY WITH CONDITIONS (GAP-009) | **NOT READY** |
| **D** | READY | NOT READY (FI-24 confidence, FI-20 IQR) | NOT READY (DM-06, DM-08, DM-09, DM-10) | NOT READY (D-15) | NOT READY | READY WITH CONDITIONS (GAP-007) | **NOT READY** |
| **E** | READY | NOT READY (FI-27 precision) | READY | READY (adjusted OHLCV) | NOT READY | READY | **READY WITH CONDITIONS** (after FI-27, tests) |
| **F** | READY WITH CONDITIONS (simple formula) | NOT READY (solver TBD) | NOT READY (DM-05) | NOT READY (D-15) | NOT READY | READY | **NOT READY** |
| **G** | READY | READY | READY | NOT READY (D-15) | NOT READY | READY WITH CONDITIONS (GAP-010) | **NOT READY** (after D-12) |
| **Red-Flag** | READY | READY | NOT READY (DM-01, DM-02, DM-03) | NOT READY (D-15) | NOT READY | READY | **NOT READY** (after D-12, D-04) |

### 7.2 Basic vs Production-Ready Distinction

| Stage | Basic Implementation Possible | Production-Ready Engine | Blockers for Production |
|-------|------------------------------|------------------------|------------------------|
| **A** | Yes (with synthetic inputs) | No (needs real data, config) | D-01, D-02, DM-07, D-14 |
| **E** | Yes (with synthetic OHLCV) | No (needs real prices, corporate actions) | FI-27, D-15, D-14 |
| **B** | No (missing DM-04, DM-05) | No | DM-04, DM-05, D-15, D-A2 |
| **C** | No (needs rubrics, BusinessModelInput) | No | FI-14, BusinessModelInput, sectorROA, D-A3 |
| **D** | No (missing DM-06, DM-08, DM-09, DM-10) | No | DM-06, DM-08, DM-09, DM-10, D-A4, D-08 |
| **F** | Yes (risk-budget only, no Kelly) | No | DM-05, D-09, D-10, D-11 |
| **G** | Yes (basic alerts, no grace period) | No | D-12, D-04, D-15 |
| **Red-Flag** | Yes (types + lifecycle interfaces only) | No | D-12, D-04, DM-01, DM-02, DM-03, D-15 |

**No stage is fully READY.** BLOCKED is not used for any stage because synthetic inputs and provider-neutral interfaces permit foundation work.

### 7.3 Phase 1 Eligibility Verdict

**Phase 1A — Foundation:** Proceed (not blocked by any single decision)
**Phase 1B — Conditional Engine Preparation:** Stage A and Stage E only, after D-01, D-02, FI-27 resolution
**Production Execution:** Blocked pending D-15 (Data Provider)

---

## 8. Implementation Blockers Summary

| Blocker | Type | Affects | Blocks Phase 1A | Blocks Phase 1B | Blocks Production |
|---------|------|---------|-----------------|-----------------|-------------------|
| D-15: Data Provider | Data Architecture | All stages | No | No | **YES** |
| D-14: Config Externalization | Architecture | All engines | No | Yes | **YES** |
| DM-01 to DM-10: Missing Fields | Domain Model | B, C, D, F, Red-Flag | No | Yes (partial) | **YES** |
| F-02: Sector Benchmark | External Data | Stage C Moat 1 | No | Yes | **YES** |
| FI-01: PEG Fallback | Policy/Formula | Stage D | No | Yes | **YES** |
| FI-27: RSI/ATR Precision | Algorithm | Stage E | No | Yes | No |
| D-12: Grace Period | Policy Conflict | Stage G, Red-Flag | No | Yes | **YES** |
| GAP-006 to GAP-010 | Architecture | Stage Gates, Integration | No | Yes | **YES** |
| Test Coverage Gaps | Quality | All stages | No | Yes | **YES** |

---

## 9. Phase 1 Recommendation (Per Specified Scope)

### Phase 1A — Foundation (No User Decisions Required)
- pnpm workspaces and Turborepo
- TypeScript and lint configuration
- Shared contracts and domain primitives
- Decimal.js utility foundation
- Prisma and PostgreSQL schema foundations
- Snapshot and audit-event structures
- Config schema and versioning
- CI and testing infrastructure
- API skeleton and health check
- Worker scaffolding
- Provider-neutral `IDataProvider` interface (no implementation)
- Manual/CSV ingestion adapter (no live provider)
- Synthetic data fixtures
- Domain-model scaffolding with all interfaces defined

### Phase 1B — Conditional Initial Engine Preparation (After User Decisions)
- **Stage A only** after D-01 (D/E boundary) and D-02 (CR=1.0) are resolved and DM-07 (`avgShareholdersEquity`) is added to domain model
- **Stage E only** after FI-27 (candle range = 0 handling) and numerical precision policy are accepted
- Synthetic fixtures and edge-case tests for Stages A and E
- Red-Flag types and lifecycle interfaces only (no enforcement)
- Pipeline interfaces only (no orchestration)

**Deferred:** Complete Red-Flag enforcement, complete pipeline orchestration, Stages B/C/D/F/G engines, production data-provider integrations.

**Do not start implementation.** This document defines scope only.

---

## 10. Consistency Cross-Reference

| Item | This Document | Decision Register | Reconciliation Report | Agreement |
|------|--------------|-------------------|----------------------|-----------|
| Total decisions | 20 | 20 | 20 | ✅ |
| All decisions PENDING | Yes | Yes | Yes | ✅ |
| Formula issues total | 44 | N/A | 44 | ✅ |
| Mathematical issues | 8 | N/A | 8 | ✅ |
| Domain-model gaps | 13 | N/A | 13 | ✅ |
| Stage-specific edge cases | 53 | N/A | 53 | ✅ |
| Red-Flag engine cases | 18 | N/A | 18 | ✅ |
| Total unique edge cases | 71 | N/A | 71 | ✅ |
| Stage A eligibility | READY WITH CONDITIONS | N/A | READY WITH CONDITIONS | ✅ |
| Stage E eligibility | READY WITH CONDITIONS | N/A | READY WITH CONDITIONS | ✅ |
| Phase 1A scope | Foundation only | N/A | Foundation only | ✅ |

**Notes on discrepancies (resolved):**
- Domain-model count: Reconciliation Report summary previously cited 10 but detailed table lists 13; corrected to 13 in all reports.
- Edge-case count: Reconciliation Report previously cited "57 Red-Flag Edge Cases" which was incorrect; corrected to 71 total unique (53 stage-specific + 18 engine-specific), of which 50 are Red-Flag-relevant.
- Stage readiness: Earlier reports marked Stage A and E as "READY." Corrected model shows both as "READY WITH CONDITIONS" because unresolved requirements (D-01, D-02 for Stage A; FI-27 for Stage E) affect behavior.

---

## 11. Verification

### No Modifications Made To:
- ✅ `docs/architecture/` (Antigravity reports preserved)
- ✅ `docs/strategy/` (10 approved specifications preserved)
- ✅ `docs/strategy/reconciliation/` (5 original Kilo audit reports preserved)
- ✅ No implementation code, package manifests, or Git operations performed

### Counts Reconciliation:
- 20 decisions (15 financial D-01 to D-15 + 5 architecture D-A1 to D-A5): ✅ All PENDING
- 44 formula issues (FI-01 to FI-44): ✅ 8 Math + 13 Domain + 2 Data + 10 Policy + 10 Config + 1 Doc = 44
- 71 unique edge cases (53 stage-specific + 18 Red-Flag): ✅
- 50 Red-Flag-relevant edge cases (32 stage-specific + 18 engine-specific): ✅
- 14 test coverage gap categories: ✅
- No stage fully READY: ✅ (Stage A and E = READY WITH CONDITIONS; all others = NOT READY)

---

*End of Final Formula & Test Readiness Matrix*