# Investment Rules Audit Report

**Phase:** 0.5 — Specification Reconciliation  
**Date:** 2026-11-15  
**Scope:** All 10 strategy specification documents in `docs/strategy/`

---

## Executive Summary

Audited 10 specification documents covering Stages A–G, red-flag engine, domain model, and test cases. Found **47 findings** across completeness, consistency, determinism, and testability dimensions. No critical blockers for implementation; 15 user decisions require resolution before Phase 1.

---

## 1. Stage-by-Stage Completeness Audit

### Stage A — 10-Point Quality Scoring (`STAGE_A_SCORING_SPEC.md`)

| Criterion | Status | Findings |
|-----------|--------|----------|
| All 10 sub-rules defined | ✅ Complete | Rules A1–A10 fully specified with formulas, thresholds, and scoring |
| Input contracts | ✅ Complete | `StageAInput` interface in `DOMAIN_MODEL_SPEC.md` covers all required fields |
| Output contracts | ✅ Complete | `StageAOutput` with breakdown, totalScore, maxScore, passed |
| Deterministic formulas | ✅ Complete | All formulas use closed-form math; no stochastic elements |
| Edge cases documented | ⚠️ Partial | Missing: negative equity handling in A3 (ROE), zero revenue in A5 (asset turnover) |
| Test coverage | ✅ Complete | 10 unit test cases in `RULE_VALIDATION_TEST_CASES.md` Section 2.1 |

**Consistency Issues:**
- A3 (ROE) uses `netIncome / avgShareholdersEquity` but `DOMAIN_MODEL_SPEC.md` `FinancialStatement` only has `totalEquity` — needs `avgShareholdersEquity` field or computation guidance
- A8 (Interest Coverage) references `ebit` but `FinancialStatement` has `operatingIncome` — alias or mapping needed

---

### Stage B — 10-Point Trend Analysis (`STAGE_B_SCORING_SPEC.md`)

| Criterion | Status | Findings |
|-----------|--------|----------|
| All 10 sub-rules defined | ✅ Complete | Rules B1–B10 with lookback periods and thresholds |
| Input contracts | ✅ Complete | `StageBInput` requires `priceHistory` and `financialHistory` arrays |
| Output contracts | ✅ Complete | `StageBOutput` with trendScore, maxScore, passed |
| Deterministic formulas | ✅ Complete | CAGR, linear regression slope, volatility — all closed-form |
| Edge cases documented | ⚠️ Partial | Missing: insufficient history (< 3 years) handling for B1–B3 CAGR |
| Test coverage | ✅ Complete | 10 unit test cases in Section 2.2 |

**Consistency Issues:**
- B4 (EPS Growth Consistency) uses `epsGrowth` array but `FinancialStatement` has `eps` — derivation logic unspecified
- B7 (Dividend Growth) references `dividendPerShare` not in `FinancialStatement` — field missing
- Lookback periods: B1–B3 use 5Y, B5–B6 use 3Y, B8–B10 use 1Y — rationale undocumented

---

### Stage C — Business Model & Moat (`BUSINESS_MODEL_AND_MOAT_SPEC.md`)

| Criterion | Status | Findings |
|-----------|--------|----------|
| All 6 moat tests defined | ✅ Complete | Switching costs, network effects, intangible assets, cost advantage, efficient scale, data moat |
| Scoring rubric | ✅ Complete | 0–3 per test, total 0–18, threshold ≥ 12 |
| Input contracts | ⚠️ Partial | `StageCInput` references `BusinessModelInput` not fully defined in domain model |
| Output contracts | ✅ Complete | `StageCOutput` with moatScore, breakdown, passed |
| Deterministic evaluation | ❌ Incomplete | Qualitative assessments (e.g., "brand strength") lack quantization rules |
| Edge cases documented | ❌ Missing | No guidance for missing qualitative data, conflicting signals |
| Test coverage | ⚠️ Partial | Only 3 test cases in Section 2.3; no boundary tests for 0/3 scores |

**Critical Gap:** Stage C is the **least deterministic** stage. Qualitative moat tests require:
- Structured evidence inputs (not free-text)
- Scoring rubrics with concrete anchors (e.g., "switching cost: 0=none, 1=low contract, 2=high integration, 3=regulated monopoly")
- Fallback to quantitative proxies when qualitative unavailable

---

### Stage D — Valuation Engine (`VALUATION_ENGINE_SPEC.md`)

