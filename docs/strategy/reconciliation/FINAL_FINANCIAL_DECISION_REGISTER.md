# Final Financial Decision Register

**Phase:** 0.6 — Final Investment Rules Reconciliation  
**Date:** 15 November 2026  
**Source:** `INVESTMENT_RULES_SPECIFICATION.md` Section 14 (15 Decisions) + Antigravity `ARCHITECTURE_GAP_REGISTER.md` (5 Architecture Governance Decisions)  
**Status:** All 20 decisions **PENDING** — require explicit user approval

---

## Executive Summary

This register consolidates all 15 user decisions from the master investment specification (`INVESTMENT_RULES_SPECIFICATION.md` Section 14) plus 5 architecture governance decisions identified by Antigravity (`ARCHITECTURE_GAP_REGISTER.md` GAP-006 through GAP-010). Each entry includes a unique ID, display number, exact question, source specification, existing specification position, Kilo Code recommendation, dependencies, implementation impact, and user approval status.

**No decision has been approved by the user.** All recommendations are engineering analysis only and do not constitute approved investment policy.

---

## Master Decision Index (20 Decisions)

| ID | Display | Category | Short Title | Status | Blocks Phase 1A | Blocks Phase 1B |
|----|---------|----------|-------------|--------|-----------------|-----------------|
| D-01 | 1 | Financial Policy | D/E Boundary Inclusivity | PENDING | No | Yes (Stage A) |
| D-02 | 2 | Financial Policy | Current Ratio = 1.0 Handling | PENDING | No | No (spec resolves) |
| D-03 | 3 | Financial Policy | Minimum Financial History | PENDING | No | Yes (Stages A–E) |
| D-04 | 4 | Financial Policy | Hard-Block Override Policy | PENDING | No | No (spec defines) |
| D-05 | 5 | Financial Policy | Promoter Pledge Threshold | PENDING | No | Yes (Red-Flag) |
| D-06 | 6 | Financial Policy | RPT Threshold | PENDING | No | Yes (Red-Flag) |
| D-07 | 7 | Financial Policy | Auditor Qualification | PENDING | No | Yes (Red-Flag) |
| D-08 | 8 | Financial Policy | DCF Terminal Cap & Asset Discounts | PENDING | No | No (defaults exist) |
| D-09 | 9 | Financial Policy | Kelly Criterion Cap | PENDING | No | No (not in Stage F spec) |
| D-10 | 10 | Financial Policy | Portfolio Volatility Target | PENDING | No | No (not in Stage F spec) |
| D-11 | 11 | Financial Policy | Correlation Lookback & Limits | PENDING | No | No (not in Stage F spec) |
| D-12 | 12 | Financial Policy | Red-Flag Grace Period | PENDING | No | **Yes (Stage G, Red-Flag)** |
| D-13 | 13 | Financial Policy | Take-Profit Scaling Levels | PENDING | No | No (defaults exist) |
| D-14 | 14 | Architecture | Config Externalization Strategy | PENDING | **Yes (All Engines)** | Yes |
| D-15 | 15 | Data Architecture | Data Provider & Universe | PENDING | **Yes (Domain Model)** | **Yes (Production)** |
| D-A1 | A1 | Architecture Governance | Stage A Boundaries (Arch) | PENDING | No | Same as D-01, D-02 |
| D-A2 | A2 | Architecture Governance | Stage B Pass Mark & Public Holding | PENDING | No | Related to D-03, D-07 |
| D-A3 | A3 | Architecture Governance | Stage C Moat Scoring Rubric | PENDING | No | Related to D-06 |
| D-A4 | A4 | Architecture Governance | PEG Growth Rate Fallback | PENDING | No | **Yes (Stage D)** |
| D-A5 | A5 | Architecture Governance | DATA_QUALITY Gating Behavior | PENDING | No | Related to D-04, D-12 |

---

## Financial Policy Decisions (D-01 through D-15)

