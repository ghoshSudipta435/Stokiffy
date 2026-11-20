# STOKIFFY — PHASE 1B CYCLE 2B-R3 IMPLEMENTATION REPORT
## Single-Host Sidecar Concurrency Remediation

**Agent:** Antigravity  
**Role:** Principal Application Architect & Monorepo Infrastructure Owner  
**Phase / Cycle:** Phase 1B — Cycle 2B-R3  
**Repository:** `/Users/sg/Dev/PROJECTS/Stokiffy`  
**Authorization:** Explicitly authorized by Project Owner (narrowly scoped single-host sidecar concurrency remediation)  
**Date:** 2026-11-18  
**Final Verdict:** **PASS** (Single-Host Scope Verified — Real Multi-Process Contention Proven; Multi-Host/Distributed Persistence Remains Out-of-Scope under ISS-01)

---

## 1. Preflight Summary & Verified Sidecar Writers / Readers

### 1.1 Environment & Baseline Verification
- **Workspace Root:** `/Users/sg/Dev/PROJECTS/Stokiffy` (no `.git` repository present; no Git operations performed).
- **Runtime:** macOS arm64, Node.js `v22.16.0`, pnpm `9.12.3`, Turborepo `2.11.11`.
- **Pre-Cycle Baseline:** 164 / 164 monorepo tests passing (`core`: 35, `contracts`: 14, `data-providers`: 25, `db`: 6, `web`: 42, `worker`: 42).
- **Prior Reports Reviewed (Read-Only):**
  - `apps/web/PHASE_1B_CYCLE_2B_R2_OBS_LOG_TEST_HARDENING_REPORT.md`
  - `apps/web/PHASE_1B_CYCLE_2B_R1_POST_IMPLEMENTATION_AUDIT_REPORT.md`

### 1.2 Complete Inventory of Sidecar Writers and Readers

Every filesystem sidecar writer and reader across `apps/web/**` and `apps/worker/**` was audited before modifying code:

| Role | Process | File & Symbol | Operation | Path Format |
|---|---|---|---|---|
| **Writer** | Web | `apps/web/lib/services/ingestion-status.service.ts` → `IngestionStatusService.createJob()` (called by `IngestionQueueService.enqueueIngestionJob()`) | Creates initial `QUEUED` sidecar record | `<JOBS_DIR>/<safeJobId>.json` |
| **Writer** | Web | `apps/web/lib/services/ingestion-status.service.ts` → `IngestionStatusService.updateJobStatus()` (called by `IngestionQueueService.enqueueIngestionJob()` rollback on enqueue failure) | Read-modify-write status & error fields | `<JOBS_DIR>/<safeJobId>.json` |
| **Writer** | Worker | `apps/worker/src/jobs/services/csv-ingestion.service.ts` → `CSVIngestionService.syncJobStatus()` (called by `processImport()` and `handleProcessFileIngestion()`) | Read-modify-write `PROCESSING`, `VALIDATING`, `COMPLETED`, `FAILED` transitions and row/error metadata | `<JOBS_DIR>/<safeJobId>.json` |
| **Reader** | Web | `apps/web/lib/services/ingestion-status.service.ts` → `getJobById()` / `getJobForUser()` (called by `GET /api/v1/ingestion/jobs/[id]` and `IngestionQueueService.getJobStatus()`) | Disk-first read + JSON parse (surfaces `JOB_STATUS_READ_ERROR` on corrupt JSON) | `<JOBS_DIR>/<safeJobId>.json` |
| **Reader** | Web | `apps/web/lib/services/ingestion-status.service.ts` → `findReusableJobForUser()` (called by `FileStagingService.stageFile()`) | Directory scan filtering strictly `file.endsWith('.json')`, disk-first dedup lookup | `<JOBS_DIR>/*.json` |

**Key Pre-Implementation Compatibility Check:** `findReusableJobForUser()` filters strictly on `file.endsWith('.json')`. Therefore, hidden `.lock`, `.tmp`, and `.reclaim.*` artifacts placed in `<JOBS_DIR>` are automatically invisible to deduplication scans and job lookups.

---

## 2. Root Causes of the Two Cycle 2B-R2 Sidecar Concurrency Races

Cycle 2B-R2 (`OBS-TEST-01`) empirically reproduced two distinct concurrency bugs in the original sidecar persistence implementation:

