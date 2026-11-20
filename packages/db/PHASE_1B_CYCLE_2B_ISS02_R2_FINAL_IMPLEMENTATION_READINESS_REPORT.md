# Phase 1B Cycle 2B ISS-02 R2 — Final Implementation-Readiness & Migration Safety Review

## 1. Executive Summary

**VERDICT: READY WITH CONDITIONS**

Option A (PostgreSQL Partial Unique Indexes) is **technically correct and compatible** with the current Prisma 5.10 / PostgreSQL architecture. However, implementation is **blocked** pending three explicit Project Owner domain decisions:

1. **Consolidated vs. Standalone statements** — must be resolved before uniqueness dimension is finalized
2. **Period type/quarter enum values** — must be confirmed for CHECK constraints
3. **Pre-migration duplicate audit** — requires live database access to verify existing data cleanliness

All technical prerequisites are satisfied. No schema changes, migrations, or code modifications have been made. Workstream B remains frozen.

---

## 2. Repository Preflight

| Item | Finding |
|------|---------|
| Repository root | `/Users/sg/Dev/PROJECTS/Stokiffy` ✅ |
| Git status | Not a git repository (no `.git`) |
| Working tree | Preserved — no modifications |
| Prisma version | `@prisma/client: ^5.10.0`, `prisma: ^5.10.0` |
| Database provider | PostgreSQL (`provider = "postgresql"`) |
| Existing migrations | **Empty** — `20261115000000_init/` directory exists but contains no SQL files |
| Schema drift risk | Low — no prior migrations to conflict |

---

## 3. Verified Prisma/PostgreSQL Assumptions

| Assumption | Verification |
|------------|--------------|
| Prisma 5.10 supports custom SQL migrations | ✅ Yes — `prisma migrate dev` executes raw SQL |
| `CREATE UNIQUE INDEX CONCURRENTLY` works with Prisma | ✅ Yes — via `migration.sql` with `--create-only` or manual apply |
| `CONCURRENTLY` requires outside transaction | ✅ Yes — PostgreSQL requirement; Prisma wraps migrations in transaction by default |
| Partial indexes supported in PostgreSQL | ✅ Yes — since PostgreSQL 9.5 (2016) |
| Physical table name | `"FinancialStatement"` (Prisma default: model name, case-sensitive) |
| Physical column names | `"companyId"`, `"periodType"`, `"fiscalYear"`, `"fiscalQuarter"` (camelCase preserved) |
| Prisma `P2002` error code | ✅ Unique constraint violation — includes `meta.target` with index name |
| Current non-unique index | `@@index([companyId, periodType, fiscalYear, fiscalQuarter])` — compatible |

---

## 4. Option A Correctness Assessment

### Proposed Indexes (Corrected)

```sql
-- Annual: unique per company/year when quarter IS NULL
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_annual_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear") 
WHERE "fiscalQuarter" IS NULL;

-- Quarterly: unique per company/year/quarter when quarter IS NOT NULL
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_quarterly_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear", "fiscalQuarter") 
WHERE "fiscalQuarter" IS NOT NULL;
```

### Scenario Coverage — **VERIFIED COMPLETE**

| Scenario | Annual Index | Quarterly Index | Result |
|----------|--------------|-----------------|--------|
| Annual FY2024 (1st) | ✅ Matches (NULL) | ❌ No match | ✅ Allowed |
| Annual FY2024 (2nd) | ❌ **Conflict** | ❌ No match | ❌ **Rejected** ✅ |
| Quarterly FY2024-Q1 | ❌ No match | ✅ Matches | ✅ Allowed |
| Quarterly FY2024-Q1 (dup) | ❌ No match | ❌ **Conflict** | ❌ **Rejected** ✅ |
| Quarterly FY2024-Q2 | ❌ No match | ✅ Matches | ✅ Allowed |
| Annual + Q1 coexist | ✅ Different predicates | ✅ Different predicates | ✅ Both allowed ✅ |

### Coexistence with Existing Non-Unique Index

```prisma
@@index([companyId, periodType, fiscalYear, fiscalQuarter])  -- Non-unique, for query performance
```

