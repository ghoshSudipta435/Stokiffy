# STOKIFFY — PHASE 1A REMEDIATION REPORT
## Workstream A: Policy-Neutral Alignment, Scope Remediation, and Technical Verification

**Project:** Stokiffy — Personal Stock Market Assistant  
**Workstream:** Workstream A (Antigravity)  
**Assigned Ownership:** `apps/web/**` and `apps/worker/**`  
**Classification:** PHASE 1A REMEDIATION COMPLETE  
**Date:** November 16, 2026  
**Status:** READY FOR WORKSTREAM ACCEPTANCE  

---

## 1. Preflight Findings & Repository State

In accordance with Phase 1A Task Cycle 2 instructions, a mandatory preflight inspection was conducted prior to executing remediation:
1. **Git Repository Status:**
   - Evaluated `git status --short`. Command returned exit code 128 (`fatal: not a git repository`).
   - The fact that the working tree is not a Git repository was recorded. Git was NOT initialized, and no Git commands were attempted.
2. **File Ownership Verification:**
   - Files within exclusive ownership (`apps/web/**` and `apps/worker/**`) were inspected against the compliance audit criteria.
   - Protected zones were verified: `packages/**` (exclusively owned by Kilo Code), root manifests, root configuration, and `docs/**` were left completely untouched.
   - Existing working-tree changes were preserved without regressions.
3. **Cross-Workstream Boundaries:**
   - Verified that Kilo Code's packages (`packages/contracts`, `packages/core`, `packages/data-providers`, `packages/db`) exist independently. Workstream A does not duplicate or overwrite their files.

---

## 2. Files Modified

The following files within our exclusive ownership were modified or created during remediation:

### Web Application (`apps/web/`)
1. `apps/web/types/api.ts` — Removed `HARD_RED_FLAG_BLOCKED` from error code union.
2. `apps/web/lib/auth.ts` — Removed pseudo-bearer-token mobile auth check; retained web workstation session helper.
3. `apps/web/lib/api-handler.ts` — Added type annotations to Zod error mapping; integrated logger child context.
4. `apps/web/lib/logger.ts` — Added `withRequestId()` and `defaultContext` support to `StructuredLogger`.
5. `apps/web/lib/env.ts` — Added explicit callback parameter types to satisfy strict typechecking.
6. `apps/web/lib/query-client.ts` — Added explicit `failureCount: number` type annotation.
7. `apps/web/middleware.ts` — Corrected Next.js edge middleware import to `next/server`.
8. `apps/web/app/api/v1/flags/[id]/acknowledge/route.ts` — Neutralized route; removed hard-red-flag blocking (422) and 10-char justification minimum.
9. `apps/web/app/api/v1/flags/route.ts` — Clearly labeled demonstration flags and neutralized flag schema.
10. `apps/web/app/api/v1/analyses/stage-a/route.ts` — Neutralized to explicit placeholder returning `NOT_IMPLEMENTED`.
11. `apps/web/app/api/v1/companies/route.ts` — Replaced fabricated financial metrics with clearly labeled demo fixtures.
12. `apps/web/app/api/v1/companies/[id]/route.ts` — Replaced fabricated stage verdicts (PASSED, score 82) with `PENDING`.
13. `apps/web/app/api/v1/ingestion/upload-csv/route.ts` — Removed provider-specific assumptions (`SCREENER_EXPORT`); generalized to `GENERIC_CSV`.
14. `apps/web/components/layout/alert-bar.tsx` — Removed zero-tolerance and permanent advancement block claims.
15. `apps/web/components/shared/red-flag-indicator.tsx` — Replaced "NON-OVERRIDABLE" assertions with neutral classification badges.
16. `apps/web/hooks/use-flags.ts` — Updated mutation payload parameter to `{ reason }`.
17. `apps/web/app/(dashboard)/dashboard/page.tsx` — Removed fabricated stage funnel counts, ratios, and limits; presented neutral technical status.
18. `apps/web/app/(dashboard)/screener/page.tsx` — Removed fabricated "PASSED" badges; added neutral demonstration labels.
19. `apps/web/app/(dashboard)/companies/[symbol]/page.tsx` — Set all 7 stages to `PENDING`; removed fabricated valuation models.
20. `apps/web/app/(dashboard)/trade-planner/page.tsx` — Removed client-side position sizing and risk-reward calculations; converted to UI scaffolding.
21. `apps/web/app/(dashboard)/portfolio/page.tsx` — Removed unapproved 25% sector cap and 15% position limit; presented neutral portfolio table.
22. `apps/web/app/(dashboard)/monitoring/page.tsx` — Removed automated exit triggers and trailing-stop surveillance claims.

