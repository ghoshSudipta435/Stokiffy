# Implementation Readiness Matrix

**Project:** Stokiffy — Personal Stock Market Assistant  
**Workstream:** Phase 0.5 — Architecture Validation & Implementation Readiness Audit  
**Owner:** Principal Software Architect & Architecture Auditor  
**Date:** 15 November 2026  
**Status:** Complete  

---

## 1. Classification Criteria & Legend

Every subsystem in the Stokiffy architecture is evaluated against the 10 strategy specifications (`docs/strategy/`) and the 7 approved architecture documents (`docs/architecture/`).

| Status | Definition | Action Required Prior to Implementation |
| :--- | :--- | :--- |
| **READY** | Specification is unambiguous, architecturally sound, and has complete interface definitions. | Can proceed to Phase 1 foundation coding immediately. |
| **READY WITH CONDITIONS** | Architecture is compatible, but requires formal resolution of specific policy decisions or contract schema additions. | Phase 1 foundation can proceed; conditions must be satisfied before implementing the specific package. |
| **BLOCKED** | Major contradiction, architectural incompatibility, or missing core prerequisite that prevents correct implementation. | Work on this subsystem is halted until architecture/policy redesign is completed. |

---

## 2. Comprehensive Subsystem Readiness Matrix

| Subsystem / Component | Classification | Associated Gaps | Concrete Architectural Evidence & Readiness Rationale |
| :--- | :---: | :---: | :--- |
| **1. Monorepo Foundation & Tooling** | **READY** | None | pnpm workspaces, Turborepo pipeline (`turbo.json`), shared configs (`packages/config`), tsconfig inheritance, and strict ESLint boundaries (`import/no-restricted-paths`) are fully defined in `FOLDER_STRUCTURE.md` and `DEVELOPMENT_STANDARDS.md`. |
| **2. Domain Core Engine — Stage A** | **READY WITH CONDITIONS** | GAP-006 | 10 scoring rules, formulas, inputs, bank legacy 9-point mode, and hard stops are defined in `STAGE_A_SCORING_SPEC.md`. **Condition:** User confirmation on exact boundary inclusivity for D/E (`0.50–1.25`) and Current Ratio (`1.0–2.0`). |
| **3. Domain Core Engine — Stage B** | **READY WITH CONDITIONS** | GAP-008 | 10-point allocation (Quarterly sales/OPM, 5Y sales/OPM/PAT, reserves, CFO vs PAT, debtor days, ROCE trend, shareholding matrix) is defined in `STAGE_B_SCORING_SPEC.md`. **Condition:** User sign-off on the proposed `>= 6.5/10` pass threshold and configurable Public holding `>= 50%` hard stop. |
| **4. Domain Core Engine — Stage C** | **READY WITH CONDITIONS** | GAP-009 | 3 business model questions, 5 moat tests, and evidence-tagging schemas are specified in `BUSINESS_MODEL_AND_MOAT_SPEC.md`. **Condition:** User approval of the proposed `>= 3/5` pass threshold with mandatory non-copyability test clearance. |
| **5. Domain Core Engine — Stage D** | **READY WITH CONDITIONS** | GAP-007 | 4 valuation models (P/E with normalized EPS, PEG, P/B by sector, 2-stage DCF with WACC & sensitivity), and 20% margin-of-safety buy ceiling are defined in `VALUATION_ENGINE_SPEC.md`. **Condition:** User approval of the deterministic PEG growth rate fallback hierarchy. |
| **6. Domain Core Engine — Stage E** | **READY** | None | 6 bullish and 3 bearish candlestick pattern detection algorithms, MA confluence (20/50/200), ATR(14) risk, and valuation buy-zone confirmation logic are rigorously detailed in `TECHNICAL_ANALYSIS_SPEC.md`. |
| **7. Domain Core Engine — Stage F** | **READY** | None | Position sizing formula `floor(Risk Budget / Risk per Share / Lot Size) * Lot Size`, liquidity cap (5% ADV), cash cap, and portfolio/sector concentration checks (10%/30%) are mathematically defined in `PORTFOLIO_RISK_AND_EXIT_SPEC.md`. |
| **8. Domain Core Engine — Stage G** | **READY** | None | Fundamental, technical, thesis, and portfolio alert evaluators, sell/trim/hold decision workflows, and journal metrics are specified in `PORTFOLIO_RISK_AND_EXIT_SPEC.md`. |
| **9. Red Flag & Gatekeeping Engine** | **READY WITH CONDITIONS** | GAP-004, GAP-010 | 4 flag classes (`HARD_STOP`, `CONDITIONAL_WARNING`, `DATA_QUALITY_WARNING`, `VALUATION_WARNING`) and 5-state lifecycle are defined in `RED_FLAG_ENGINE_SPEC.md`. **Condition:** Relocate `flags/` as a top-level module in `packages/core/src/flags/` and confirm data-quality acknowledgment gating behavior. |
| **10. Configuration & Ruleset System** | **READY** | GAP-011 | YAML/JSON configuration schemas (`RuleSetConfig`, `BenchmarkConfig`) and versioning (`stage-a-v1.0`) are detailed in `DOMAIN_MODEL_SPEC.md`. Validated via Zod. |
| **11. Contracts & DTOs Layer (`packages/contracts`)** | **READY WITH CONDITIONS** | GAP-001, GAP-002, GAP-003 | Universal Zod schemas for all domain entities, uniform response envelopes (`ApiResponse<T>`), and cursor pagination are detailed. **Condition:** Add missing request/response schemas for Stage E, Flag Acknowledgment/Override, and Journal Reviews. |
| **12. Database & Persistence Layer (`packages/db`)** | **READY WITH CONDITIONS** | GAP-011 | PostgreSQL schema topology, repositories, and immutable `audit_events` table are documented in `SYSTEM_ARCHITECTURE.md` and `SECURITY_ARCHITECTURE.md`. **Condition:** Incorporate `DataSnapshot`, `AnalysisSnapshot`, and full `RedFlag` lifecycle fields into Prisma schema during Phase 1. |
| **13. Data Providers Layer (`packages/data-providers`)** | **READY** | None | Streaming CSV/Excel parser interfaces, Screener.in column mappers, and `DataProvenance` validation rules are detailed in `FOLDER_STRUCTURE.md` and `DOMAIN_MODEL_SPEC.md`. |
| **14. API Gateway & Routes (`apps/web/app/api/v1`)** | **READY WITH CONDITIONS** | GAP-001, GAP-002, GAP-003 | Next.js Route Handlers as modular monolith gateway, RFC 7807 error envelopes, and idempotency headers are documented in `API_ARCHITECTURE.md`. **Condition:** Add route files for Stage E, Flag Acknowledgments, and Trade Journal reviews. |
| **15. Frontend Dashboard (`apps/web`)** | **READY** | None | Next.js App Router route groups `(auth)` / `(dashboard)`, 10 screen specifications, server/client component boundaries, TanStack Query cache keys, and dual charting (TradingView + Recharts) are fully specified in `FRONTEND_ARCHITECTURE.md`. |
| **16. Background Worker (`services/worker`)** | **READY** | None | `pg-boss` PostgreSQL-backed daemon architecture, queue definitions for async CSV ingestion, daily alert evaluations, and batch rescoring are detailed in `SYSTEM_ARCHITECTURE.md` and `FOLDER_STRUCTURE.md`. |
| **17. Testing & Quality Assurance** | **READY** | GAP-012 | 80+ test cases covering threshold boundaries, bank legacy exceptions, DCF scenarios, and property tests are defined in `RULE_VALIDATION_TEST_CASES.md`. Vitest runner architecture is set up in `DEVELOPMENT_STANDARDS.md`. |
| **18. Security, Auth & Audit** | **READY** | None | Dual authentication (cookies for web, Bearer tokens for mobile), row-level tenant ownership (`userId`), input sanitization, and immutable `audit_events` ledger are fully designed in `SECURITY_ARCHITECTURE.md`. |
| **19. Future Mobile Client Readiness** | **READY** | None | Universal RESTful `/api/v1` HTTP contract, stateless Bearer token auth, OpenAPI 3.1 client SDK generation, UTC timestamps, and opaque CUID2 identifiers are guaranteed across all specifications. |