### Race 1 — Torn / Corrupted JSON Writes (`SyntaxError: Unexpected non-whitespace character after JSON`)
- **Cause:** Both `IngestionStatusService` (`apps/web`) and `CSVIngestionService` (`apps/worker`) wrote directly to `<JOBS_DIR>/<safeJobId>.json` via `fs.promises.writeFile(filePath, JSON.stringify(...), 'utf-8')`.
- **Failure Mechanism:** `writeFile()` opens the existing inode with `O_WRONLY | O_TRUNC` and streams bytes directly into the live target file. When two concurrent writers overlap with payloads of different byte lengths (e.g., a longer `COMPLETED` payload overlapping a shorter `PROCESSING` payload), the shorter write truncates or interleaves into the same inode while the longer write flushes trailing bytes, leaving syntactically corrupt JSON on disk (e.g., `Unexpected non-whitespace character after JSON at position 405`). Concurrent readers (`getJobById()`) can also observe half-written files.

### Race 2 — Read-Modify-Write Lost Updates & Terminal-State Regression
- **Cause:** Both `IngestionStatusService.updateJobStatus()` and `CSVIngestionService.syncJobStatus()` performed an unguarded `readFile -> JSON.parse -> spread merge -> writeFile` sequence with:
  1. **No cross-process or per-job mutual exclusion:** Two overlapping writers could both read the same `QUEUED` or `PROCESSING` snapshot before either wrote back.
  2. **No monotonic / terminal-state guard:** A stale `PROCESSING` writer that read an earlier snapshot (or arrived late after a retry/overlap) blindly overwrote a committed `COMPLETED` or `FAILED` record, regressing `status` back to `PROCESSING` and erasing terminal metadata (`processedCount`, `validRowCount`, `warningsCount`, `completedAt`, `error`, `failureCategory`, `errorsSummary`).

---

## 3. Final Architecture & Concurrency Design

A dedicated, zero-dependency, POSIX-safe single-host sidecar persistence module was implemented symmetrically in `apps/web/lib/storage/sidecar-store.ts` and `apps/worker/src/lib/sidecar-store.ts` (verified byte-identical via `diff -u`), with three layered guarantees:

### 3.1 Atomic JSON Writes (`writeJsonAtomically`)
1. Creates a unique hidden temporary file in the **same directory** as the target sidecar (`path.join(dir, '.<baseName>.<pid>.<uuid>.tmp')`) using exclusive creation (`fs.promises.open(tempPath, 'wx', 0o600)`).
2. Writes the full serialized JSON payload (`handle.writeFile(serialized, 'utf-8')`).
3. Flushes file data to disk (`handle.sync()`) and closes the descriptor (`handle.close()`).
4. Atomically replaces the target sidecar via POSIX `rename(2)` (`fs.promises.rename(tempPath, targetPath)`), guaranteed atomic on the same filesystem so concurrent readers always observe either the complete previous JSON or the complete next JSON—never a partial or torn file.
5. **Guaranteed Cleanup:** In `finally`, if any step prior to `rename()` throws, the handle is closed and the temporary `.tmp` file is unlinked, leaving the original target JSON intact and zero orphaned temp files behind.

### 3.2 Per-Job Cross-Process Lock (`withJobSidecarLock`)
- **Lock Path:** `path.join(jobsDirectory, '.<safeJobId>.lock')` — scoped strictly **per job** (never a global directory lock), so updates to `job_A` never block `job_B`.
- **Acquisition:** Uses atomic POSIX file creation `fs.promises.open(lockPath, 'wx', 0o600)` (`O_CREAT | O_EXCL`), writes `{ pid: process.pid, token: randomUUID(), acquiredAt }`, calls `handle.sync()`, and closes the descriptor.
- **Contention & Bounded Waiting:** On `EEXIST`, waits using bounded jittered exponential backoff (`initialRetryDelayMs: 5`, `maxRetryDelayMs: 25`, default `lockTimeoutMs: 5000`) to avoid lockstep retries and prevent indefinite hangs. Exceeding `lockTimeoutMs` throws a structured `SIDECAR_LOCK_TIMEOUT` error.
- **Safe Dead-Process Stale Lock Reclamation (`tryReclaimDeadProcessLock`):**
  - Never breaks a lock blindly by age alone.
  - Only inspects a contended lockfile after `staleCheckGraceMs` (default `100ms`).
  - Parses `{ pid, token }` and checks OS process liveness via `process.kill(pid, 0)`:
    - If `process.kill(pid, 0)` succeeds or throws `EPERM` (live process owned by another UID), the lock is **NEVER broken** — contenders continue waiting until release or timeout.
    - **Only** if `process.kill(pid, 0)` throws `ESRCH` (PID is definitively dead on the local host), the contender atomically claims the orphaned lock via `fs.promises.rename(lockPath, '<lockPath>.reclaim.<pid>.<uuid>')` and unlinks the renamed file so two contenders cannot race to unlink a newly acquired lock.
