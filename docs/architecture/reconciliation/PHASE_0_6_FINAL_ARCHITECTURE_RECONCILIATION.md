# Phase 0.6: Final Architecture Reconciliation

**Project:** Stokiffy — Personal Stock Market Assistant  
**Workstream:** Phase 0.6 — Final Architecture & Cross-Audit Reconciliation  
**Role:** Principal Software Architect, Senior Full-Stack Engineer & Independent Architecture Auditor  
**Date:** 15 November 2026  
**Status:** Accepted with Open Decisions — Baseline Acceptance Audit Complete  

---

## 1. Executive Summary & Authoritative Verdict

### 1.1 Context & Purpose
Following independent audits conducted by Antigravity (Architecture Audit) and Kilo Code (Investment Rules Audit), this document reconciles all cross-audit findings between the 7 technical architecture specifications (`docs/architecture/`) and the 10 investment strategy specifications (`docs/strategy/`).

This reconciliation enforces strict boundaries between:
1. **Foundation Scaffolding:** Monorepo workspace tooling, shared configs, baseline schemas, and CI test harness.
2. **Domain Interfaces:** Pure TypeScript type definitions, mathematical utility wrappers, and contract boundaries without encoded policy.
3. **Actual Engine Implementation:** Execution logic for financial scoring, valuation algorithms, and candlestick pattern detection.
4. **Production Enforcement:** Pipeline gating, automated flag override audits, and alert triggers.

---

### 1.2 Precise Status & Authorization Terminology

To prevent ambiguity between technical viability, governance approvals, and user commands, this audit adheres to the following strict classification taxonomy:

| Classification | Definition |
| :--- | :--- |
| **Architecturally Eligible** | Architecture design and package boundaries support the proposed scope without refactoring. |
| **Technically Ready** | Required technical specifications, interfaces, and data models are sufficiently formulated. |
| **Policy Approved** | User has explicitly approved applicable financial thresholds, boundary conditions, or governance rules. |
| **User Authorized** | User has explicitly instructed implementation work to begin. |
| **Implemented** | Source code, configuration files, or database migrations have actually been created. |
| **Verified** | Required test suites, property checks, or bitwise verification scripts have executed successfully. |

---

### 1.3 Authoritative Project Verdict

