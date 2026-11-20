# Engineering & Development Standards

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** Engineering Standards, Code Conventions & Quality Guidelines  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  
**Audience:** All Contributing Engineers, Architects, and AI Assistants  

---

## 1. Strict TypeScript Standards

All workspace packages must inherit from `packages/config/typescript/base.json` with the strictest compiler flags enabled. Type safety is non-negotiable.

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### TypeScript Rules
1. **No `any` Permitted:** The use of `any` is strictly prohibited and triggers a build failure via ESLint (`@typescript-eslint/no-explicit-any: error`). Use `unknown` with type narrowing or type guards.
2. **Explicit Return Types on Domain Functions:** All scoring algorithms, financial formulas, and repository methods must declare explicit return types.
3. **No Non-Null Assertions (`!`):** Avoid the non-null assertion operator (`!`). Handle `null` and `undefined` explicitly with optional chaining (`?.`) or nullish coalescing (`??`).

---

## 2. Naming Conventions

Consistency across codebases prevents cognitive overload. Follow these conventions strictly:

| Artifact | Convention | Example |
| :--- | :--- | :--- |
| **Directories** | `kebab-case` | `company-research/`, `stage-a/`, `trade-planner/` |
| **Source Files** | `kebab-case.ts` | `position-sizer.ts`, `stage-a-card.tsx` |
| **React Components** | `PascalCase` | `StageACard`, `PositionCalculator`, `ScreenerTable` |
| **Interfaces & Types** | `PascalCase` | `AnalysisResult`, `TradePlanDto`, `CompanyProfile` |
| **Zod Schemas** | `PascalCase` + `Schema` | `CreateTradePlanSchema`, `CompanyFilterSchema` |
| **Functions & Methods** | `camelCase` | `calculateMarginOfSafety()`, `evaluateRedFlags()` |
| **Constants & Enums** | `UPPER_SNAKE_CASE` | `DEFAULT_RISK_BUDGET_PERCENT`, `MAX_STOCK_CAP` |
| **Database Tables** | `snake_case` (plural) | `companies`, `financial_periods`, `analysis_runs` |
| **Database Columns** | `snake_case` | `fiscal_year`, `pe_ratio`, `is_consolidated` |
| **REST Endpoints** | `kebab-case` | `/api/v1/trade-plans`, `/api/v1/moat-assessments` |

---

## 3. Monorepo Import Boundaries & Dependency Direction

To prevent architectural degradation, import boundaries are enforced via ESLint (`import/no-restricted-paths`) and CI lint checks:

```
┌─────────────────────────────────────────────────────────────┐
│                       apps/web                              │
│         Can import: @stock-assistant/contracts              │
│                     @stock-assistant/core                   │
│                     @stock-assistant/db (via Route Handlers)│
│                     @stock-assistant/ui                     │
│                                                             │
│   ❌ CANNOT IMPORT: @prisma/client directly in components   │
│   ❌ CANNOT PERFORM: Direct financial scoring calculations │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    packages/core                            │
│         Can import: @stock-assistant/contracts              │
│                     decimal.js                              │
│                                                             │
│   ❌ CANNOT IMPORT: React, Next.js, @prisma/client, DB      │
│   ❌ CANNOT IMPORT: Node HTTP libraries                     │
└─────────────────────────────────────────────────────────────┘
```

### Prohibited Patterns
```ts
// ❌ CRITICAL VIOLATION in apps/web/components/features/screener/screener-table.tsx:
import { prisma } from '@stock-assistant/db'; // NEVER import DB into React components!

// ❌ CRITICAL VIOLATION in apps/web/components/features/company/stage-a-card.tsx:
// Calculating score inside a React component:
const score = (peRatio < 20 ? 1 : 0) + (roe > 0.20 ? 1 : 0.5); // NEVER do math in UI!

// ✅ CORRECT: Consume pre-calculated domain results from API / core:
const { score, checks, redFlags } = analysisResult;
```

---

## 4. Financial Calculation & Numerical Standards

1. **Precision First:**
   Never use native JavaScript arithmetic for monetary values, share counts, or valuation models:
   ```ts
   // ❌ BAD:
   const maxLoss = positionSize * (entryPrice - stopPrice);
   
   // ✅ GOOD:
   import { Decimal } from 'decimal.js';
   const maxLoss = new Decimal(positionSize).times(
     new Decimal(entryPrice).minus(new Decimal(stopPrice))
   ).toNumber();
   ```
