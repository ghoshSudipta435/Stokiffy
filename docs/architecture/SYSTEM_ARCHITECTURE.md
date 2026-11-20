# System Architecture: Personal Stock Market Assistant

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** System Architecture & Foundation Planning  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  
**Audience:** Technical Lead, Senior Next.js Engineers, Backend & Mobile Architects  

---

## 1. Executive Summary & Core Mission

The **Personal Stock Market Assistant** is a disciplined, rule-driven equity research, valuation, and portfolio execution assistant. Designed for long-term fundamental investors (initially targeting Indian listed equities on the NSE/BSE), the platform guides the investor through a rigorous 7-stage investment funnel (Stages A through G):

```
[ Universe / Screener ]
          │
          ▼
┌───────────────────┐
│ Stage A: Gatekeep │ ──(Fail / Red Flag)──► [ Shortlist Rejected / On-Hold ]
└───────────────────┘
          │ (Pass ≥ 6.5 & No Hard Flag)
          ▼
┌───────────────────┐
│ Stage B: Trends   │ ──(Fail / Red Flag)──► [ Quality Decline Warning ]
└───────────────────┘
          │ (Pass ≥ 6.5 & Consistency)
          ▼
┌───────────────────┐
│ Stage C: Moat     │ ──(Fail < 3/5 or Copyable)──► [ Commodity / Low Durability ]
└───────────────────┘
          │ (Pass ≥ 3/5 & Moat Validated)
          ▼
┌───────────────────┐
│ Stage D: Value    │ ──(Price > Fair Value - 20%)──► [ Valuation Watchlist ]
└───────────────────┘
          │ (Margin of Safety ≥ 20%)
          ▼
┌───────────────────┐
│ Stage E: Timing   │ ──(Unconfirmed / Downtrend)──► [ Setup Monitoring ]
└───────────────────┘
          │ (Pattern Confirmed & In Buy Zone)
          ▼
┌───────────────────┐
│ Stage F: Risk/Buy │ ──(Breaches Portfolio Limits)──► [ Blocked / Sizing Trimmed ]
└───────────────────┘
          │ (Approved & Manually Executed)
          ▼
┌───────────────────┐
│ Stage G: Monitor  │ ──(Thesis Broken / Invalidation)──► [ Sell / Trim Review ]
└───────────────────┘
```

The system is strictly an **analytical engine and disciplined assistant**, not an automated tip generator or black-box trading bot. It preserves complete auditability, input provenance, and rule-set versioning for every conclusion.

---

## 2. Architectural Principles & Non-Negotiable Tenets

1. **Deterministic Calculation Over AI Hallucination:**
   Financial ratios, scoring bands, valuation models (P/E, PEG, P/B, DCF), position sizing, and gate decisions are 100% deterministic code executed by a pure TypeScript engine. Large Language Models (LLMs) are restricted to unstructured text summarisation (annual reports, earnings calls) and evidence citation.
2. **Strict Layer Boundary Isolation:**
   - The web frontend (`apps/web`) **never** accesses the database directly.
   - The frontend **never** implements financial formulas, scoring algorithms, or valuation logic.
   - Database ORM entities (`@stock-assistant/db`) are strictly forbidden from leaking to the frontend or mobile clients.
3. **Decoupled Core Investment Engine:**
   All financial formulas, Stage A-G decision rules, red-flag triggers, and position calculators reside in `@stock-assistant/core`. This package has **zero dependencies** on React, Next.js, Node.js HTTP primitives, or database drivers.
4. **Stable API Boundary (`/api/v1`):**
   A versioned RESTful HTTP boundary encapsulates all capabilities. Both the Next.js web application and future mobile applications (Flutter / React Native) consume the exact same documented endpoints.
5. **Point-in-Time Reproducibility:**
   Company financials are subject to corporate restatements and provider revisions. The system stores point-in-time snapshots for every analysis run. A score calculated on 15 November 2026 can be reconstructed with identical numbers and rule versions years later.
