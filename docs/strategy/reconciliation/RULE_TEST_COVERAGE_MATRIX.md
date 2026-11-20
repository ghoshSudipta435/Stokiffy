# Rule Test Coverage Matrix Report

**Phase:** 0.5 — Specification Reconciliation  
**Date:** 2026-11-15  
**Scope:** Test coverage analysis against all investment rules in 10 specification documents

---

## Executive Summary

Analyzed test coverage from `RULE_VALIDATION_TEST_CASES.md` against 87 rules across Stages A–G, red-flag engine, and cross-cutting concerns. Found **critical gaps**: 0 integration tests, 0 pipeline tests, 0 property-based tests, 0 contract tests. Unit coverage averages 68% but with severe Stage C (17%) and Stage F (25%) deficiencies. **No end-to-end test scenarios exist.**

---

## 1. Coverage Summary by Stage

| Stage | Rules | Unit Tests | Integration Tests | Property Tests | Contract Tests | Coverage % | Gap Severity |
|-------|-------|------------|-------------------|----------------|----------------|------------|--------------|
| A — Quality Scoring | 10 | 10 | 0 | 0 | 0 | 100%* | Low |
| B — Trend Analysis | 10 | 10 | 0 | 0 | 0 | 100%* | Low |
| C — Moat Scoring | 6 | 1 | 0 | 0 | 0 | 17% | **Critical** |
| D — Valuation | 4 methods | 8 | 0 | 0 | 0 | 80% | Medium |
| E — Technical | 8 groups | 12 | 0 | 0 | 0 | 85% | Low |
| F — Portfolio | 4 rules | 1 | 0 | 0 | 0 | 25% | **High** |
| G — Exit Rules | 8 rules | 8 | 0 | 0 | 0 | 100%* | Low |
| Red-Flag Engine | 12 flags | 6 | 0 | 0 | 0 | 50% | Medium |
| **Pipeline (A→G)** | **N/A** | **0** | **0** | **0** | **0** | **0%** | **Critical** |

\* Unit test count matches rule count but **edge cases not fully covered** — see detailed matrices below.

---

## 2. Detailed Unit Test Coverage Matrix

### Stage A — Quality Scoring (10 Rules, 10 Tests in Section 2.1)

| Rule | Test Cases Provided | Missing Edge Cases |
|------|---------------------|-------------------|
| A1 Revenue Growth | 3 (normal, zero base, insufficient history) | Negative revenue, negative base |
| A2 Net Profit Growth | 3 (normal, zero base, insufficient history) | Both negative, negative base |
| A3 ROE | 2 (normal, high) | Zero/negative equity, negative NI + negative equity |
| A4 ROCE | 2 (normal, high) | Zero/negative capital employed |
| A5 Asset Turnover | 2 (normal, high) | Zero assets |
| A6 Operating Margin | 2 (normal, high) | Zero revenue |
| A7 FCF Yield | 2 (normal, high) | Zero market cap, negative FCF |
| A8 Interest Coverage | 3 (normal, no debt, low) | Negative EBIT, zero interest |
| A9 Debt-to-Equity | 3 (normal, zero equity, high) | Negative equity |
| A10 Current Ratio | 2 (normal, high) | Zero current liabilities |

**Stage A Gap:** 11 edge cases untested across 10 rules. No property tests (e.g., `score ∈ [0,1]`, `totalScore ≤ 10`).

---

### Stage B — Trend Analysis (10 Rules, 10 Tests in Section 2.2)

| Rule | Test Cases Provided | Missing Edge Cases |
|------|---------------------|-------------------|
| B1 Revenue CAGR | 2 (normal, insufficient history) | Negative base, negative current |
| B2 Net Profit CAGR | 2 (normal, insufficient history) | Negative base |
| B3 EPS CAGR | 2 (normal, insufficient history) | Negative EPS base |
| B4 EPS Consistency | 1 (4/5 years positive) | Zero EPS years, all negative, derivation logic |
| B5 OCF CAGR | 1 (normal) | Negative OCF, insufficient history |
| B6 FCF CAGR | 1 (normal) | Negative FCF, insufficient history |
| B7 Dividend Growth | 1 (normal) | **Zero base**, special dividends, **missing field** |
| B8 BVPS Growth | 1 (normal) | **Missing fields** (sharesOutstanding, BVPS), negative equity |
| B9 Price Momentum | 1 (normal) | Corporate actions, insufficient days |
| B10 Volatility | 2 (normal, low vol) | **Insufficient returns (<30)**, holiday gaps |

