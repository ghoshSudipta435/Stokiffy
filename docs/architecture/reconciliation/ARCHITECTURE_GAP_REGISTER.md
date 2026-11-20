# Architecture Gap Register

**Project:** Stokiffy — Personal Stock Market Assistant  
**Workstream:** Phase 0.5 — Architecture Validation & Implementation Readiness Audit  
**Owner:** Principal Software Architect & Architecture Auditor  
**Date:** 15 November 2026  
**Status:** Complete  

---

## 1. Overview & Methodology

This register documents all identified gaps, ambiguities, discrepancies, and policy conflicts between the approved architecture specifications (`docs/architecture/`) and the newly supplied investment engine strategy specifications (`docs/strategy/`).

Each issue is assigned a unique tracking identifier, categorized by severity, analyzed for architectural and business impact, and assigned a recommended resolution along with whether explicit user approval is required.

### Severity Definition
- **Critical:** Contradiction or missing component that would block correct software implementation, break system determinism, or cause architectural rework if not resolved before Phase 1.
- **High:** Significant functional or contract gap that must be resolved prior to implementing the affected stage/package.
- **Medium:** Ambiguity, boundary condition, or design refinement that should be clarified for consistent development standards.
- **Low:** Minor standardization, cosmetic naming, or procedural prerequisite.

---

## 2. Gap & Contradiction Register

### GAP-001: Missing Stage E (Technical Analysis) API Endpoints in Gateway Contract
- **Source Documents:** 
  - `API_ARCHITECTURE.md` Section 4 (`Comprehensive RESTful Endpoint Catalog`)
  - `TECHNICAL_ANALYSIS_SPEC.md` Section 1–4
  - `DOMAIN_MODEL_SPEC.md` Section 4.5 (`StageEInput`, `StageEOutput`)
- **Description:** 
  `API_ARCHITECTURE.md` defines `/api/v1/companies/{id}/prices` for raw OHLCV bars, but completely omits an API route for running or retrieving Stage E technical pattern detection and confluence evaluation (e.g. `POST /api/v1/analyses/stage-e` or `GET /api/v1/companies/{id}/technical-setups`). The web frontend (Trade Planner Screen 5) and future mobile clients require a dedicated endpoint to verify pattern confirmation, moving average support, ATR risk, and price proximity to the Stage D Max Buy Price.
- **Why It Matters:** 
  Without this endpoint, client applications would either have to calculate technical patterns on the client (a critical violation of our architecture tenets) or be unable to display the Stage E confluence setup before generating a Stage F trade plan.
- **Severity:** High
- **Recommended Resolution:** 
  Add `POST /api/v1/analyses/stage-e` and `GET /api/v1/companies/{id}/technical-setups` to the `packages/contracts` schema catalog and `apps/web/app/api/v1/analyses/stage-e/route.ts`. The endpoint will consume `StageEInput` and return `StageEOutput`.
- **User Approval Required:** No (Technical architectural completeness).

---

### GAP-002: Incomplete Red Flag Lifecycle Endpoints (Acknowledgment vs Override)
- **Source Documents:** 
  - `API_ARCHITECTURE.md` Section 4.4 (`Analysis & Gatekeeping: Stages A & B`)
  - `RED_FLAG_ENGINE_SPEC.md` Section 2.1, 2.2, 3
  - `DOMAIN_MODEL_SPEC.md` Section 5 (`FlagEngine` interface)
- **Description:** 
  `RED_FLAG_ENGINE_SPEC.md` defines an explicit 5-state lifecycle for flags (`CREATED` -> `ACTIVE` -> `ACKNOWLEDGED` / `OVERRIDDEN` -> `RESOLVED` / `EXPIRED`). It establishes two distinct user actions:
  1. *Acknowledgment:* Used for `CONDITIONAL_WARNING` and `DATA_QUALITY_WARNING` (user notes context; flag stays visible; progression unblocked).
  2. *Override:* Used exclusively for `HARD_STOP` and `VALUATION_WARNING` (user records an audited exception with before/after state).
  However, `API_ARCHITECTURE.md` only specifies `POST /api/v1/analyses/{id}/override`. There is no dedicated endpoint for acknowledging warnings, nor is there an endpoint to inspect cross-stage flag history.
