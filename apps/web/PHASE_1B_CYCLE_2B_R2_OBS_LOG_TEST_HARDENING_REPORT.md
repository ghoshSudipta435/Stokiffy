# STOKIFFY — PHASE 1B CYCLE 2B-R2 IMPLEMENTATION REPORT
## Duplicate Logging Cleanup (OBS-LOG-01) & Worker Reliability Test Hardening (OBS-TEST-01)

**Author:** Antigravity (Principal Application Architect & Monorepo Infrastructure Owner)  
**Repository:** `/Users/sg/Dev/PROJECTS/Stokiffy`  
**Phase:** 1B — Cycle 2B-R2  
**Authorization:** Explicitly Authorized by Project Owner (OBS-LOG-01 & OBS-TEST-01 Only)  
**Final Status:** **PASS WITH CONDITIONS** *(OBS-LOG-01 and direct handler exception tests pass; two real sidecar concurrency races were reproduced and documented without unauthorized sidecar redesign)*  
**Date:** November 18, 2026  

---

## 1. Executive Summary

Antigravity has completed the targeted Cycle 2B-R2 reliability hardening authorized by the Project Owner:

1. **OBS-LOG-01 (RESOLVED — PASS):** Eliminated duplicate error logging for retryable failures inside [`QueueManager.processJob()`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.ts#L82-L194). Every failed attempt now emits **exactly one** authoritative structured error log carrying `jobId`, `jobName` (queue), `failureCategory`, `retryable`, `retryCount`, `retryLimit`, `exhausted`, `error`, and `stack` (never logging sensitive payload data).
2. **OBS-TEST-01A — Direct Handler Exceptions (RESOLVED — PASS):** Added 4 new tests in [`apps/worker/src/queue.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.test.ts) directly verifying unhandled exceptions thrown by `JobDefinition.handler` inside `QueueManager.processJob()` (both intermediate and retry-exhausted attempts), single-log guarantees, original error preservation, and permanent-failure cancellation regression.
3. **OBS-TEST-01B — Concurrent Sidecar Updates (REPRODUCED TWO REAL RACES — DOCUMENTED WITHOUT UNAUTHORIZED REDESIGN):**
   - **Race #1 — Torn / Corrupted JSON Write (Observed Live on Real Disk):** Two concurrent `fs.promises.writeFile()` calls onto the same sidecar file produced `SyntaxError: Unexpected non-whitespace character after JSON at position 405 (line 14 column 2)` on macOS APFS due to non-atomic `O_TRUNC` overwrites of differing lengths.
   - **Race #2 — Lost-Update Regression (Deterministically Reproduced in Both Worker and Web Tests):** Controlled promise interleaving proved that unguarded `readFile → JSON.parse → writeFile` allows a slower `PROCESSING` write to overwrite a committed `COMPLETED` status and erase `processedCount` and `completedAt`.
   - Per Section 6 (*"Stop that remediation pending separate project-owner authorization"*), neither `CSVIngestionService.syncJobStatus()` nor `IngestionStatusService.updateJobStatus()` was altered.

---

## 2. Preflight Findings

- **Repository Root & Identity:** Confirmed `stokiffy` monorepo at `/Users/sg/Dev/PROJECTS/Stokiffy`. No `.git` directory exists; did not initialize Git.
- **Reports Reviewed:** Verified Cycle 2B implementation report (`PHASE_1B_CYCLE_2B_ISS03_ISS04_IMPLEMENTATION_REPORT.md`) and Cycle 2B-R1 post-implementation audit (`PHASE_1B_CYCLE_2B_R1_POST_IMPLEMENTATION_AUDIT_REPORT.md`).
- **Pre-Edit Baseline Tests:** Verified fresh prior to edits — `apps/worker`: 36 / 36 passed; `apps/web`: 40 / 40 passed.
- **Preservation:** All existing source files, tests, and prior reports preserved intact.

---

## 3. Exact Files Modified

| File | Category | Reason |
| :--- | :---: | :--- |
| [`apps/worker/src/queue.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.ts) | Source | **OBS-LOG-01:** Scoped `try/catch` around `def.handler()` and `boss.cancel()` so retryable failures and unhandled exceptions each emit exactly one structured error log. |
| [`apps/worker/src/queue.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.test.ts) | Test | **OBS-LOG-01 & OBS-TEST-01:** Added 4 tests verifying single-log guarantee, direct unhandled handler exceptions (intermediate & exhausted), and permanent-cancel log/propagation regression. |
| [`apps/worker/src/jobs/csv-ingestion.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/jobs/csv-ingestion.test.ts) | Test | **OBS-TEST-01:** Added 2 deterministic concurrent sidecar tests (distinct-job isolation + same-job read-modify-write lost-update race proof). |
| [`apps/web/lib/services/ingestion-pipeline.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/web/lib/services/ingestion-pipeline.test.ts) | Test | **OBS-TEST-01:** Added 2 deterministic concurrent web status sidecar tests (distinct-tenant isolation + same-job read-modify-write lost-update race proof). |
| [`apps/web/PHASE_1B_CYCLE_2B_R2_OBS_LOG_TEST_HARDENING_REPORT.md`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/web/PHASE_1B_CYCLE_2B_R2_OBS_LOG_TEST_HARDENING_REPORT.md) | Report | Authorized Cycle 2B-R2 implementation report. |

*(Zero files modified in `packages/**`, `docs/**`, `apps/worker/src/jobs/services/csv-ingestion.service.ts`, or `apps/web/lib/services/ingestion-status.service.ts`.)*

---

## 4. OBS-LOG-01 Root Cause & Fix

### Root Cause
In Cycle 2B [`apps/worker/src/queue.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.ts), the entire body of `QueueManager.processJob()` was wrapped inside a single outer `try { ... } catch (err) { ... }`. When a handler returned a retryable failure result (`!result.success && isRetryableJobResult(result)`):
1. Lines 130–139 logged `jobLogger.error(...)` with `{ failureCategory, retryable: true, exhausted }`.
2. Line 141 threw `new Error(result.error || 'Job handler indicated retryable failure')`.
3. Lines 142–145 immediately caught that exact self-thrown error and emitted a **second** `jobLogger.error(...)` (`Job <id> throwing to pg-boss retry/failure pipeline: ...`) before rethrowing.

### Chosen Logging Boundary & Fix
Logging is now cleanly owned at each distinct orchestration outcome inside `QueueManager.processJob()` without an outer re-catching `try/catch`:
1. **Unhandled `def.handler()` exception:** Narrow `try/catch` around `await def.handler(...)` logs **once** (`failureCategory: 'UNHANDLED_EXCEPTION'`, `retryable: true`, `retryCount`, `retryLimit`, `exhausted`, plus original `Error` & `stack`) and rethrows the original error untouched.
2. **Permanent non-retryable result:** Logs **once** via `jobLogger.warn(...)` (`retryable: false`) and cancels via `await this.boss.cancel(queueName, job.id)`. If `boss.cancel()` throws (or `this.boss` is uninitialized), logs **once** via `jobLogger.error(...)` and throws so pg-boss never marks the failed job `completed`.
3. **Retryable failure result:** Constructs `retryError`, logs **once** via `jobLogger.error(...)` (`failureCategory`, `retryable: true`, `retryCount`, `retryLimit`, `exhausted`, `retryError` with stack), and throws directly to pg-boss.

---

## 5. Logging Behavior Before & After

| Attempt Outcome | Before Cycle 2B-R2 | After Cycle 2B-R2 |
| :--- | :--- | :--- |
| **Retryable failure result (`PERSISTENCE_ERROR` / `RETRYABLE_INFRA_ERROR`)** | **2 `error` logs** (structured log + duplicate catch-block log) | **1 `error` log** (structured `jobId`, `jobName`, `failureCategory`, `retryable`, `retryCount`, `retryLimit`, `exhausted`, `error`, `stack`) |
| **Unhandled exception thrown by `def.handler()`** | 1 `error` log (missing `retryCount`/`retryLimit`/`exhausted` metadata) | **1 `error` log** (`failureCategory: 'UNHANDLED_EXCEPTION'`, `retryable: true`, `retryCount`, `retryLimit`, `exhausted`, original `error` + `stack`) |
| **Permanent failure (`boss.cancel()` succeeds)** | 1 `warn` log, 0 `error` logs | **1 `warn` log, 0 `error` logs** (unchanged + includes `retryCount`/`retryLimit`) |
| **Permanent failure (`boss.cancel()` throws)** | 1 `warn` log + 1 `error` log (generic catch message) | **1 `warn` log + 1 specific cancellation `error` log** (propagates error safely) |

---

## 6. Direct `processJob()` Exception Test Design & Results

Added to [`apps/worker/src/queue.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/queue.test.ts) (`Cycle 2B-R2: OBS-LOG-01 Single Failure Log & OBS-TEST-01 Direct Handler Exceptions`):
1. **`OBS-LOG-01: emits exactly one structured error log for a retryable failure attempt`** — PASS. Asserts `console.error` called exactly once, validates JSON payload fields (`jobId`, `jobName`, `failureCategory`, `retryable: true`, `retryCount: 1`, `retryLimit: 3`, `exhausted: false`, `error`, `stack`), confirms sensitive payload field (`secretToken`) is never logged, confirms `boss.cancel` is not called.
2. **`OBS-TEST-01: propagates direct unhandled handler exception for bounded retry with single structured log`** — PASS. Handler throws a `TypeError`; verifies exact original `Error` instance is rethrown (not swallowed or falsely completed), `boss.cancel`/`boss.complete` not called, and exactly 1 structured error log emitted with `UNHANDLED_EXCEPTION`.
3. **`OBS-TEST-01: logs exhausted=true once when unhandled handler exception hits retryLimit`** — PASS. Verifies `retryCount: 3, retryLimit: 3` logs `exhausted: true` once and propagates original error.
4. **`OBS-LOG-01 regression: emits zero error logs on successful permanent cancel, and single error log if cancel throws`** — PASS. Verifies deterministic failure cancel path (`1 warn, 0 error`) and cancel transport error path (`1 error`, propagates).

---

## 7. Concurrent Sidecar Update Test Design & Results

Added deterministic concurrency tests to both [`apps/worker/src/jobs/csv-ingestion.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/worker/src/jobs/csv-ingestion.test.ts) and [`apps/web/lib/services/ingestion-pipeline.test.ts`](file:///Users/sg/Dev/PROJECTS/Stokiffy/apps/web/lib/services/ingestion-pipeline.test.ts):
1. **Distinct-job / distinct-tenant concurrent isolation (Worker & Web):** Runs concurrent `Promise.all` updates targeting separate job tickets alongside an untouched peer ticket. **PASS** — both updated sidecars remain valid JSON, tenant isolation (`userId` / `getJobForUser`) is strictly preserved, and unrelated peer sidecars remain byte-for-byte untouched.
2. **Same-job deterministic interleaved read-modify-write test (Worker & Web):** Uses controlled deferred promises on `fs.promises.readFile` (zero timing flakiness) so Update A (`PROCESSING`) pauses after reading `QUEUED` while Update B (`COMPLETED`, `processedCount: 5` / `12`, `completedAt`) runs to completion, then releases Update A. **DETERMINISTICALLY REPRODUCES LOST-UPDATE RACE** (see Section 8).

---

## 8. Reproduced Race Conditions (Exact Evidence — Unremediated Per Scope Boundary)

### Race Condition #1: Torn / Corrupted JSON Sidecar on Concurrent `writeFile()` (Observed Live on Real Disk)
- **Trigger:** Running two concurrent `service.syncJobStatus('job_concurrent_target', ...)` calls via `Promise.all` writing JSON strings of different lengths (`PROCESSING` vs `VALIDATING`) directly to the same file path (`fs.promises.writeFile(jobFilePath, ...)`).
- **Exact Observed Failure:**
  ```text
  SyntaxError: Unexpected non-whitespace character after JSON at position 405 (line 14 column 2)
  ❯ readJobSidecar src/jobs/csv-ingestion.test.ts:37:17
  ```
- **Root Cause:** `fs.promises.writeFile()` opens the target file directly with `O_WRONLY | O_CREAT | O_TRUNC`. When a shorter write overlaps a longer write on the same inode, trailing bytes from the longer payload remain past the end of the shorter JSON document, corrupting the sidecar file so subsequent reads fail with `JOB_STATUS_READ_ERROR`.
- **Test Hygiene Note:** Because raw OS `Promise.all` interleaving on the same file is timing-dependent (flaky), the distinct-job isolation test targets separate job tickets while the same-job concurrency defect is deterministically pinned by Race Condition #2 below; Race #1 is explicitly documented here so neither defect is hidden.

### Race Condition #2: Lost-Update Regression Under Interleaved Read-Modify-Write (Deterministically Reproduced)
- **Trigger:** Update A (`PROCESSING`) reads `QUEUED`, pauses before write; Update B (`COMPLETED`, `processedCount: 5`, `completedAt`) reads `QUEUED` and commits `COMPLETED` to disk; Update A resumes and writes its stale snapshot (`PROCESSING`).
- **Observed Result (Both `CSVIngestionService.syncJobStatus` and `IngestionStatusService.updateJobStatus`):**
  - Terminal `COMPLETED` status regressed back to `PROCESSING`.
  - `processedCount` and `completedAt` committed by Update B were **permanently lost** (`undefined`).
  - Unrelated job sidecars remained untouched and `userId` remained preserved.

### Narrow Remediation Assessment (Stopping Pending Separate Project Owner Authorization)
- **Would a narrowly scoped atomic local-file update (`writeFile(tmp)` + `fs.promises.rename()`) be necessary?**
  - **YES — necessary to prevent Race #1 (torn/corrupted JSON files on disk)** in single-host workstation deployments.
  - **HOWEVER, atomic rename alone does NOT prevent Race #2 (lost updates from interleaved `readFile → writeFile`).** Preventing Race #2 on local disk requires either an in-process per-job write mutex / advisory file lock (single-host only) or **ISS-01** (database-backed `IngestionJob` row with transactional state-transition guards / `UPDATE ... WHERE status NOT IN ('COMPLETED', 'FAILED')`).
- **Per Section 6:** No sidecar persistence changes were made in Cycle 2B-R2. Both defects remain explicitly open pending separate Project Owner authorization.

---

## 9. Exact Verification Commands & Outcomes

| # | Command | Outcome | Exact Count / Detail |
| :---: | :--- | :---: | :--- |
| 1 | `pnpm --filter @stokiffy/worker exec vitest run src/queue.test.ts` | **PASS (Exit 0)** | 21 / 21 passed *(+4 new)* |
| 2 | `pnpm --filter @stokiffy/worker exec vitest run src/jobs/csv-ingestion.test.ts` | **PASS (Exit 0)** | 15 / 15 passed *(+2 new; Race #2 deterministically reproduced)* |
| 3 | `pnpm --filter @stock-assistant/web exec vitest run lib/services/ingestion-pipeline.test.ts` | **PASS (Exit 0)** | 22 / 22 passed *(+2 new; Race #2 deterministically reproduced)* |
| 4 | `pnpm turbo run test --force` | **PASS (Exit 0)** | **164 / 164 passed** *(10/10 tasks, +8 new over 156 baseline)* |
| 5 | `pnpm turbo run build` | **PASS (Exit 0)** | 6 / 6 packages built cleanly |
| 6 | `pnpm turbo run typecheck` | **PASS (Exit 0)** | 10 / 10 tasks — 0 TypeScript errors |
| 7 | `pnpm turbo run lint` | **PASS (Exit 0)** | 6 / 6 tasks — `next lint`: ✔ No ESLint warnings or errors |

---

## 10. Full Monorepo Regression Results

| Workspace | Prior Tests (Cycle 2B) | New Tests (Cycle 2B-R2) | Total Tests | Status |
| :--- | :---: | :---: | :---: | :---: |
| `@stock-assistant/core` | 35 | 0 | 35 | **PASS** |
| `@stock-assistant/contracts` | 14 | 0 | 14 | **PASS** |
| `@stock-assistant/data-providers` | 25 | 0 | 25 | **PASS** |
| `@stock-assistant/db` | 6 | 0 | 6 | **PASS** |
| `@stock-assistant/web` | 40 | **+2** | **42** | **PASS** |
| `@stokiffy/worker` | 36 | **+6** | **42** | **PASS** |
| **Full Monorepo Total** | **156** | **+8** | **164 / 164** | **100% PASS** |

---

## 11. Remaining Limitations & Technical Debt

1. **Sidecar Concurrency Races (Race #1 Torn JSON Write & Race #2 Lost Update):** Explicitly reproduced and open pending separate Project Owner authorization (narrow atomic-rename + per-job lock for single-host, or full **ISS-01** DB-backed `IngestionJob` persistence).
2. **ISS-01 (UNRESOLVED & UNAUTHORIZED):** Shared object storage & DB-backed `IngestionJob` model for multi-replica production.
3. **ISS-02 (UNRESOLVED & UNAUTHORIZED):** `FinancialStatement` DB-level compound uniqueness (accounting for PostgreSQL `NULL` semantics on `fiscalQuarter`).
4. **BLK-NULL-01 (Kilo `packages/db` Blocker):** 16 core `FinancialStatement` `Decimal` columns in `packages/db/prisma/schema.prisma:77-92` remain non-nullable; temporary `as any` casts in worker remain untouched pending Kilo's authorized migration.
5. **OBS-DRIFT-01 (LOW):** Byte-identical `path-resolver.ts` copies remain in `apps/web` and `apps/worker` (no shared package created).

---

## 12. Ownership & Authorization Compliance

- **Authorized Scope Only:** Modified only `apps/worker/src/queue.ts`, `apps/worker/src/queue.test.ts`, `apps/worker/src/jobs/csv-ingestion.test.ts`, and `apps/web/lib/services/ingestion-pipeline.test.ts`, plus this report.
- **Kilo-Owned Packages (`packages/**`) & `docs/**`:** **100% UNTOUCHED.**
- **Previous Reports:** **100% UNTOUCHED.**
- **Schema / Migrations / Neon / Git / Deployment:** **NONE EXECUTED.**
- **Policy Freeze:** All 20 canonical investment decisions remain `PENDING USER DECISION`; Stage A remains `NOT_IMPLEMENTED`.