### Background Worker (`apps/worker/`)
23. `apps/worker/src/jobs/types.ts` — Removed `MARKET_ALERTS` queue and stop-loss schemas; defined provider-neutral file staging and technical maintenance schemas.
24. `apps/worker/src/jobs/registry.ts` — Registered policy-neutral queues: `file-ingestion`, `system-maintenance`, `nightly-audit`.
25. `apps/worker/src/jobs/handlers/process-csv-import.ts` — General file staging handler without third-party assumptions.
26. `apps/worker/src/jobs/handlers/system-maintenance.ts` — Technical queue maintenance and housekeeping handler.
27. `apps/worker/src/jobs/handlers/daily-data-quality-audit.ts` — Technical database snapshot integrity verification.
28. `apps/worker/src/jobs/handlers/evaluate-daily-alerts.ts` — **DELETED** (Removed unapproved financial stop-loss evaluation handler).
29. `apps/worker/src/scheduler.ts` — Removed market-close trailing stop checks; configured technical maintenance and snapshot integrity audits.
30. `apps/worker/src/queue.ts` — Updated to use typed `Job` interface from `pg-boss`.
31. `apps/worker/src/queue.test.ts` — Updated test suite for policy-neutral schemas and handlers.
32. `apps/worker/src/types/ambient.d.ts` — Created ambient type declarations for `pg-boss`, `dotenv`, and `process`.
33. `apps/worker/tsconfig.json` — Added `"DOM"` library for timer and console global types.

---

## 3. Detailed Summary of Changes Made

### 3.1 Hard Red-Flag & Acknowledgment Neutralization
- **Before:** `/api/v1/flags/[id]/acknowledge` inspected flag severity and rejected `HARD` flags with HTTP 422 `HARD_RED_FLAG_BLOCKED` and "Zero-tolerance violation". It also enforced a mandatory 10-character justification minimum.
- **Remediation:** Removed the HTTP 422 rejection and `HARD_RED_FLAG_BLOCKED` code. Removed the 10-character minimum in favor of generic string presence validation (`z.string().min(1)`). Added an explicit policy note that flag override semantics are pending user policy decision.
- **Component Updates:** In `red-flag-indicator.tsx`, removed badges reading "NON-OVERRIDABLE" and "OVERRIDABLE WITH JUSTIFICATION"; replaced with neutral "CLASSIFICATION: HARD" and "CLASSIFICATION: WARNING". In `alert-bar.tsx`, removed claims that advancement to Stages E/F is permanently blocked.

### 3.2 Stage A Screening Endpoint
- **Before:** `/api/v1/analyses/stage-a` returned `status: 'READY_FOR_PIPELINE'` and an analysis ID.
- **Remediation:** Converted to an explicit neutral placeholder interface returning `status: 'NOT_IMPLEMENTED'` with the message: *"Stage A calculation engine is in packages/core and awaiting user policy decision approvals. No financial analysis executed."*

### 3.3 Stage E Trade Planner Scaffolding
- **Before:** `trade-planner/page.tsx` executed position sizing calculations (`sharesQuantity = Math.floor(capital / entry)`), calculated risk-reward ratios (`1 : ${riskRewardRatio}`), evaluated `parseFloat(riskRewardRatio) >= 2 ? 'FAVORABLE' : 'UNFAVORABLE'`, and hardcoded EMA breakout rules.
- **Remediation:** Removed all client-side financial calculations. Removed invented EMA and volume threshold checklists. Converted into neutral UI scaffolding with clear disclaimers that execution logic belongs in `packages/core` and requires explicit user policy approval.

### 3.4 Stage F Portfolio Risk Scaffolding
- **Before:** `portfolio/page.tsx` hardcoded "Cap: 25.0% maximum" for sector concentration, "Cap: 15.0% maximum" for single-position limit, and "Minimum: 20%" for cash cushion reserve.
- **Remediation:** Removed all hardcoded caps and "Status: Compliant" badges. Retained neutral data table scaffolding. Clearly identified holdings data as sample demonstration fixtures.