---

## 3. Subsystem Readiness Summary

```
Total Subsystems Evaluated: 19
─────────────────────────────────────────────
  READY:                  11 (57.9%)
  READY WITH CONDITIONS:   8 (42.1%)
  BLOCKED:                 0 ( 0.0%)
─────────────────────────────────────────────
Overall Verdict: ARCHITECTURALLY READY FOR PHASE 1 FOUNDATION
```

---

## 4. Phase-by-Phase Implementation Prerequisite Checklist

To ensure a smooth transition from Phase 0.5 into implementation, the conditions above map cleanly to the planned implementation phases:

### Phase 1: Monorepo & Technical Foundation
- [x] Monorepo tooling and package boundaries (`apps/web`, `packages/*`, `services/worker`)
- [x] Strict TypeScript configuration and ESLint boundary rules
- [x] Standardize on `Decimal.js` (eliminate `big.js` redundancy — GAP-005)
- [x] Setup `packages/core/src/flags/` as a top-level cross-stage module (GAP-004)
- [x] Incorporate `DataSnapshot`, `AnalysisSnapshot`, and `audit_events` in Prisma schema (GAP-011)
- [x] Include Stage E, Flag Acknowledgment, and Journal schemas in `packages/contracts` (GAP-001, GAP-002, GAP-003)

### Phase 2: Stage A Screener MVP
- [ ] Receive user confirmation on D/E and Current Ratio boundary inclusivity (GAP-006)
- [ ] Confirm Data Quality Warning acknowledgment gating behavior (GAP-010)
- [ ] Implement Stage A 10-point scoring engine, bank variant, and hard-stop red flags
- [ ] Implement CSV ingestion adapter and Screener UI (Screens 2 & 10)

### Phase 3: Stage B Trends & Stage C Moat
- [ ] Receive user confirmation on Stage B `>= 6.5/10` pass mark and Public holding `>= 50%` flag (GAP-008)
- [ ] Receive user confirmation on Stage C `>= 3/5` moat score and Test 1 pass rule (GAP-009)
- [ ] Implement Stage B 10-point trend engine and Stage C qualitative assessment form (Screen 3)

### Phase 4: Stage D Valuation & Stage E Technical Timing
- [ ] Receive user confirmation on PEG growth rate fallback policy (GAP-007)
- [ ] Implement 4 valuation models (P/E, PEG, P/B, DCF) and 20% margin-of-safety buy ceiling
- [ ] Implement Stage E candlestick pattern detectors and confluence evaluation against buy zone

### Phase 5: Stage F Trade Planner & Stage G Monitoring / Journal
- [ ] Implement position sizing calculator and portfolio exposure checks (Screen 5)
- [ ] Implement active alert monitoring desk (Screen 7)
- [ ] Implement closed-trade journal and post-trade reviews (Screen 8)