### Decision D-01: D/E Boundary Inclusivity (Stage A Rule 6)

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-01 |
| **Display Number** | 1 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 14 Row 1; `STAGE_A_SCORING_SPEC.md` Rule 6; `ARCHITECTURE_GAP_REGISTER.md` GAP-006 |
| **Exact Question** | "D/E boundary inclusivity: 0.5 and 1.25 — which band?" |
| **Existing Spec Position** | `STAGE_A_SCORING_SPEC.md` Rule 6: "Boundary Decision Required: Option A: `< 0.5` / `0.5–1.25` / `> 1.25` (recommended). Option B: `≤ 0.5` / `0.5 < × ≤ 1.25` / `> 1.25`" |
| **Kilo Recommendation** | **Option A** — Standard interpretation; `< 0.5000` = 1.0 pt; `0.5000 ≤ D/E ≤ 1.2500` = 0.5 pt; `> 1.2500` = 0.0 pt + HARD_STOP |
| **Dependencies** | D-14 (config externalization) |
| **Implementation Impact** | Affects `StageAEngine.debtEquityRule()`, `RedFlagEngine.STAGE_A_DEBT_EQUITY_HIGH`, config key `stageA.rules.debtEquity.boundaries` |
| **User Approval Status** | **PENDING** |

---

### Decision D-02: Current Ratio Exactly 1.0 — Hard Flag or 0.5 Points

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-02 |
| **Display Number** | 2 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 14 Row 2; `STAGE_A_SCORING_SPEC.md` Rule 7; `ARCHITECTURE_GAP_REGISTER.md` GAP-006 |
| **Exact Question** | "Current Ratio exactly 1.0 — hard flag or 0.5 pts?" |
| **Existing Spec Position** | `STAGE_A_SCORING_SPEC.md` Rule 7: "Current Ratio exactly 1.0 → scores 0.5 (falls in 1–2 band); hard flag is strictly `< 1`" |
| **Kilo Recommendation** | **Option A** — Already documented in spec; hard flag threshold is `< 1.0000` not `≤ 1.0000`; CR = 1.0000 → 0.5 pts, no flag |
| **Dependencies** | D-14 (config externalization) |
| **Implementation Impact** | Affects `StageAEngine.currentRatioRule()`, `RedFlagEngine.STAGE_A_CURRENT_RATIO_LOW`, config key `stageA.rules.currentRatio.thresholds` |
| **User Approval Status** | **PENDING** (confirm spec interpretation) |

---

### Decision D-03: Minimum Financial History Requirements

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-03 |
| **Display Number** | 3 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 14 (implied); `STAGE_A_SCORING_SPEC.md`, `STAGE_B_SCORING_SPEC.md`, `VALUATION_ENGINE_SPEC.md` |
| **Exact Question** | "How many years of financial history are required for each stage?" |
| **Existing Spec Position** | Stage A: 5Y; Stage B: 5Y/3Y mixed (8 quarters minimum); Stage D: 10Y DCF horizon; Stage E: 252 trading days — **no unified policy** |
| **Kilo Recommendation** | **Option C** — Minimum 3 years universal with graceful degradation (partial scores for available periods); balances IPO coverage and data quality |
| **Dependencies** | D-14 (config); D-15 (data provider capability) |
| **Implementation Impact** | Affects input validation for all `Stage*Input` types; graceful degradation requires partial scoring rules per sub-rule; config keys: `universe.minHistoryYears`, `stageX.minPeriods` |
| **User Approval Status** | **PENDING** |

---

### Decision D-04: Red-Flag Hard-Block Override Policy

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-04 |
| **Display Number** | 4 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 3; `RED_FLAG_ENGINE_SPEC.md` Section 2.1, 3, 11.2 |
| **Exact Question** | "Should HARD_STOP red flags be absolute hard-blocks, or allow override?" |
| **Existing Spec Position** | HARD_STOP blocks progression; override permitted with audit trail (Section 3: "Override Rules"): reason (min 50 chars), timestamp, user ID, before/after state; original flag never deleted |
| **Kilo Recommendation** | **Option C (spec-aligned)** — Hard-block with manual override (audit trail required); Option B (grace period) is D-12 |
| **Dependencies** | D-12 (grace period); D-14 (config) |
| **Implementation Impact** | Affects `FlagEngine.applyOverride()`, Stage Gate enforcement, audit trail persistence; requires `overrideReason`, `acknowledgedAt`, `acknowledgedBy` fields |
| **User Approval Status** | **PENDING** (confirm override workflow scope) |

