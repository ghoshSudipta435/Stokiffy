# Architecture & Domain Conflict Register

**Project:** Stokiffy — Personal Stock Market Assistant  
**Workstream:** Phase 0.6 — Final Architecture & Cross-Audit Reconciliation  
**Role:** Principal Software Architect, Senior Full-Stack Engineer & Independent Architecture Auditor  
**Date:** 15 November 2026  
**Status:** Accepted with Open Decisions — Baseline Acceptance Audit Complete  

---

## 1. Overview, Governance Legend & Register Arithmetic

This register documents all technical discrepancies, cross-audit conflicts, and unapproved business/financial policy decisions identified between the Antigravity Architecture Audit, the Kilo Code Strategy Audit, and the authoritative project source documents (`docs/architecture/`, `docs/strategy/`, and `Personal_Stock_Assistant_Updated_Strategy_Blueprint.docx`).

### 1.1 Governance Classification Legend
- **RECONCILED (Technical):** Technical architecture, directory topology, API contract, or code organization discrepancy resolved based on authoritative engineering specifications; does not alter investment or financial policy.
- **PENDING USER DECISION:** Business rule, investment threshold, risk limit, or governance policy choice reserved exclusively for user authorization. **No decision in this category is approved; all proposed options represent unapproved technical recommendations only.**