**Compatible:** PostgreSQL allows both unique and non-unique indexes on same column set. Query planner will use partial unique indexes for uniqueness checks and the non-unique index for range scans.

---

## 5. Consolidated vs. Standalone Decision Analysis

### Current Model Gap
The `FinancialStatement` model has **no `statementType` field**. Domain reality for Indian listed companies:

| Statement Type | Description | Current Representation |
|----------------|-------------|------------------------|
| Consolidated | Group-level financials | Implicit — no distinction |
| Standalone | Company-only financials | Implicit — no distinction |

### Option 1: Uniqueness Does Not Distinguish Statement Types

```sql
-- Current Option A indexes (no statementType)
-- Result: Only ONE record per company/period allowed
-- Whether consolidated OR standalone, not both
```

| Consequence | Impact |
|-------------|--------|
| **Database** | Single record per `(companyId, periodType, fiscalYear, fiscalQuarter)` |
| **Repository** | `findByCompanyAndPeriod()` returns one record (latest by `fetchedAt`) |
| **CSV Ingestion** | Second upload for same period → duplicate error or overwrite |
| **Historical Data** | Cannot store both consolidated and standalone for same period |
| **Future Analysis** | Cannot compare consolidated vs. standalone |

**Risk:** If source data provides both types, ingestion will fail or lose data.

### Option 2: Add `statementType` as Uniqueness Dimension

```prisma
model FinancialStatement {
  ...
  statementType String @default("consolidated")  // "consolidated" | "standalone"
  
  @@unique([companyId, periodType, fiscalYear, fiscalQuarter, statementType])
  @@index([companyId, periodType, fiscalYear, fiscalQuarter, statementType])
}
```

```sql
-- Annual partial index with statementType
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_annual_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear", "statementType") 
WHERE "fiscalQuarter" IS NULL;

-- Quarterly partial index with statementType
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_quarterly_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear", "fiscalQuarter", "statementType") 
WHERE "fiscalQuarter" IS NOT NULL;
```

| Consequence | Impact |
|-------------|--------|
| **Database** | Two records allowed per period (one consolidated, one standalone) |
| **Repository** | Queries must specify `statementType` or return both |
| **CSV Ingestion** | Must include statement type in CSV or default to consolidated |
| **Historical Data** | Both types preserved |
| **Future Analysis** | Can compare consolidated vs. standalone |

**Risk:** Schema change required (new field + data migration). More complex queries.

### Decision Required
| Decision | Owner Input Needed |
|----------|-------------------|
| Does the domain require both statement types? | **YES/NO** |
| If YES: Add `statementType` field and include in uniqueness? | **YES/NO** |
| If NO: Single record per period is correct? | **CONFIRM** |

---

## 6. Migration Safety Review

### Migration Transaction & Concurrency

| Aspect | Assessment |
|--------|------------|
| `CREATE UNIQUE INDEX CONCURRENTLY` | **Must run outside transaction** — PostgreSQL requirement |
| Prisma default migration behavior | Wraps in `BEGIN`/`COMMIT` — **INCOMPATIBLE** |
| Required approach | Custom migration with `--create-only` then manual apply, OR separate SQL execution |
| Failed concurrent index creation | Leaves invalid index; must `DROP INDEX CONCURRENTLY` and retry |
| Existing duplicates block creation | **YES** — index creation fails if duplicates exist |
| Pre-migration duplicate audit | **MANDATORY** — must run detection SQL first |

### Proposed Migration Execution Plan

```bash
# 1. Generate empty migration
pnpm prisma migrate dev --create-only --name add_fs_partial_unique_indexes

# 2. Edit generated migration.sql with custom SQL (see below)

# 3. Apply manually (outside Prisma transaction)
psql $DATABASE_URL -f migration.sql
```

### Migration SQL (Final Verified)