---

### Decision D-05: Promoter Pledge Threshold (Critical Red-Flag)

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-05 |
| **Display Number** | 5 |
| **Source** | `RED_FLAG_ENGINE_SPEC.md` Critical Flags; `INVESTMENT_RULES_SPECIFICATION.md` Section 15 (Stage A Conditional Warning `STAGE_A_PROMOTER_PLEDGE_HIGH`) |
| **Exact Question** | "At what promoter pledge percentage should a Critical flag trigger?" |
| **Existing Spec Position** | `> 30%` (Red-Flag Spec Critical Flags table); Stage A Conditional Warning at `> 20%` |
| **Kilo Recommendation** | **Option A** — `> 30%` for Critical (SEBI disclosure threshold); `> 20%` for Conditional Warning (Stage A/B) |
| **Dependencies** | D-15 (data provider for pledge data); D-14 (config) |
| **Implementation Impact** | Requires `promoterPledgePct` field in `FinancialStatement`/`RedFlagInput` (DM-01); config key: `redflag.promoterPledgeThreshold` |
| **User Approval Status** | **PENDING** |

---

### Decision D-06: Related Party Transaction Threshold (Critical Red-Flag)

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-06 |
| **Display Number** | 6 |
| **Source** | `RED_FLAG_ENGINE_SPEC.md` Critical Flags |
| **Exact Question** | "What % of revenue from related party transactions triggers Critical flag?" |
| **Existing Spec Position** | `> 10%` of revenue (Red-Flag Spec) |
| **Kilo Recommendation** | **Option A** — Standard governance threshold for Indian listed companies |
| **Dependencies** | D-15 (data extraction from annual reports); D-14 (config) |
| **Implementation Impact** | Requires `relatedPartyTxn` field (DM-02); config key: `redflag.relatedPartyThreshold` |
| **User Approval Status** | **PENDING** |

---

### Decision D-07: Auditor Qualification Treatment

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-07 |
| **Display Number** | 7 |
| **Source** | `RED_FLAG_ENGINE_SPEC.md` Critical Flags |
| **Exact Question** | "Which auditor opinions trigger Critical flag?" |
| **Existing Spec Position** | Any non-"unqualified" = Critical (Red-Flag Spec) |
| **Kilo Recommendation** | **Option C** — Proportionate: "Qualified" = Major (`CONDITIONAL_WARNING`); "Adverse" / "Disclaimer" = Critical (`HARD_STOP`) |
| **Dependencies** | D-15 (auditor report parsing); D-14 (config) |
| **Implementation Impact** | Requires `auditorQualification` enum field: `unqualified` \| `qualified` \| `adverse` \| `disclaimer` (DM-03); config key: `redflag.auditorQualificationMapping` |
| **User Approval Status** | **PENDING** |

---

### Decision D-08: DCF Terminal Growth Cap & Asset-Based Discounts

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-08 |
| **Display Number** | 8 |
| **Source** | `VALUATION_ENGINE_SPEC.md` Section 6.2, 5.3; `INVESTMENT_RULES_SPECIFICATION.md` Section 14 Row 8 |
| **Exact Question** | "What cap on terminal growth rate, and what asset liquidation discounts?" |
| **Existing Spec Position** | Terminal growth capped at GDP growth (~6%); Asset discounts: Cash 100%, Receivables 80%, Inventory 50%, PPE 30%, Intangibles 0%, Other 20% |
| **Kilo Recommendation** | **Option C + D** — Terminal cap = Risk-free rate - 1% (conservative, ~6% given 10Y G-sec ~7%); discounts configurable (6 params) |
| **Dependencies** | D-14 (config externalization) |
| **Implementation Impact** | Affects `ValuationEngine.DCF()` and `AssetBased()`; config keys: `valuation.dcf.terminalGrowthCap`, `valuation.assetBased.discounts.*` |
| **User Approval Status** | **PENDING** |

---