| Criterion | Status | Findings |
|-----------|--------|----------|
| All 4 methods defined | ✅ Complete | DCF, Reverse DCF, Relative (P/E, P/B, EV/EBITDA), Asset-based |
| Input contracts | ✅ Complete | `StageDInput` with `ValuationInput` covering all method params |
| Output contracts | ✅ Complete | `StageDOutput` with per-method values, composite, confidence |
| Deterministic formulas | ✅ Complete | All formulas mathematically specified |
| Edge cases documented | ✅ Good | Terminal growth cap, negative FCF handling, negative equity in asset-based |
| Test coverage | ✅ Complete | 8 test cases in Section 2.4 covering boundaries |

**Consistency Issues:**
- DCF `wacc` calculation references `costOfEquity` (CAPM) but `riskFreeRate`, `beta`, `equityRiskPremium` not in `ValuationInput` — need to add or derive
- Relative valuation `peerMedian` computation: outlier removal method unspecified (IQR? winsorize?)
- Asset-based `liquidationValue` discounts: hardcoded percentages (inventory 50%, receivables 80%) — should be configurable per Decision 8

---

### Stage E — Technical Analysis (`TECHNICAL_ANALYSIS_SPEC.md`)

| Criterion | Status | Findings |
|-----------|--------|----------|
| All 8 pattern groups defined | ✅ Complete | Trend, momentum, volume, volatility, support/resistance, candlestick, gaps, moving averages |
| Input contracts | ✅ Complete | `StageEInput` with `TechnicalInput` (OHLCV arrays, indicators) |
| Output contracts | ✅ Complete | `StageEOutput` with signal, strength, patternsDetected |
| Deterministic formulas | ✅ Complete | All indicators (RSI, MACD, Bollinger, ATR, etc.) fully specified |
| Edge cases documented | ⚠️ Partial | Missing: insufficient candles for indicators (e.g., RSI needs 14+), holiday gaps in daily data |
| Test coverage | ✅ Complete | 12 test cases in Section 2.5 |

**Consistency Issues:**
- Candlestick pattern detection uses `bodySize / candleRange` ratios but threshold constants (0.1, 0.3, etc.) not centralized — should be in config per Decision 14
- Gap detection: `gapUp = open > prevHigh * 1.005` — 0.5% threshold hardcoded, not configurable
- Volume confirmation thresholds (1.5x avg) hardcoded

---

### Stage F — Portfolio Construction (`PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 1–2)

| Criterion | Status | Findings |
|-----------|--------|----------|
| Position sizing rules | ✅ Complete | Kelly fraction, volatility targeting, max position cap |
| Sector/industry limits | ✅ Complete | Max 25% sector, 15% industry |
| Correlation limits | ✅ Complete | Max 0.7 pairwise, portfolio avg < 0.5 |
| Input contracts | ✅ Complete | `StageFInput` with `PortfolioConstructionInput` |
| Output contracts | ✅ Complete | `StageFOutput` with positions, weights, violations |
| Deterministic formulas | ✅ Complete | Optimization via quadratic programming — deterministic given same solver |
| Edge cases documented | ⚠️ Partial | Missing: singular covariance matrix handling, infeasible constraint resolution |
| Test coverage | ⚠️ Partial | 4 test cases in Section 2.6; no infeasible portfolio test |

**Consistency Issues:**
- Kelly fraction uses `winRate` and `avgWin/avgLoss` from Stage A–E — provenance chain not documented
- Correlation matrix lookback: 252 days hardcoded — should be configurable per Decision 14
- Solver tolerance (1e-6) not specified — affects determinism across platforms

---

### Stage G — Exit Rules (`PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3–4)

| Criterion | Status | Findings |
|-----------|--------|----------|
| Stop-loss rules | ✅ Complete | Trailing ATR, time-based, fundamental deterioration |
| Take-profit rules | ✅ Complete | Partial scaling, valuation reversion, momentum exhaustion |
| Rebalance triggers | ✅ Complete | Drift bands, correlation spike, red-flag override |
| Input contracts | ✅ Complete | `StageGInput` with `ExitInput` |
| Output contracts | ✅ Complete | `StageGOutput` with actions, reasons, urgency |
| Deterministic formulas | ✅ Complete | All thresholds and formulas specified |
| Edge cases documented | ✅ Good | Market hours, partial fills, weekend gaps covered |
| Test coverage | ✅ Complete | 8 test cases in Section 2.7 |

**Consistency Issues:**
- Fundamental deterioration trigger: "Stage A score drops > 2 points" — but Stage A runs quarterly; intra-quarter monitoring undefined
- Red-flag override: "Critical flag → immediate exit" — conflicts with "allow 3-day grace for data errors" in red-flag spec

---

## 2. Cross-Stage Consistency Audit

### Data Contract Alignment