- **Reliable Owner-Verified Release:** In `finally`, verifies `parsed.token === token` before unlinking `lockPath`, ensuring locks are always released even if the critical section throws an exception.

### 3.3 Monotonic Merge & Terminal-State Guard (`mergeJobSidecarRecord`)
Executed strictly **inside** `withJobSidecarLock` immediately after reading the latest JSON from disk:
1. **Rule 1 — Strict Terminal Immutability (`COMPLETED`, `FAILED`):** Once `existing.status` is `COMPLETED` or `FAILED`, any subsequent update (regression to `PROCESSING`/`VALIDATING`/`QUEUED`, conflicting flip `COMPLETED <-> FAILED`, or late metadata-only mutation) returns `{ record: existing, ignoredStaleTransition: true, reason }` without mutating or rewriting the file, and logs a structured warning.
2. **Rule 2 — No Backward Regression to `QUEUED`:** If `existing.status` is `PROCESSING` or `VALIDATING` and `incomingStatus === 'QUEUED'`, the transition is rejected (`ignoredStaleTransition: true`) and logged.
3. **Rule 3 — Legitimate Retry & Progress Transitions Preserved:** Transitions `QUEUED -> PROCESSING -> VALIDATING -> PROCESSING -> VALIDATING -> COMPLETED/FAILED` remain fully supported.
4. **Rule 4 — Metadata & Identity Preservation:** Only defined incoming fields (`value !== undefined`) are applied; `undefined` fields never clobber persisted metadata (`processedCount`, `validRowCount`, `warningsCount`, `completedAt`, `error`, `failureCategory`, `errorsSummary`), and immutable identity fields (`jobId`, `userId`, `storageKey`, `sha256Hash`, `enqueuedAt`) cannot be overwritten.

---

## 4. Why This Mechanism Coordinates Web and Worker Across Processes on a Single Host

An in-process mutex (such as a JS `Map<string, Promise>`) only serializes coroutines inside a single Node.js event loop and provides **zero protection** when the Next.js web server (`apps/web`) and the background worker (`apps/worker`) run as separate OS processes sharing `<JOBS_DIR>`.

This design coordinates independent web and worker OS processes on the same host because:
1. **Shared Kernel-Enforced Mutual Exclusion:** Both `apps/web` and `apps/worker` resolve the exact same canonical `<JOBS_DIR>` (established in Cycle 2B ISS-04) and contend on the exact same lockfile path `<JOBS_DIR>/.<safeJobId>.lock`. The OS kernel enforces `O_CREAT | O_EXCL` atomicity across all local processes on the host.
2. **Shared Disk-First Read Inside the Lock:** Inside the critical section, both `IngestionStatusService.updateJobStatus()` and `CSVIngestionService.syncJobStatus()` read the latest committed JSON directly from disk before merging, eliminating stale cross-process snapshots (and refreshing `IngestionStatusService.memoryStore` with the newly committed record).
3. **Kernel-Atomic Reader Visibility:** `writeJsonAtomically()` uses same-directory `rename(2)`, so an uncoordinated reader in `apps/web` (`GET /api/v1/ingestion/jobs/[id]` or `findReusableJobForUser()`) sees an atomic inode swap and never reads half-written JSON.
4. **Local PID Liveness Semantics:** `process.kill(pid, 0)` operates against the shared single-host OS process table, safely distinguishing a live web/worker process from a crashed local process (`ESRCH`).

---

## 5. Exact List of Created & Modified Files

All changes were strictly confined to Antigravity-owned directories (`apps/web/**` and `apps/worker/**`):