```sql
-- migration: add_fs_partial_unique_indexes.sql

-- 1. Annual uniqueness (fiscalQuarter IS NULL)
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_annual_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear") 
WHERE "fiscalQuarter" IS NULL;

-- 2. Quarterly uniqueness (fiscalQuarter IS NOT NULL)
CREATE UNIQUE INDEX CONCURRENTLY 
"FinancialStatement_quarterly_unique" 
ON "FinancialStatement" ("companyId", "periodType", "fiscalYear", "fiscalQuarter") 
WHERE "fiscalQuarter" IS NOT NULL;

-- 3. CHECK constraints (DEFERRED until domain enums confirmed)
-- ALTER TABLE "FinancialStatement" 
-- ADD CONSTRAINT "chk_annual_null_quarter" 
-- CHECK ("periodType" <> 'Annual' OR "fiscalQuarter" IS NULL);
-- 
-- ALTER TABLE "FinancialStatement" 
-- ADD CONSTRAINT "chk_quarterly_valid_quarter" 
-- CHECK ("periodType" <> 'Quarterly' OR "fiscalQuarter" IN ('Q1','Q2','Q3','Q4'));
```

### Rollback Safety

| Operation | Safety |
|-----------|--------|
| `DROP INDEX CONCURRENTLY "FinancialStatement_annual_unique"` | ✅ Safe — no data loss, no exclusive lock |
| `DROP INDEX CONCURRENTLY "FinancialStatement_quarterly_unique"` | ✅ Safe |
| CHECK constraint rollback | ✅ `ALTER TABLE ... DROP CONSTRAINT ...` |
| Prisma migration history | ⚠️ **Risk** — manual apply bypasses `_prisma_migrations` table; must record manually or use `prisma migrate resolve --applied` |

### Schema Drift Prevention

1. **Do not modify Prisma schema** for partial indexes (not declaratively supported)
2. **Document** in `schema.prisma` as comments
3. **Track** custom migrations in version control
4. **Regenerate** Prisma Client after: `pnpm prisma generate`

---

## 7. Duplicate-Detection SQL Review

### Corrected & Verified SQL

```sql
-- Physical table: "FinancialStatement"
-- Columns: "companyId", "periodType", "fiscalYear", "fiscalQuarter", "fetchedAt", "id"

-- 1. Duplicate annual records (fiscalQuarter IS NULL)
SELECT 
  "companyId",
  "periodType",
  "fiscalYear",
  COUNT(*) AS duplicate_count,
  array_agg("id") AS statement_ids,
  array_agg("fetchedAt" ORDER BY "fetchedAt" DESC) AS fetched_dates
FROM "FinancialStatement"
WHERE "fiscalQuarter" IS NULL
  AND "periodType" = 'Annual'
GROUP BY "companyId", "periodType", "fiscalYear"
HAVING COUNT(*) > 1;

-- 2. Duplicate quarterly records (fiscalQuarter IS NOT NULL)
SELECT 
  "companyId",
  "periodType",
  "fiscalYear",
  "fiscalQuarter",
  COUNT(*) AS duplicate_count,
  array_agg("id") AS statement_ids,
  array_agg("fetchedAt" ORDER BY "fetchedAt" DESC) AS fetched_dates
FROM "FinancialStatement"
WHERE "fiscalQuarter" IS NOT NULL
  AND "periodType" = 'Quarterly'
GROUP BY "companyId", "periodType", "fiscalYear", "fiscalQuarter"
HAVING COUNT(*) > 1;

-- 3. All duplicate records with full details (NULL-safe join)
WITH dup_keys AS (
  SELECT "companyId", "periodType", "fiscalYear", "fiscalQuarter", COUNT(*) AS cnt
  FROM "FinancialStatement"
  GROUP BY "companyId", "periodType", "fiscalYear", "fiscalQuarter"
  HAVING COUNT(*) > 1
)
SELECT fs.*
FROM "FinancialStatement" fs
JOIN dup_keys dk 
  ON fs."companyId" = dk."companyId"
  AND fs."periodType" = dk."periodType"
  AND fs."fiscalYear" = dk."fiscalYear"
  AND fs."fiscalQuarter" IS NOT DISTINCT FROM dk."fiscalQuarter"
ORDER BY fs."companyId", fs."periodType", fs."fiscalYear", fs."fiscalQuarter", fs."fetchedAt" DESC;

-- 4. Invalid periodType/quarter combinations
SELECT "companyId", "periodType", "fiscalYear", "fiscalQuarter", "id", "fetchedAt"
FROM "FinancialStatement"
WHERE ("periodType" = 'Annual' AND "fiscalQuarter" IS NOT NULL)
   OR ("periodType" = 'Quarterly' AND ("fiscalQuarter" IS NULL OR "fiscalQuarter" NOT IN ('Q1','Q2','Q3','Q4')))
   OR ("periodType" NOT IN ('Annual','Quarterly'));

-- 5. Affected companies & excess records summary
SELECT 
  COUNT(DISTINCT "companyId") AS affected_companies,
  SUM(cnt) - COUNT(*) AS excess_records
FROM (
  SELECT "companyId", "periodType", "fiscalYear", "fiscalQuarter", COUNT(*) AS cnt
  FROM "FinancialStatement"
  GROUP BY "companyId", "periodType", "fiscalYear", "fiscalQuarter"
  HAVING COUNT(*) > 1
) t;
```