### Decision D-09: Kelly Criterion Cap

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-09 |
| **Display Number** | 9 |
| **Source** | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` (Kelly in domain readiness); `INVESTMENT_RULES_SPECIFICATION.md` (not explicit) |
| **Exact Question** | "What maximum fraction of Kelly bet to allow?" |
| **Existing Spec Position** | 25% (referenced in domain readiness as typical industry practice) |
| **Kilo Recommendation** | **Option B** — Half-Kelly (50%): 75% of Kelly return with 50% volatility; industry standard for discretionary |
| **Dependencies** | D-14; Stage A–E backtest framework for `winRate`, `avgWin`, `avgLoss` provenance |
| **Implementation Impact** | Affects `PortfolioConstruction.kellySizing()`; config key: `portfolio.kellyCap`; **NOT in approved Stage F spec** (simple risk-budget only) |
| **User Approval Status** | **PENDING** |

---

### Decision D-10: Portfolio Volatility Target

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-10 |
| **Display Number** | 10 |
| **Source** | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` (vol targeting in domain readiness) |
| **Exact Question** | "What annualized portfolio volatility target?" |
| **Existing Spec Position** | 15% (referenced in domain readiness) |
| **Kilo Recommendation** | **Option A** — Reasonable for Indian equity long-only; matches typical institutional targets |
| **Dependencies** | D-14; D-11 (correlation lookback) |
| **Implementation Impact** | Affects `PortfolioConstruction.volatilityTargeting()`; config key: `portfolio.targetVolatility`; **NOT in approved Stage F spec** |
| **User Approval Status** | **PENDING** |

---

### Decision D-11: Correlation Lookback & Limits

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-11 |
| **Display Number** | 11 |
| **Source** | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` (domain readiness); `INVESTMENT_RULES_SPECIFICATION.md` (not explicit) |
| **Exact Question** | "What lookback period and correlation limits for portfolio construction?" |
| **Existing Spec Position** | 252 days lookback, pairwise ≤ 0.7, portfolio avg < 0.5 (domain readiness) |
| **Kilo Recommendation** | **Option D** — Configurable all three; start with current as defaults |
| **Dependencies** | D-14 |
| **Implementation Impact** | Affects `PortfolioConstruction.correlationMatrix()`; config keys: `portfolio.correlationLookback`, `maxPairwiseCorrelation`, `maxAvgCorrelation`; **NOT in approved Stage F spec** |
| **User Approval Status** | **PENDING** |

---

### Decision D-12: Red-Flag Grace Period for Data Errors — CRITICAL CONFLICT

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-12 |
| **Display Number** | 12 |
| **Source** | `RED_FLAG_ENGINE_SPEC.md` Section 4; `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3.2; `INVESTMENT_RULES_SPECIFICATION.md` Section 14 Row 12 |
| **Exact Question** | "How long to allow for data correction before Critical flag enforcement?" |
| **Existing Spec Position** | **CONFLICT:** Red-Flag Spec Section 4: "3-day grace for data errors"; Stage G Spec: "Critical flag → Immediate Exit" |
| **Kilo Recommendation** | **Option A (3 days)** — Aligns with Red-Flag Spec Section 4; practical for corporate action corrections (splits, bonuses, restatements) |
| **Dependencies** | D-04 (override policy); D-15 (data quality flags from provider) |
| **Implementation Impact** | **Must resolve before Phase 1B** — affects `RedFlagEngine.enforce()`, `StageG.exitTriggers.redFlagOverride`, requires `RedFlagOutput.gracePeriodExpiry` field; needs data error classification logic |
| **User Approval Status** | **PENDING — URGENT** |

---

