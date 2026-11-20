# Domain Implementation Readiness Report

**Phase:** 0.5 — Specification Reconciliation  
**Date:** 2026-11-15  
**Scope:** Readiness classification for each Stage (A–G) and shared components for Phase 1 implementation in `packages/core`

---

## Executive Summary

Assessed 8 implementation units (7 Stages + Red-Flag Engine + Shared Domain) against 5 readiness criteria: **Specification Completeness**, **Determinism**, **Data Availability**, **Test Coverage**, **Contract Stability**. 

**Result:** 2 units **READY**, 3 units **NEEDS MINOR WORK**, 2 units **NEEDS MAJOR WORK**, 1 unit **BLOCKED**. Phase 1 can begin with Stages A, B, E; Stages C, D, F, G, Red-Flag need prerequisite resolution.

---

## Readiness Classification Framework

| Level | Criteria | Phase 1 Action |
|-------|----------|----------------|
| **READY** | Spec complete, deterministic, data fields defined, tests exist, contracts stable | Implement immediately |
| **NEEDS MINOR WORK** | 1-2 gaps (edge cases, config externalization, missing tests) | Implement with tracked TODOs |
| **NEEDS MAJOR WORK** | Significant gaps (missing formulas, qualitative determinism, data fields) | Resolve gaps before implementation |
| **BLOCKED** | Critical dependency unresolved (data provider, spec conflict) | Cannot start until resolved |

---

## Unit Readiness Assessment

### 1. Stage A — Quality Scoring Engine
**Classification: READY ✅**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 10 rules fully specified with formulas, thresholds, scoring |
| Determinism | ✅ | Pure arithmetic, no stochastic elements |
| Data Availability | ⚠️ | **Missing:** `avgShareholdersEquity`, `interestExpense` (has `financeCost`) |
| Test Coverage | ✅ | 10 unit tests (happy path + basic edges) |
| Contract Stability | ✅ | `StageAInput`/`StageAOutput` stable in domain model |

**Gaps (Minor):**
- Add `avgShareholdersEquity` to `FinancialStatement` or compute helper
- Map `financeCost` → `interestExpense` with documentation
- Add 11 missing edge case tests (negative equity, zero denominators)

**Implementation Effort:** ~40 hours (engine + tests + validation)
**Dependencies:** None
**Recommendation:** Start Phase 1 here — highest readiness, validates domain model patterns

---

### 2. Stage B — Trend Analysis Engine
**Classification: NEEDS MINOR WORK ⚠️**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 10 rules with lookbacks, formulas, thresholds |
| Determinism | ✅ | CAGR, regression, volatility — all closed-form |
| Data Availability | ❌ | **Missing:** `dividendPerShare`, `sharesOutstanding`, `epsGrowth` derivation |
| Test Coverage | ✅ | 10 unit tests |
| Contract Stability | ⚠️ | `StageBInput` needs `epsGrowth` derivation logic |

**Gaps (Minor-Medium):**
- Add `dividendPerShare`, `sharesOutstanding` to `FinancialStatement` (Decision 15)
- Define `epsGrowth` derivation: `(eps[t] - eps[t-1]) / abs(eps[t-1])` with zero handling
- Document lookback rationale (5Y vs 3Y vs 1Y)
- Add 14 missing edge case tests (negative bases, corporate actions, holiday gaps)

**Implementation Effort:** ~50 hours
**Dependencies:** Decision 15 (data fields), Decision 3 (history requirements)
**Recommendation:** Implement after Stage A; block on `dividendPerShare`/`sharesOutstanding` fields

---

### 3. Stage C — Business Model & Moat Engine
**Classification: NEEDS MAJOR WORK 🔴**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ⚠️ | 6 moat tests defined but **qualitative only** |
| Determinism | ❌ | **No quantization rules** for qualitative assessments |
| Data Availability | ❌ | `BusinessModelInput` interface **missing** from domain model |
| Test Coverage | ❌ | 1 test for 6 rules (17% coverage) |
| Contract Stability | ❌ | Input contract undefined |

**Critical Gaps:**
1. **No deterministic scoring** — qualitative 0–3 rubrics need anchored definitions
2. **Missing `BusinessModelInput`** interface — must define structured evidence fields
3. **No quantitative proxies** — need fallback formulas for each moat test
4. **Test coverage critical** — need 24+ tests including rubric validation