- **Why It Matters:** 
  Developers would be forced to either misuse the override endpoint for simple acknowledgments or fail to implement the required audit trails specified in `RED_FLAG_ENGINE_SPEC.md`.
- **Severity:** High
- **Recommended Resolution:** 
  Introduce two dedicated endpoints in `@stock-assistant/contracts` and `/api/v1`:
  - `POST /api/v1/flags/{id}/acknowledge` (Request: `{ userId, reason }`)
  - `POST /api/v1/flags/{id}/override` (Request: `{ userId, reason, decision: 'override' }`)
  - `GET /api/v1/flags?companyId={id}&status=ACTIVE`
- **User Approval Required:** No (API contract gap).

---

### GAP-003: Missing Trade Journal & Post-Trade Review Endpoints
- **Source Documents:** 
  - `API_ARCHITECTURE.md` Section 4.8 (`Portfolio & Execution Ledger`)
  - `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3.3
  - `DOMAIN_MODEL_SPEC.md` Section 4.7 (`JournalEntry`, `PostTradeReview`, `CorporateAction`)
  - `FRONTEND_ARCHITECTURE.md` Section 3 (Screen 8: Trade Journal)
- **Description:** 
  `FRONTEND_ARCHITECTURE.md` details Screen 8 as a dedicated Trade Journal for post-trade audits, emotional bias tracking, and rule failure attribution. `PORTFOLIO_RISK_AND_EXIT_SPEC.md` specifies `JournalEntry` and `PostTradeReview` models. In contrast, `API_ARCHITECTURE.md` only defines `/api/v1/portfolio/transactions`, which only captures raw monetary buys/sells.
- **Why It Matters:** 
  Stage G requires capturing *why* a trade succeeded or failed (e.g. execution quality, rules followed, behavioural errors). Without dedicated journal API endpoints, the web frontend cannot persist post-trade reviews.
- **Severity:** High
- **Recommended Resolution:** 
  Add dedicated journal endpoints to `API_ARCHITECTURE.md`:
  - `GET /api/v1/journal` (List closed trade journal entries)
  - `GET /api/v1/journal/{id}` (Retrieve entry with snapshot and reviews)
  - `POST /api/v1/journal/{id}/review` (Submit `PostTradeReview`)
  - `POST /api/v1/journal/{id}/corporate-actions` (Record dividends/splits)
- **User Approval Required:** No (API contract completeness).

---

### GAP-004: Core Red Flag Engine Package Structure Misplacement
- **Source Documents:** 
  - `FOLDER_STRUCTURE.md` Section 2.2 (`packages/core/`)
  - `DOMAIN_MODEL_SPEC.md` Section 6 (`Calculation Boundaries`)
  - `RED_FLAG_ENGINE_SPEC.md` Section 1, 2
- **Description:** 
  `FOLDER_STRUCTURE.md` placed `red-flags.ts` inside `packages/core/src/stage-a/red-flags.ts`. However, `RED_FLAG_ENGINE_SPEC.md` establishes that red flags span all stages (Stage A through Stage G). `DOMAIN_MODEL_SPEC.md` Section 6 explicitly allocates `packages/core/src/flags/` as a top-level domain module.
- **Why It Matters:** 
  Coupling red flags to Stage A violates domain separation, making it awkward or circular for Stage B, D, E, F, and G to evaluate and instantiate flags.
- **Severity:** Medium
- **Recommended Resolution:** 
  Establish `packages/core/src/flags/` as a top-level module containing:
  - `engine.ts` (Flag lifecycle, evaluation, gate logic)
  - `types.ts` (`RedFlag`, `FlagAcknowledgment`, `FlagOverride`)
  - `evaluators/` (Stage-specific flag evaluators)
- **User Approval Required:** No (Code organization alignment).

---

### GAP-005: Arbitrary Precision Library Redundancy (`Decimal.js` vs `big.js`)
- **Source Documents:** 
  - `ARCHITECTURAL_DECISIONS.md` (ADR-005: Arbitrary-Precision Financial Math)
  - `DEVELOPMENT_STANDARDS.md` Section 4
  - `DOMAIN_MODEL_SPEC.md` Section 9 (`Decimal Precision Rules`)
- **Description:** 
  ADR-005 mandates `Decimal.js` across the entire monorepo. `DOMAIN_MODEL_SPEC.md` Section 9 introduces `big.js` specifically for share quantity flooring while prescribing `decimal.js` for ratios, currency, percentages, and CAGR.
- **Why It Matters:** 
  Including both `decimal.js` and `big.js` in `packages/core` introduces unnecessary dependency duplication, bundle overhead, and cognitive friction for developers deciding which library to import. `Decimal.js` natively supports integer floor operations (`new Decimal(val).floor().toNumber()`).
- **Severity:** Low
- **Recommended Resolution:** 
  Standardize exclusively on `Decimal.js` across all workspace packages (`packages/core`, `packages/contracts`, `apps/web`). Document that integer share quantities use `decimal.floor().toNumber()`.
- **User Approval Required:** No (Engineering library rationalization).

---

### GAP-006: Stage A Ratio Boundary Inclusivity Ambiguity (D/E and Current Ratio)
- **Source Documents:** 
  - `STAGE_A_SCORING_SPEC.md` Section 2 (Rule 6, Rule 7)
  - `SYSTEM_ARCHITECTURE.md` Section 5.1
  - `INVESTMENT_RULES_SPECIFICATION.md` Section 6.1
- **Description:** 
  `STAGE_A_SCORING_SPEC.md` Rule 6 explicitly states: *"Boundary Decision Required: Are boundaries inclusive? Option A: <0.5 / 0.5–1.25 / >1.25 (recommended). Option B: ≤0.5 / 0.5<x≤1.25 / >1.25"*. Similarly, for Current Ratio, it notes that exactly 1.0 scores 0.5 (falling in the 1.0–2.0 band), while the hard flag is strictly `< 1.0`.
- **Why It Matters:** 
  Boundary conditions determine point allocation and hard red-flag triggering for border cases. If boundary inclusivity is not mathematically locked, test cases and scoring outputs will be non-deterministic.
- **Severity:** Medium
- **Recommended Resolution:** 
  Adopt Option A as the standard:
  - **D/E:**
    - `< 0.5000`: 1.0 point
    - `0.5000 <= D/E <= 1.2500`: 0.5 points
    - `> 1.2500`: 0.0 points + `STAGE_A_DEBT_EQUITY_HIGH` (HARD_STOP)
  - **Current Ratio:**
    - `> 2.0000`: 1.0 point
    - `1.0000 <= CR <= 2.0000`: 0.5 points
    - `< 1.0000`: 0.0 points + `STAGE_A_CURRENT_RATIO_LOW` (HARD_STOP)
  - **Interest Coverage:**
    - `> 10.0000`: 1.0 point
    - `5.0000 <= IC <= 10.0000`: 0.5 points
    - `3.0000 <= IC < 5.0000`: 0.25 points
    - `< 3.0000`: 0.0 points + `STAGE_A_INT_COVERAGE_LOW` (HARD_STOP)
- **User Approval Required:** Yes (Financial policy boundary confirmation).

---

### GAP-007: PEG Growth Rate Source & Fallback Policy
- **Source Documents:** 
  - `VALUATION_ENGINE_SPEC.md` Section 4.3 (`Growth Rate Selection`)
  - `INVESTMENT_RULES_SPECIFICATION.md` Section 9.2
- **Description:** 
  `VALUATION_ENGINE_SPEC.md` Section 4.3 identifies growth rate selection as an open decision: Historical 5Y CAGR vs Analyst Consensus Forward Growth vs User-Specified. In Phase 1, external analyst consensus APIs will not be connected (CSV/manual mode).
- **Why It Matters:** 
  If PEG requires forward estimates that are unavailable, PEG valuation will either fail or default to undefined. A deterministic fallback order must be defined.
- **Severity:** High
- **Recommended Resolution:** 
  Define a deterministic hierarchy in `packages/core/src/stage-d/models/peg-valuation.ts`:
  1. If `userSpecifiedGrowth` is provided -> use it (labeled "User Assumption").
  2. Else if `analystForwardGrowth` is available -> use it (labeled "Analyst Consensus").
  3. Else if `historical5yCagr` is positive -> use it (labeled "Historical 5Y CAGR").
  4. If historical CAGR is negative or zero -> mark PEG as `Applicability: 'unsuitable'`, emit `DATA_QUALITY_WARNING`, and do not compute PEG fair value.
- **User Approval Required:** Yes (Valuation policy decision).

---

### GAP-008: Stage B Pass Threshold & Heuristic Red-Flag Approvals
- **Source Documents:** 
  - `INVESTMENT_RULES_SPECIFICATION.md` Section 7.2, 7.4
  - `STAGE_B_SCORING_SPEC.md` Section 1, 2
  - `SYSTEM_ARCHITECTURE.md` Section 1
- **Description:** 
  The strategy specifications explicitly highlight that:
  1. The Stage B pass threshold of `>= 6.5/10` is an engineering default from the blueprint, not an explicit rule in the handwritten notes.
  2. The rule that Public shareholding `>= 50%` triggers a `HARD_STOP` is a handwritten heuristic that should be confirmed as configurable rather than a permanent universal governance rule.
  3. The shareholding pattern of Promoter: Up, FII/DII: Down, Public: Up is scored as 0.0 in the notes with "incomplete/unclear rule — review required".
- **Why It Matters:** 
  These thresholds directly dictate whether a stock qualifies for Stage C (Moat Analysis). Hard-coding them without user sign-off risks enforcing rules the investor did not intend.
- **Severity:** High
- **Recommended Resolution:** 
  1. Confirm the `>= 6.5/10` Stage B pass threshold.
  2. Implement Public Shareholding `>= 50%` as a configurable rule setting (`STAGE_B_PUBLIC_HOLDING_GE_50`) with default severity `HARD_STOP`, editable in `RuleSetConfig`.
  3. Confirm that Promoter Up / FII-DII Down / Public Up scores 0.0 and raises `CONDITIONAL_WARNING: STAGE_B_SHAREHOLDING_INCOMPLETE`.
- **User Approval Required:** Yes (Investment strategy governance).

---

### GAP-009: Stage C Moat Scoring Framework Approval
- **Source Documents:** 
  - `INVESTMENT_RULES_SPECIFICATION.md` Section 2, 8
  - `BUSINESS_MODEL_AND_MOAT_SPEC.md` Section 4
  - `SYSTEM_ARCHITECTURE.md` Section 1
- **Description:** 
  The handwritten notes contain no numerical scoring for Stage C. The strategy blueprint introduces a 5-point rubric (1 point per moat test) where passing requires:
  - Total moat score `>= 3/5`
  - Test 1 (Non-copyability) must pass (`answer === 'no'`)
  - All 3 business model questions answered with documented evidence
- **Why It Matters:** 
  Stage C acts as the qualitative gate before Stage D (Valuation). A purely quantitative rule synthesized by engineering must have formal investor sign-off.
- **Severity:** High
- **Recommended Resolution:** 
  Present the Stage C rubric to the user for formal approval as the v1 baseline. Store the pass mark (`minMoatScore: 3`) and mandatory test requirement (`requireNonCopyability: true`) in `RuleSetConfig.stageC`.
- **User Approval Required:** Yes (Qualitative gate policy approval).

---

### GAP-010: Data Quality Warnings Pipeline Gating Behavior
- **Source Documents:** 
  - `RED_FLAG_ENGINE_SPEC.md` Section 2.1
  - `DOMAIN_MODEL_SPEC.md` Section 3.1
  - `STAGE_A_SCORING_SPEC.md` Section 6.3
- **Description:** 
  `RED_FLAG_ENGINE_SPEC.md` Section 2.1 indicates in its table that `DATA_QUALITY_WARNING` blocks progression (`YES — marks result incomplete`). However, Section 2.2 states that a user can acknowledge data limitations (e.g., missing sector ROA benchmark) to allow research to proceed provisionally.
- **Why It Matters:** 
  If missing non-critical metrics completely block pipeline progression, the user will be unable to analyze companies in sectors where certain benchmarks are not published.
- **Severity:** Medium
- **Recommended Resolution:** 
  Adopt the following standard:
  - Critical missing data (e.g. missing latest FY sales or profit) triggers `HARD_STOP` (blocks progression completely).
  - Non-critical missing data (e.g. missing industry ROA or historical 5Y benchmark) triggers `DATA_QUALITY_WARNING`.
  - A `DATA_QUALITY_WARNING` marks the analysis verdict as `INCOMPLETE / PROVISIONAL`, but progression to Stage B is permitted once the user acknowledges the limitation via `POST /api/v1/flags/{id}/acknowledge`.
- **User Approval Required:** Yes (Workflow policy confirmation).

---

### GAP-011: Database Persistence Schema for Immutable Snapshots
- **Source Documents:** 
  - `SYSTEM_ARCHITECTURE.md` Section 13 (`PostgreSQL data model`)
  - `DOMAIN_MODEL_SPEC.md` Section 8 (`Data Snapshot & Reproducibility`)
  - `FOLDER_STRUCTURE.md` Section 2.4 (`packages/db`)
- **Description:** 
  `DOMAIN_MODEL_SPEC.md` Section 8 introduces explicit `AnalysisSnapshot` (serialized input, output, ruleSetVersion, configHash) and `DataSnapshot` (raw financials, marketData, provenance map). The high-level schema map in `SYSTEM_ARCHITECTURE.md` outlines `analysis_runs` and `financial_periods`, but does not specify the exact JSONB schema and foreign key linkage to guarantee bitwise reproducibility.
- **Why It Matters:** 
  Prisma schema design in Phase 1 must accommodate immutable point-in-time snapshots to ensure historical runs are never overwritten when restatements occur.
- **Severity:** Medium
- **Recommended Resolution:** 
  Incorporate `DataSnapshot` and `AnalysisSnapshot` entities directly into `packages/db/prisma/schema.prisma` in Phase 1, using PostgreSQL `JSONB` columns for input/output payloads and unique compound indexes on `[companyId, ruleSetVersion, createdAt]`.
- **User Approval Required:** No (Database architecture implementation detail).

---

### GAP-012: Golden Fixture Source Input Data Transcription
- **Source Documents:** 
  - `DEVELOPMENT_STANDARDS.md` Section 8 (`Testing Standards`)
  - `RULE_VALIDATION_TEST_CASES.md` Section 1, 12
  - `Stock selection.pdf` (Handwritten notes)
- **Description:** 
  The handwritten notes cite TCS and HUL as scoring 8.5/10 in Stage A. Both architecture and strategy documents state that golden test fixtures must only be created if exact source input figures are transcribed.
- **Why It Matters:** 
  Fabricating numbers to hit 8.5/10 would compromise the integrity of our test suite.
- **Severity:** Low
- **Recommended Resolution:** 
  In Phase 1, build synthetic threshold boundary tests first (`sales-growth.test.ts`, `roe.test.ts`, etc.). Add TCS and HUL golden fixture tests only after transcribing the exact point-in-time financial inputs from the handwritten notes or historic filings into `packages/core/test/golden-fixtures/`.
- **User Approval Required:** No (Testing quality guideline).

---

## 3. Summary of Gap Severity Distribution

| Severity | Count | Issue IDs |
| :--- | :---: | :--- |
| **Critical** | 0 | None (Core architectural tenets are fully compatible) |
| **High** | 5 | GAP-001, GAP-002, GAP-003, GAP-007, GAP-008, GAP-009 |
| **Medium** | 4 | GAP-004, GAP-006, GAP-010, GAP-011 |
| **Low** | 2 | GAP-005, GAP-012 |
| **Total** | **11** | All cataloged with actionable resolutions |