### Decision D-13: Take-Profit Scaling Levels

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-13 |
| **Display Number** | 13 |
| **Source** | `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3.2; `INVESTMENT_RULES_SPECIFICATION.md` (not explicit) |
| **Exact Question** | "At what profit levels and what fractions to scale out?" |
| **Existing Spec Position** | +20%→30%, +40%→30%, +60%→40% (Stage G domain readiness) |
| **Kilo Recommendation** | **Option E** — Fully configurable; start with current as defaults |
| **Dependencies** | D-14 |
| **Implementation Impact** | Affects `StageGExitEngine.takeProfitScaling()`; config keys: `exit.takeProfitLevels.*`, `exit.takeProfitScales.*`; must sum to ≤ 100% |
| **User Approval Status** | **PENDING** |

---

### Decision D-14: Configuration Externalization Strategy

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-14 |
| **Display Number** | 14 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 13 (Determinism); all Stage specs have Configuration sections; Antigravity GAP-005, GAP-006 |
| **Exact Question** | "Should all hardcoded thresholds be externalized to configuration files?" |
| **Existing Spec Position** | 32+ hardcoded constants identified; all Stage specs show YAML config with "externalized" comment |
| **Kilo Recommendation** | **Option B** — Strategic (business decisions, user-tunable) → config (~15 params); Tactical (algorithm internals, stable) → code constants (~17 params) |
| **Strategic (Config) — ~15 params:** | Market cap, liquidity, history years, terminal growth cap, asset discounts, Kelly cap, vol target, correlation lookback/limits, solver tolerance, ATR params, max hold, fundamental drop, TP levels/scales, val reversion, RSI/MACD exhaustion, drift thresholds, red-flag thresholds |
| **Tactical (Code Constants):** | Candlestick ratios (0.1, 2.0), volume spike (1.5), gap (0.5%), S/R cluster (0.5%), Wilder smoothing periods (14, 26, 9, 20) |
| **Dependencies** | None (architectural decision) |
| **Implementation Impact** | Affects **ALL Stages A–G, Red-Flag, Valuation**; requires `ConfigService` with schema validation, hot-reload, versioning |
| **User Approval Status** | **PENDING** |

---

### Decision D-15: Data Provider & Universe Definition

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-15 |
| **Display Number** | 15 |
| **Source** | `INVESTMENT_RULES_SPECIFICATION.md` Section 13; `DOMAIN_MODEL_SPEC.md` (assumes `IDataProvider`); all Stage specs reference data fields |
| **Exact Question** | "Which data vendor(s) for fundamentals, prices, corporate actions, and red-flag fields?" |
| **Existing Spec Position** | Not specified — architecture assumes `IDataProvider` contract |
| **Kilo Recommendation** | **Option D (Hybrid MVP)** — NSE/BSE API (prices, corporate actions) + Screener.in scrape (fundamentals) + manual entry for red-flag fields (promoter pledge, RPT, auditor) — lowest cost, covers 90% needs |
| **Dependencies** | None — prerequisite for all |
| **Implementation Impact** | **Blocks production integrations and dependent engine execution** but **does NOT block** Phase 1A foundation work: provider-neutral interfaces (`IDataProvider`), manual/CSV ingestion, synthetic data fixtures, domain-model scaffolding, database schema. Blocks: real market-data execution, Stages B, C, D, F, G, Red-Flag fields (DM-01 to DM-10, F-02) |
| **User Approval Status** | **PENDING — URGENT** |

---

## Architecture Governance Decisions (D-A1 through D-A5)

*These 5 decisions were identified by Antigravity (`ARCHITECTURE_GAP_REGISTER.md`) as requiring user confirmation for architectural completeness. They are governance/policy decisions, not financial policy.*

### Decision D-A1: Stage A Boundary Inclusivity (Architecture Confirmation)

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-A1 |
| **Display Number** | A1 |
| **Source** | `ARCHITECTURE_GAP_REGISTER.md` GAP-006 |
| **Exact Question** | "Confirm D/E and Current Ratio boundary inclusivity for deterministic implementation" |
| **Related Financial Decisions** | D-01, D-02 |
| **Kilo Recommendation** | Adopt Option A per GAP-006: D/E `< 0.5000` = 1.0; `0.5000 ≤ D/E ≤ 1.2500` = 0.5; `> 1.2500` = 0.0 + HARD_STOP; CR `≥ 1.0000` = 0.5 pts; `< 1.0000` = HARD_STOP |
| **User Approval Status** | **PENDING** (same as D-01, D-02) |

---

### Decision D-A2: Stage B Pass Mark & Public Holding ≥50% Flag

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-A2 |
| **Display Number** | A2 |
| **Source** | `ARCHITECTURE_GAP_REGISTER.md` GAP-008 |
| **Exact Question** | "Confirm Stage B pass mark (≥6.5/10) and Public Holding ≥50% as configurable HARD_STOP" |
| **Related Financial Decisions** | D-03 (history), D-07 (auditor), D-05 (pledge) |
| **Kilo Recommendation** | Confirm `≥ 6.5/10` pass threshold; implement Public Holding `≥ 50%` as configurable `RuleSetConfig.stageB.publicHoldingThreshold` with default `HARD_STOP`; confirm Up/Down/Up pattern scores 0.0 + `CONDITIONAL_WARNING` |
| **User Approval Status** | **PENDING** |

---

### Decision D-A3: Stage C Moat Scoring Rubric Approval

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-A3 |
| **Display Number** | A3 |
| **Source** | `ARCHITECTURE_GAP_REGISTER.md` GAP-009 |
| **Exact Question** | "Confirm Stage C 5-point rubric: ≥3/5 pass, Test 1 (non-copyability) mandatory pass" |
| **Related Financial Decisions** | D-06 (related to moat evidence) |
| **Kilo Recommendation** | Confirm: 5 tests × 1 pt; pass = `≥ 3/5` AND Test 1 passes (`answer === 'no'`); all 3 business model questions require documented evidence |
| **User Approval Status** | **PENDING** |

---

### Decision D-A4: PEG Growth Rate Fallback Policy

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-A4 |
| **Display Number** | A4 |
| **Source** | `ARCHITECTURE_GAP_REGISTER.md` GAP-007 |
| **Exact Question** | "Confirm deterministic growth rate selection hierarchy for PEG when analyst consensus unavailable" |
| **Options** | 1) User-specified → 2) Analyst forward → 3) Historical 5Y CAGR (if >0) → 4) Mark PEG unsuitable |
| **Kilo Recommendation** | Option 1→2→3→4 hierarchy as stated; if historical CAGR ≤ 0, PEG `Applicability: 'unsuitable'`, emit `DATA_QUALITY_WARNING`, do not compute fair value |
| **User Approval Status** | **PENDING** |

---

### Decision D-A5: DATA_QUALITY_WARNING Pipeline Gating Behavior

| Attribute | Detail |
|-----------|--------|
| **Unique ID** | D-A5 |
| **Display Number** | A5 |
| **Source** | `ARCHITECTURE_GAP_REGISTER.md` GAP-010 |
| **Exact Question** | "Confirm missing non-critical data marks INCOMPLETE but permits progression after acknowledgment" |
| **Options** | A) Blocks completely (HARD_STOP) B) Marks INCOMPLETE, permits after acknowledgment (Red-Flag Spec Section 2.2) |
| **Kilo Recommendation** | Option B — aligns with Red-Flag Spec Section 2.2: critical missing data (latest FY sales/profit) = HARD_STOP; non-critical missing data (sector benchmark) = DATA_QUALITY_WARNING → INCOMPLETE, permits after acknowledgment via `POST /api/v1/flags/{id}/acknowledge` |
| **User Approval Status** | **PENDING** |

---

## Decision Dependency Graph (Critical Path)

```
D-15 (Data Provider) ──→ Domain Model Completion (DM-01 to DM-10, F-02)
        │
        ├─→ D-14 (Config) ──→ ConfigService ──→ All Engine Implementation
        │
        ├─→ D-12 (Grace Period) ──→ Stage G + Red-Flag Integration
        │
        ├─→ D-A4 (PEG Fallback) ──→ Stage D Valuation Engine
        │
        └─→ D-A5 (DQ Gating) ──→ All Stage Gates
```

**Phase 1A Foundation Prerequisites:** D-14 (Config strategy), D-15 (Provider-neutral interfaces only — NOT production provider)

**Phase 1B Engine Prerequisites:** D-01, D-02, D-03, D-12, D-A5 + Domain Model fields for Stages A & E

---

## Explicit Confirmation

**No decision in this register has been approved by the user.** All recommendations are engineering analysis only. The user must explicitly approve each decision before the associated implementation can proceed. Recommendations are marked "Kilo Recommendation" and do not constitute approved investment policy.

---

*End of Final Financial Decision Register*