### Created Files
1. `apps/web/lib/storage/sidecar-store.ts` — Shared single-host atomic write, per-job POSIX lockfile, and transition-guard module (web copy).
2. `apps/worker/src/lib/sidecar-store.ts` — Shared single-host atomic write, per-job POSIX lockfile, and transition-guard module (worker copy; byte-identical to web copy, verified via `diff -u` exit code `0`).
3. `apps/worker/src/lib/sidecar-store.test.ts` — Unit tests for lock release on throw, per-job non-blocking isolation, temp-file cleanup on rename failure, live-PID lock preservation, dead-PID (`ESRCH`) reclamation, transition-guard rules, and **real multi-process OS contention test**.
4. `apps/web/PHASE_1B_CYCLE_2B_R3_SIDECAR_CONCURRENCY_IMPLEMENTATION_REPORT.md` — This implementation report.

### Modified Files
5. `apps/web/lib/services/ingestion-status.service.ts` — Wired `createJob()` and `updateJobStatus()` through `withJobSidecarLock`, disk-first read inside lock, `mergeJobSidecarRecord`, structured warning on ignored stale transitions, and `writeJsonAtomically`.
6. `apps/web/lib/services/ingestion-pipeline.test.ts` — Replaced Cycle 2B-R2 lost-update reproduction test with 5 Cycle 2B-R3 remediation tests verifying atomic non-corruption, per-job locking, non-blocking unrelated jobs, `COMPLETED` & `FAILED` immutability, legitimate retry transitions, tenant isolation, and zero leftover `.tmp`/`.lock` files.
7. `apps/worker/src/jobs/services/csv-ingestion.service.ts` — Wired `syncJobStatus()` through `withJobSidecarLock`, existence check + disk read inside lock, `mergeJobSidecarRecord`, structured warning on ignored stale transitions, and `writeJsonAtomically` (preserving all Cycle 2B nullability workarounds and retry classifications untouched).
8. `apps/worker/src/jobs/csv-ingestion.test.ts` — Replaced Cycle 2B-R2 race reproduction test with 5 Cycle 2B-R3 remediation tests verifying worker concurrency, barrier-serialized interleaving, non-blocking distinct jobs, `COMPLETED` & `FAILED` immutability, legitimate retry flows, and zero leftover `.tmp`/`.lock` files.

### Ownership Confirmation
- `packages/core/**`: **UNTOUCHED**
- `packages/contracts/**`: **UNTOUCHED**
- `packages/db/**`: **UNTOUCHED**
- `packages/data-providers/**`: **UNTOUCHED**
- `docs/**`: **UNTOUCHED**
- All prior phase/cycle report files: **UNTOUCHED**

---

## 6. Code-Level Change Summary

1. **`apps/web/lib/storage/sidecar-store.ts` & `apps/worker/src/lib/sidecar-store.ts`:**
   - Exported `sanitizeSidecarJobId`, `withJobSidecarLock`, `writeJsonAtomically`, `mergeJobSidecarRecord`, `SidecarJobStatus`, `SidecarRecordBase`, `SidecarLockOptions`, and `MergeSidecarResult`.
   - Enforced `0o600` permissions on lockfiles and temporary files, `0o700` on created directories, `fsync()` before `close()`/`rename()`, owner-token verification on unlock, and dead-PID-only (`ESRCH`) lock reclamation via atomic rename.
2. **`apps/web/lib/services/ingestion-status.service.ts`:**
   - Added optional `lockOptions?: SidecarLockOptions` constructor argument (preserving full backward compatibility with existing callers).
   - `createJob()`: acquires `withJobSidecarLock(this.jobsDirectory, job.jobId, ...)` and persists via `writeJsonAtomically()`, updating `memoryStore` inside the lock.
   - `updateJobStatus()`: acquires `withJobSidecarLock(this.jobsDirectory, jobId, ...)`, reads latest JSON from disk inside the lock (falling back to `memoryStore` only if no sidecar file exists on disk), merges via `mergeJobSidecarRecord()`, logs a structured warning and skips disk rewrite when `ignoredStaleTransition === true`, otherwise writes via `writeJsonAtomically()` and updates `memoryStore`.