**Stage B Gap:** 14 edge cases untested. Critical: B7, B8 depend on missing domain fields.

---

### Stage C — Moat Scoring (6 Tests, 1 Test in Section 2.3)

| Moat Test | Test Cases Provided | Missing Coverage |
|-----------|---------------------|------------------|
| Switching Costs | 0 | All 4 score levels (0,1,2,3), evidence variants |
| Network Effects | 0 | All 4 score levels, user count proxies |
| Intangible Assets | 0 | Patent-heavy vs brand-heavy, conflicting signals |
| Cost Advantage | 0 | All 4 levels, industry comparison |
| Efficient Scale | 1 (monopoly case) | 3 other levels, niche vs broad |
| Data Moat | 0 | All 4 levels, data asset types |

**Stage C Gap:** **Only 1 of 6 moat tests has any test case.** No quantitative proxy tests. No qualitative rubric validation. **Critical deficiency.**

---

### Stage D — Valuation (4 Methods, 8 Tests in Section 2.4)

| Method | Test Cases Provided | Missing Edge Cases |
|--------|---------------------|-------------------|
| DCF | 3 (normal, negative FCF→reverse, terminal cap) | WACC ≤ g_term, negative equity, missing CAPM inputs |
| Reverse DCF | 2 (normal, no solution high/low) | Convergence tolerance, multiple roots (impossible) |
| Relative | 2 (normal, <3 peers) | **Peer selection**, outlier removal, negative multiples |
| Asset-Based | 1 (normal) | **Negative liquidation value**, discount config, **missing sharesOutstanding** |
| Composite | 0 | Reweighting, all invalid, confidence calculation |

**Stage D Gap:** 8 edge cases untested. Critical: peer selection methodology untested.

---

### Stage E — Technical Analysis (8 Groups, 12 Tests in Section 2.5)

| Indicator/Pattern | Test Cases Provided | Missing Edge Cases |
|-------------------|---------------------|-------------------|
| RSI | 2 (normal, oversold/overbought) | **<14 candles**, avgLoss=0, holiday gaps |
| MACD | 2 (normal, crossover) | **<26 candles**, initial EMA calculation |
| Bollinger Bands | 2 (normal, squeeze) | **<20 candles**, stdDev=0 (flat price) |
| ATR | 1 (normal) | **<14 candles**, first TR calc |
| Candlestick Patterns | 2 (doji, hammer, engulfing) | **Candle range=0**, threshold boundaries |
| Volume Confirmation | 1 (spike) | **Holiday volume**, avgVolume=0 |
| Gap Detection | 1 (gap up) | **Weekend/holiday gaps**, 0.5% boundary |
| Support/Resistance | 1 (pivot points) | **Cluster threshold boundary**, <20 candles |

**Stage E Gap:** 10 edge cases untested. Critical: holiday/weekend gap handling untested.

---

### Stage F — Portfolio Construction (4 Rules, 1 Test in Section 2.6)

| Rule | Test Cases Provided | Missing Edge Cases |
|------|---------------------|-------------------|
| Kelly Sizing | 0 | **f* < 0**, b=0, winRate=0/1, kellyCap binding |
| Volatility Targeting | 0 | **assetVol=0**, targetVol binding, lookback variance |
| Quadratic Optimization | 1 (normal 3-asset) | **Infeasible constraints**, singular Σ, solver tolerance, **solver variance** |
| Correlation Limits | 0 | **Pairwise breach**, avg breach, relaxation order |

**Stage F Gap:** **Only 1 test for 4 rules.** Critical: no infeasible portfolio test, no solver determinism test.

---

### Stage G — Exit Rules (8 Rules, 8 Tests in Section 2.7)