**Required Before Implementation:**
- Define `BusinessModelInput` with structured evidence per moat test
- Create quantitative proxy formulas (see Formula Audit Section 3)
- Write anchored rubrics: "0 = X, 1 = Y, 2 = Z, 3 = W" with examples
- Decision on: purely quantitative? hybrid? manual override?

**Implementation Effort:** ~120 hours (major design work + implementation)
**Dependencies:** Decision 14 (config for rubric anchors), Decision 15 (data for proxies)
**Recommendation:** **Do not start Phase 1** — resolve determinism first via design spike

---

### 4. Stage D — Valuation Engine
**Classification: NEEDS MAJOR WORK 🔴**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 4 methods fully formulated |
| Determinism | ✅ | All formulas mathematically specified |
| Data Availability | ❌ | **Missing:** `beta`, `riskFreeRate`, `equityRiskPremium`, `sharesOutstanding`, `ebitda`, peer universe |
| Test Coverage | ⚠️ | 8 tests, missing peer selection, composite reweighting |
| Contract Stability | ⚠️ | `ValuationInput` missing CAPM params, peer selection logic |

**Critical Gaps:**
1. **CAPM inputs missing** from `ValuationInput` — `beta`, `riskFreeRate`, `equityRiskPremium` required for DCF
2. **Peer selection methodology unspecified** — critical for Relative valuation
3. **`sharesOutstanding` missing** — needed for all per-share outputs
4. **`ebitda` not in domain model** — derive from `operatingIncome + depreciationAmortization`
5. **Asset-based discounts hardcoded** — need config (Decision 8, 14)

**Required Before Implementation:**
- Extend `ValuationInput` with CAPM params and peer universe
- Define peer selection algorithm (sector, market cap range, profitability filter)
- Add `sharesOutstanding` to `FinancialStatement` (Decision 15)
- Add `ebitda` derivation or field
- Externalize discounts to config

**Implementation Effort:** ~80 hours
**Dependencies:** Decision 8 (terminal cap, discounts), Decision 14 (config), Decision 15 (data fields)
**Recommendation:** **Do not start Phase 1** — resolve peer selection and CAPM inputs first

---

### 5. Stage E — Technical Analysis Engine
**Classification: READY ✅**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 8 indicator groups fully formulated |
| Determinism | ✅ | All indicators (RSI, MACD, BB, ATR, candlesticks) deterministic |
| Data Availability | ✅ | `PricePoint[]` with OHLCV in domain model |
| Test Coverage | ✅ | 12 unit tests covering main indicators |
| Contract Stability | ✅ | `StageEInput`/`StageEOutput` stable |

**Gaps (Minor):**
- 10 missing edge case tests (holiday gaps, insufficient candles, flat price)
- 8 hardcoded thresholds need config externalization (Decision 14)
- Corporate action adjustment for price history (splits, bonuses)

**Implementation Effort:** ~50 hours
**Dependencies:** Decision 14 (config for thresholds), Decision 15 (corporate action adjusted prices)
**Recommendation:** Start Phase 1 — high readiness, independent of fundamentals

---

### 6. Stage F — Portfolio Construction Engine
**Classification: NEEDS MAJOR WORK 🔴**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | Kelly, vol targeting, optimization, correlation limits |
| Determinism | ⚠️ | **Solver tolerance/choice unspecified** — affects weight precision |
| Data Availability | ⚠️ | Needs covariance matrix, expected returns from Stages A–E |
| Test Coverage | ❌ | 1 test for 4 rules (25% coverage) |
| Contract Stability | ✅ | `StageFInput`/`StageFOutput` defined |

**Critical Gaps:**
1. **Solver not specified** — OSQP? qpOASES? Custom? Tolerance undocumented
2. **WinRate/avgWin/avgLoss provenance undefined** — from backtests of Stages A–E?
3. **No infeasible portfolio handling test** — constraints can conflict
4. **Correlation lookback/limits hardcoded** — need config (Decision 11, 14)
5. **Missing 3 rule tests** — Kelly, vol targeting, correlation limits

**Required Before Implementation:**
- Select and document quadratic solver (recommend OSQP for TypeScript/WASM)
- Define `winRate`, `avgWin`, `avgLoss` computation from Stage A–E backtests
- Specify solver tolerance (1e-6) and infeasible constraint relaxation order
- Externalize correlation params, Kelly cap, vol target to config