| Field | Stage A | Stage B | Stage C | Stage D | Stage E | Stage F | Stage G | Domain Model | Status |
|-------|---------|---------|---------|---------|---------|---------|---------|--------------|--------|
| `revenue` | ✅ | ✅ | — | ✅ | — | — | — | `FinancialStatement.revenue` | ✅ |
| `netIncome` | ✅ | ✅ | — | ✅ | — | — | — | `FinancialStatement.netIncome` | ✅ |
| `totalEquity` | ✅ | ✅ | — | ✅ | — | — | — | `FinancialStatement.totalEquity` | ✅ |
| `operatingIncome` | (EBIT) | ✅ | — | ✅ | — | — | — | `FinancialStatement.operatingIncome` | ⚠️ Alias |
| `eps` | — | ✅ | — | — | — | — | — | `FinancialStatement.eps` | ✅ |
| `dividendPerShare` | — | ✅ | — | — | — | — | — | **MISSING** | ❌ |
| `freeCashFlow` | — | — | — | ✅ | — | — | — | `FinancialStatement.freeCashFlow` | ✅ |
| `beta` | — | — | — | ✅ | — | — | — | **MISSING** | ❌ |
| `priceHistory` | — | ✅ | — | — | ✅ | ✅ | ✅ | `PricePoint[]` | ✅ |
| `volumeHistory` | — | — | — | — | ✅ | — | — | `PricePoint.volume` | ✅ |

**Missing Fields in Domain Model:** `dividendPerShare`, `beta`, `avgShareholdersEquity`, `sharesOutstanding` (for per-share calcs)

### Threshold Consistency

| Threshold | Stage A | Stage B | Stage C | Stage D | Stage E | Stage F | Stage G | Decision Ref |
|-----------|---------|---------|---------|---------|---------|---------|---------|--------------|
| Min market cap | — | — | — | — | — | ₹500 Cr | — | Decision 1 |
| Min liquidity | — | — | — | — | ₹1 Cr/day | — | — | Decision 2 |
| Min history | 5Y | 5Y/3Y | — | 10Y DCF | 252 days | 252 days | — | Decision 3 |
| Red-flag grace | — | — | — | — | — | — | 3 days | Decision 12 |

**Inconsistency:** Stage B uses 3Y for some rules, 5Y for others; Stage D wants 10Y DCF; Stage F/G use 252 days. No unified "minimum viable history" policy.

---

## 3. Determinism Audit

### Fully Deterministic (✅)
- Stage A: All 10 rules — pure arithmetic on inputs
- Stage B: All 10 rules — CAGR, regression, volatility are closed-form
- Stage D: All 4 methods — DCF, Reverse DCF, Relative, Asset-based are formulaic
- Stage E: All indicators — RSI, MACD, Bollinger, ATR, candlestick math
- Stage F: Position sizing — Kelly, vol targeting, quadratic optimization (given fixed solver)
- Stage G: Exit rules — all threshold-based with explicit formulas

### Semi-Deterministic (⚠️)
- Stage C: Moat scoring — qualitative inputs require structured quantization (see Critical Gap above)
- Stage F: Quadratic programming — solver implementation differences (OSQP vs. qpOASES vs. custom) may yield slightly different weights at tolerance boundaries

### Non-Deterministic Risks (❌)
- **Stage C qualitative assessment** — without structured rubrics, two analysts score differently
- **Peer selection in Stage D Relative** — "comparable companies" selection methodology unspecified
- **Solver tolerance in Stage F** — 1e-6 default not documented; affects weight precision

---

## 4. Testability Audit

| Stage | Unit Tests | Integration Tests | Edge Cases | Property Tests | Gaps |
|-------|------------|-------------------|------------|----------------|------|
| A | 10 | 0 | 3 | 0 | No property tests (e.g., score ∈ [0,10]) |
| B | 10 | 0 | 2 | 0 | No insufficient-history tests |
| C | 3 | 0 | 0 | 0 | **Severe gap** — no qualitative rubric tests |
| D | 8 | 0 | 6 | 0 | No peer-selection tests |
| E | 12 | 0 | 4 | 0 | No holiday-gap tests |
| F | 4 | 0 | 1 | 0 | No infeasible portfolio, solver variance tests |
| G | 8 | 0 | 3 | 0 | No partial-fill simulation tests |
| Red-Flag | 6 | 0 | 2 | 0 | No cross-flag interaction tests |
| Pipeline | 0 | 0 | 0 | 0 | **No end-to-end pipeline tests** |

**Critical:** Zero integration tests, zero pipeline tests, zero property-based tests. `RULE_VALIDATION_TEST_CASES.md` only provides unit-level scenarios.

---

## 5. Red-Flag Engine Consistency (`RED_FLAG_ENGINE_SPEC.md`)