> [!IMPORTANT]
> **AUTHORITATIVE ACCEPTANCE AUDIT VERDICT: ACCEPTED WITH OPEN DECISIONS**
> 
> - **Phase 1A (Foundation Scaffolding & Shared Contracts):** **ARCHITECTURALLY ELIGIBLE FOR CONSIDERATION & TECHNICALLY READY (10 Subsystems)**.  
>   Monorepo tooling, strict TypeScript/ESLint configs, policy-neutral Zod contracts, domain model interfaces, `Decimal.js` math wrappers, Prisma database baseline schema, snapshot persistence models, and CI test harness are structurally sound and ready for implementation whenever the user authorizes it.
> - **Website-First Scope Enforcement:** The platform implements a responsive website first. Mobile-specific implementations (Flutter/React Native, mobile auth, mobile UI) are strictly deferred to Phase 8. Client-agnostic OpenAPI 3.1 DTOs are generated in `packages/contracts` (Subsystem #2) to serve the website now while guaranteeing future API compatibility.
> - **Phase 1B (Stage A Calculation Engine):** **STRICTLY BLOCKED & GATED UPON FORMAL USER AUTHORIZATION OF `[DEC-16 / A1]` (1 Subsystem)**.  
>   Implementation of Stage A scoring formulas and boundary checks is strictly conditional upon formal user resolution of boundary inclusivity (`[DEC-16 / A1]`).
> - **Current Implementation Status:** **NOT STARTED** (Zero lines of application code, zero packages created, zero database migrations executed).
> - **Current User Authorization Status:** **NOT GRANTED** (This document establishes architectural readiness only; it does NOT authorize implementation).
> - **Financial Decisions Status:** **ALL 20 DECISIONS REMAIN `PENDING USER DECISION`** (Zero policy approvals exist; all recommendations are unapproved technical proposals).
> - **Subsequent Calculation Engines & Mobile App:** **ORDERLY DEFERRED (7 Subsystems)** (Stages B–G calculation engines belong to Phases 3–5; native mobile applications belong to Phase 8).

---

## 2. Multi-Dimensional Readiness Framework

Readiness is evaluated across seven distinct operational dimensions to prevent conflating architectural viability with financial policy sign-offs or third-party data availability:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SEVEN-DIMENSION READINESS MODEL                         │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ Dimension                    │ Definition                   │ Current Status│
├──────────────────────────────┼──────────────────────────────┼───────────────┤
│ 1. Architecture Readiness    │ Topology, monorepo, packages,│ READY         │
│                              │ boundaries, layer isolation  │               │
│ 2. Domain-Model Readiness    │ Pure TS interfaces, types,   │ READY W/ COND │
│                              │ entity ownership boundaries  │ (Ownership)   │
│ 3. Financial-Rule Readiness  │ Mathematical formulas, gate  │ PENDING USER  │
│                              │ thresholds, boundary rules   │ (20 Decisions)│
│ 4. Data-Provider Readiness   │ CSV parsers, statement maps, │ READY for CSV │
│                              │ external market API feeds    │ (Phase 1 MVP) │
│ 5. API Gateway Readiness     │ Route Handlers, DTO schemas, │ READY W/ COND │
│                              │ response envelopes, semantics│ (6 Semantics) │
│ 6. Test-Suite Readiness      │ Harness, documented cases,   │ SPECIFIED BUT │
│                              │ implemented tests, execution │ UNEXECUTED    │
│ 7. Implementation Readiness  │ Phased eligibility:          │               │
│                              │   - Phase 1A (Foundation)    │ ELIGIBLE (10) │
│                              │   - Phase 1B (Stage A Engine)│ GATED (1)     │
│                              │   - Deferred Stages & Mobile │ DEFERRED (7)  │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

---

## 3. Cross-Agent Reconciliation & Inconsistency Resolutions

### 3.1 Technical Proposal for Red-Flag Taxonomy Reconciliation
- **The Cross-Audit Discrepancy:**
  - Antigravity identified a 4-class taxonomy based on pipeline gating role: `HARD_STOP`, `CONDITIONAL_WARNING`, `DATA_QUALITY_WARNING`, `VALUATION_WARNING`.
  - Kilo Code reported a 4-class taxonomy based on severity: `Critical`, `Major`, `Minor`, `Info`.
- **Authoritative Investigation:**
  Cross-examination of `RED_FLAG_ENGINE_SPEC.md` Section 2.1 & 3 and `DOMAIN_MODEL_SPEC.md` Section 3.1 reveals that gating behavior, display severity, and user actions must not be conflated into a single flat enum.
- **Proposed Technical Architecture Model (Unapproved Technical Proposal):**
  The architecture proposes separating red flags into **six distinct operational facets**:
  1. **Flag Category / Gating Class (`class: FlagClass`):** Determines pipeline progression gating:
     - `HARD_STOP`: Halts pipeline progression to subsequent stages.
     - `CONDITIONAL_WARNING`: Pauses progression pending explicit documented user review.
     - `DATA_QUALITY_WARNING`: Flags missing, stale, or restated data; marks result provisional.
     - `VALUATION_WARNING`: Blocks `BUY-READY` status but permits research to continue.
  2. **Severity (`severity: FlagSeverity`):** Determines visual hierarchy, UI alert banners, and notification urgency (`critical`, `high`, `medium`, `low`).
  3. **Enforcement Action:** The automated action executed by the engine (`HALT_STAGE`, `PAUSE_FOR_EXPLANATION`, `MARK_PROVISIONAL`, `BLOCK_BUY_READY`).
  4. **Lifecycle Status (`status: FlagStatus`):** State of the flag record (`CREATED` -> `ACTIVE` -> `ACKNOWLEDGED` / `OVERRIDDEN` -> `RESOLVED` / `EXPIRED`).
  5. **User Acknowledgment:** Used for non-critical warnings (`CONDITIONAL_WARNING`, `DATA_QUALITY_WARNING`). Captures `userId`, `acknowledgedAt`, and `reason` to permit conditional progression without erasing the flag.
  6. **Override Authorization:** Restricted exception workflow for `HARD_STOP` and `VALUATION_WARNING`. Captures compulsory justification, before/after audit states, and emits immutable `AuditEvent` records.

> [!CAUTION]
> **Status of Proposal:** This multi-faceted model is an **unapproved technical architecture proposal**. Exact mappings between severity levels and gating classes, as well as hard-stop override eligibility, remain **`PENDING USER DECISION` (`[DEC-04]` and `[DEC-20 / A5]`)**. Phase 1A will define only neutral type interfaces in `packages/core/src/flags/types.ts`; full evaluators and production enforcement are deferred to later phases.

---

### 3.2 Reconciliation of Stage C Moat Framework Inconsistency
- **The Cross-Audit Discrepancy:**
  - Antigravity referenced **Five Moat Tests** scored 0–5 (passing at `>= 3/5` with Test 1 mandatory).
  - Kilo Code asserted there are **Six Moat Tests** scored 0–3 each (total 0–18, passing at `>= 12`).
- **Authoritative Investigation:**
  - Authoritative source `BUSINESS_MODEL_AND_MOAT_SPEC.md` Section 4 is explicitly titled: `## 4. Five Moat Tests (Proposed Scoring)`.
  - It lists exactly **Five Moat Tests**:
    1. *Test 1:* Can competitors easily copy the business? (Pass = "No", 1 pt)
    2. *Test 2:* Can the advantage last 10+ years? (Pass = "Yes", 1 pt)
    3. *Test 3:* Has ROE been high & consistent for 10+ years? (Pass = "Yes", 1 pt)
    4. *Test 4:* Can the company raise prices without losing customers? (Pass = "Yes", 1 pt)
    5. *Test 5:* Is market share stable or growing over 5+ years? (Pass = "Yes", 1 pt)
  - Section 4.2: Each test awards **1 point** if passed. Overall pass requires `>= 3/5 points` **AND** Test 1 must pass. Total possible score: **5 points**.
  - The user's handwritten notes (`Stock selection.pdf`) and strategy blueprint (`Personal_Stock_Assistant_Updated_Strategy_Blueprint.docx` Section 6, lines 280–293) confirm exactly these 5 questions.
  - *Origin of Kilo Code's 6 tests:* Kilo Code imported Morningstar's external economic moat classification (Switching Costs, Network Effects, Intangible Assets, Cost Advantage, Efficient Scale, Data) and an unapproved 0–18 scoring system. (Kilo Code subsequently acknowledged and corrected this in `FINAL_FORMULA_AND_TEST_READINESS_MATRIX.md`).
- **Authoritative Resolution:**
  - The canonical specification is confirmed as **Five Moat Tests**, scored 0 to 5.
  - Kilo Code's 6-test / 18-point rubric is rejected as an external hallucination.
  - The `>= 3/5` threshold remains an **unapproved proposed baseline pending user approval (`[DEC-18 / A3]`)**.

---

### 3.3 Precision Library Standardization
- **Resolution:** Standardize exclusively on `Decimal.js` across the entire monorepo (`packages/core`, `packages/contracts`, `apps/web`). `Decimal.js` natively supports arbitrary precision integer floor operations (`new Decimal(quantity).floor().toNumber()`). Introducing `big.js` adds duplicate dependency bloat.

---

### 3.4 Core Module Organization
- **Resolution:** Elevate red flags to top-level module `packages/core/src/flags/` containing type definitions and lifecycle interfaces in Phase 1A. Full cross-stage evaluators are deferred to Phase 2 and beyond.

---

### 3.5 API Gateway Exposure & Unresolved Semantics
While new route contracts were added (`analyses/stage-e`, `flags/acknowledge`, `flags/override`, `journal`), **API readiness is conditional upon formalizing the following 6 unresolved operational semantics**:
1. **Hard-Stop Override Authorization:** Policy rules defining who can override a hard stop (self-audit in personal mode vs multi-user role constraints) and the required before/after state payload structure.
2. **Warning Acknowledgment Lifecycle:** Semantics governing whether acknowledging a warning applies to a single quarterly filing or all future filings for that company.
3. **Re-Triggering and Reactivation:** Rules defining whether a previously resolved or acknowledged flag automatically reactivates if subsequent quarterly data deteriorates.
4. **Historical Flag Filtering and Cursor Pagination:** Concrete query parameter contracts (`cursor`, `limit`, `stage`, `status`, `severity`, `companyId`) for high-volume flag queries.
5. **Journal Review Mutability:** Determining whether post-trade post-mortem reviews (`PostTradeReview`) are permanently immutable to prevent hindsight revisionism or permit draft edits before final publishing.
6. **Analysis Request Idempotency:** Defining semantic cache behavior when `POST /api/v1/analyses/stage-a` is called repeatedly with the same company and snapshot ID (cached response vs forced recalculation).

---

### 3.6 Data Provider Dependency Timing
- **Resolution:** Kilo Code's classification of the Red-Flag Engine as "BLOCKED" due to missing governance fields in basic CSVs was conflated with Phase 1. In accordance with the phased roadmap (`SYSTEM_ARCHITECTURE.md` Section 19), Phase 1 establishes technical foundations, and Phase 2 utilizes CSV uploads where missing governance fields default to `null` with non-blocking `DATA_QUALITY_WARNING` tags. External data scraping belongs to Phase 7.

---

### 3.7 Stage E Technical Analysis Multi-Faceted Readiness
In accordance with independent acceptance audit requirements, Stage E readiness is evaluated across all technical and data dimensions:
- **Algorithm Specification Completeness:** **COMPLETE**. Technical indicators (RSI, MACD, Bollinger Bands, ATR), 6 Bullish Candlestick patterns, 3 Bearish Candlestick patterns, and Buy-Zone Confluence scoring are mathematically specified in `TECHNICAL_ANALYSIS_SPEC.md`.
- **Numerical & Mathematical Correctness:** **SPECIFIED VIA DECIMAL.JS**. Floating-point drift in Wilder smoothing (RSI, ATR) is resolved via `Decimal.js` rational recurrence in ADR-005. Division-by-zero edge cases (zero loss $\rightarrow$ RSI=100; flat price standard deviation = 0) are handled.
- **Market Data Availability:** **DEFERRED**. Execution requires daily and weekly OHLCV candlestick series, which are not provided by basic financial statement CSVs.
- **Corporate-Action-Adjusted OHLCV Dependency:** **CRITICAL PREREQUISITE**. Historical stock splits, bonus issues, and major capital restructurings produce artificial price jumps in raw data. Unadjusted data creates false candlestick patterns and erroneous moving-average breaches. The specification explicitly mandates `adjusted: boolean` in `OhlcvBar`. Split-adjusted historical price data is deferred to Phase 4 adjusted price ingestion or Phase 7 feeds.
- **Edge-Case Test Coverage:** **GAPS IDENTIFIED**. 12 unit test scenarios exist in `RULE_VALIDATION_TEST_CASES.md`; 10 edge cases were identified as missing by Kilo Code (holiday trading gaps, weekend gaps, <14 candles, flat candle ranges).
- **User Policy Dependencies:** Minimum liquidity turnover is governed by `[DEC-02]` (₹1 Cr/day institutional turnover). Indicator periods (14-day RSI, 20-day BB) are technical defaults.
- **Precise Readiness Classification:** **`SPECIFIED (ALGORITHM & MATH); DEFERRED TO PHASE 4 PENDING ADJUSTED OHLCV DATA & HARNESS`**.

---

## 4. Technical Control Integrity & Guarantee Classification

Platform capabilities previously described as "guaranteed" are formally categorized below:

| Technical Control / Capability | Status Classification | Proposed Implementation Mechanism | Evidence Required to Upgrade to "Verified Implementation" |
| :--- | :---: | :--- | :--- |
| **1. Bitwise-Identical Historical Reruns** | **Architecture Requirement (Unverified Control)** | Pure in-memory deterministic TypeScript functions consuming serialized `AnalysisSnapshot.input` and SHA256 config hashes via `Decimal.js`. | Automated integration test executing an identical analysis snapshot across independent node processes and asserting `output1 === output2` bitwise. |
| **2. Immutable Snapshot Database Triggers** | **Proposed Mechanism (Unverified Control)** | PostgreSQL database triggers raising exceptions on `UPDATE` or `DELETE` statements on `analysis_snapshots` and `data_snapshots` tables. | Migration script defining SQL trigger and a test case attempting an update asserting SQL error `23505` / trigger rejection. |
| **3. Complete Tenant Isolation** | **Architecture Requirement (Unverified Control)** | Repository-level `WHERE userId = session.userId` compound query constraints and JWT subject verification. | Multi-tenant test suite verifying that User B receives HTTP 403/404 when attempting to query or mutate User A's `tradePlanId`. |
| **4. PostgreSQL Row-Level Security (RLS)** | **Proposed Mechanism (Unverified Control)** | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with database policies tied to connection session variable `app.current_user_id`. | SQL migration enabling RLS and integration tests proving bypass attempts fail even when executing raw SQL queries without user session context. |
| **5. Cross-Version Deterministic Execution** | **Architecture Requirement (Unverified Control)** | Versioned JSON/YAML rulesets (`stage-a-v1.0.json`) paired with SemVer engine compatibility checks. | Golden fixture test asserting that v1.0 engine with v1.0 config produces identical scores after v1.1 code is deployed. |

---

## 5. Canonical 20-Decision User Governance Mapping

The table below establishes the **single canonical decision register**:
- **DEC-01 through DEC-15:** Preserves the original 15 investment-policy decisions from Kilo Code's `USER_DECISION_REGISTER.md`.
- **DEC-16 through DEC-20:** Explicitly incorporates the 5 stage-specific architecture governance decisions (A1 through A5).

> [!CAUTION]
> **Zero Policy Approvals Granted:** Every item below is explicitly classified as **`PENDING USER DECISION`**. Proposed options represent technical recommendations only; none are approved policy.

| Canonical Decision ID | Historical Mapping | Decision Topic / Scope | Source Reference | Proposed Technical Recommendation (Unapproved) | Implementation Phase Gated | Status |
| :---: | :---: | :--- | :--- | :--- | :---: | :---: |
| **DEC-01** | DEC-01 | Min Market Cap Filter | `USER_DECISION_REGISTER.md` #1 | ₹500 Cr (NSE SME threshold) | Phase 5 (Stage F) | **PENDING USER DECISION** |
| **DEC-02** | DEC-02 | Min Daily Turnover (Liquidity) | `USER_DECISION_REGISTER.md` #2 | ₹1 Cr/day (Institutional baseline) | Phase 4 (Stage E) | **PENDING USER DECISION** |
| **DEC-03** | DEC-03 | Min Financial History | `USER_DECISION_REGISTER.md` #3 | Minimum 3Y universal with graceful degradation | Stages A–D Validation | **PENDING USER DECISION** |
| **DEC-04** | DEC-04 | Red-Flag Hard-Block Override Policy | `USER_DECISION_REGISTER.md` #4 | Hard-block with mandatory audited override workflow | Red-Flag Engine | **PENDING USER DECISION** |
| **DEC-05** | DEC-05 | Promoter Pledge Threshold | `USER_DECISION_REGISTER.md` #5 | > 30% triggers Critical flag (SEBI threshold) | Phase 7 (Data Feeds) | **PENDING USER DECISION** |
| **DEC-06** | DEC-06 | Related Party Txn Threshold | `USER_DECISION_REGISTER.md` #6 | > 10% of revenue triggers Critical flag | Phase 7 (Data Feeds) | **PENDING USER DECISION** |
| **DEC-07** | DEC-07 | Auditor Opinion Treatment | `USER_DECISION_REGISTER.md` #7 | Adverse/Disclaimer = Critical; Qualified = Major | Phase 7 (Data Feeds) | **PENDING USER DECISION** |
| **DEC-08** | DEC-08 | DCF Cap & Asset Discounts | `USER_DECISION_REGISTER.md` #8 | Terminal cap = Rf - 1% (≈6%); Configurable asset discounts | Stage D Valuation | **PENDING USER DECISION** |
| **DEC-09** | DEC-09 | Kelly Sizing Cap | `USER_DECISION_REGISTER.md` #9 | 50% (Half-Kelly industry standard) | Stage F Risk Sizing | **PENDING USER DECISION** |
| **DEC-10** | DEC-10 | Portfolio Target Volatility | `USER_DECISION_REGISTER.md` #10 | 15% annualized target volatility | Stage F Optimization | **PENDING USER DECISION** |
| **DEC-11** | DEC-11 | Correlation Limits & Lookback | `USER_DECISION_REGISTER.md` #11 | 252 days; pairwise ≤ 0.7; portfolio avg < 0.5 | Stage F Constraints | **PENDING USER DECISION** |
| **DEC-12** | DEC-12 | Red-Flag Data Error Grace Period | `USER_DECISION_REGISTER.md` #12 | 3-day grace for data errors; immediate review on fundamental flags | Stage G Exit Rules | **PENDING USER DECISION** |
| **DEC-13** | DEC-13 | Take-Profit Scaling Levels | `USER_DECISION_REGISTER.md` #13 | +20%→30%, +40%→30%, +60%→40% (Configurable) | Stage G Exit Rules | **PENDING USER DECISION** |
| **DEC-14** | DEC-14 | Config Externalization Strategy | `USER_DECISION_REGISTER.md` #14 | Strategic thresholds in YAML; tactical internals in code | Configuration Service | **PENDING USER DECISION** |
| **DEC-15** | DEC-15 | Data Vendor Selection | `USER_DECISION_REGISTER.md` #15 | Hybrid: CSV/NSE for MVP; licensed vendor in Phase 7 | Data Providers | **PENDING USER DECISION** |
| **DEC-16** | **A1** | Stage A Boundary Inclusivity | `STAGE_A_SCORING_SPEC.md` Rule 6, 7 | Option A: `<0.50` (1.0), `0.50–1.25` (0.5), `>1.25` (0.0); CR `<1.00` = stop | **Stage A Engine (Phase 1B Gate)**| **PENDING USER DECISION** |
| **DEC-17** | **A2** | Stage B Pass Mark & Public Holding | `STAGE_B_SCORING_SPEC.md` §1 | `>= 6.5/10` pass; Public `>= 50%` configurable hard stop | Stage B Engine (Phase 3)| **PENDING USER DECISION** |
| **DEC-18** | **A3** | Stage C Moat Rubric Approval | `BUSINESS_MODEL_AND_MOAT_SPEC.md` | 5 tests; pass `>= 3/5` with Test 1 mandatory | Stage C Engine (Phase 3)| **PENDING USER DECISION** |
| **DEC-19** | **A4** | Stage D PEG Fallback Hierarchy | `VALUATION_ENGINE_SPEC.md` §4.3 | Proposed: 1. User -> 2. Consensus -> 3. 5Y CAGR -> 4. Unsuitable | Stage D Engine (Phase 4)| **PENDING USER DECISION** |
| **DEC-20** | **A5** | DATA_QUALITY Gating Behavior | `RED_FLAG_ENGINE_SPEC.md` §2.1, 2.2 | Marks INCOMPLETE; permits progression upon user acknowledgment | Pipeline Engine (Phase 2)| **PENDING USER DECISION** |

---

## 6. Financial Policy Assumptions Audit

All proposed defaults are evaluated against their source provenance:

| Parameter | Original User Note Value | Value in Authoritative Spec | Proposed Recommendation | Conflicting Values Found | Final Policy Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Min Market Cap** | Not specified | Not specified | ₹500 Cr (NSE SME) | ₹500 Cr vs ₹1,000 Cr vs No min | **`PENDING USER DECISION` (DEC-01)** |
| **Min Daily Turnover** | Discussed qualitatively | ₹1 Cr/day | ₹1 Cr/day | **₹1 Cr/day vs ₹2 Cr/day** | **`PENDING USER DECISION` (DEC-02)** |
| **Financial History** | 5Y annual / 8Q YoY | 5Y (A/B), 10Y (D), 252d (E) | Minimum 3Y universal w/ degradation | Uniform 5Y vs 3Y vs Stage-specific | **`PENDING USER DECISION` (DEC-03)** |
| **Promoter Pledge** | Qualitative trend | > 30% (Critical) | > 30% (SEBI threshold) | > 30% vs > 20% vs > 50% | **`PENDING USER DECISION` (DEC-05)** |
| **Related Party Txn** | Qualitative check | > 10% of revenue | > 10% of revenue | > 10% vs > 5% vs > ₹100 Cr | **`PENDING USER DECISION` (DEC-06)** |
| **Auditor Opinion** | Check qualifications | Any non-unqualified | Adverse/Disclaimer=Critical; Qualified=Major | Any non-unqualified vs Tiered | **`PENDING USER DECISION` (DEC-07)** |
| **DCF Terminal Cap** | Simplified calculator | GDP growth (~6%) | Rf - 1% (≈6%) | GDP (~6%) vs Rf (~7%) vs Rf-1% | **`PENDING USER DECISION` (DEC-08)** |
| **Kelly Sizing Cap** | Simple risk budget | 25% (Quarter-Kelly) | 50% (Half-Kelly) | **Original 25% vs Proposed 50%** | **`PENDING USER DECISION` (DEC-09)** |
| **Portfolio Volatility** | Not specified | 15% | 15% | 15% vs Dynamic Regime | **`PENDING USER DECISION` (DEC-10)** |
| **Correlation Limits** | Not specified | 252d; 0.7 pair / 0.5 avg | Configurable (252d, 0.7, 0.5) | 252d vs 504d vs Dynamic | **`PENDING USER DECISION` (DEC-11)** |
| **Data Error Grace** | Not specified | **Conflict:** 3d (Red-Flag) vs 0d (Stage G)| 3-day grace for data errors | **3 days vs 0 days (Immediate)** | **`PENDING USER DECISION` (DEC-12)** |
| **Take-Profit Scaling** | Not specified | +20%→30%, +40%→30%, +60%→40% | Configurable scaling tiers | Fixed tiers vs Trailing | **`PENDING USER DECISION` (DEC-13)** |
| **Config Strategy** | Hard-coded notes | "Externalized in YAML" | Strategic (15) in YAML; tactical in code | All 32 in YAML vs Strategic only | **`PENDING USER DECISION` (DEC-14)** |
| **Data Provider** | Manual entry | Manual / CSV import | Hybrid CSV/NSE MVP; licensed vendor in Phase 7 | CSV MVP vs Licensed scraping | **`PENDING USER DECISION` (DEC-15)** |
| **Stage A Boundaries** | 0.5 and 1.25 in notes | Marked "DECISION NEEDED" | Option A: `<0.5` (1), `0.5–1.25` (0.5), `>1.25` (0) | Option A vs Option B | **`PENDING USER DECISION` (DEC-16)** |
| **Stage B Pass Mark** | Not in notes | Proposed ≥6.5/10 | Confirm proposed ≥6.5/10 default | ≥6.5/10 vs User custom | **`PENDING USER DECISION` (DEC-17)** |
| **Stage C Moat Rubric**| 5 questions in notes | 5 tests; pass ≥3/5 | Confirm 5 tests, ≥3/5, Test 1 mandatory | 5 tests / 5 pts vs 6 tests / 18 pts | **`PENDING USER DECISION` (DEC-18)** |
| **Stage D PEG Fallback**| Primary method | Undefined for negative growth | Unapproved proposal: User -> Consensus -> 5Y CAGR | Undefined vs 4-tier fallback | **`PENDING USER DECISION` (DEC-19)** |
| **Data Quality Gating**| Notes silent | Blocks vs Acknowledge | Acknowledge allows provisional progression | Hard block vs Acknowledge to proceed | **`PENDING USER DECISION` (DEC-20)** |

---

## 7. Domain Model & Formula Traceability

### 7.1 Verified Domain Field Ownership & Entity Mapping
Earlier drafts incorrectly assumed that all missing formula fields belong in `FinancialStatement`. The table below establishes the **correct entity ownership** based on authoritative accounting and specification sources:

| Field | Actual Owning Model | Source Rule | Data Type | Nullable? | Provenance / Data Source | Stage Dependency |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| `interestExpense` | `FinancialStatement` (Income Stmt) | Stage A Rule 8 | `Decimal` | Yes | P&L Schedule / Finance Costs | Stage A |
| `dividendPerShare` | `FinancialStatement` (Cash Flow) / `CorporateAction` | Stage B Rule 7 | `Decimal` | Yes | Exchange Corporate Actions / Cash Flow | Stage B |
| `depreciationAmortization` | `FinancialStatement` (Cash Flow / P&L) | Stage D FCFF §5.2 | `Decimal` | Yes | Cash Flow Statement / P&L Schedule | Stage D |
| `capitalExpenditure` | `FinancialStatement` (Cash Flow) | Stage D FCFF §5.2 | `Decimal` | Yes | Cash Flow Investing Activities | Stage D |
| `changeInWorkingCapital` | `FinancialStatement` (Cash Flow) | Stage D FCFF §5.2 | `Decimal` | Yes | Cash Flow Operating Activities | Stage D |
| `avgShareholdersEquity` | **Derived Calculation Input** | Stage A Rule 4 | `Decimal` | Yes | Computed: $(Equity_T + Equity_{T-1}) / 2$ | Stage A |
| `avgTotalAssets` | **Derived Calculation Input** | Stage A Rule 10 | `Decimal` | Yes | Computed: $(Assets_T + Assets_{T-1}) / 2$ | Stage A |
| `epsGrowth` | **Derived Calculation Input** | Stage B Rule 4 | `Decimal[]` | Yes | Computed from historical annual EPS array | Stage B |
| `bvps` | **Derived Calculation Input** | Stage B Rule 8 | `Decimal` | Yes | Computed: $TotalEquity / SharesOutstanding$ | Stage B, D |
| `ebitda` | **Derived Calculation Input** | Valuation / Red-Flag | `Decimal` | Yes | Computed: $EBIT + D\&A$ | Stage D |
| `sharesOutstanding` | `Company` / `CapitalStructure` | Stage D Intrinsic Val | `Decimal` | Yes | Exchange Shareholding Disclosures | Stage B, D |
| `promoterPledgePct` | `ShareholdingPattern` / `GovernanceDisclosure`| Red-Flag Critical (`[DEC-05]`)| `Decimal` | Yes | Exchange Shareholding Filings | Red-Flag, B, G |
| `relatedPartyTxn` | `GovernanceDisclosure` | Red-Flag Critical (`[DEC-06]`)| `Decimal` | Yes | Annual Report Notes to Accounts | Red-Flag |
| `auditorQualification`| `AuditorReport` | Red-Flag Critical (`[DEC-07]`)| `enum AuditorOpinion` | Yes | Independent Auditor's Report | Red-Flag |
| `beta` | `MarketData` / `PriceSeries` | Stage B Rule 6, Stage F | `Decimal` | Yes | 252d/504d Daily Return Covariance | Stage B, F |
| `riskFreeRate` ($R_f$) | `MacroEconomicData` / `RuleSetConfig` | Stage D WACC, Stage F | `Decimal` | No | 10Y Indian G-Sec Benchmark Yield | Stage D, F |
| `equityRiskPremium` ($ERP$)| `MacroEconomicData` / `RuleSetConfig` | Stage D CAPM | `Decimal` | No | Configured Valuation Parameter | Stage D |

#### Classification of Gaps Across 5 Structural Dimensions:
1. **Missing Domain-Model Fields (Entity Schemas):** `interestExpense`, `dividendPerShare`, `depreciationAmortization`, `capitalExpenditure`, `changeInWorkingCapital` must be added to `FinancialStatement`.
2. **Missing Calculation Inputs (Derived Math):** `avgShareholdersEquity`, `avgTotalAssets`, `epsGrowth`, `bvps`, `ebitda` are computed by mathematical functions; they do not require independent raw database columns.
3. **Missing Persistence Models (New Tables):** `ShareholdingPattern` (for promoter pledge), `GovernanceDisclosure` (for RPT), and `AuditorReport` (for audit qualifications) require distinct Prisma tables.
4. **Missing External Data Sources:** Live SEBI/NSE shareholding feeds, corporate governance filings, and daily index price series for beta derivation belong to Phase 7 licensed integrations.
5. **Missing User-Defined Policies:** Thresholds and handling for missing governance data remain pending user decision (`[DEC-04]`, `[DEC-05]`, `[DEC-06]`, `[DEC-07]`, `[DEC-20 / A5]`).

---

### 7.2 Formula Issues Reconciled & Policy Clarifications

#### Formula Issue F-01: PEG Division by Zero & Negative Growth (`[DEC-19 / A4]`)
- **Mathematical Requirement:**  
  When earnings growth rate $g \le 0$ or $P/E \le 0$, the ratio $PEG = (P/E) / g$ is mathematically undefined or economically meaningless (e.g. negative growth yields a negative PEG that would naively appear "undervalued" under standard $< 1.0$ filters). The core engine **must evaluate PEG as `UNSUITABLE` / `UNDEFINED`** and must exclude unsuitable values from peer median calculations.
- **User Policy Decision (PENDING `[DEC-19 / A4]`):**  
  The proposed 4-tier fallback hierarchy (User Input $\rightarrow$ Analyst Consensus $\rightarrow$ 5Y Historical CAGR $\rightarrow$ Mark Unsuitable) is an **unapproved technical recommendation**. Whether to automatically fall back to historical CAGR or require manual user selection remains an open policy choice.
- **Phase 1A Design Boundary:**  
  In Phase 1A, the `PegResult` contract supports a policy-neutral union type:
  ```typescript
  export type PegResult = 
    | { status: 'VALID'; peg: Decimal; growthRateUsed: Decimal; source: string }
    | { status: 'UNSUITABLE'; reason: 'ZERO_OR_NEGATIVE_GROWTH' | 'MISSING_DATA' | 'CYCLICAL_EARNINGS' };
  ```
  No automated fallback execution is implemented until `[DEC-19 / A4]` is formally approved by the user.

#### Formula Issue F-02: Stage A Sector ROA Benchmark & Missing Data Behavior
- **Authoritative Investigation of `STAGE_A_SCORING_SPEC.md` Rule 10:**  
  Rule 10 Return on Assets (1.0 pt max) consists of:
  - Sub-rule 10a: Latest FY ROA $\ge$ Industry Minimum ROA (+0.5 pt).
  - Sub-rule 10b: 1Y ROA > 5Y Average ROA (+0.5 pt).
  The specification states: `If industryRoaMin unavailable → 10a unscored (0.5 pts max)`.
- **Distinction of 5 Distinct Failure Modes:**
  1. *Missing Company ROA:* Net profit or total assets missing $\rightarrow$ Rule is completely uncomputable; emits `DATA_QUALITY_WARNING: MISSING_COMPANY_ROA`.
  2. *Missing Sector Benchmark:* `industryRoaMin` is absent $\rightarrow$ Sub-rule 10a is unscored; sub-rule 10b remains eligible for +0.5 pt.
  3. *Invalid or Stale Source Data:* Data older than 18 months or flagged as restated $\rightarrow$ Emits `DATA_QUALITY_WARNING: STALE_DATA`.
  4. *Insufficient Historical Data:* Fewer than 5 annual filings exist $\rightarrow$ 5Y Average ROA cannot be computed; sub-rule 10b is uncomputable.
  5. *Mathematically Undefined Ratio:* Total Assets $\le 0$ $\rightarrow$ Division by zero; ROA is mathematically undefined.
- **Unresolved Policy Decision:**  
  The source specification does NOT specify whether an "unscored" sub-rule normalizes the total Stage A denominator (scoring out of 9.5) or treats the sub-rule as 0 points out of 10.0. Assigning 0 points without blocking was an unapproved assumption in earlier drafts. This behavior is formally classified as **`PENDING USER DECISION` (Stage A Benchmark Scoring Policy)**.

---

## 8. Test-Suite Readiness Reconciliation

Testing readiness is evaluated across four distinct statuses to prevent confusing test specifications with executed test verification:

1. **Test Infrastructure Availability:** **HARNESS NOT IMPLEMENTED** (No monorepo, `package.json`, or Vitest test runner configuration exists in the workspace yet).
2. **Test Scenarios Documented:** **SCENARIOS DOCUMENTED WITH IDENTIFIED GAPS**
   - **56 Unit Test Scenarios** are documented in `RULE_VALIDATION_TEST_CASES.md`.
   - **57 Edge Case Gaps** were cataloged by Kilo Code in `RULE_TEST_COVERAGE_MATRIX.md`.
   - **88 Missing Non-Unit Scenarios:** 21 missing integration tests, 8 missing pipeline E2E tests, 9 missing property-based tests, 50 missing contract tests.
   - **Stage C Moat Coverage:** Critical deficiency (only 1 test scenario exists for 5 moat tests; 4 missing).
   - **Stage F Portfolio Coverage:** Critical deficiency (only 1 test scenario exists for 4 rules; 3 missing).
3. **Test Implementation Completed:** **TESTS NOT IMPLEMENTED** (Zero `.test.ts` or test suite files exist in the repository).
4. **Tests Executed and Passing:** **TESTS UNEXECUTED (0 PASSING)** (Zero automated tests have executed).
5. **Golden Fixtures (TCS & HUL):** **DATA NOT TRANSCRIBED** (Raw historical statement tables from handwritten notes are not yet serialized into JSON fixtures).

---

## 9. Narrowed Phased Implementation Scope & Strict Boundary

To maintain engineering discipline and prevent unapproved financial rules from being prematurely encoded, Phase 1 is strictly bifurcated:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 1 IMPLEMENTATION ROADMAP                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 1A: Foundation Scaffolding & Shared Contracts (Sprint 1 Scope)        │
│  - Monorepo tooling (pnpm, Turborepo, turbo.json)                           │
│  - Shared configs (packages/config: TypeScript, ESLint, Prettier, Vitest)   │
│  - Policy-neutral Zod validation contracts (packages/contracts)             │
│  - Client-agnostic OpenAPI 3.1 DTO exports for web frontend route handlers  │
│  - Pure TS domain foundation (packages/core: base types, Decimal.js math)   │
│  - Red-flag interface contracts (packages/core/src/flags/types.ts - types)  │
│  - Pipeline engine interfaces (packages/core/src/engine/ - interfaces only) │
│  - Database schema baseline (packages/db: Prisma, snapshots, audit_events)  │
│  - Configuration service loader mechanism (packages/core/src/config)        │
│  - Web shell skeleton (apps/web: Next.js App Router, layout, /api/v1/health)│
│  - CI automation pipeline (GitHub Actions lint, typecheck, test harness)    │
│  - Website-first strategy: Mobile UI, Flutter, & mobile auth DEFERRED (Ph 8)│
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 1B: Stage A Engine Implementation (Sprint 2 Scope — STRICTLY GATED)  │
│  - Implement Stage A 10-point scoring engine (packages/core/src/stage-a)    │
│  - Implement bank legacy 9-point scoring variant                            │
│  - Synthetic unit test suite covering all boundary thresholds               │
│  - PREREQUISITE: Formal user approval of [DEC-16 / A1] (Boundary Inclusivity)│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Strict Phase 1A Implementation Boundary:

#### PERMITTED IN PHASE 1A (Technical Scaffolding & Contracts — Exactly 10 Subsystems):
- Neutral technical primitives (`ISODateString`, `Currency`, `Unit`, `DataProvenance`).
- Structural Zod contracts validating shapes, UUIDs, numbers, and pagination.
- Client-agnostic OpenAPI 3.1 specifications generated in `packages/contracts` for web route handlers.
- Arbitrary-precision math wrappers (`Decimal.js` helpers with zero-division safety).
- Snapshot and audit logging persistence models (`DataSnapshot`, `AnalysisSnapshot`, `AuditEvent`).
- Configuration versioning and loader validation mechanisms.
- Pure TypeScript interfaces that do not prescribe unresolved policy behavior.
- Next.js website API shell and edge security middleware.
- Vitest test runner configuration and CI harness.

#### STRICTLY PROHIBITED IN PHASE 1A WITHOUT SEPARATE APPROVAL:
- Financial scoring algorithms (no Stage A–G scoring functions).
- Default investment thresholds (no hardcoded ₹500 Cr market cap or 20% ROE thresholds).
- Policy enforcement (no automated pipeline progression halting).
- Hard-stop override permissions or bypass workflows.
- Automatic warning acknowledgment progression.
- Automated PEG fallback execution.
- Missing-data scoring assumptions (no auto-zeroing missing benchmarks).
- Portfolio optimization algorithms (no OSQP quadratic programming execution).
- Production external data integrations or web scrapers.
- Native mobile client development, mobile UI, or mobile-specific infrastructure.

---

## 10. Subsystem Arithmetic & Count Reassessment

The platform is decomposed into **exactly 18 subsystems**:

```
Total Subsystems Evaluated: 18
───────────────────────────────────────────────────────────────────────────────
  Phase 1A Eligible (Immediate Foundation Scaffolding & Contracts - Sprint 1): 10 (55.6%)
  Phase 1B Eligible (Stage A Engine - Sprint 2 Gated on [DEC-16 / A1]):         1 ( 5.6%)
  Deferred Subsystems (Calculation Engines Stages B–G & Mobile App Phase 8):    7 (38.9%)
  Blocked Subsystems:                                                           0 ( 0.0%)
───────────────────────────────────────────────────────────────────────────────
  Arithmetic Verification: 10 + 1 + 7 = 18 Subsystems (100.0%)
```

1. **Phase 1A Eligible Subsystems (10):** Monorepo Foundation (#1), Contracts Layer (#2), Shared Domain Model Interfaces (#3), Database Baseline (#4), Configuration Service Prototype (#5), API Gateway Shell (#6), Red-Flag Interface Contracts (#14), Pipeline Engine Interfaces (#15), Background Worker Daemon Scaffolding (#16), Testing Infrastructure Harness (#17).
2. **Phase 1B Eligible Subsystem (1 - Gated):** Core Engine — Stage A (#7).
3. **Deferred Subsystems (7):** Stage B (#8), Stage C (#9), Stage D (#10), Stage E (#11), Stage F (#12), Stage G (#13), and Mobile Client Application & Features (#18 in Phase 8).

---

## 11. FINAL CROSS-REPORT CONSISTENCY CHECK

This section confirms complete cross-report consistency between all three Phase 0.6 Antigravity reports:

| Consistency Item | `PHASE_0_6_FINAL_ARCHITECTURE_RECONCILIATION.md` | `ARCHITECTURE_AND_DOMAIN_CONFLICT_REGISTER.md` | `FINAL_ARCHITECTURE_READINESS_MATRIX.md` | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Canonical Decision Mapping** | 20 Decisions (`[DEC-01]`..`[DEC-15]`, `[DEC-16/A1]`..`[DEC-20/A5]`) | 20 Decisions mapped in Section 3 | Referenced in Subsystem dependencies | **CONSISTENT** |
| **All Policy Decisions Status**| `PENDING USER DECISION` (Zero approved) | `PENDING USER DECISION` (Zero approved) | Gated on User Decision | **CONSISTENT** |
| **Technical Conflicts** | 10 Technical Conflicts Reconciled | 10 Technical Conflicts Reconciled | Reconciled technical baseline applied | **CONSISTENT** |
| **Red-Flag Taxonomy** | 6-facet Technical Proposal (Policy Pending) | CONF-001 Technical Proposal (Policy Pending)| 1A Types Only; Evaluators in Ph 2 | **CONSISTENT** |
| **Stage C Moat Tests** | Exactly 5 tests, 0–5 score (6-test rejected)| CONF-002 5 tests confirmed (DEC-18 pending)| 5-test rubric deferred to Phase 3 | **CONSISTENT** |
| **Stage A Boundary Reference**| Canonically `[DEC-16 / A1]` | Canonically `[DEC-16 / A1]` (CONF-010) | Gated on `[DEC-16 / A1]` | **CONSISTENT** |
| **Stage E Readiness Status** | Specified (Algorithm/Math); Needs Adj OHLCV| Specified (Algorithm/Math); Needs Adj OHLCV| Specified (Algorithm/Math); Needs Adj OHLCV| **CONSISTENT** |
| **PEG Fallback Status** | DEC-19 Pending; Proposal unapproved | DEC-19 Pending; Math vs Policy separated | Gated on `[DEC-19 / A4]` | **CONSISTENT** |
| **Missing Benchmark Scoring** | Unspecified in spec; Policy decision pending| Rule 10 failure modes cataloged | Gated on Benchmark Policy | **CONSISTENT** |
| **Domain Model Ownership** | Entity-specific ownership mapping (11+ fields)| Corrected ownership table | Schema models aligned | **CONSISTENT** |
| **Testing Readiness State** | 0 Executed; Harness not implemented | Documented gaps separated from execution | Explicit 4-status labels applied | **CONSISTENT** |
| **Phase 1A Permitted Scope** | 10 Foundation Subsystems (Strict boundary) | 10 Foundation Subsystems (Strict boundary) | 10 Foundation Subsystems (Strict boundary)| **CONSISTENT** |
| **Phase 1B Scope** | Stage A Engine (Gated on `[DEC-16 / A1]`) | Gated on `[DEC-16 / A1]` | 1 Subsystem Phase 1B Eligible (Gated) | **CONSISTENT** |
| **Deferred Subsystems** | 7 Subsystems (Stages B–G + Mobile App Ph 8)| Mapped to Phases 3–8 | 7 Subsystems Deferred | **CONSISTENT** |
| **Total Subsystems** | Exactly 18 Subsystems (10 + 1 + 7 = 18) | Mapped across 18 Subsystems | Exactly 18 Subsystems in Table | **CONSISTENT** |
| **Implementation Status** | NOT STARTED | NOT STARTED | NOT STARTED | **CONSISTENT** |
| **User Authorization Status** | NOT GRANTED | NOT GRANTED | NOT GRANTED | **CONSISTENT** |
| **Overall Verdict** | Accepted with Open Decisions | Accepted with Open Decisions | Accepted with Open Decisions | **CONSISTENT** |

---

## 12. PHASE 0.6 FINAL ACCEPTANCE RESULT

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                   PHASE 0.6 FINAL ARCHITECTURE AUDIT RESULT                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  FINAL CLASSIFICATION: ACCEPTED WITH OPEN DECISIONS                           ║
║                                                                               ║
║  1. Architectural Integrity: VERIFIED & INTERNALLY CONSISTENT                 ║
║  2. Implementation Eligibility: PHASE 1A ELIGIBLE FOR CONSIDERATION           ║
║  3. Stage A Engine Gate: PHASE 1B GATED ON USER APPROVAL OF [DEC-16 / A1]     ║
║  4. Implementation Status: NOT STARTED                                        ║
║  5. User Authorization: NOT GRANTED (AWAITING USER INSTRUCTION)               ║
║  6. Open User Decisions: EXACTLY 20 DECISIONS TRACKED (ZERO APPROVED)         ║
║  7. Test Coverage State: 56 DOCUMENTED / 57 MISSING GAPS / 0 EXECUTED         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```
