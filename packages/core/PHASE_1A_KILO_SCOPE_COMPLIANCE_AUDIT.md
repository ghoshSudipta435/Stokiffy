# Phase 1A Kilo Scope Compliance Audit

**Date:** 16 November 2026  
**Workstream:** B — Domain, Contracts, Database and Provider Foundation  
**Auditor:** Kilo Code  
**Packages Audited:** `packages/core`, `packages/contracts`, `packages/db`, `packages/data-providers`

---

## 1. Preflight Findings

| Item | Finding |
|------|---------|
| Git repository | NOT initialized. `git status --short` returns "fatal: not a git repository". No `.git` directory exists. No Git initialization performed. |
| packages/ directory | Did not exist prior to Phase 1A implementation. Created during Phase 1A. |
| apps/ directory | Does not exist (Antigravity ownership). No files created or modified. |
| Root workspace configuration | Does not exist. No `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `turbo.json`, or `.npmrc`. Not owned by Kilo — not created or modified. |
| Architecture documents | Present in `docs/architecture/` — reviewed for alignment. |
| Strategy specifications | Present in `docs/strategy/` — reviewed for domain type alignment. |
| Package managers available | Node.js v22.16.0, npm v10.9.2. pnpm NOT available (corepack module missing). |
| Package structure | Four packages exist: `core`, `contracts`, `db`, `data-providers`. Each has `src/`, `tests/`, `tsconfig.json`, `package.json`. |

---

## 2. Actual Files Inspected

### packages/core (21 source files)

| File | Status |
|------|--------|
| `src/index.ts` | Inspected — public exports barrel |
| `src/common/decimal.ts` | Inspected — Decimal.js primitives |
| `src/common/errors.ts` | Inspected — domain error classes |
| `src/types/base.ts` | Inspected — base domain types |
| `src/types/scoring.ts` | Inspected — scoring result types |
| `src/types/snapshot.ts` | Inspected — snapshot types |
| `src/types/stage-a.ts` through `stage-g.ts` | Inspected — all 7 stage type definitions |
| `src/engine/interfaces.ts` | Inspected — engine interfaces (ScoringEngine, FlagEngine) |
| `tests/decimal.test.ts` | Inspected — 28 decimal precision tests |
| `tests/types.test.ts` | Inspected — 7 type correctness tests |

### packages/contracts (12 source files)

| File | Status |
|------|--------|
| `src/index.ts` | Inspected — public exports barrel |
| `src/enums/index.ts` | Inspected — 12 Zod enum schemas |
| `src/models/index.ts` | Inspected — 10 Zod DTO schemas |
| `src/api/common.ts` | Inspected — API envelopes, error codes |
| `src/api/companies.ts` | Inspected — companies API contracts |
| `src/api/analyses.ts` | Inspected — analysis API contracts |
| `src/api/trade-plans.ts` | Inspected — trade plan API contracts |
| `src/api/portfolio.ts` | Inspected — portfolio API contracts |
| `src/api/valuations.ts` | Inspected — valuation API contracts |
| `tests/contracts.test.ts` | Inspected — 14 Zod validation tests |

### packages/db (16 source files + Prisma schema)

| File | Status |
|------|--------|
| `prisma/schema.prisma` | Inspected — 24 models, PostgreSQL + Prisma |
| `src/client.ts` | Inspected — PrismaClient singleton |
| `src/index.ts` | Inspected — public exports barrel |
| `src/utils/transaction.ts` | Inspected — transaction wrapper |
| `src/utils/soft-delete.ts` | Inspected — soft-delete utilities |
| `src/repositories/company-repository.ts` | Inspected — row-level ownership |
| `src/repositories/financials-repository.ts` | Inspected — ownership filter FIXED |
| `src/repositories/analysis-repository.ts` | Inspected — row-level ownership |
| `src/repositories/trade-plan-repository.ts` | Inspected — row-level ownership |
| `src/repositories/portfolio-repository.ts` | Inspected — upsert bug FIXED |
| `src/repositories/alert-repository.ts` | Inspected — row-level ownership |
| `src/repositories/audit-repository.ts` | Inspected — immutability claim CORRECTED |
| `tests/repositories.test.ts` | Inspected — 8 repository boundary tests |

### packages/data-providers (11 source files)

| File | Status |
|------|--------|
| `src/index.ts` | Inspected — public exports barrel |
| `src/interfaces/financial-provider.ts` | Inspected — FinancialStatementProvider interface |
| `src/interfaces/market-data-provider.ts` | Inspected — MarketDataProvider interface |
| `src/csv/parser.ts` | Inspected — streaming CSV parser |
| `src/csv/mapper.ts` | Inspected — CSV-to-DTO mapper (zero-coercion FIXED) |
| `src/csv/validator.ts` | Inspected — CSV row validators |
| `src/external/base-client.ts` | Inspected — HTTP client with retry |
| `src/external/mock-provider.ts` | Inspected — mock providers for dev/test |
| `tests/csv.test.ts` | Inspected — 15 CSV tests |
| `tests/mock-provider.test.ts` | Inspected — 10 mock provider tests |

---

## 3. Domain Purity Findings (`packages/core`)

| Check | Result | Evidence |
|-------|--------|----------|
| No React/Next.js dependency | PASS | `package.json` has only `decimal.js` as runtime dependency |
| No Prisma/database dependency | PASS | No `@prisma/client` or database drivers in `package.json` |
| Framework-independent public interfaces | PASS | All exports are plain TypeScript types and functions |
| No circular dependencies | PASS | Import graph is acyclic: types → base → scoring/snapshot/stage; engine → types; index → all |
| No infrastructure imports | PASS | `src/index.ts` exports only domain primitives, errors, types, and interfaces |

**Finding:** `packages/core` is fully framework-independent and domain-pure. Zero infrastructure coupling.

---

## 4. Decimal Precision Findings (`packages/core`)

| Check | Result | Evidence |
|-------|--------|----------|
| Decimal.js used for financial math | PASS | `src/common/decimal.ts` imports and configures `decimal.js` |
| Missing values never coerced to zero | PASS | `safeDecimal()` returns `null` for null/undefined/NaN/Infinity |
| Division-by-zero protection | PASS | `safeDivide()` returns `null` when denominator is zero |
| Precision constants defined | PASS | `DECIMAL_PRECISION` — RATIO:10, CURRENCY:2, PERCENTAGE:4, CAGR:6 |
| toCurrency/toRatio/toPercentage/toCagr return null for null input | PASS | All conversion functions guard against null |
| Rounding policy documented | PASS | `ROUND_HALF_UP`, precision 28 |
| Share quantities use floor | PASS | `toShareQuantity()` uses `Decimal.floor().toNumber()` |

**Finding:** All financial primitives correctly use Decimal.js. Missing data is never silently converted to zero. Division-by-zero returns null, never Infinity.

---

## 5. Policy-Dependent Interface Findings (`packages/core`)

| Interface | Policy Encoding? | Assessment |
|-----------|-----------------|------------|
| `OverrideRequest` | Partial | Includes `decision: 'acknowledge' \| 'override'` — prescribes decision structure but not policy logic |
| `AcknowledgmentRequest` | No | Neutral data structure (flagId, userId, reason) |
| `StageGateResult` | Partial | Includes `canProceed`, `blockedBy`, `requiresAcknowledgment`, `overrides` — prescribes gate structure but not policy thresholds |
| `FlagEngine.applyOverride` | Partial | Interface signature prescribes override method shape, not policy |
| `FlagEngine.acknowledgeFlag` | Partial | Interface signature prescribes acknowledgment method shape, not policy |
| `ScoringEngine` | No | Pure interface: Input → Output, no scoring logic |
| `EngineNotImplementedError` | No | Placeholder error, no policy |

**Finding:** Override/acknowledgment interfaces are **type-level data structures only**. They prescribe the *shape* of override/acknowledgment data but do not implement any policy thresholds, grace periods, or bypass semantics. All 20 decisions (D-01 through D-15, D-A1 through D-A5) remain PENDING. No implementation of override behavior exists.

**Minor observation:** `StageGateResult.canProceed` presumes a gate enforcement model exists. This is a type definition only; the actual gate policy (Decision D-04, D-12) is not implemented.

---

## 6. Contract Validation Findings (`packages/contracts`)

### Pre-Remediation Issues (FIXED)

| Schema | Issue | Severity | Resolution |
|--------|-------|----------|------------|
| `CreateTradePlanRequestSchema.riskPercentage` | Hardcoded `min(0.1).max(5.0)` — encodes 5% risk cap (Decision D-09/D-10 PENDING) | Critical | Made optional, removed bounds |
| `FlagOverrideRequestSchema.reason` | Hardcoded `min(50)` — encodes override reason policy (Decision D-04 PENDING) | Critical | Made optional, removed min length |
| `FlagAcknowledgeRequestSchema.reason` | Hardcoded `min(10)` — encodes acknowledgment reason policy (Decision D-04/D-05 PENDING) | Critical | Made optional, removed min length |
| `HttpErrorCode.HARD_RED_FLAG_BLOCKED` | Encodes red-flag blocking policy (Decision D-04/D-12 PENDING) | Critical | Removed from enum |
| `ValuationResponseSchema.buyReady` | Encodes buy-ready decision (Decision D-08 PENDING) | High | Removed |
| `ValuationResponseSchema.marginOfSafetyPct` | Encodes margin-of-safety concept (Decision D-08 PENDING) | High | Removed |
| `TradePlanResponseSchema.blocked` | Encodes trade-plan gate behavior | High | Removed |
| `FinancialLineItemSchema.value` | Non-nullable number — coerces missing to zero in mapper | High | Made nullable |

### Post-Remediation Status

| Schema | Status |
|--------|--------|
| All enum schemas | PASS — neutral classification labels only |
| `CompanySchema`, `FinancialStatementSchema`, etc. | PASS — DTO structures only |
| `ApiResponseSchema`, `ErrorResponseSchema` | PASS — neutral envelopes |
| `RunStageARequestSchema`, `RunStageBRequestSchema` | PASS — neutral request structures |
| `CreateTradePlanRequestSchema` | PASS — `riskPercentage` optional, no bounds |
| `FlagOverrideRequestSchema` | PASS — `reason` optional |
| `FlagAcknowledgeRequestSchema` | PASS — `reason` optional |
| `TransactionRequestSchema` | PASS — neutral transaction fields |
| `ValuationRequestSchema` / `ValuationResponseSchema` | PASS — no buy-ready or margin fields |
| `FinancialLineItemSchema.value` | PASS — nullable, missing values preserved as null |

**Finding:** All schemas are now policy-neutral. No hardcoded thresholds, score boundaries, or override rules remain.

---

## 7. Database Ownership and Immutability Findings (`packages/db`)

### Pre-Remediation Issues (FIXED)

| Issue | Severity | Resolution |
|-------|----------|------------|
| `FinancialsRepository` queries filter by `companyId` only, not `userId` | Critical | Added `company: { userId }` to all queries |
| `PortfolioRepository.upsert` missing `userId`/`companyId` in create data | Critical | Added spread with `userId` and `companyId` |
| `AuditRepository` comment falsely claims DB-level immutability | High | Corrected comment — application-layer only, DB-level enforcement not implemented |
| `softDeleteData()` returns wrong type, no model has `deletedAt` field | Moderate | Return type corrected; models use `isActive` not `deletedAt` |
| `notDeleted()` references `deletedAt` but no model has it | Moderate | Utility retained for future use; no model currently uses soft-delete |

### Ownership Verification

| Repository | findById | findMany | update | delete/softDelete | Ownership Filter |
|------------|----------|----------|--------|-------------------|------------------|
| CompanyRepository | ✅ userId | ✅ userId | ✅ userId (via findById) | ✅ userId (via findById) | Applied |
| FinancialsRepository | N/A | ✅ userId (via company relation) | N/A | N/A | **FIXED** — was missing |
| AnalysisRepository | ✅ userId | ✅ userId | N/A | N/A | Applied |
| TradePlanRepository | ✅ userId | ✅ userId | ✅ userId (via findById) | N/A | Applied |
| PortfolioRepository | ✅ userId | ✅ userId | ✅ userId (via findById) | N/A | Applied |
| AlertRepository | N/A | ✅ userId | ✅ userId (via findFirst) | N/A | Applied |
| AuditRepository | N/A | ✅ userId | N/A | N/A | Applied |

### Audit Immutability — Evidence-Based Finding

**Claim from previous report:** "Audit events are never updated or deleted (enforced at DB level)."

**Actual state:** NOT EVIDENCE-BASED.

| Enforcement Mechanism | Implemented? | Evidence |
|----------------------|--------------|----------|
| Prisma model read-only | No | `AuditEvent` is a standard model with full CRUD capability |
| Database triggers | No | No SQL triggers defined in schema |
| Row-level security | No | No PostgreSQL RLS policies defined |
| Application-layer restriction | Partial | `AuditRepository` only exposes `create` and `find` methods (no update/delete) |

**Corrected statement:** Application-layer only creates and reads audit events (no update/delete methods exposed). True database-level immutability (PostgreSQL row-level security, triggers, or permissions) is NOT implemented in Phase 1A and must be enforced at the infrastructure layer before production use.

**Finding:** The immutability claim was overstated. Only application-layer enforcement exists. Database-level immutability is a future requirement.

---

## 8. Provider-Neutrality Findings (`packages/data-providers`)

| Check | Result | Evidence |
|-------|--------|----------|
| No production provider selected | PASS | No API keys, no provider-specific adapters in `src/external/` except mock |
| Provider interfaces isolated | PASS | `FinancialStatementProvider`, `MarketDataProvider` in `src/interfaces/` |
| CSV adapter supports manual ingestion | PASS | `CSVParser`, `validate*Row`, `mapTo*` functions |
| No hidden provider-specific field assumptions | PASS | Interfaces use contracts from `@stock-assistant/contracts` |
| No unbounded memory for CSV | MODERATE | `csvContent.split('\n')` loads entire file — claim of "streaming" is inaccurate |
| Malformed/missing/invalid row handling | PASS | Validators return errors; mapper returns null for invalid rows |
| Explicit data provenance | PASS | `DataProvenance` included in all result types |
| Date/number/decimal parsing | PASS | `parseNumber` returns null for invalid values; `Date.parse` validated |
| Base HTTP client retry/timeout | PASS | Exponential backoff, AbortController timeout, maxRetries |
| Mock data clearly identifiable | PASS | `providerName = 'mock'`, `MOCK_SYMBOLS` list |

**Finding:** Provider-neutral architecture is correct. The CSV parser claim of "streaming" is inaccurate — it loads the entire file into memory via `split('\n')`. This is a documentation issue, not a functional defect.

---

## 9. Dependency and Package Naming Findings

### Package Naming

| Package | Current Name | Project Name | Issue |
|---------|-------------|--------------|-------|
| `@stock-assistant/core` | `@stock-assistant/core` | Stokiffy | Naming inconsistency — "stock-assistant" ≠ "Stokiffy" |
| `@stock-assistant/contracts` | `@stock-assistant/contracts` | Stokiffy | Naming inconsistency |
| `@stock-assistant/db` | `@stock-assistant/db` | Stokiffy | Naming inconsistency |
| `@stock-assistant/data-providers` | `@stock-assistant/data-providers` | Stokiffy | Naming inconsistency |

**Finding:** Package names use `@stock-assistant/*` but the project is "Stokiffy". Per instructions, packages are NOT renamed automatically. This is a naming inconsistency to be resolved by the project owner.

### Cross-Package Dependencies

| Package | Dependency | Reference Type | Resolves? |
|---------|-----------|---------------|-----------|
| `packages/db` | `@stock-assistant/contracts` | `file:../contracts` | Yes (after npm install) |
| `packages/data-providers` | `@stock-assistant/contracts` | `file:../contracts` | Yes (after npm install) |
| `packages/data-providers` | `@stock-assistant/core` | `file:../core` | Yes (after npm install) |

**Finding:** `file:` references resolve correctly after `npm install` in each package. However, without root workspace configuration (`pnpm-workspace.yaml`), these are not true workspace dependencies. `workspace:*` conversion is necessary for proper monorepo integration but cannot be done without modifying root configuration (not owned by Kilo).

**Finding:** Cannot claim a successful monorepo build when the workspace is not configured. Packages are independently buildable and testable.

---

## 10. Violations Summary

| # | Violation | Severity | Location | Remediation Status |
|---|-----------|----------|----------|-------------------|
| V-01 | `CreateTradePlanRequestSchema` hardcoded 5% risk cap | Critical | `packages/contracts/src/api/trade-plans.ts` | FIXED — made optional |
| V-02 | `FlagOverrideRequestSchema` hardcoded min(50) reason | Critical | `packages/contracts/src/api/analyses.ts` | FIXED — made optional |
| V-03 | `FlagAcknowledgeRequestSchema` hardcoded min(10) reason | Critical | `packages/contracts/src/api/analyses.ts` | FIXED — made optional |
| V-04 | `HttpErrorCode.HARD_RED_FLAG_BLOCKED` encodes blocking policy | Critical | `packages/contracts/src/api/common.ts` | FIXED — removed |
| V-05 | `ValuationResponseSchema.buyReady` encodes buy decision | High | `packages/contracts/src/api/valuations.ts` | FIXED — removed |
| V-06 | `ValuationResponseSchema.marginOfSafetyPct` encodes valuation policy | High | `packages/contracts/src/api/valuations.ts` | FIXED — removed |
| V-07 | `TradePlanResponseSchema.blocked` encodes gate behavior | High | `packages/contracts/src/api/trade-plans.ts` | FIXED — removed |
| V-08 | `FinancialLineItemSchema.value` coerces missing to zero | High | `packages/contracts/src/models/index.ts` | FIXED — made nullable |
| V-09 | CSV mapper coerces missing values to zero (`?? 0`) | High | `packages/data-providers/src/csv/mapper.ts` | FIXED — null preserved, isMissing set |
| V-10 | `FinancialsRepository` missing userId ownership filter | Critical | `packages/db/src/repositories/financials-repository.ts` | FIXED — added `company: { userId }` |
| V-11 | `PortfolioRepository.upsert` missing userId/companyId in create | Critical | `packages/db/src/repositories/portfolio-repository.ts` | FIXED — added to create data |
| V-12 | AuditRepository falsely claims DB-level immutability | High | `packages/db/src/repositories/audit-repository.ts` | FIXED — comment corrected |
| V-13 | `softDeleteData()` returns wrong type, no `deletedAt` in models | Moderate | `packages/db/src/utils/soft-delete.ts` | FIXED — return type corrected |
| V-14 | `notDeleted()` references `deletedAt` but models use `isActive` | Moderate | `packages/db/src/utils/soft-delete.ts` | Noted — utility retained for future use |
| V-15 | Package names `@stock-assistant/*` vs project "Stokiffy" | Low | All `package.json` files | Noted — not renamed per instructions |
| V-16 | CSV parser not truly streaming (loads entire file) | Low | `packages/data-providers/src/csv/parser.ts` | Noted — documentation issue only |
| V-17 | No root workspace configuration | Moderate | Repository root | Noted — not owned by Kilo |

**Total: 17 violations identified, 13 remediated, 4 documented as notes/blockers.**

---

## Cross-Workstream Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| Root workspace configuration | Antigravity | NOT OWNED — blocks `workspace:*` conversion |
| `apps/**` implementation | Antigravity | NOT OWNED — packages ready for integration |
| Production data provider selection (Decision D-15) | User | PENDING — blocks production integrations |

---

## 20 Decisions — All PENDING

| ID | Decision | Status |
|----|----------|--------|
| D-01 | D/E Boundary Inclusivity | PENDING |
| D-02 | Current Ratio = 1.0 Handling | PENDING |
| D-03 | Minimum Financial History | PENDING |
| D-04 | Hard-Block Override Policy | PENDING |
| D-05 | Promoter Pledge Threshold | PENDING |
| D-06 | RPT Threshold | PENDING |
| D-07 | Auditor Qualification | PENDING |
| D-08 | DCF Terminal Cap & Asset Discounts | PENDING |
| D-09 | Kelly Criterion Cap | PENDING |
| D-10 | Portfolio Volatility Target | PENDING |
| D-11 | Correlation Lookback & Limits | PENDING |
| D-12 | Red-Flag Grace Period | PENDING — URGENT |
| D-13 | Take-Profit Scaling Levels | PENDING |
| D-14 | Config Externalization Strategy | PENDING |
| D-15 | Data Provider & Universe | PENDING — URGENT |
| D-A1 | Stage A Boundaries (Arch) | PENDING |
| D-A2 | Stage B Pass Mark & Public Holding | PENDING |
| D-A3 | Stage C Moat Scoring Rubric | PENDING |
| D-A4 | PEG Growth Rate Fallback | PENDING |
| D-A5 | DATA_QUALITY Gating Behavior | PENDING |

**Confirmation: All 20 decisions remain PENDING. No user approval evidence exists.**

---

*End of Phase 1A Kilo Scope Compliance Audit*