**Implementation Effort:** ~80 hours
**Dependencies:** Decision 9, 10, 11, 14 (config), Stages A–E (for return estimates)
**Recommendation:** **Do not start Phase 1** — needs solver decision and return provenance

---

### 7. Stage G — Exit Rules Engine
**Classification: NEEDS MINOR WORK ⚠️**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 8 exit rules fully formulated |
| Determinism | ✅ | All threshold-based with explicit formulas |
| Data Availability | ✅ | Uses Stage A–F outputs, price data, red-flag outputs |
| Test Coverage | ✅ | 8 unit tests |
| Contract Stability | ⚠️ | **Conflict with Red-Flag Spec** on grace period |

**Gaps (Minor-Medium):**
- **Critical conflict:** Red-Flag Spec (3-day grace) vs Stage G (immediate exit) — Decision 12
- 9 missing edge case tests (gap through stop, partial fills, stale DCF)
- 8 hardcoded thresholds need config (Decision 13, 14)
- Fundamental deterioration: intra-quarter monitoring undefined

**Required Before Implementation:**
- Resolve Decision 12 (grace period)
- Externalize thresholds to config
- Define intra-quarter fundamental monitoring (re-run Stage A? proxy?)

**Implementation Effort:** ~40 hours
**Dependencies:** Decision 12 (conflict), Decision 13, 14 (config), Stages A, D, E, Red-Flag
**Recommendation:** Implement after Decision 12 resolved; can parallelize with Stage F

---

### 8. Red-Flag Engine
**Classification: BLOCKED 🚫**

| Criterion | Status | Details |
|-----------|--------|---------|
| Specification Completeness | ✅ | 4 classes × 12 flags with formulas |
| Determinism | ✅ | All threshold-based |
| Data Availability | ❌ | **8 fields missing** from domain model |
| Test Coverage | ⚠️ | 6 tests for 12 flags (50%) |
| Contract Stability | ✅ | `RedFlagInput`/`RedFlagOutput` defined |

**Blocking Gaps:**
1. **8 required fields missing from domain model** (Decision 15):
   - `promoterPledgePct` (Critical)
   - `relatedPartyTxn` (Critical)
   - `auditorQualification` (Critical)
   - `promoterHolding` (Minor)
   - `insiderNetSell_90d` (Minor)
   - `industryMedianPE` (Minor)
   - `daysToEarnings` (Info)
   - `isInIndexRebalanceWindow` (Info)
2. **Grace period conflict** with Stage G (Decision 12)
3. **No data source** for red-flag fields — requires specialized data pipeline

**Required Before Implementation:**
- Decision 15 (Data Provider) — **absolute blocker**
- Decision 12 (Grace Period) — conflict resolution
- Extend `FinancialStatement`/`RedFlagInput` with 8 fields
- Build data pipeline for promoter pledge, RPT, auditor qualification

**Implementation Effort:** ~60 hours (engine) + **Data Pipeline (separate project)**
**Dependencies:** Decision 15 (BLOCKER), Decision 12, Decision 5, 6, 7 (thresholds)
**Recommendation:** **Cannot start Phase 1** — data pipeline prerequisite

---

### 9. Shared Domain Model & Contracts
**Classification: NEEDS MINOR WORK ⚠️**

| Criterion | Status | Details |
|-----------|--------|---------|
| Interface Completeness | ❌ | **6 fields missing**, 1 interface missing (`BusinessModelInput`) |
| Engine Contracts | ⚠️ | `IStageEngine` missing timeout, cancellation, progress |
| Pipeline Contract | ❌ | `IPipelineEngine` missing dependency graph, partial failure handling |
| Data Provider Contract | ❌ | `IDataProvider` not defined |
| TypeScript Standards | ✅ | Aligns with `DEVELOPMENT_STANDARDS.md` |

**Missing Fields in `FinancialStatement`:**
1. `dividendPerShare` (Stage B7)
2. `beta` (Stage D CAPM)
3. `sharesOutstanding` (Stage D, B8)
4. `avgShareholdersEquity` (Stage A3)
5. `promoterPledgePct` (Red-Flag)
6. `relatedPartyTxn` (Red-Flag)
7. `auditorQualification` (Red-Flag)
8. `promoterHolding` (Red-Flag)
9. `insiderNetSell_90d` (Red-Flag)
10. `depreciationAmortization` (for EBITDA derivation)

