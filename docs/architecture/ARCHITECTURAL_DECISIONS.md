# Architectural Decision Records (ADRs)

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** Architecture Decision Records & System Rationales  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  

---

## Index of Architectural Decisions

- [ADR-001: Monorepo Tooling (pnpm Workspaces + Turborepo)](#adr-001-monorepo-tooling-pnpm-workspaces--turborepo)
- [ADR-002: Modular Monolith with Next.js Route Handlers vs Microservices](#adr-002-modular-monolith-with-nextjs-route-handlers-vs-microservices)
- [ADR-003: Core Investment Engine Isolation (Pure TypeScript)](#adr-003-core-investment-engine-isolation-pure-typescript)
- [ADR-004: Relational Persistence with PostgreSQL & Prisma ORM](#adr-004-relational-persistence-with-postgresql--prisma-orm)
- [ADR-005: Arbitrary-Precision Financial Math (Decimal.js & Postgres NUMERIC)](#adr-005-arbitrary-precision-financial-math-decimaljs--postgres-numeric)
- [ADR-006: Dual-Client Authentication Strategy (Web Cookies + Mobile Bearer Tokens)](#adr-006-dual-client-authentication-strategy-web-cookies--mobile-bearer-tokens)
- [ADR-007: State Management Strategy (TanStack Query + Minimal Zustand)](#adr-007-state-management-strategy-tanstack-query--minimal-zustand)
- [ADR-008: Asynchronous Background Processing via PostgreSQL Queue (pg-boss)](#adr-008-asynchronous-background-processing-via-postgresql-queue-pg-boss)
- [ADR-009: Strict Gatekeeping & Explainable Red-Flag Scoring Architecture](#adr-009-strict-gatekeeping--explainable-red-flag-scoring-architecture)
- [ADR-010: AI Layer Isolation (Deterministic Calculation vs AI Summarization)](#adr-010-ai-layer-isolation-deterministic-calculation-vs-ai-summarization)
- [ADR-011: Point-in-Time Data Provenance & Immutable Historical Snapshots](#adr-011-point-in-time-data-provenance--immutable-historical-snapshots)
- [ADR-012: The 12-Pillar Architectural Matrix](#adr-012-the-12-pillar-architectural-matrix)

---

### ADR-001: Monorepo Tooling (pnpm Workspaces + Turborepo)
- **Status:** Accepted
- **Context:** The project requires clean separation between the frontend web application, pure business logic, database models, data providers, and background services. We evaluated npm workspaces, yarn berry, and pnpm + Turborepo.
- **Decision:** Adopt **pnpm workspaces** orchestrated by **Turborepo**.
- **Justification:**
  - pnpm provides content-addressable storage, saving disk space and eliminating phantom dependencies via strict symlinking.
  - Turborepo offers intelligent topological task pipelines, caching build artifacts, test runs, and type checks across workspace packages.
- **Consequences:** Developers must use `pnpm` exclusively; npm and yarn are disallowed via `.npmrc` engine enforcement.

---

### ADR-002: Modular Monolith with Next.js Route Handlers vs Microservices
- **Status:** Accepted
- **Context:** The blueprint requires a responsive web interface today and an architecture capable of supporting a future native mobile app (Flutter / React Native) without backend rewrites. We evaluated whether to split the system into microservices (Auth service, Screener service, Valuation service) or build an independent Express/NestJS server immediately.
- **Decision:** Build a **Modular Monolith** using Next.js App Router Route Handlers (`apps/web/app/api/v1/*`) backed by domain workspace packages.
- **Justification:**
  - Premature microservices introduce severe operational drag: multiple CI pipelines, Docker Swarm/K8s clusters, network latency, distributed transactions, and serialization overhead.
  - Next.js Route Handlers run standard Web Request/Response APIs, exposing a clean RESTful HTTP interface identical to any standalone backend.
  - Domain boundaries are enforced at compile time via package isolation (`@stock-assistant/core`, `@stock-assistant/db`, `@stock-assistant/contracts`), not by network hops.
- **Consequences:** If specific components require horizontal scaling in later phases (e.g. data ingestion worker), they can be decoupled with zero domain rewrites.

---

### ADR-003: Core Investment Engine Isolation (Pure TypeScript)
- **Status:** Accepted
- **Context:** Financial calculations (Stage A-G rules, P/E, PEG, P/B, DCF, position sizing, red flags) must be reusable across the web app, background worker, CLI tools, and future mobile runtimes.
- **Decision:** Encapsulate all investment math in a pure TypeScript package (`packages/core`) with **zero dependencies on React, Next.js, or database ORMs**.
- **Justification:**
  - Eliminates framework lock-in.
  - Facilitates 100% deterministic unit testing with millisecond test runtimes using Vitest.
  - Ensures identical calculation results whether executed on the server, in a worker job, or packaged for edge execution.
- **Consequences:** Web components cannot perform ad-hoc calculations; all data must be calculated via `@stock-assistant/core` or requested through the API.

---

### ADR-004: Relational Persistence with PostgreSQL & Prisma ORM
- **Status:** Accepted
- **Context:** Financial data demands strict relational integrity, foreign key cascading, transactional consistency (ACID), and complex multi-period queries (annual statements, quarterly trends, ownership shifts). We evaluated PostgreSQL vs MongoDB vs SQLite.
- **Decision:** Use **PostgreSQL (v16+)** managed via **Prisma ORM**.
- **Justification:**
  - Relational schema with strict constraints prevents orphaned financial periods or corrupt transactions.
  - Native `NUMERIC` data type ensures precision for currency and ratios.
  - Native `JSONB` support allows flexible storage of rule-set configurations and raw statement inputs alongside relational entities.
  - Prisma provides end-to-end type safety, migration management, and clean schema modelling.
- **Consequences:** Requires a running PostgreSQL instance in development (provided via Docker Compose) and connection pool management (PgBouncer).

---

### ADR-005: Arbitrary-Precision Financial Math (Decimal.js & Postgres NUMERIC)
- **Status:** Accepted
- **Context:** JavaScript's native `number` type is an IEEE-754 double-precision float. Operations like `0.1 + 0.2 = 0.30000000000000004` lead to unacceptable drift in share quantities, portfolio values, valuation multiples, and threshold comparisons.
- **Decision:** Use **Decimal.js** for all calculations in `@stock-assistant/core` and store financial amounts in PostgreSQL as `NUMERIC(18, 4)` or `NUMERIC(24, 6)`.
- **Justification:** Guarantees absolute mathematical determinism and prevents rounding anomalies across currency conversions and valuation models.
- **Consequences:** Calculations must use Decimal method chains (e.g. `a.plus(b).times(c)`) rather than native arithmetic operators.

---

### ADR-006: Dual-Client Authentication Strategy (Web Cookies + Mobile Bearer Tokens)
- **Status:** Accepted
- **Context:** The web application needs secure browser-based sessions resistant to XSS/CSRF. The future mobile app (Flutter / React Native) requires token-based authentication (Bearer JWT) because mobile operating systems do not rely on browser cookie jars.
- **Decision:** Implement **Auth.js for encrypted HTTP-only session cookies** on the web, paired with an **asymmetric JWT Bearer token endpoint** (`/api/v1/auth/token`) for mobile applications.
- **Justification:** Gives optimal security for web browsers while providing a standard OAuth2-style Bearer token workflow for mobile clients without architectural conflict.
- **Consequences:** API middleware must inspect both cookie sessions and `Authorization: Bearer` headers.

---

### ADR-007: State Management Strategy (TanStack Query + Minimal Zustand)
- **Status:** Accepted
- **Context:** Financial dashboards require caching, automatic background refetching, mutation rollbacks, and synchronized views across screens. We evaluated Redux Toolkit, Zustand alone, and TanStack Query.
- **Decision:** Use **TanStack Query (v5)** for all server-state caching and synchronization. Use **Zustand** only for transient, purely client-local UI state.
- **Justification:**
  - 95% of state in financial research applications is server-state (company profiles, scores, watchlists, prices).
  - TanStack Query eliminates boilerplate, handles deduplication, caching, pagination, and optimistic updates out of the box.
- **Consequences:** Eliminates global Redux stores; UI state remains lean and scoped.

---

### ADR-008: Asynchronous Background Processing via PostgreSQL Queue (pg-boss)
- **Status:** Accepted
- **Context:** Operations like parsing 10-year financial CSV statements, batch-rescoring 500 stocks upon benchmark updates, and evaluating daily price alerts must not block Next.js HTTP request threads.
- **Decision:** Use **`pg-boss`** to manage background job queues directly inside PostgreSQL.
- **Justification:**
  - Uses Postgres `FOR UPDATE SKIP LOCKED` row mechanics to implement transactional, reliable queues.
  - Avoids introducing Redis or Celery infrastructure in Phase 1, keeping operational footprint minimal.
  - Background daemon runs in `services/worker`.
- **Consequences:** Requires PostgreSQL to be healthy for background tasks to process; easily migratable to BullMQ/Redis later if high queue volume demands it.

---

### ADR-009: Strict Gatekeeping & Explainable Red-Flag Scoring Architecture
- **Status:** Accepted
- **Context:** The handwritten notes define a staged funnel where Stage A acts as a hard filter. A stock may score 7.5/10, but if ROCE is below 10% or D/E is above 1.25, it must not progress.
- **Decision:** Separate scoring into two explicit outputs:
  1. **Score & Breakdown:** Points awarded per check with formula and inputs.
  2. **Flag Evaluator:** Triggered flags categorized into `HardStop`, `ConditionalWarning`, `DataQualityWarning`, and `ValuationWarning`.
  A high score **never** overrides a `HardStop`. Progression to Stage B is blocked at the domain engine level unless an auditable human override is recorded.
- **Justification:** Adheres strictly to the investor's core discipline: "A company passing a stage is eligible for the next analysis stage; it is not automatically a buy recommendation."
- **Consequences:** UI must prominently display red flags alongside scores and enforce override documentation.

---

### ADR-010: AI Layer Isolation (Deterministic Calculation vs AI Summarization)
- **Status:** Accepted
- **Context:** Modern assistants often blur the line between deterministic rules and generative AI output.
- **Decision:** Enforce a strict boundary:
  - **Deterministic Pure TS:** Financial ratios, scoring, valuation models, position sizing, red flags, and gate decisions.
  - **AI LLM Responsibilities:** Unstructured text summarization (annual reports, management commentary, earnings calls), highlighting evidence for moat questions, and identifying information gaps.
- **Justification:** LLMs are prone to arithmetic hallucinations and inconsistency. Financial investment decisions must rest on mathematically sound foundations.
- **Consequences:** All AI outputs must cite source filings with timestamps and be visually flagged as "AI Assisted".

---

### ADR-011: Point-in-Time Data Provenance & Immutable Historical Snapshots
- **Status:** Accepted
- **Context:** Financial data providers frequently revise or restate past balance sheets. If the system overwrote historical periods, past research decisions could not be audited or reproduced.
- **Decision:** Store financial statements and analysis runs as **immutable point-in-time snapshots**. When revised data is imported, a new snapshot version is created rather than overwriting existing records.
- **Justification:** Ensures complete auditability and backtesting reliability.
- **Consequences:** Requires composite foreign keys (`companyId`, `periodId`, `version`) and snapshot archiving.

---

## ADR-012: The 12-Pillar Architectural Matrix

| Pillar | Architectural Selection | Implementation Vehicle |
| :--- | :--- | :--- |
| **1. Frontend Architecture** | Next.js App Router (RSC + Client leaves) | `apps/web/app/` with route groups `(auth)` and `(dashboard)` |
| **2. Backend/API Architecture** | Modular Monolith Route Handlers (`/api/v1/*`) | `apps/web/app/api/v1/` exposing RESTful contracts |
| **3. Database Access Architecture**| Relational PostgreSQL with Repository Pattern | `packages/db` via Prisma ORM & PgBouncer |
| **4. Domain Boundaries** | Clean Architecture / Hexagonal isolation | `packages/core` (Zero dependencies) |
| **5. Authentication Architecture** | Hybrid Session Cookies (Web) + JWT Bearer (Mobile)| Auth.js + `/api/v1/auth/token` |
| **6. API Versioning Strategy** | URI Versioning (`/api/v1/`) | Versioned route handlers and OpenAPI 3.1 contracts |
| **7. Error Handling Conventions** | RFC 7807 Problem Details + Domain Exceptions | Standardized error envelope with Zod field details |
| **8. Logging & Observability** | Structured JSON logging with Correlation IDs | Pino logger with `requestId` tracing |
| **9. Testing Architecture** | Vitest (Unit/Fixtures) + Playwright (E2E) | Strict golden fixtures (TCS, HUL hand-calculated checks) |
| **10. Security Architecture** | Least Privilege, Row-Level Ownership, CSP | Zod sanitization, HTTPS, immutable `audit_events` |
| **11. Environment Management** | Layered environment variables & Secret Scanning | `.env.example`, Turborepo pass-through variables |
| **12. Future Mobile Compatibility** | Universal REST API, shared DTOs & OpenAPI spec | `@stock-assistant/contracts` compiling to client SDKs |