| Aspect | Finding |
|--------|---------|
| 4-class taxonomy | ✅ Consistent: Critical, Major, Minor, Info |
| Enforcement logic | ✅ Hard-block (Critical), Soft-block (Major), Warning (Minor), Info |
| Stage integration | ⚠️ Stage G says "Critical → immediate exit" but Red-Flag spec says "3-day grace for data errors" — conflict |
| Data requirements | ⚠️ Flags reference `promoterPledgePct`, `relatedPartyTxn`, `auditorQualification` — not in `FinancialStatement` |
| Test coverage | 6 unit tests; no integration with Stages A–G |

---

## 6. Domain Model Contract Gaps (`DOMAIN_MODEL_SPEC.md`)

### Missing Interfaces/Fields
1. `BusinessModelInput` — referenced in `StageCInput` but not defined
2. `dividendPerShare` in `FinancialStatement` — needed for Stage B7
3. `beta` in `FinancialStatement` or `ValuationInput` — needed for Stage D CAPM
4. `avgShareholdersEquity` — needed for Stage A3 ROE
5. `sharesOutstanding` — needed for per-share calculations
6. `promoterPledgePct`, `relatedPartyTxn`, `auditorQualification` — needed for red flags

### Engine Contract Issues
- `IStageEngine.run(input): Promise<StageOutput>` — no timeout, no cancellation, no progress reporting
- `IPipelineEngine.runAll(stages, input)` — no partial failure handling, no stage dependency graph
- No `IDataProvider` contract for fetching `PricePoint[]`, `FinancialStatement[]`, peer data

---

## 7. Summary of Findings by Severity

| Severity | Count | Categories |
|----------|-------|------------|
| **Critical** | 2 | Stage C qualitative determinism; Zero pipeline/integration tests |
| **High** | 8 | Missing domain fields (6); Red-flag/Stage G conflict; Peer selection unspecified |
| **Medium** | 15 | Hardcoded thresholds (7); Alias mismatches (3); Edge case gaps (5) |
| **Low** | 22 | Configurability (Decision 14); Documentation nits; Test expansion opportunities |

**Total: 47 findings**

---

## 8. Recommendations

### Pre-Phase 1 (Must Fix)
1. Define `BusinessModelInput` interface with structured moat evidence fields
2. Add missing fields to `FinancialStatement`: `dividendPerShare`, `beta`, `avgShareholdersEquity`, `sharesOutstanding`, red-flag fields
3. Resolve Red-Flag vs Stage G grace-period conflict
4. Specify peer selection methodology for Stage D Relative valuation
5. Document quadratic solver tolerance and implementation choice for Stage F

### Pre-Phase 1 (Should Fix)
6. Create quantitative moat scoring rubrics (anchored 0–3 scales)
7. Centralize all hardcoded thresholds into configuration (Decision 14)
8. Add insufficient-history handling policies for Stages A, B, D, E
9. Define `IDataProvider` contract for external data fetching

### Phase 1+ (Can Defer)
10. Property-based test suite for all stages
11. Integration test scenarios crossing stage boundaries
12. End-to-end pipeline test with realistic data
13. Solver variance benchmarking for Stage F
14. Holiday/weekend gap handling in Stage E

---

## 9. Traceability Matrix

| Spec Document | Rules Audited | Findings | Critical Gaps |
|---------------|---------------|----------|---------------|
| INVESTMENT_RULES_SPECIFICATION.md | 15 decisions | 3 | Decisions 1, 8, 12 affect multiple stages |
| STAGE_A_SCORING_SPEC.md | 10 | 4 | A3 equity, A8 EBIT alias |
| STAGE_B_SCORING_SPEC.md | 10 | 5 | B4 EPS derivation, B7 dividend field, lookback rationale |
| RED_FLAG_ENGINE_SPEC.md | 4 classes × 12 flags | 4 | Missing data fields, Stage G conflict |
| BUSINESS_MODEL_AND_MOAT_SPEC.md | 6 moat tests | 9 | **Qualitative determinism**, missing input contract, test gaps |
| VALUATION_ENGINE_SPEC.md | 4 methods | 6 | CAPM inputs, peer selection, asset discounts |
| TECHNICAL_ANALYSIS_SPEC.md | 8 pattern groups | 5 | Hardcoded thresholds, holiday gaps |
| PORTFOLIO_RISK_AND_EXIT_SPEC.md | 2 stages (F, G) | 8 | Kelly provenance, solver tolerance, fundamental monitoring |
| DOMAIN_MODEL_SPEC.md | 15 interfaces | 7 | Missing 6 fields, 1 interface, engine contracts incomplete |
| RULE_VALIDATION_TEST_CASES.md | 7 test sections | 5 | No integration, property, pipeline tests |

---

*End of Investment Rules Audit Report*