**Missing Interfaces:**
- `BusinessModelInput` (Stage C)
- `IDataProvider` (all stages)

**Engine Contract Gaps:**
- `IStageEngine.run(input, options?)` — needs `timeoutMs`, `signal: AbortSignal`, `onProgress?`
- `IPipelineEngine.runAll(stages, input)` — needs `stageDependencies`, `failurePolicy`, `partialResults`

**Implementation Effort:** ~20 hours (domain model), ~15 hours (contracts)
**Dependencies:** Decision 15 (data fields), Decision 3 (history validation)
**Recommendation:** Complete before any Stage implementation — foundation for all engines

---

## Phase 1 Implementation Sequence

### Sprint 1 (Weeks 1-2): Foundation + Ready Engines
| Task | Effort | Dependencies |
|------|--------|--------------|
| Complete Domain Model (add 10 fields, `BusinessModelInput`, `IDataProvider`) | 35h | Decision 15 (for field types) |
| Implement `ConfigService` (Decision 14) | 20h | Decision 14 |
| Implement Stage A Engine | 40h | Domain Model done |
| Implement Stage E Engine | 50h | Domain Model done, Decision 14 |
| Stage A + E Unit Tests (property-based) | 20h | Engines done |
| **Total** | **~165h** | |

### Sprint 2 (Weeks 3-4): Trend + Valuation Prep
| Task | Effort | Dependencies |
|------|--------|--------------|
| Implement Stage B Engine | 50h | Domain Model (needs dividendPerShare, sharesOutstanding) |
| Stage B Unit + Edge Tests | 25h | Engine done |
| Design Stage C Quantitative Proxies + Rubrics | 40h | Decision on approach |
| Design Stage D Peer Selection Algorithm | 20h | Decision 8, 15 |
| Extend ValuationInput with CAPM params | 10h | Domain Model |
| **Total** | **~145h** | |

### Sprint 3 (Weeks 5-6): Valuation + Portfolio + Exit
| Task | Effort | Dependencies |
|------|--------|--------------|
| Implement Stage D Engine | 80h | Peer selection designed, CAPM inputs |
| Select/Integrate Quadratic Solver (OSQP) | 20h | Decision on solver |
| Implement Stage F Engine | 80h | Solver chosen, return provenance defined |
| Resolve Decision 12 (Grace Period) | 5h | User decision |
| Implement Stage G Engine | 40h | Decision 12 resolved |
| **Total** | **~225h** | |

### Sprint 4 (Weeks 7-8): Red-Flag + Pipeline + Integration
| Task | Effort | Dependencies |
|------|--------|--------------|
| Build Red-Flag Data Pipeline (Decision 15) | **Separate track** | Decision 15 |
| Implement Red-Flag Engine | 60h | Data pipeline, fields in domain model |
| Implement Pipeline Engine | 30h | All stage engines done |
| Integration Tests (7 cross-stage) | 40h | All engines done |
| Pipeline/E2E Tests (8 scenarios) | 30h | Pipeline done |
| **Total** | **~160h + Data Pipeline** | |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Decision 15 (Data Provider) delays all Stages C, D, F, G, Red-Flag | High | Critical | Start data pipeline spike Week 1; use mock data for engine dev |
| Stage C qualitative determinism unsolvable | Medium | High | Time-box design spike (2 weeks); fallback to quantitative-only MVP |
| Quadratic solver determinism across platforms | Medium | Medium | Pin OSQP version; add solver variance test; document tolerance |
| Peer selection methodology controversy | Medium | Medium | Document algorithm; make pluggable; start with simple sector+size filter |
| Red-Flag grace period conflict unresolved | Low | High | Escalate to user Week 1; default to 3-day grace (Red-Flag Spec) |
| Config externalization scope creep | Medium | Low | Strict split: strategic→config, tactical→code (Decision 14) |

---

## Go/No-Go Criteria for Phase 1 Start