3. **`apps/worker/src/jobs/services/csv-ingestion.service.ts`:**
   - Added optional `lockOptions?: SidecarLockOptions` constructor argument (preserving full backward compatibility).
   - `syncJobStatus()`: acquires `withJobSidecarLock(this.jobsDirectory, jobTicketId, ...)`, checks file existence and reads latest JSON inside the lock, merges via `mergeJobSidecarRecord()`, logs structured `warn` when `ignoredStaleTransition === true`, otherwise persists via `writeJsonAtomically()`. Preserved all existing Cycle 2B Prisma null-handling casts and failure classification behavior.

---

## 7. Complete Test Coverage Matrix

| # | Test File | Test Case | Concurrency / Edge-Case Guarantee Verified | Result |
|---|---|---|---|---|
| 1 | `apps/worker/src/lib/sidecar-store.test.ts` | `releases the per-job lock reliably when the critical section throws an exception` | Lock released in `finally` on error; 0 `.lock` leftovers; next caller acquires immediately | PASS |
| 2 | `apps/worker/src/lib/sidecar-store.test.ts` | `uses per-job locks so an unrelated job is never blocked by a held lock` | Per-job lock granularity (`job_beta` progresses immediately while `job_alpha` is locked) | PASS |
| 3 | `apps/worker/src/lib/sidecar-store.test.ts` | `cleans up temporary files and preserves target JSON if atomic rename fails` | `.tmp` cleanup on simulated `rename()` error; original JSON untouched | PASS |
| 4 | `apps/worker/src/lib/sidecar-store.test.ts` | `never breaks a lock held by a live local PID and times out deterministically` | Live PID lock is never broken; throws `SIDECAR_LOCK_TIMEOUT` after bounded timeout | PASS |
| 5 | `apps/worker/src/lib/sidecar-store.test.ts` | `safely reclaims a stale lock belonging to a definitively dead local PID (ESRCH)` | Real exited child PID verified `ESRCH` is safely reclaimed via rename+unlink; 0 leftovers | PASS |
| 6 | `apps/worker/src/lib/sidecar-store.test.ts` | `enforces mergeJobSidecarRecord terminal immutability and non-regression rules` | `PROCESSING -> QUEUED` blocked; `COMPLETED` rejects `PROCESSING` and `FAILED` flips; retry flow allowed | PASS |
| 7 | `apps/worker/src/lib/sidecar-store.test.ts` | `prevents torn JSON and lost updates across two independent OS processes contending on the exact same sidecar` | **Real 2-process OS contention** (40 locked writes with varying payload sizes + continuous concurrent reader in 3rd process) → 0 parse errors, `COMPLETED` + `processedCount: 42` preserved, unrelated sidecar intact, 0 `.tmp`/`.lock`/`.reclaim` leftovers | PASS |
| 8 | `apps/worker/src/jobs/csv-ingestion.test.ts` | `isolates concurrent updates across distinct job tickets and preserves parseable JSON and tenant ownership` | Concurrent distinct jobs isolated, tenant-scoped, unrelated job untouched | PASS |
| 9 | `apps/worker/src/jobs/csv-ingestion.test.ts` | `prevents torn/corrupted JSON and metadata loss under heavy concurrent same-job updates` | 8 simultaneous `Promise.all` worker `syncJobStatus` calls of varying payload sizes → 0 torn JSON, `COMPLETED` + `processedCount`/`validRowCount`/`warningsCount`/`completedAt` preserved, 0 `.tmp`/`.lock` leftovers | PASS |
| 10 | `apps/worker/src/jobs/csv-ingestion.test.ts` | `serializes interleaved read-modify-write via per-job lock and prevents COMPLETED from regressing to PROCESSING` | Barrier-paused read-modify-write proves same-job serialization, non-blocking unrelated job, and `COMPLETED` non-regression | PASS |
| 11 | `apps/worker/src/jobs/csv-ingestion.test.ts` | `prevents committed FAILED state from regressing to PROCESSING and preserves error metadata` | Terminal `FAILED` rejects `PROCESSING`/`VALIDATING` and preserves `error`, `failureCategory`, `errorsSummary` | PASS |
| 12 | `apps/worker/src/jobs/csv-ingestion.test.ts` | `preserves legitimate retry and processing transitions (QUEUED -> PROCESSING -> VALIDATING -> PROCESSING -> COMPLETED)` | Full retry sequence succeeds, backward `QUEUED` ignored, metadata preserved | PASS |
| 13 | `apps/web/lib/services/ingestion-pipeline.test.ts` | `isolates concurrent updates across distinct tenant jobs and leaves unrelated sidecars untouched` | Concurrent web updates isolated across tenants, unrelated sidecar intact, 0 leftovers | PASS |
| 14 | `apps/web/lib/services/ingestion-pipeline.test.ts` | `prevents torn JSON writes and preserves COMPLETED metadata under heavy same-job Promise.all contention` | 6 simultaneous `Promise.all` web `updateJobStatus` calls → valid JSON, `COMPLETED` + metadata preserved, 0 leftovers | PASS |
| 15 | `apps/web/lib/services/ingestion-pipeline.test.ts` | `serializes interleaved read-modify-write on the same job without blocking unrelated jobs and blocks COMPLETED regression` | Barrier-paused web update proves serialization, unrelated job non-blocking, and `COMPLETED` + `processedCount: 12` preserved | PASS |
| 16 | `apps/web/lib/services/ingestion-pipeline.test.ts` | `prevents committed FAILED state from regressing and preserves error metadata` | Terminal `FAILED` rejects `PROCESSING` and `COMPLETED`, preserving `error` and `failureCategory` | PASS |
| 17 | `apps/web/lib/services/ingestion-pipeline.test.ts` | `preserves legitimate retry and processing transitions (QUEUED -> PROCESSING -> VALIDATING -> PROCESSING -> COMPLETED)` | Full retry sequence succeeds, backward `QUEUED` ignored, tenant ID & metadata preserved | PASS |