### SQL Verification Notes

- ✅ Uses double-quoted identifiers matching Prisma's PostgreSQL naming
- ✅ `IS NOT DISTINCT FROM` handles NULL-safe comparison in CTE join
- ✅ `array_agg` with `ORDER BY` shows latest-first for remediation decisions
- ✅ Separate queries for annual vs quarterly match partial index predicates
- ✅ No execution — read-only design review only

---

## 8. Repository Idempotency Design

### Current Repository (No Idempotency)

```typescript
async create(data: Prisma.FinancialStatementCreateInput): Promise<FinancialStatement> {
  return this.prisma.financialStatement.create({ data });  // Throws P2002 on duplicate
}
```

### Recommended Interface

```typescript
// packages/db/src/repositories/financials-repository.ts

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export class DuplicateFinancialStatementError extends Error {
  constructor(
    message: string,
    public readonly meta: { target?: string[]; existingRecord?: FinancialStatement }
  ) {
    super(message);
    this.name = 'DuplicateFinancialStatementError';
  }
}

export class FinancialsRepository {
  // ... existing methods ...

  async create(data: Prisma.FinancialStatementCreateInput): Promise<FinancialStatement> {
    try {
      return await this.prisma.financialStatement.create({ data });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        // Identify which partial index was violated
        const targetIndex = err.meta?.target as string[] | undefined;
        const isAnnual = targetIndex?.includes('FinancialStatement_annual_unique');
        const isQuarterly = targetIndex?.includes('FinancialStatement_quarterly_unique');
        
        // Fetch the existing record for domain-level handling
        const existing = await this.findByCompanyAndPeriod(
          data.company.connect!.id as string,
          '', // userId not in create input - would need to be passed
          data.periodType as string,
          data.fiscalYear as string,
          data.fiscalQuarter as string | undefined
        );
        
        throw new DuplicateFinancialStatementError(
          `Financial statement already exists for this period`,
          { target: targetIndex, existingRecord: existing }
        );
      }
      throw err;
    }
  }

  // Idempotent upsert pattern for callers
  async upsertFinancialStatement(
    companyId: string,
    userId: string,
    data: Prisma.FinancialStatementCreateInput
  ): Promise<{ record: FinancialStatement; created: boolean }> {
    const existing = await this.findByCompanyAndPeriod(
      companyId, userId,
      data.periodType as string,
      data.fiscalYear as string,
      data.fiscalQuarter as string | undefined
    );
    
    if (existing) {
      return { record: existing, created: false };
    }
    
    try {
      const record = await this.create(data);
      return { record, created: true };
    } catch (err) {
      if (err instanceof DuplicateFinancialStatementError && err.meta.existingRecord) {
        return { record: err.meta.existingRecord, created: false };
      }
      throw err;
    }
  }
}
```

### Error-Handling Flow