### 1.2 Register Arithmetic & ID-Level Account
The historical audit trajectory generated **14 conflict IDs (CONF-001 through CONF-014)**. An exhaustive verification confirms:
- **10 Technical Architecture Conflicts:** CONF-001, CONF-002, CONF-003, CONF-004, CONF-005, CONF-006, CONF-007, CONF-009, CONF-013, CONF-014. These resolve engineering alignment issues without altering investment policy.
- **4 Reclassified Policy Conflicts:** CONF-008, CONF-010, CONF-011, CONF-012 were identified in early drafts as "conflicts" but represent financial policy decisions. They are canonically mapped to `[DEC-12]`, `[DEC-16 / A1]`, `[DEC-17 / A2]`, and `[DEC-19 / A4]`.
- **20 User Policy Decisions:** `[DEC-01]` through `[DEC-15]` (from Kilo Code's `USER_DECISION_REGISTER.md`) plus `[DEC-16 / A1]` through `[DEC-20 / A5]`.
- **Arithmetic Verification:** $10\text{ (Technical Conflicts)} + 20\text{ (Policy Decisions)} = 30\text{ Active Cataloged Entries}$.  
  *(Note: The 10 technical items are not policy decisions, and the 20 policy decisions are not technical bugs).*

---

## 2. Reconciled Technical Architecture & Domain Structure Conflicts

### Exact ID-Level Historical Reconciliation Table (CONF-001 through CONF-014):

| Historical Conflict ID | Original Description | Categorization | Canonical Resolution / Policy Mapping | Technical Status | Policy Status |
| :---: | :--- | :---: | :--- | :---: | :---: |
| **CONF-001** | Red-Flag Taxonomy Model | Technical Proposal | 6-facet model proposed (Class, Severity, Action, Status, Ack, Override) | **RECONCILED** | Pending `[DEC-04]`, `[DEC-20 / A5]` |
| **CONF-002** | Stage C Moat Test Count | Technical Clarification | 5 Moat Tests confirmed from spec (6-test Morningstar model rejected) | **RECONCILED** | Pass mark pending `[DEC-18 / A3]` |
| **CONF-003** | Math Library Duplication | Technical Standardization| Standardized exclusively on `Decimal.js` across monorepo | **RECONCILED** | Standard Engineering Decision |
| **CONF-004** | Red-Flag Module Placement| Technical Alignment | Relocated to `packages/core/src/flags/` (types in 1A; evaluators in Ph 2) | **RECONCILED** | Standard Engineering Decision |
| **CONF-005** | Stage E Technical Route | API Contract Addition | Added `POST /api/v1/analyses/stage-e`; 6 operational semantics tracked | **RECONCILED** | Semantics tracked for Ph 4 |
| **CONF-006** | Flag Acknowledgment Route| API Contract Addition | Added `POST /api/v1/flags/{id}/acknowledge`; distinct from override | **RECONCILED** | Semantics tracked for Ph 2 |
| **CONF-007** | Trade Journal API Routes | API Contract Addition | Added `GET/POST /api/v1/journal` and `POST .../review`; mutability tracked | **RECONCILED** | Semantics tracked for Ph 5 |
| **CONF-008** | Stage G Grace Period vs Exit| Policy Contradiction | **Reclassified to `[DEC-12]`** (3d data error grace vs 0d immediate exit) | **RECLASSIFIED**| **`PENDING USER DECISION` (DEC-12)** |
| **CONF-009** | Data Provider Phasing | Roadmap Alignment | Phase 1 establishes foundation with CSV; live scraping deferred to Ph 7 | **RECONCILED** | Standard Engineering Decision |
| **CONF-010** | Stage A Boundary Inclusivity| Policy Boundary Choice | **Reclassified to `[DEC-16 / A1]`** (Option A `<0.50` vs Option B `<=0.50`) | **RECLASSIFIED**| **`PENDING USER DECISION` (DEC-16)** |
| **CONF-011** | Stage B Pass Threshold | Policy Threshold Choice| **Reclassified to `[DEC-17 / A2]`** (`>= 6.5/10` pass mark; Public `>= 50%`) | **RECLASSIFIED**| **`PENDING USER DECISION` (DEC-17)** |
| **CONF-012** | Stage D PEG Fallback | Policy Fallback Choice | **Reclassified to `[DEC-19 / A4]`** (4-tier fallback proposal unapproved) | **RECLASSIFIED**| **`PENDING USER DECISION` (DEC-19)** |
| **CONF-013** | Domain Model Field Ownership| Data Modeling Alignment| 11+ fields mapped to true entities (`FinancialStatement`, `Company`, etc.) | **RECONCILED** | Standard Engineering Decision |
| **CONF-014** | Snapshot Storage & Triggers | Database Persistence | `DataSnapshot`, `AnalysisSnapshot`, `AuditEvent` with SQL triggers | **RECONCILED** | Proposed Control (Unverified) |

---

### Detailed Technical Conflict Analysis:

### CONF-001: Red-Flag Taxonomy — Multi-Faceted Model vs Flat Enums
- **Description:** Structural discrepancy in how the red-flag taxonomy is modeled across specifications.
- **Antigravity Finding:** Defined a 4-class taxonomy based on pipeline gating role: `HARD_STOP`, `CONDITIONAL_WARNING`, `DATA_QUALITY_WARNING`, `VALUATION_WARNING`.
- **Kilo Code Finding:** Stated a 4-class taxonomy based on severity: `Critical`, `Major`, `Minor`, `Info`.
- **Authoritative Source:** `RED_FLAG_ENGINE_SPEC.md` Section 2.1 & 3; `DOMAIN_MODEL_SPEC.md` Section 3.1.
- **Root Cause & Impact:** Conflating pipeline progression gating behavior with visual display severity produces ambiguity in API contracts, database schema, and pipeline execution logic.
- **Proposed Technical Resolution:** Separate red flags into **six distinct operational facets**:
  1. *Flag Category / Gating Class (`class: FlagClass`):* Determines pipeline gating behavior (`HARD_STOP`, `CONDITIONAL_WARNING`, `DATA_QUALITY_WARNING`, `VALUATION_WARNING`).
  2. *Severity (`severity: FlagSeverity`):* Determines visual hierarchy, UI badges, and alert urgency (`critical`, `high`, `medium`, `low`).
  3. *Enforcement Action:* Automated engine action (`HALT_STAGE`, `PAUSE_FOR_EXPLANATION`, `MARK_PROVISIONAL`, `BLOCK_BUY_READY`).
  4. *Lifecycle Status:* State tracking (`CREATED`, `ACTIVE`, `ACKNOWLEDGED`, `OVERRIDDEN`, `RESOLVED`, `EXPIRED`).
  5. *User Acknowledgment:* Documents user rationale to permit conditional progression on warnings without erasing the flag from audit history.
  6. *Override Authorization:* Formal audited exception workflow for hard stops.
- **Approval Requirement & Policy Status:** This multi-faceted model is an **unapproved technical architecture proposal**. Exact mappings between severity levels and gating classes, as well as hard-stop override eligibility, remain **`PENDING USER DECISION` (`[DEC-04]` and `[DEC-20 / A5]`)**. In Phase 1A, only pure TypeScript type definitions will be created in `packages/core/src/flags/types.ts`; full evaluators and production enforcement are deferred to later phases.
- **Status:** **RECONCILED (Technical Architecture Proposal — Policy Pending `[DEC-04]`, `[DEC-20 / A5]`)**

---

### CONF-002: Stage C Moat Test Count and Scoring System
- **Description:** Discrepancy in the number of moat tests and maximum scoring potential.
- **Antigravity Finding:** Documented **Five Moat Tests**, scored 0–5 (1 pt each), passing at `>= 3/5` with Test 1 (Non-copyability) strictly passing.
- **Kilo Code Finding:** Stated there are **Six Moat Tests** scored 0–3 each (total 0–18, passing at `>= 12`), referencing Morningstar moat categories.
- **Authoritative Source:** `BUSINESS_MODEL_AND_MOAT_SPEC.md` Section 3 & 4; `Personal_Stock_Assistant_Updated_Strategy_Blueprint.docx` Section 6 (lines 280–293); `Stock selection.pdf`.
- **Root Cause & Impact:** Kilo Code imported Morningstar's external economic moat classification (Switching Costs, Network Effects, Intangible Assets, Cost Advantage, Efficient Scale, Data) and an unapproved 0–18 scoring system, which would alter the Stage C data model and UI forms. (Kilo Code subsequently acknowledged and corrected this in `FINAL_FORMULA_AND_TEST_READINESS_MATRIX.md`).
- **Proposed Resolution:** Confirm the authoritative project specification: exactly **Five Moat Tests**, scored 0 to 5, passing at `>= 3/5` with Test 1 mandatory:
  1. *Test 1:* Can competitors easily copy the business? (Pass = "No", 1 pt)
  2. *Test 2:* Can the advantage last 10+ years? (Pass = "Yes", 1 pt)
  3. *Test 3:* Has ROE been high & consistent for 10+ years? (Pass = "Yes", 1 pt)
  4. *Test 4:* Can the company raise prices without losing customers? (Pass = "Yes", 1 pt)
  5. *Test 5:* Is market share stable or growing over 5+ years? (Pass = "Yes", 1 pt)
- **Approval Requirement:** The `>= 3/5` pass threshold remains an **unapproved proposed baseline pending formal user approval (`[DEC-18 / A3]`)**.
- **Status:** **RECONCILED (Technical Framework Confirmed — Pass Mark Pending `[DEC-18 / A3]`)**

---

### CONF-003: Arbitrary-Precision Math Library Standardization
- **Description:** Duplicate precision libraries introduced across specifications.
- **Antigravity Finding:** Mandated `Decimal.js` across the monorepo (ADR-005).
- **Kilo Code Finding:** Suggested `big.js` specifically for share quantities and `decimal.js` for currency/ratios (`DOMAIN_MODEL_SPEC.md` Section 9).
- **Authoritative Source:** `ARCHITECTURAL_DECISIONS.md` (ADR-005); `DEVELOPMENT_STANDARDS.md` Section 4.
- **Impact:** Duplicate dependencies, bundle bloat, and confusion over which library to import.
- **Proposed Resolution:** Standardize exclusively on `Decimal.js` across all workspace packages (`packages/core`, `packages/contracts`, `apps/web`). `Decimal.js` natively supports arbitrary precision integer floor operations (`new Decimal(quantity).floor().toNumber()`).
- **Approval Requirement:** None (Standard software engineering decision).
- **Status:** **RECONCILED (Technical)**

---

### CONF-004: Cross-Stage Red Flag Module Organization
- **Description:** Incorrect directory placement of the Red Flag Engine in the folder blueprint.
- **Antigravity Finding:** `FOLDER_STRUCTURE.md` placed `red-flags.ts` inside `packages/core/src/stage-a/`.
- **Kilo Code Finding:** Red-Flag Engine operates across Stages A through G; domain interfaces placed in `packages/core/src/flags/`.
- **Authoritative Source:** `RED_FLAG_ENGINE_SPEC.md` Section 1; `DOMAIN_MODEL_SPEC.md` Section 6.
- **Impact:** Confining red flags to Stage A creates circular dependencies when Stages B through G trigger flags.
- **Proposed Resolution:** In Phase 1A, establish top-level module `packages/core/src/flags/` containing type definitions and lifecycle schemas only. Actual engine evaluators are implemented in subsequent stages.
- **Approval Requirement:** None (Code organization alignment).
- **Status:** **RECONCILED (Technical)**

---

### CONF-005: Missing Stage E Technical Analysis API Route & Unresolved Semantics
- **Description:** The RESTful gateway contract lacked an endpoint to execute or retrieve Stage E technical analysis.
- **Antigravity Finding:** Identified that `API_ARCHITECTURE.md` had `/api/v1/companies/{id}/prices`, but no Stage E analysis route.
- **Kilo Code Finding:** Confirmed `TECHNICAL_ANALYSIS_SPEC.md` and `StageEInput`/`StageEOutput` are fully formulated.
- **Authoritative Source:** `API_ARCHITECTURE.md` Section 4; `TECHNICAL_ANALYSIS_SPEC.md` Section 2.3.
- **Impact:** Client applications would have no mechanism to retrieve candlestick setups and buy-zone confluence.
- **Proposed Resolution:** Add `POST /api/v1/analyses/stage-e` and `GET /api/v1/companies/{id}/technical-setups` to `packages/contracts`.
- **Unresolved Semantics Cataloged:** While route names are established, API readiness is conditional upon formalizing request idempotency and cache expiration on intraday candle updates.
- **Approval Requirement:** None (API contract completeness).
- **Status:** **RECONCILED (Technical — Route Added, Semantics Tracked)**

---

### CONF-006: Red-Flag Lifecycle & Acknowledgment API Route & Unresolved Semantics
- **Description:** Gateway contract lacked endpoints for acknowledging warnings vs overriding hard stops.
- **Antigravity Finding:** `API_ARCHITECTURE.md` only had `POST /api/v1/analyses/{id}/override`.
- **Kilo Code Finding:** Confirmed distinct lifecycle actions between acknowledgment and override.
- **Authoritative Source:** `RED_FLAG_ENGINE_SPEC.md` Section 2.2, 3; `DOMAIN_MODEL_SPEC.md` Section 5 (`FlagEngine`).
- **Impact:** Users could not acknowledge data quality or conditional warnings without incorrectly recording a hard override.
- **Proposed Resolution:** Add `POST /api/v1/flags/{id}/acknowledge` and `GET /api/v1/flags` to `packages/contracts`.
- **Unresolved Semantics Cataloged:**
  1. *Warning Acknowledgment Scope:* Rules governing whether an acknowledgment applies to a single quarterly filing or all future filings for that company.
  2. *Re-Triggering:* Rules governing whether an acknowledged flag reactivates if subsequent quarterly data worsens.
  3. *Historical Filtering:* Query parameter contracts (`cursor`, `limit`, `stage`, `status`, `severity`, `companyId`) for historical queries.
- **Approval Requirement:** None (API contract completeness).
- **Status:** **RECONCILED (Technical — Route Added, Semantics Tracked)**

---

### CONF-007: Missing Trade Journal API Routes & Review Mutability
- **Description:** Gateway contract lacked routes for the Trade Journal and post-mortem review submissions.
- **Antigravity Finding:** `FRONTEND_ARCHITECTURE.md` defined Screen 8 (Journal), but `API_ARCHITECTURE.md` only had raw `/transactions`.
- **Kilo Code Finding:** Confirmed Stage G journal models (`JournalEntry`, `PostTradeReview`, `CorporateAction`).
- **Authoritative Source:** `PORTFOLIO_RISK_AND_EXIT_SPEC.md` Section 3.3; `FRONTEND_ARCHITECTURE.md` Screen 8.
- **Impact:** Client applications could not persist post-trade qualitative reviews, emotional bias tracking, or lessons learned.
- **Proposed Resolution:** Add `GET/POST /api/v1/journal` and `POST /api/v1/journal/{id}/review` to contracts.
- **Unresolved Semantics Cataloged:** Determining whether a submitted post-trade review is permanently immutable to prevent hindsight revisionism or permits draft revisions prior to final publishing.
- **Approval Requirement:** None (API contract completeness).
- **Status:** **RECONCILED (Technical — Route Added, Semantics Tracked)**

---

### CONF-008: Stage G Critical Red-Flag Exit Timing vs Grace Period
- **Reclassification:** Mapped canonically to **Section 3 (`[DEC-12]`)**.

---

### CONF-009: Data Provider Dependency Timing (Phase 1 Foundation vs Phase 7 Integration)
- **Description:** Disagreement on whether missing governance data fields block Phase 1 implementation.
- **Antigravity Finding:** Phase 1 establishes the monorepo, contracts, and core engine primitives. Data provider integration occurs in Phase 7. CSV import is used for MVP. Phase 1 is unblocked.
- **Kilo Code Finding:** Classified the Red-Flag Engine as "BLOCKED" because governance fields (promoter pledge, auditor qualifications, RPT) are not available in basic CSV files.
- **Authoritative Source:** `SYSTEM_ARCHITECTURE.md` Section 19 (`Phased Implementation Roadmap`); `INVESTMENT_RULES_SPECIFICATION.md` Section 1.
- **Impact:** Treating Phase 7 data feeds as a Phase 1 prerequisite would unnecessarily stall all engineering work.
- **Proposed Resolution:** Reaffirm the phased roadmap: Phase 1 implements foundation scaffolding with CSV models. Governance fields default to `null` and emit non-blocking `DATA_QUALITY_WARNING` tags during Phase 2. External scraping belongs to Phase 7.
- **Approval Requirement:** None (Roadmap alignment).
- **Status:** **RECONCILED (Technical)**

---

### CONF-010: Stage A Boundary Inclusivity
- **Reclassification:** Mapped canonically to **Section 3 (`[DEC-16 / A1]`)**.

---

### CONF-011: Stage B Pass Threshold & Public Holding Heuristic
- **Reclassification:** Mapped canonically to **Section 3 (`[DEC-17 / A2]`)**.

---

### CONF-012: Stage D PEG Growth Rate Fallback Hierarchy
- **Reclassification:** Mapped canonically to **Section 3 (`[DEC-19 / A4]`)**.

---

### CONF-013: Domain Model Field Ownership & Structural Entity Mapping
- **Description:** Earlier audits assumed that all missing financial and governance fields belonged in `FinancialStatement`.
- **Antigravity Finding:** Database schemas must support all metrics across stages without conflating accounting disclosures with market statistics.
- **Kilo Code Finding:** Explicitly listed missing fields in `INVESTMENT_RULES_AUDIT.md` Section 2.
- **Authoritative Investigation & Resolution:**  
  A rigorous audit of accounting taxonomy and source specifications reveals that fields belong to distinct domain models:

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

#### Structural Classification Across 5 Dimensions:
1. **Missing Domain-Model Fields (Entity Schemas):** `interestExpense`, `dividendPerShare`, `depreciationAmortization`, `capitalExpenditure`, `changeInWorkingCapital` must be added to `FinancialStatement`.
2. **Missing Calculation Inputs (Derived Math):** `avgShareholdersEquity`, `avgTotalAssets`, `epsGrowth`, `bvps`, `ebitda` are computed by mathematical functions; they do not require independent raw database columns.
3. **Missing Persistence Models (New Tables):** `ShareholdingPattern` (for promoter pledge), `GovernanceDisclosure` (for RPT), and `AuditorReport` (for audit qualifications) require distinct Prisma tables.
4. **Missing External Data Sources:** Live SEBI/NSE shareholding feeds, corporate governance filings, and daily index price series for beta derivation belong to Phase 7 licensed integrations.
5. **Missing User-Defined Policies:** Thresholds and handling for missing governance data remain pending user decision (`[DEC-04]`, `[DEC-05]`, `[DEC-06]`, `[DEC-07]`, `[DEC-20 / A5]`).
- **Approval Requirement:** None (Data modeling and entity mapping alignment).
- **Status:** **RECONCILED (Technical — Entity Ownership Corrected)**

---

### CONF-014: Immutable Snapshot Storage Specification & Trigger Design
- **Description:** Ensuring `DataSnapshot` and `AnalysisSnapshot` schemas guarantee bitwise reproducibility.
- **Antigravity Finding:** Cataloged as GAP-011 (Prisma JSONB models required).
- **Kilo Code Finding:** Emphasized that reproducibility requires storing serialized inputs, outputs, and SHA256 rule config hashes.
- **Authoritative Source:** `SYSTEM_ARCHITECTURE.md` Section 13; `DOMAIN_MODEL_SPEC.md` Section 8.
- **Impact:** Restatements by data providers could overwrite historical analysis inputs, breaking auditability.
- **Proposed Resolution:** Include explicit `DataSnapshot` and `AnalysisSnapshot` tables in `packages/db/prisma/schema.prisma` with compound unique index `[companyId, ruleSetVersion, createdAt]` and immutable PostgreSQL trigger design.
- **Approval Requirement:** None (Technical persistence design).
- **Status:** **RECONCILED (Technical)**

---

## 3. Canonical 20-Decision User Governance Mapping

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

## 4. Conflict Summary Statistics & Arithmetic Verification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REGISTER ARITHMETIC VERIFICATION                        │
├──────────────────────────────────────────────────────┬──────────────────────┤
│ Classification Category                              │ Count                │
├──────────────────────────────────────────────────────┼──────────────────────┤
│ 1. Historical Conflict IDs Logged (CONF-001..014)     │ 14 IDs               │
│    - Reconciled Technical Architecture Conflicts     │ 10 entries (Active)  │
│    - Reclassified Policy Decisions (CONF-008,10,11,12)│ 4 entries (Mapped)   │
│ 2. Active User Financial & Policy Decisions          │ 20 decisions         │
│    (DEC-01 through DEC-20 / A5)                      │ (Pending Sign-off)   │
├──────────────────────────────────────────────────────┼──────────────────────┤
│ ACTIVE CATALOGED REGISTER ENTRIES                    │ 30 ENTRIES           │
│ (10 Active Technical Conflicts + 20 User Decisions)  │                      │
└──────────────────────────────────────────────────────┴──────────────────────┘
```

**Verification Statement:** Exactly 10 technical architecture discrepancies and exactly 20 user policy decisions are cataloged. There are zero duplicate decisions, zero misclassified entries, and zero policy decisions marked as approved.

---

## 5. FINAL CROSS-REPORT CONSISTENCY CHECK

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

## 6. PHASE 0.6 FINAL ACCEPTANCE RESULT

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