---

## 8. Verification Commands Run & Observed Results

| Verification Step | Command | Result | Details |
|---|---|---|---|
| Web/Worker Module Parity | `diff -u apps/web/lib/storage/sidecar-store.ts apps/worker/src/lib/sidecar-store.ts` | **PASS (exit 0)** | Zero byte differences |
| Web Sidecar Tests | `pnpm --filter @stock-assistant/web exec vitest run lib/services/ingestion-pipeline.test.ts` | **PASS (exit 0)** | 1 file, **25 / 25 tests passed** |
| Worker Sidecar & Ingestion Tests | `pnpm --filter @stokiffy/worker exec vitest run src/lib/sidecar-store.test.ts src/jobs/csv-ingestion.test.ts` | **PASS (exit 0)** | 2 files, **25 / 25 tests passed** (`sidecar-store.test.ts`: 7, `csv-ingestion.test.ts`: 18) |
| Full Monorepo Test Suite | `pnpm turbo run test --force` | **PASS (exit 0)** | **10 / 10 tasks, 14 / 14 test files, 177 / 177 tests passed** (+13 net new tests vs 164 baseline): `core` 35, `contracts` 14, `data-providers` 25, `db` 6, `web` 45, `worker` 52 |
| Full Monorepo Build | `pnpm turbo run build` | **PASS (exit 0)** | 6 / 6 packages compiled (`next build` + `tsc -b` + workspace builds clean) |
| Full Monorepo Typecheck | `pnpm turbo run typecheck` | **PASS (exit 0)** | 6 / 6 packages passed `tsc --noEmit` with 0 errors |
| Full Monorepo Lint | `pnpm turbo run lint` | **PASS (exit 0)** | 6 / 6 packages passed (`next lint`: `✔ No ESLint warnings or errors`) |
| Stray Artifact Audit | `find apps/web apps/worker -maxdepth 4 \( -name '*.lock' -o -name '*.tmp' -o -name '*.reclaim.*' \) -not -path '*/node_modules/*' -not -path '*/.next/*'` | **PASS (exit 0)** | 0 stray `.lock`, `.tmp`, or `.reclaim.*` files |

---

## 9. Cross-Process Verification Evidence