| Rule | Test Cases Provided | Missing Edge Cases |
|------|---------------------|-------------------|
| Trailing ATR Stop | 1 (normal) | **Gap down through stop**, weekend gap, ATR=0 |
| Time-Based Stop | 1 (normal) | **Holiday calendar**, exactly at boundary |
| Fundamental Deterioration | 1 (score drop >2) | **Intra-quarter monitoring**, entry score provenance |
| Take-Profit Scaling | 1 (level 1 hit) | **Partial fills**, gap through multiple levels |
| Valuation Reversion | 1 (price > 1.3*DCF) | **Stale DCF**, DCF invalid |
| Momentum Exhaustion | 1 (RSI>80 + MACD) | **RSI=80 boundary**, MACD=0 |
| Rebalance Drift | 1 (drift >5%) | **Both abs/rel breach**, multiple simultaneous |
| Red-Flag Override | 1 (critical→exit) | **Grace period conflict**, major→reduce, minor→review |

**Stage G Gap:** 9 edge cases untested. Critical: grace period conflict with Red-Flag spec untested.

---

### Red-Flag Engine (12 Flags, 6 Tests in Section 2.8)

| Flag Class | Flags | Tests | Missing Coverage |
|------------|-------|-------|------------------|
| Critical (Hard Block) | 4 | 2 | **Promoter pledge**, auditor qualification, related party, consistent loss — **all missing fields** |
| Major (Soft Block) | 3 | 1 | Debt spike (denom=0), margin collapse (negative), FCF 3Y |
| Minor (Warning) | 3 | 1 | Promoter holding, insider selling, high valuation |
| Info | 2 | 0 | Upcoming earnings, index rebalance |
| Cross-Flag | N/A | 0 | **Multiple simultaneous flags**, priority resolution |

**Red-Flag Gap:** 6 of 12 flags untested. Critical: all Critical flags depend on missing domain fields.

---

## 3. Cross-Cutting Test Gaps

### 3.1 Integration Tests (0 Exist)
| Integration Point | Required Tests | Status |
|-------------------|----------------|--------|
| Stage A → Stage B (shared financial history) | 3 | ❌ |
| Stage B → Stage D (growth rates for DCF) | 2 | ❌ |
| Stage D → Stage G (valuation for exit) | 2 | ❌ |
| Stage E → Stage G (technical signals for exit) | 2 | ❌ |
| Stage F → Stage G (portfolio positions for exit) | 2 | ❌ |
| Red-Flag → Stage G (override logic) | 3 | ❌ |
| Red-Flag → Stage F (block new positions) | 2 | ❌ |
| Pipeline A→B→C→D→E→F→G | 5 | ❌ |

**Total Missing Integration Tests: 21**

### 3.2 Pipeline/End-to-End Tests (0 Exist)
| Scenario | Description | Status |
|----------|-------------|--------|
| Happy Path | Quality stock passes all stages, enters portfolio, exits on TP | ❌ |
| Red-Flag Block | Critical flag blocks at Stage F | ❌ |
| Red-Flag Exit | Holding gets critical flag, exits per Stage G | ❌ |
| Valuation-Driven Exit | Price > 1.3x DCF triggers exit | ❌ |
| Rebalance | Drift triggers rebalance, respects correlation | ❌ |
| Insufficient History | New IPO with <5Y history flows through | ❌ |
| Negative Financials | Distressed company with negative equity | ❌ |
| Corporate Action | Stock split/bonus during holding period | ❌ |

**Total Missing Pipeline Tests: 8**

### 3.3 Property-Based Tests (0 Exist)
| Property | Applicable Stages | Status |
|----------|-------------------|--------|
| `score ∈ [0, maxScore]` | A, B, C, E | ❌ |
| `totalScore ≤ sum(maxScores)` | A, B, C | ❌ |
| `valuation > 0` for valid inputs | D | ❌ |
| `weights sum to 1` | F | ❌ |
| `weights ≤ maxPosition` | F | ❌ |
| `correlation ≤ 0.7` pairwise | F | ❌ |
| `exit triggers monotonic` (once triggered, stays) | G | ❌ |
| `red-flag priority: Critical > Major > Minor > Info` | Red-Flag | ❌ |
| `deterministic: same input → same output` | All | ❌ |

**Total Missing Property Tests: 9**