6. **Financial Precision:**
   All monetary amounts, valuation outputs, and exact percentages are represented using arbitrary-precision decimals (`Decimal.js` in TypeScript, `NUMERIC(18, 4)` / `NUMERIC(24, 6)` in PostgreSQL) to prevent IEEE-754 floating-point rounding errors.
7. **Explainable Red Flags:**
   A passing score never overrides a hard-stop red flag. Every score breakdown displays the exact formula, inputs, benchmark, awarded points, and human-readable justification.

---

## 3. High-Level System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIERS                                   │
│                                                                             │
│   ┌───────────────────────────────┐     ┌───────────────────────────────┐   │
│   │    Web Application (Now)      │     │  Mobile App (Future Target)   │   │
│   │   Next.js App Router (React)  │     │   Flutter or React Native     │   │
│   │   Tailwind CSS + shadcn/ui    │     │   Native iOS / Android        │   │
│   │   TanStack Query Cache        │     │   Shared DTOs & Validation    │   │
│   └───────────────┬───────────────┘     └───────────────┬───────────────┘   │
└───────────────────┼─────────────────────────────────────┼───────────────────┘
                    │ Cookie Session (Web)                │ Bearer Token (Mobile)
                    ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EDGE & GATEWAY LAYER                               │
│                                                                             │
│   - TLS 1.3 Termination & Reverse Proxy                                     │
│   - Route Handler Gateway (/api/v1/*)                                       │
│   - Rate Limiting, Helmet Security Headers, CORS, CSRF Protection           │
│   - Request ID Injection & Request Logging Traceability                     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MODULAR MONOLITH APPLICATION (apps/web)                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ API Routing & Controller Layer (Next.js Route Handlers)               │  │
│  │ - Zod Request Validation (@stock-assistant/contracts)                 │  │
│  │ - Authentication Verification (Auth.js session or JWT Bearer)         │  │
│  │ - Idempotency & Uniform Response Envelope Serialization               │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                       │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │ Application Service & Use-Case Orchestration                          │  │
│  │ - ScreenerService, ValuationService, TradePlanService, AuditService   │  │
│  └───────────┬───────────────────────────────────────────────┬───────────┘  │
└──────────────┼───────────────────────────────────────────────┼──────────────┘
               │                                               │
               ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     @stock-assistant/core     │               │      @stock-assistant/db      │
│                               │               │                               │
│ - Pure Domain Business Logic  │               │ - Prisma Client ORM           │
│ - Stage A/B Scoring Engines   │               │ - PostgreSQL Repositories     │
│ - Red-Flag Detection Rules    │               │ - Unit of Work / Transactions │
│ - Valuation Math (DCF, PEG)   │               │ - Read Replicas & Connection  │
│ - Position Sizing Formulas    │               │   Pool (PgBouncer)            │
└───────────────────────────────┘               └───────────────┬───────────────┘
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENCE LAYER                                 │
│                                                                             │
│   ┌───────────────────────────────────┐ ┌────────────────────────────────┐  │
│   │     PostgreSQL 16+ Database       │ │      pg-boss Job Queue         │  │
│   │ - Relational Storage (Prisma)     │ │ - Asynchronous Ingestion       │  │
│   │ - Point-in-time Financials        │ │ - Alert Rule Evaluation        │  │
│   │ - Immutable Audit Events          │ │ - Batch Scoring Updates        │  │
│   │ - JSONB Snapshot Storage          │ │ - Scheduled Market Sync        │  │
│   └───────────────────────────────────┘ └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Enqueue / Dequeue Jobs
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                       BACKGROUND WORKER SERVICE                             │
│                           (services/worker)                                 │
│                                                                             │
│   - Node.js Daemon running pg-boss queue consumers                          │
│   - Market Data Importers (CSV/Excel & External REST Adapters)              │
│   - Alert Evaluation Engine (Price boundaries, earnings updates)            │
│   - Daily Snapshot Creator & Data Quality Auditor                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Monorepo Architecture (pnpm + Turborepo)

The repository is organised as a high-performance **pnpm + Turborepo** workspace. Every boundary is strictly defined by workspace package dependencies and lint rules.

```
stock-assistant/
├── apps/
│   └── web/                   # Next.js App Router (UI & /api/v1 Route Handlers)
├── packages/
│   ├── core/                  # Pure TypeScript domain & investment engine
│   ├── contracts/             # Zod schemas, API DTOs, Enums, OpenAPI spec
│   ├── db/                    # Prisma ORM, migrations, repository implementations
│   ├── data-providers/        # Adapters for CSV, Excel, SEBI/NSE filings, providers
│   ├── ui/                    # Shared design system, shadcn/ui, Radix primitives
│   └── config/                # Shared ESLint, Prettier, TypeScript & Vitest configs
├── services/
│   └── worker/                # Background job processor (pg-boss daemon)
├── docs/
│   ├── architecture/          # Engineering architecture specifications
│   ├── strategy/              # Investment strategy & handwritten notes blueprint
│   ├── api/                   # OpenAPI contracts and endpoint guides
│   └── decisions/             # Architecture Decision Records (ADRs)
├── turbo.json                 # Turborepo task pipeline configuration
├── pnpm-workspace.yaml        # Workspace package definitions
└── package.json               # Root scripts and dev dependencies
```

### Dependency Direction Matrix

To enforce clean architecture, dependencies must flow strictly in one direction. Cycles are prohibited:

| Layer / Package | Allowed to Import | Strictly Prohibited from Importing |
| :--- | :--- | :--- |
| `apps/web` | `@stock-assistant/contracts`<br>`@stock-assistant/core`<br>`@stock-assistant/db`<br>`@stock-assistant/ui` | Direct SQL drivers, external data scrapers, mock bypasses |
| `packages/core` | `@stock-assistant/contracts`<br>`decimal.js` | React, Next.js, `@stock-assistant/db`, Prisma, HTTP servers |
| `packages/contracts` | `zod` | Any other workspace package (Pure contract definitions) |
| `packages/db` | `@stock-assistant/contracts`<br>`@prisma/client` | Next.js, React, UI components |
| `packages/data-providers` | `@stock-assistant/contracts`<br>`@stock-assistant/core` | React, Next.js, `apps/web` |
| `packages/ui` | `@stock-assistant/contracts` | `packages/db`, `@stock-assistant/core`, `@prisma/client` |
| `services/worker` | `@stock-assistant/core`<br>`@stock-assistant/db`<br>`@stock-assistant/data-providers` | Next.js, React, UI components |

---

## 5. Subsystem Responsibilities

### 5.1. Core Investment Engine (`packages/core`)
- **Stage A Gatekeeper:** Implements the 10 checks for non-financials (Sales growth, Profit growth, OPM, ROE, ROCE, Debt/Equity, Current Ratio, Interest Coverage, P/E vs Industry, ROA) and the 9-check legacy variant for banks/NBFCs. Emits granular points, thresholds, and red flags.
- **Stage B Trend Engine:** Evaluates 8-quarter YoY trends and 5-year annual metrics (Sales, OPM, Net Profit, Reserves vs Borrowings, CFO vs PAT, Debtor Days, ROCE trajectory, and Shareholding shifts).
- **Stage C Moat Assessment:** Calculates moat scoring based on the 5 qualitative tests (Non-copyability, 10-year durability, consistent ROE, pricing power, market share stability).
- **Stage D Valuation Suite:** Computes 4 valuation models (P/E multiple with normalised EPS, PEG ratio, Price-to-Book by sector, and 2-stage DCF model with sensitivity matrix) plus 20% margin-of-safety boundaries.
- **Stage E Technical Timing Context:** Evaluates candlestick patterns (Bullish Engulfing, Hammer, Morning Star, etc.) in the context of 20/50/200-day moving averages and volume confirmation.
- **Stage F Risk & Sizing Calculator:** Calculates maximum position size based on portfolio risk budget (default 1%), entry price, stop-loss price, single-stock cap (default 10%), and sector cap (default 30%).
- **Stage G Monitoring & Invalidation Engine:** Flags thesis invalidation, hard fundamental red-flag breaches, fair-value targets, and trailing stops.

### 5.2. Data Contracts & Validation (`packages/contracts`)
- **Single Source of Truth:** Houses every Zod schema for request validation, response DTOs, and entity definitions.
- **Cross-Platform Readiness:** Zod schemas are compiled to TypeScript types and automatically exported as OpenAPI 3.1 definitions to generate TypeScript / Dart / Kotlin API clients for future mobile applications.
- **Input Sanitisation:** Enforces bounds checking (e.g. `peRatio >= 0`, `marginOfSafety between 0 and 100`, `quantity > 0`).

### 5.3. Persistence & Database Access (`packages/db`)
- **Schema Management:** Manages PostgreSQL schema migrations via Prisma.
- **Repository Pattern:** Encapsulates raw Prisma queries behind clean repository interfaces (e.g., `CompanyRepository`, `FinancialPeriodRepository`, `AnalysisRunRepository`, `TradePlanRepository`).
- **Connection Optimization:** Configured for PgBouncer connection pooling to support high-concurrency serverless or containerised environments.
- **Data Integrity:** Enforces database-level foreign keys, unique compound constraints (e.g. `[companyId, fiscalYear, periodType]`), and row check constraints.

### 5.4. Data Ingestion & Providers (`packages/data-providers`)
- **MVP Ingestion:** High-speed CSV/Excel parser for company financials and market data with comprehensive validation and error feedback.
- **Provider Abstraction:** Defines `MarketDataProvider` and `FinancialStatementProvider` interfaces. Enables seamless future integration with licensed Indian equity data vendors without refactoring business logic.

### 5.5. Background Processing (`services/worker`)
- **PostgreSQL Queue (`pg-boss`):** Utilises PostgreSQL's `SKIP LOCKED` row mechanics to implement guaranteed-delivery, transactional job queues without introducing Redis in Phase 1.
- **Scheduled Tasks:** Manages nightly price bar ingestion, alert evaluation, and batch rescoring against updated benchmarks.

---

## 6. Data Flow & Lifecycle Management

```
1. Ingestion:
   User / Worker ──► CSV/API Payload ──► data-providers ──► Raw Staging DB
                                                               │
2. Normalisation:                                              ▼
   Normalised Periods & Point-in-Time Financials ◄── Validation & Provenance Stamp
   │
   ▼
3. Screening & Analysis Pipeline:
   Trigger Run ──► Fetch Snapshot ──► packages/core Engine ──► Compute Stage A-D
                                                               │
4. Persistence & Audit:                                        ▼
   Store AnalysisRun + StageResults + FlagTriggers + AuditEvent in DB
   │
   ▼
5. Interactive User Review:
   Web UI displays Score Breakdown, Explanations, Red Flags, and Override Controls
```

---

## 7. Operational & Non-Functional Architecture

| Metric | Architectural Target | Mechanism |
| :--- | :--- | :--- |
| **API Response Latency** | < 100ms (p95) for cached/read queries | Next.js Route Handlers + Postgres indexing + TanStack Query caching |
| **Scoring Engine Speed** | < 5ms per company analysis run | Pure in-memory deterministic TypeScript functions |
| **Financial Precision** | Exact to 4 decimal places (currency/shares) | Decimal.js (`numeric` types in DB) |
| **Reproducibility** | 100% exact historical reconstruction | Immutable `analysis_runs` with linked snapshot foreign keys |
| **Scalability** | Single-user personal MVP -> Multi-tenant SaaS | Modular monolith design; multi-tenant `userId` isolation built-in from day 1 |
| **Disaster Recovery** | Point-in-Time Recovery (PITR) | Automated daily PostgreSQL snapshots and WAL archiving |

---

## 8. Path to Future Mobile Expansion

The system is deliberately engineered to prevent architectural rewrite when adding Flutter or React Native mobile clients:
1. **Identical API Endpoints:** Mobile interacts with the exact same `/api/v1/*` endpoints as the web app.
2. **Stateless Token Authentication:** The API layer supports both HTTP-only session cookies (for web browser clients) and signed JWT Bearer tokens (for mobile applications).
3. **No Database Access from Clients:** Direct database connectivity is strictly prohibited across all client applications.
4. **Standardised Contract Package:** The `@stock-assistant/contracts` package generates client-side models and validation logic for both web and mobile platforms.