**Real multi-process OS contention was explicitly verified** in `apps/worker/src/lib/sidecar-store.test.ts` (`prevents torn JSON and lost updates across two independent OS processes contending on the exact same sidecar`):
- Spawned **two independent Node.js OS child processes** (`node --experimental-strip-types --input-type=module`) synchronized behind a start barrier file (`start.barrier`) so both OS processes began contending simultaneously on the exact same `<tempJobsDir>/job_xproc_01.json` sidecar.
- **Process A (`worker` role):** Executed 20 locked read-merge-atomic-write cycles with alternating long/short payloads (`PROCESSING`, `VALIDATING`), committing `COMPLETED` with `processedCount: 42`, `validRowCount: 42`, `warningsCount: 0`, and `completedAt: '2026-11-18T14:45:00.000Z'` at iteration 10, followed by 9 late `PROCESSING`/`VALIDATING` attempts.
- **Process B (`web` role):** Simultaneously executed 20 competing locked read-merge-atomic-write cycles (`PROCESSING`, `VALIDATING`, `QUEUED`) with varying payload sizes across the same window.
- **Parent OS Process (Continuous Reader):** Continuously polled `fs.readFileSync(targetPath)` + `JSON.parse()` every 2ms throughout the entire contention window.
- **Observed Outcome:**
  - Both child OS processes exited with code `0` and empty error output.
  - Continuous reader recorded `> 0` valid parses and **`0` JSON parse errors** (proving atomic visibility of `rename(2)`).
  - Final sidecar JSON on disk was valid and strictly preserved `status: 'COMPLETED'`, `userId: 'tenant_xproc'`, `processedCount: 42`, `validRowCount: 42`, `warningsCount: 0`, and `completedAt: '2026-11-18T14:45:00.000Z'`.
  - Unrelated sidecar `job_xproc_unrelated.json` remained byte-for-byte identical.
  - Directory contained `0` leftover `.tmp`, `.lock`, or `.reclaim.*` files.

---

## 10. Remaining Limitations & Explicitly Out-of-Scope Items

This cycle resolves sidecar concurrency strictly for **single-host** deployments where `apps/web` and `apps/worker` share a local POSIX filesystem (`JOBS_DIR`):

1. **Multi-Host / Distributed Deployments (ISS-01 — Out of Scope):**
   - Local POSIX lockfiles (`O_CREAT | O_EXCL`), local `rename(2)`, and `process.kill(pid, 0)` PID liveness checks **do not** provide distributed mutual exclusion across separate container hosts, pods, or network filesystems without shared POSIX locking semantics.
   - Multi-host / distributed production deployment continues to require **ISS-01**: migrating job status persistence to a database-backed `IngestionJob` table (using transactional row locks / conditional updates) and migrating CSV staging to shared object storage (S3/GCS).
2. **Database Uniqueness & Migrations (ISS-02 — Out of Scope):**
   - No Prisma schema changes, migrations, or database uniqueness constraints were touched.
3. **Prisma Schema Nullability Alignment (Kilo Code Ownership — Out of Scope):**
   - Existing Cycle 2B temporary `as any` null-preservation casts in `apps/worker/src/jobs/services/csv-ingestion.service.ts` were preserved untouched pending Kilo Code's authorized `packages/db` schema work.
4. **Canonical Investment Policy Freeze:**
   - All 20 canonical investment decisions (`D-01`–`D-15`, `D-A1`–`D-A5`) remain `PENDING USER DECISION`.
   - Stage A screening remains `NOT_IMPLEMENTED`.

---

## 11. Ownership & Safety Boundary Confirmation

- **Strict File Ownership Observed:** Only files inside `apps/web/**` and `apps/worker/**` were created or modified. Zero changes were made to `packages/core/**`, `packages/contracts/**`, `packages/db/**`, `packages/data-providers/**`, `docs/**`, or prior reports.
- **No Unapproved Side Effects:** No Git initialization/commits/pushes, no `pnpm install` or dependency additions, no Prisma schema/migration changes, no Neon/live database queries, no cloud storage/deployment changes.
- **No Unsolicited Next Cycle:** Implementation stops here pending Project Owner review and authorization.

---

## 12. Final Verdict

**PASS**

All primary objectives of Phase 1B Cycle 2B-R3 are verified complete for single-host deployments:
- Torn/corrupted JSON writes eliminated via same-directory temporary file + `fsync` + atomic `rename(2)` with guaranteed cleanup on failure.
- Cross-process read-modify-write races eliminated on a single host via per-job `O_CREAT | O_EXCL` lockfiles with bounded backoff, owner-token release, and dead-PID-only (`ESRCH`) stale-lock reclamation.
- Terminal job states (`COMPLETED`, `FAILED`) are strictly immutable against late/stale regressions while preserving legitimate retry transitions and metadata.
- Real two-process OS contention verified green alongside **177 / 177** passing monorepo tests, clean `build`, clean `typecheck`, and clean `lint`.