2. **Missing Data vs Zero:**
   A missing financial value must **never** be coerced to `0` or `0.00`. If an interest coverage ratio or sector benchmark is missing, the metric state must be explicitly set to `NOT_AVAILABLE` or `UNSCORED`.
3. **Division-by-Zero Safety:**
   Before any division operation (e.g. P/E = Price / EPS), verify that the denominator is positive and valid. Negative EPS must be marked `NOT_MEANINGFUL` (`N/M`).

---

## 5. Error Handling Conventions

The codebase uses a dual error strategy:

### 5.1. Domain Layer: Result Pattern / Domain Exceptions
In `@stock-assistant/core`, functions return typed Result objects or throw explicit domain errors:

```ts
export class HardRedFlagError extends Error {
  constructor(
    public readonly triggers: Array<{ field: string; value: number; threshold: number }>,
    message: string
  ) {
    super(message);
    this.name = 'HardRedFlagError';
  }
}
```

### 5.2. API Layer: RFC 7807 Problem Details
All API Route Handlers must wrap execution in standard try/catch blocks that convert domain exceptions into RFC 7807 error envelopes:

```ts
// apps/web/app/api/v1/analyses/stage-a/route.ts
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = RunStageASchema.parse(body);
    const result = await screenerService.runStageA(validated);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err); // Maps ZodError -> 400, DomainError -> 422, etc.
  }
}
```

Rules:
- Never swallow exceptions with empty `catch {}` blocks.
- Never return generic 500 errors without capturing the stack trace in structured logs.
- Never leak database connection strings, SQL queries, or internal paths in API error messages.

---

## 6. Validation Standards

Every external input (HTTP request body, query parameter, CSV row, external API payload) must be validated using Zod schemas located in `@stock-assistant/contracts`.

```ts
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
```

---

## 7. Logging & Observability

1. **Structured JSON Logs:**
   All logs must be emitted as structured JSON using a high-performance logger (Pino). Plain `console.log` statements are prohibited in production code.
2. **Correlation / Request IDs:**
   Every HTTP request receives a unique `requestId` generated by edge middleware. This ID is propagated across all log statements and included in the API response envelope.
3. **Data Scrubbing:**
   Passwords, session tokens, personal investor identification, and API keys must be automatically redacted using Pino serializers.

---

## 8. Testing Standards & Quality Gates

The project enforces three layers of testing:

```
┌─────────────────────────────────────────────────────────────┐
│                 End-to-End Tests (Playwright)              │
│  - Full user journeys: Screening ➔ Valuation ➔ Buy Plan     │
│  - CSV file ingestion and UI rendering validation          │
├─────────────────────────────────────────────────────────────┤
│             Integration Tests (Vitest + Test DB)            │
│  - Repository queries, transactions, migration sanity       │
│  - API Route Handlers request/response contract tests       │
├─────────────────────────────────────────────────────────────┤
│                  Unit Tests (Vitest)                        │
│  - 100% test coverage for Stage A-G scoring algorithms      │
│  - Golden Fixtures (TCS, HUL hand-calculated benchmarks)    │
│  - Boundary condition tests (<10%, exactly 10%, >10% ROCE)  │
└─────────────────────────────────────────────────────────────┘
```

### Golden Fixture Requirement
Any scoring rule derived from handwritten notes must be accompanied by an immutable JSON fixture verifying that exact note inputs produce exact note outputs.

---

## 9. Code Formatting & Git Hygiene

1. **Formatting:** Enforced via **Prettier** (2 spaces, single quotes, trailing commas, 100-character print width).
2. **Git Commit Messages:** Follow the Conventional Commits specification:
   - `feat(core): add Stage B debtor days acceleration check`
   - `fix(valuation): correct DCF mid-year discounting factor`
   - `docs(architecture): document mobile token exchange flow`
   - `refactor(web): extract screener table column definitions`
3. **Pre-commit Hooks:** Managed via `simple-git-hooks` and `lint-staged`. Commits are rejected if formatting, linting, or TypeScript typechecks fail.