| Criterion | Status | Required For |
|-----------|--------|--------------|
| Domain Model complete (all 10 fields + BusinessModelInput) | ❌ | All Stages |
| ConfigService implemented | ❌ | All Stages |
| Decision 12 (Grace Period) resolved | ❌ | Stage G, Red-Flag |
| Decision 15 (Data Provider) approach agreed | ❌ | Stages C, D, F, G, Red-Flag |
| Stage C quantitative proxies designed | ❌ | Stage C |
| Stage D peer selection algorithm defined | ❌ | Stage D |
| Quadratic solver selected | ❌ | Stage F |

**Recommendation:** **Conditional Go** — Start Sprint 1 (Foundation + Stages A, E) immediately. 
Block Sprint 2+ on: Decision 12, Decision 15 approach, Stage C/D designs.

---

## File/Module Structure for `packages/core`

```
packages/core/
├── src/
│   ├── domain/
│   │   ├── financial-statement.ts      # FinancialStatement + missing fields
│   │   ├── price-point.ts              # PricePoint
│   │   ├── stage-a.ts                  # StageAInput, StageAOutput
│   │   ├── stage-b.ts                  # StageBInput, StageBOutput
│   │   ├── stage-c.ts                  # StageCInput, StageCOutput, BusinessModelInput
│   │   ├── stage-d.ts                  # StageDInput, StageDOutput, ValuationInput
│   │   ├── stage-e.ts                  # StageEInput, StageEOutput, TechnicalInput
│   │   ├── stage-f.ts                  # StageFInput, StageFOutput, PortfolioConstructionInput
│   │   ├── stage-g.ts                  # StageGInput, StageGOutput, ExitInput
│   │   ├── red-flag.ts                 # RedFlagInput, RedFlagOutput, Flag classes
│   │   └── contracts.ts                # IStageEngine, IPipelineEngine, IDataProvider
│   ├── config/
│   │   ├── schema.ts                   # Config schema (zod/JSON Schema)
│   │   ├── defaults.ts                 # Default values for all 32 strategic params
│   │   └── config-service.ts           # ConfigService with hot-reload
│   ├── engines/
│   │   ├── stage-a-engine.ts
│   │   ├── stage-b-engine.ts
│   │   ├── stage-c-engine.ts
│   │   ├── stage-d-engine.ts
│   │   ├── stage-e-engine.ts
│   │   ├── stage-f-engine.ts
│   │   ├── stage-g-engine.ts
│   │   └── red-flag-engine.ts
│   ├── pipeline/
│   │   └── pipeline-engine.ts
│   ├── utils/
│   │   ├── math.ts                     # CAGR, regression, stdDev, EMA, etc.
│   │   ├── validation.ts               # Input validation helpers
│   │   └── financial.ts                # EBITDA, FCF, BVPS derivations
│   └── index.ts                        # Public exports
├── tests/
│   ├── unit/                           # Per-engine tests
│   ├── integration/                    # Cross-stage tests
│   ├── pipeline/                       # E2E tests
│   ├── property/                       # fast-check property tests
│   └── fixtures/                       # Test data builders
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Summary Readiness Matrix

| Unit | Classification | Sprint | Blockers |
|------|----------------|--------|----------|
| Domain Model/Contracts | NEEDS MINOR WORK | 1 | Decision 15 (field types) |
| ConfigService | NEEDS MINOR WORK | 1 | Decision 14 |
| Stage A Engine | **READY** | 1 | None |
| Stage B Engine | NEEDS MINOR WORK | 2 | dividendPerShare, sharesOutstanding |
| Stage C Engine | **NEEDS MAJOR WORK** | 2+ | Quantitative proxies, rubrics, BusinessModelInput |
| Stage D Engine | **NEEDS MAJOR WORK** | 3 | CAPM inputs, peer selection, sharesOutstanding |
| Stage E Engine | **READY** | 1 | Decision 14 (config) |
| Stage F Engine | **NEEDS MAJOR WORK** | 3 | Solver choice, return provenance, config |
| Stage G Engine | NEEDS MINOR WORK | 3 | Decision 12 (grace period), config |
| Red-Flag Engine | **BLOCKED** | 4 | Decision 15 (data pipeline), 8 missing fields |
| Pipeline Engine | NEEDS MINOR WORK | 4 | All stage engines done |

**Phase 1 Scope Recommendation:** Sprints 1-2 only (Foundation, Stages A, B, E, Config, Domain Model)
**Defer to Phase 2:** Stages C, D, F, G, Red-Flag, Pipeline (require prerequisite resolution)

---

*End of Domain Implementation Readiness Report*