### 3.4 Contract Tests (0 Exist)
| Contract | Required Tests | Status |
|----------|----------------|--------|
| `StageAInput` → `StageAOutput` shape | 5 | ❌ |
| `StageBInput` → `StageBOutput` shape | 5 | ❌ |
| `StageCInput` → `StageCOutput` shape | 5 | ❌ |
| `StageDInput` → `StageDOutput` shape | 5 | ❌ |
| `StageEInput` → `StageEOutput` shape | 5 | ❌ |
| `StageFInput` → `StageFOutput` shape | 5 | ❌ |
| `StageGInput` → `StageGOutput` shape | 5 | ❌ |
| `RedFlagInput` → `RedFlagOutput` shape | 5 | ❌ |
| `FinancialStatement` required fields | 10 | ❌ |
| `PricePoint` required fields | 5 | ❌ |

**Total Missing Contract Tests: 50**

---

## 4. Test Coverage by Requirement Type

| Requirement Type | Rules Covered | Tests Written | Coverage | Gap |
|------------------|---------------|---------------|----------|-----|
| Happy Path (normal inputs) | 58 | 56 | 97% | Low |
| Boundary Values (thresholds) | 58 | 24 | 41% | **High** |
| Error/Edge Cases | 58 | 11 | 19% | **Critical** |
| Invalid Inputs | 58 | 3 | 5% | **Critical** |
| Missing Data | 58 | 2 | 3% | **Critical** |
| Determinism Verification | 58 | 0 | 0% | **Critical** |
| Performance/Benchmarks | 58 | 0 | 0% | Medium |

---

## 5. Test Case Quality Assessment

### Existing Test Cases (from `RULE_VALIDATION_TEST_CASES.md`)

**Strengths:**
- Clear input/output format with concrete numbers
- Covers happy path for most rules
- Includes some boundary values (zero, insufficient history)

**Weaknesses:**
- No test IDs or traceability to requirements
- No expected error messages for invalid inputs
- No performance benchmarks
- No negative testing (invalid types, missing fields)
- No cross-rule interaction tests
- Stage C tests are essentially absent
- No test data builders/factories for complex inputs (e.g., 10Y financial history)

---

## 6. Recommended Test Suite Structure

```
tests/
├── unit/
│   ├── stage-a/
│   │   ├── revenue-growth.test.ts
│   │   ├── ... (10 files)
│   │   └── property.test.ts          # NEW: property-based tests
│   ├── stage-b/
│   │   ├── ... (10 files)
│   │   └── property.test.ts
│   ├── stage-c/
│   │   ├── moat-rubrics.test.ts      # NEW: quantitative proxy tests
│   │   ├── qualitative.test.ts       # NEW: structured evidence tests
│   │   └── property.test.ts
│   ├── stage-d/
│   │   ├── dcf.test.ts
│   │   ├── reverse-dcf.test.ts
│   │   ├── relative.test.ts
│   │   ├── asset-based.test.ts
│   │   ├── composite.test.ts
│   │   ├── peer-selection.test.ts    # NEW
│   │   └── property.test.ts
│   ├── stage-e/
│   │   ├── rsi.test.ts
│   │   ├── macd.test.ts
│   │   ├── bollinger.test.ts
│   │   ├── atr.test.ts
│   │   ├── candlestick.test.ts
│   │   ├── volume.test.ts
│   │   ├── gaps.test.ts
│   │   ├── support-resistance.test.ts
│   │   ├── holiday-gaps.test.ts      # NEW
│   │   └── property.test.ts
│   ├── stage-f/
│   │   ├── kelly.test.ts
│   │   ├── volatility-targeting.test.ts
│   │   ├── optimization.test.ts
│   │   ├── correlation.test.ts
│   │   ├── infeasible.test.ts        # NEW
│   │   ├── solver-variance.test.ts   # NEW
│   │   └── property.test.ts
│   ├── stage-g/
│   │   ├── trailing-atr.test.ts
│   │   ├── time-stop.test.ts
│   │   ├── fundamental.test.ts
│   │   ├── take-profit.test.ts
│   │   ├── valuation-reversion.test.ts
│   │   ├── momentum-exhaustion.test.ts
│   │   ├── rebalance.test.ts
│   │   ├── red-flag-override.test.ts
│   │   ├── grace-period.test.ts      # NEW: conflict resolution
│   │   └── property.test.ts
│   └── red-flag/
│       ├── critical.test.ts
│       ├── major.test.ts
│       ├── minor.test.ts
│       ├── info.test.ts
│       ├── cross-flag.test.ts        # NEW
│       └── property.test.ts
├── integration/
│   ├── stage-a-to-b.test.ts
│   ├── stage-b-to-d.test.ts
│   ├── stage-d-to-g.test.ts
│   ├── stage-e-to-g.test.ts
│   ├── stage-f-to-g.test.ts
│   ├── red-flag-to-f.test.ts
│   ├── red-flag-to-g.test.ts
│   └── data-contracts.test.ts        # NEW: contract tests
├── pipeline/
│   ├── happy-path.test.ts
│   ├── red-flag-block.test.ts
│   ├── red-flag-exit.test.ts
│   ├── valuation-exit.test.ts
│   ├── rebalance.test.ts
│   ├── insufficient-history.test.ts
│   ├── negative-financials.test.ts
│   └── corporate-action.test.ts
└── fixtures/
    ├── financial-history-10y.json
    ├── price-history-5y.json
    ├── peer-universe.json
    └── test-data-builders.ts
```