### 3.5 Stage G Monitoring Scaffolding
- **Before:** `monitoring/page.tsx` claimed "Trailing stop loss surveillance", "Automated exit triggers", "SURVEILLANCE ACTIVE", and simulated stop-loss breach statuses.
- **Remediation:** Removed all automated exit triggers, trailing stop surveillance, and simulated stop loss breaches. Retained neutral monitoring table scaffolding.

### 3.6 Background Worker Engine
- **Before:** `evaluate-daily-alerts.ts` simulated trailing-stop breach evaluations (`checkTrailingStops: true`). `scheduler.ts` scheduled daily trailing-stop surveillance at market close. `types.ts` hardcoded provider assumptions (`SCREENER_EXPORT`, `BHAV_COPY`).
- **Remediation:**
  1. Deleted `evaluate-daily-alerts.ts`.
  2. Created `system-maintenance.ts` for technical queue housekeeping.
  3. Replaced provider-specific import types with generic `fileType: z.string().default('GENERIC_CSV')`.
  4. Updated `scheduler.ts` to schedule only technical maintenance (`scheduled-system-maintenance`) and snapshot integrity audits (`nightly-snapshot-integrity-audit`).

### 3.7 Mobile Readiness Presentation
- **Before:** `apps/web/lib/auth.ts` included a pseudo-bearer-token check (`token === env.NEXTAUTH_SECRET`) simulating mobile client authentication.
- **Remediation:** Removed the pseudo-bearer-token check. Retained a clean web session helper for personal workstation mode. Explicitly noted that mobile client authentication is deferred to Phase 8.

### 3.8 Frontend Truthfulness & Fixture Demarcation
- **Before:** Mock companies, financial metrics (P/E 31.5, ROCE 58.2%), and stage verdicts (PASSED, score 82, FAIR valuation) were presented as live or active.
- **Remediation:** All demonstration data across API routes, screener, dashboard, and company views is explicitly marked `[DEMO FIXTURE]` with `isDemoData: true`. All stage verdicts default to `PENDING` or `NOT_EVALUATED`.

---

## 4. Features Removed, Disabled, or Converted into Placeholders

| Feature | Action Taken | Rationale |
|---|---|---|
| Hard Red Flag Automated 422 Block | **REMOVED** | Decision 20 is pending user authorization. |
| 10-Character Justification Minimum | **REMOVED** | Invented policy threshold. |
| Client-Side Position Sizing Calculator | **REMOVED** | Domain math belongs in `packages/core`. |
| Client-Side Risk/Reward Evaluation | **REMOVED** | Financial logic belongs in `packages/core`. |
| Hardcoded 50-EMA / 200-EMA Checklist | **REMOVED** | Decisions 13 & 14 are pending user approval. |
| Hardcoded 25% / 15% / 20% Portfolio Caps | **REMOVED** | Decisions 15, 16, & 17 are pending user approval. |
| Automated Trailing Stop Exit Signals | **REMOVED** | Decisions 18 & 19 are pending user approval. |
| Worker Trailing Stop Evaluation Job | **REMOVED** | Worker must not evaluate trading decisions. |
| Provider-Specific CSV Enum | **REMOVED** | Data parsing belongs in `packages/data-providers`. |
| Pseudo-Bearer Token Mobile Auth Check | **REMOVED** | Mobile auth is deferred to Phase 8. |
| Stage A API Endpoint | **CONVERTED TO PLACEHOLDER** | Returns `NOT_IMPLEMENTED` awaiting core engine. |
| Stage E & F Screens | **CONVERTED TO SCAFFOLDING** | Neutral layouts awaiting core engine integration. |

---

## 5. Features Intentionally Retained