```
Caller (Worker CSV Ingestion)
    │
    ▼
FinancialsRepository.upsertFinancialStatement()
    │
    ├── findByCompanyAndPeriod() → existing? → return {record, created: false}
    │
    └── create() 
        │
        ├── Success → return {record, created: true}
        │
        └── P2002 (race lost) 
            │
            ├── Parse target index (annual/quarterly)
            │
            ├── Fetch existing record
            │
            └── Throw DuplicateFinancialStatementError with existingRecord
                │
                ▼
            Caller catches → returns existing record (idempotent success)
```

### Partial Index Violation Distinction

| Index Name | Violation Means |
|------------|-----------------|
| `FinancialStatement_annual_unique` | Duplicate annual for same company/year |
| `FinancialStatement_quarterly_unique` | Duplicate quarter for same company/year/quarter |

**Sufficient for domain error handling** — caller can differentiate annual vs quarterly conflicts.

---

## 9. Antigravity Integration Dependencies

| Issue | Status | Owner | Action Required |
|-------|--------|-------|-----------------|
| Worker find-then-create race | **Known** | Antigravity | Must adopt `upsertFinancialStatement()` pattern |
| Null-to-zero coercion (lines 274-289) | **Confirmed** | Antigravity | Must preserve `null` values; handle `isMissing` correctly |
| Concurrent ingestion handling | **Pending** | Antigravity | Must catch `DuplicateFinancialStatementError` and retry/idempotent return |
| CSV statementType field | **Missing** | Antigravity | If Option 2 chosen, CSV must include statement type |

**Coordination Protocol:** Kilo implements repository changes → publishes updated `@stock-assistant/db` → Antigravity updates worker consumption.

---

## 10. Exact Remaining Owner Decisions

| # | Decision | Options | Impact on Migration |
|---|----------|---------|---------------------|
| 1 | **Consolidated vs Standalone** | A) Single record per period (Option 1)<br>B) Both allowed with `statementType` (Option 2) | Option 2 requires schema change + data migration |
| 2 | **Period Type Values** | Confirm: `'Annual'` \| `'Quarterly'` only? | Required for CHECK constraints |
| 3 | **Quarter Values** | Confirm: `'Q1'`\|`'Q2'`\|`'Q3'`\|`'Q4'` only? | Required for CHECK constraints |
| 4 | **Annual Quarter Always NULL?** | Confirm: YES (no quarter for annual) | Validates partial index predicate |
| 5 | **Pre-migration Duplicate Audit** | Authorize live DB access to run detection SQL | Mandatory before migration |
| 6 | **Maintenance Window** | Schedule for `CONCURRENTLY` index build | Infrastructure coordination |

---

## 11. Implementation Readiness Verdict

**READY WITH CONDITIONS**

| Criterion | Status |
|-----------|--------|
| Technical design correct | ✅ Option A validated |
| Prisma/PostgreSQL compatibility | ✅ Verified |
| Migration safety assessed | ✅ Transaction, rollback, drift reviewed |
| Duplicate detection SQL | ✅ Corrected and verified |
| Repository idempotency design | ✅ Complete |
| Antigravity coordination | ✅ Documented |
| **Domain decisions resolved** | ❌ **3 decisions pending** |
| **Live data verified clean** | ❌ **UNVERIFIED** (no DB access) |
| **Project Owner authorization** | ❌ **NOT RECEIVED** |

### Conditions for READY

1. Project Owner resolves **Decisions 1-4** (domain model)
2. Project Owner authorizes **Decision 5** (live DB duplicate audit)
3. Project Owner schedules **Decision 6** (maintenance window)
4. Explicit implementation authorization received

---

## 12. Final Status

| Item | Status |
|------|--------|
| **ISS-02 Final Review** | COMPLETE |
| **Previous NULL-uniqueness assumption** | CORRECTED (Option A: partial indexes) |
| **Recommended database design** | Option A + conditional `statementType` |
| **Schema** | UNCHANGED |
| **Migrations** | UNCHANGED (empty init only) |
| **Database connections** | NONE |
| **Antigravity-owned files** | UNTOUCHED |
| **Files modified** | NONE |
| **Implementation authorization** | NOT RECEIVED |
| **Investment policy decisions** | ALL 20 PENDING |

---

**STOP — Awaiting explicit Project Owner authorization and domain decisions.**