---

## 7. Test Implementation Priority

| Priority | Test Category | Count | Rationale |
|----------|---------------|-------|-----------|
| **P0 (Pre-Phase 1)** | Stage C moat rubric tests | 6 | Critical determinism gap |
| **P0** | Stage F infeasible portfolio test | 1 | Portfolio construction can fail silently |
| **P0** | Red-Flag Critical flag tests | 4 | Hard-block logic must be verified |
| **P0** | Stage D peer selection test | 1 | Methodology unspecified, high impact |
| **P0** | Grace period conflict test | 1 | Spec contradiction must be resolved |
| **P1 (Phase 1)** | All boundary value tests | ~30 | Threshold behavior critical |
| **P1** | Property-based tests (9 properties) | 9 | Determinism verification |
| **P1** | Contract tests (10 interfaces) | 50 | API stability |
| **P2 (Phase 1+)** | Integration tests | 21 | Cross-stage correctness |
| **P2** | Pipeline/E2E tests | 8 | Full workflow validation |
| **P3 (Ongoing)** | Holiday/weekend gap tests | 5 | Indian market specific |
| **P3** | Solver variance benchmark | 1 | Determinism across platforms |

**Total New Tests Needed: ~143** (vs. 56 existing)

---

## 8. Tooling Recommendations

| Need | Recommended Tool | Rationale |
|------|------------------|-----------|
| Property-based testing | `fast-check` (TypeScript) | Generates edge cases automatically |
| Test data builders | `ts-auto-mock` / custom builders | Complex nested inputs (10Y history) |
| Contract testing | `io-ts` + `schemats` | Runtime validation of interfaces |
| Snapshot testing | `jest` snapshots | Determinism verification |
| Benchmarking | `benchmark.js` | Solver performance, determinism |
| Mutation testing | `stryker-mutator` | Test quality verification |
| CI integration | GitHub Actions matrix | Multi-Node version, OS testing |

---

## 9. Traceability: Rules → Tests

| Spec Section | Rules | Existing Tests | Required Tests | Coverage |
|--------------|-------|----------------|----------------|----------|
| 2.1 Stage A | 10 | 10 | 21 | 48% |
| 2.2 Stage B | 10 | 10 | 24 | 42% |
| 2.3 Stage C | 6 | 1 | 25 | 4% |
| 2.4 Stage D | 4 methods | 8 | 20 | 40% |
| 2.5 Stage E | 8 groups | 12 | 22 | 55% |
| 2.6 Stage F | 4 | 1 | 15 | 7% |
| 2.7 Stage G | 8 | 8 | 17 | 47% |
| 2.8 Red-Flag | 12 | 6 | 18 | 33% |
| **Integration** | **21 points** | **0** | **21** | **0%** |
| **Pipeline** | **8 scenarios** | **0** | **8** | **0%** |
| **Properties** | **9 properties** | **0** | **9** | **0%** |
| **Contracts** | **10 interfaces** | **0** | **50** | **0%** |

**Overall Rule-Level Coverage: 56/87 = 64%**  
**Overall Requirement Coverage: 56/199 = 28%**

---

*End of Rule Test Coverage Matrix Report*