1. **Next.js 14 App Router Workstation Architecture:** High-density financial workstation layout with dark obsidian theme, Lucide icons, and `tabular-nums` typography.
2. **Hardened HTTP Security Headers:** CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, and Permissions-Policy in `next.config.mjs` and `middleware.ts`.
3. **Request Tracing & Structured JSON Logging:** Canonical `X-Request-Id` UUID injection and structured JSON logging in both web (`StructuredLogger`) and worker (`WorkerLogger`).
4. **RFC 7807 Error Envelope Standard:** Uniform `ApiResponse<T>`, `PaginatedApiResponse<T>`, and `ApiErrorResponse` envelopes.
5. **pg-boss Background Worker Queue Engine:** Queue manager with connection retries, exponential backoff, worker concurrency pools, and graceful shutdown signal handlers (`SIGINT`/`SIGTERM`) respecting `WORKER_DRAIN_TIMEOUT_MS`.
6. **Financial Workstation Formatters:** Formats Indian currency (INR Lakhs/Crores), sign-aware percentages, financial ratios, and IST dates. Fully covered by automated tests.
7. **20-Decision Governance Register:** Dedicated live viewer in `/settings` transparently displaying all 20 canonical decisions as `PENDING USER DECISION`.

---

## 6. Cross-Workstream Dependencies for Phase 1B

When Phase 1B begins, Workstream A will connect to Workstream B packages without architectural refactoring:
- **`packages/contracts`:** Local DTO definitions will be superseded by shared Zod contracts.
- **`packages/core`:** The placeholder at `/api/v1/analyses/stage-a` and the Stage E/F/G screens will invoke pure TypeScript calculation engines once user decisions are finalized.
- **`packages/db`:** Prisma client and repositories will replace demonstration fixtures in web route handlers and worker staging handlers.
- **`packages/data-providers`:** Generic file staging will hand off CSV streams to specialized provider adapters.

---

## 7. Verification Commands and Results

All checks supported by the current repository state were executed:

### Check 1: Unit Test Suite (Vitest)
```bash
./packages/core/node_modules/vitest/vitest.mjs run apps/web/lib/formatters.test.ts apps/worker/src/queue.test.ts
```
**Result:** **PASSED (100%)**
```
Test Files  2 passed (2)
     Tests  14 passed (14)
  Duration  371ms
```
- `apps/web/lib/formatters.test.ts`: 7 tests passed (INR notation, Crores/Lakhs, percentage signs, ratios, IST dates).
- `apps/worker/src/queue.test.ts`: 7 tests passed (generic file ingestion schema, system maintenance schema, snapshot integrity schema, registry validation, and handler execution).

### Check 2: Worker Daemon TypeScript Typecheck
```bash
./packages/core/node_modules/typescript/bin/tsc --project apps/worker/tsconfig.json --noEmit
```
**Result:** **PASSED (Exit code 0, 0 errors)**

### Check 3: Worker Daemon Compilation & Build
```bash
./packages/core/node_modules/typescript/bin/tsc --project apps/worker/tsconfig.json
```
**Result:** **PASSED (Exit code 0)**  
Compiled clean ES modules into `apps/worker/dist/` (`index.js`, `queue.js`, `scheduler.js`, `lifecycle.js`, `jobs/`, `config/`, `lib/`).

### Check 4: Compiled Worker Module Verification
```bash
node -e "import('./apps/worker/dist/jobs/types.js').then(m => console.log('Worker types module loaded:', Object.keys(m.QUEUES)))"
```
**Result:** **PASSED**
```
Worker types module loaded: [ 'FILE_INGESTION', 'SYSTEM_MAINTENANCE', 'NIGHTLY_AUDIT' ]
```

---

## 8. Remaining Blockers

There are zero technical or architectural blockers within Workstream A.
The following items are intentional cross-phase dependencies:
1. **User Policy Decisions 1–20:** Awaiting explicit user approval before threshold values are configured in `packages/core`.
2. **Phase 1B Package Integration:** Linking `packages/contracts`, `packages/core`, and `packages/db` into `apps/web` and `apps/worker` will take place in Phase 1B after Workstream A and B foundations are accepted.

---

## 9. Final Governance Confirmations

1. **20 Decisions Pending:** I confirm that all 20 canonical investment policy decisions remain strictly **PENDING USER DECISION**. Zero financial thresholds, caps, or scoring formulas have been hardcoded.
2. **Strict Operation Safety:** I confirm that **NO** production deployments, migrations, database alterations, or Git operations (`git init`, `add`, `commit`, `push`, `branch`, `merge`) were performed.
3. **Scope Integrity:** I confirm that **NO** files outside of `apps/web/**` and `apps/worker/**` were modified. `packages/**`, root files, and `docs/**` remain untouched.
