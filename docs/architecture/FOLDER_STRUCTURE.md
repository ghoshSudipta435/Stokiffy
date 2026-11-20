# Folder Structure & Monorepo Layout

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** Folder Structure & Directory Blueprint  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  

---

## 1. Monorepo Organization Overview

The project uses **pnpm workspaces** managed by **Turborepo**. The monorepo separates web user interface, domain calculation logic, data contracts, database persistence, external data adapters, background worker tasks, and engineering documentation into isolated directories.

```
stock-assistant/
├── apps/                          # Deployable client applications
│   └── web/                       # Next.js 14+ App Router application & /api/v1 routes
├── packages/                      # Shared libraries & packages
│   ├── core/                      # Pure TypeScript investment & scoring domain engine
│   ├── contracts/                 # Zod validation schemas, DTOs, API contracts
│   ├── db/                        # Prisma ORM, migrations, database repositories
│   ├── data-providers/            # Market & financial data ingestion adapters
│   ├── ui/                        # Reusable shadcn/ui components & design system
│   └── config/                    # Shared TypeScript, ESLint, Prettier, Vitest configs
├── services/                      # Standalone backend support services
│   └── worker/                    # Asynchronous job processor (pg-boss background daemon)
├── docs/                          # Project specifications and architecture
│   ├── architecture/              # Engineering architecture and system design
│   ├── strategy/                  # Investment strategies and note-derived rules
│   ├── api/                       # OpenAPI specifications and integration guides
│   └── decisions/                 # Architectural Decision Records (ADRs)
├── .github/                       # CI/CD workflows and automation
│   └── workflows/
│       ├── ci.yml                 # Lint, typecheck, test, and build pipeline
│       └── audit.yml              # Security and dependency audit
├── .gitignore                     # Git ignore rules for node, next, coverage, dist
├── .npmrc                         # pnpm configuration and peer-dependency hoisting
├── package.json                   # Root package definition & scripts
├── pnpm-workspace.yaml            # pnpm workspace definition
├── tsconfig.base.json             # Root TypeScript configuration
└── turbo.json                     # Turborepo task pipeline execution graph
```

---

## 2. Exhaustive Directory Breakdown

### 2.1. `apps/web/` — Next.js Application & API Gateway
Contains the responsive web dashboard and the versioned `/api/v1` Route Handlers.

```
apps/web/
├── app/                                  # Next.js App Router root
│   ├── (auth)/                           # Route Group: Authentication flows
│   │   ├── login/
│   │   │   └── page.tsx                  # Login screen
│   │   ├── register/
│   │   │   └── page.tsx                  # Account registration (protected in personal mode)
│   │   └── layout.tsx                    # Minimalist auth layout (centred card)
│   ├── (dashboard)/                      # Route Group: Authenticated application
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Pipeline funnel, alerts, portfolio snapshot
│   │   ├── screener/
│   │   │   ├── page.tsx                  # Stage A filter, table, CSV import trigger
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Deep screener result breakdown
│   │   ├── companies/
│   │   │   └── [symbol]/
│   │   │       ├── page.tsx              # Company research overview
│   │   │       ├── stage-a/page.tsx      # Stage A gatekeeper scorecard
│   │   │       ├── stage-b/page.tsx      # Stage B multi-year trend charts
│   │   │       ├── stage-c/page.tsx      # Stage C moat questionnaire & evidence
│   │   │       ├── stage-d/page.tsx      # Stage D valuation models (P/E, PEG, P/B, DCF)
│   │   │       ├── financials/page.tsx   # Balance sheet, P&L, Cash flow statement views
│   │   │       └── layout.tsx            # Company header, sub-navigation tabs, stock ticker
│   │   ├── watchlists/
│   │   │   ├── page.tsx                  # Watchlist overview and comparisons
│   │   │   └── [id]/page.tsx             # Filtered watchlist view
│   │   ├── trade-planner/
│   │   │   ├── page.tsx                  # Stage F trade plan creator & position sizer
│   │   │   └── [id]/page.tsx             # Active trade plan details & risk checks
│   │   ├── portfolio/
│   │   │   ├── page.tsx                  # Positions, sector allocation, P&L
│   │   │   └── transactions/page.tsx     # Historical manual trades and dividends
│   │   ├── monitoring/
│   │   │   └── page.tsx                  # Active alerts, trigger events, reviews
│   │   ├── journal/
│   │   │   ├── page.tsx                  # Closed trades, post-mortem reviews, lessons
│   │   │   └── [id]/page.tsx             # Detailed trade journal review entry
│   │   ├── settings/
│   │   │   ├── page.tsx                  # Risk limits, rule-set versioning, API keys
│   │   │   └── benchmarks/page.tsx       # Sector benchmark ratio configuration
│   │   └── layout.tsx                    # Shell layout: Sidebar, topbar, alert banner
│   ├── api/                              # Route Handler Gateway
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts    # Auth.js / NextAuth handler
│   │   └── v1/                           # Version 1 API boundary
│   │       ├── auth/
│   │       │   ├── token/route.ts        # Mobile token issuance (JWT)
│   │       │   └── me/route.ts           # Current user profile
│   │       ├── companies/
│   │       │   ├── route.ts              # Search & list companies
│   │       │   └── [id]/
│   │       │       ├── route.ts          # Company profile
│   │       │       ├── financials/route.ts# Historical financials
│   │       │       ├── prices/route.ts   # OHLCV price series
│   │       │       └── shareholding/route.ts# Quarterly ownership
│   │       ├── analyses/
│   │       │   ├── stage-a/route.ts      # Execute / retrieve Stage A gate run
│   │       │   ├── stage-b/route.ts      # Execute / retrieve Stage B trend run
│   │       │   └── [id]/
│   │       │       └── override/route.ts # Submit documented flag override
│   │       ├── moat-assessments/
│   │       │   └── route.ts              # Stage C qualitative moat evaluation
│   │       ├── valuations/
│   │       │   └── route.ts              # Stage D fair-value computation
│   │       ├── trade-plans/
│   │       │   ├── route.ts              # Stage F position sizing & plan creation
│   │       │   └── [id]/route.ts         # Update / cancel trade plan
│   │       ├── portfolio/
│   │       │   ├── summary/route.ts      # Allocation, exposure, cash balance
│   │       │   └── positions/route.ts    # Open holdings & transactions
│   │       ├── alerts/
│   │       │   ├── route.ts              # Active system alerts
│   │       │   └── [id]/ack/route.ts     # Acknowledge / dismiss alert
│   │       ├── rule-sets/
│   │       │   ├── route.ts              # Active & draft scoring rule versions
│   │       │   └── [id]/publish/route.ts # Publish versioned rule set
│   │       └── ingestion/
│   │           ├── upload-csv/route.ts   # Financial data CSV import
│   │           └── status/[jobId]/route.ts# Asynchronous ingestion status
│   ├── favicon.ico
│   ├── globals.css                       # Tailwind root directives & theme tokens
│   ├── layout.tsx                        # Global HTML root layout
│   └── not-found.tsx                     # 404 handler
├── components/                           # Web-specific components (features & layouts)
│   ├── layout/
│   │   ├── app-sidebar.tsx               # Collapsible dashboard navigation
│   │   ├── app-topbar.tsx                # Breadcrumbs, quick search, user menu
│   │   ├── alert-bar.tsx                 # High-priority system alert banner
│   │   └── mobile-nav.tsx                # Responsive bottom navigation bar
│   ├── features/                         # Domain feature-specific component trees
│   │   ├── screener/
│   │   │   ├── screener-table.tsx        # Filterable Stage A summary table
│   │   │   ├── score-badge.tsx           # Exceptional / Excellent / Good / Avoid badge
│   │   │   └── screener-filters.tsx      # Sector, market cap, and score filters
│   │   ├── company-research/
│   │   │   ├── company-header.tsx        # Symbol, sector, current price, stage status
│   │   │   ├── stage-a-card.tsx          # 10-check breakdown with formulas and explanations
│   │   │   ├── stage-b-trend-chart.tsx   # Multi-year YoY trend visualization
│   │   │   ├── stage-c-moat-form.tsx     # 5-test qualitative moat evaluation form
│   │   │   └── stage-d-valuation-card.tsx# P/E, PEG, P/B, DCF fair value slider & MOS
│   │   ├── trade-planner/
│   │   │   ├── position-calculator.tsx   # Dynamic risk budget and stop-loss calculator
│   │   │   └── risk-exposure-preview.tsx # Sector and single-stock exposure gauge
│   │   ├── portfolio/
│   │   │   ├── portfolio-summary.tsx     # Net worth, unrealized P&L, cash buffer
│   │   │   └── position-list.tsx         # Open holdings table with stop triggers
│   │   ├── monitoring/
│   │   │   └── alert-feed.tsx            # Chronological alert stream with filters
│   │   └── journal/
│   │       └── journal-entry-form.tsx    # Trade review and emotional bias capture
│   └── shared/
│       ├── data-table.tsx                # TanStack Table reusable component
│       ├── financial-metric.tsx          # Formatted currency/percentage display
│       ├── red-flag-indicator.tsx        # Hard stop / warning visual alert
│       └── empty-state.tsx               # Generic empty view placeholder
├── hooks/                                # Client-side custom hooks
│   ├── use-screener.ts                   # TanStack Query hook for screener queries
│   ├── use-company.ts                    # Hook for company profile & financials
│   ├── use-analysis.ts                   # Hook for running Stage A/B evaluations
│   ├── use-valuation.ts                  # Hook for interactive valuation calculator
│   └── use-portfolio.ts                  # Hook for portfolio balances and orders
├── lib/                                  # Web utility modules
│   ├── api-client.ts                     # Type-safe Fetch wrapper for /api/v1
│   ├── query-client.ts                   # TanStack Query client configuration
│   ├── auth.ts                           # Auth.js configuration & session helpers
│   ├── formatters.ts                     # Currency (INR), percentage, and date formatters
│   └── error-handling.ts                 # Client-side API error transformer
├── middleware.ts                         # Edge middleware for route protection & headers
├── next.config.mjs                       # Next.js configuration (Turbopack, headers)
├── tailwind.config.ts                    # Tailwind styling configuration
└── tsconfig.json                         # App-specific TypeScript configuration
```

---

### 2.2. `packages/core/` — Investment & Scoring Domain Engine
Pure TypeScript library containing financial models, stage rules, and calculations. Zero framework dependencies.

```
packages/core/
├── src/
│   ├── index.ts                          # Public package exports
│   ├── common/                           # Common domain primitives
│   │   ├── decimal.ts                    # Arbitrary-precision math wrappers (Decimal.js)
│   │   ├── errors.ts                     # Domain-specific error classes
│   │   └── types.ts                      # Common internal types
│   ├── stage-a/                          # Stage A: Quick Screening Gatekeeper
│   │   ├── engine.ts                     # Stage A calculation orchestrator
│   │   ├── rules/
│   │   │   ├── sales-growth.ts           # 1Y YoY & 5Y CAGR sales rule
│   │   │   ├── profit-growth.ts          # 1Y YoY & 5Y CAGR profit rule
│   │   │   ├── opm.ts                    # Operating profit margin vs sector benchmark
│   │   │   ├── roe.ts                    # Return on Equity scoring & 1Y vs 5Y
│   │   │   ├── roce.ts                   # Return on Capital Employed scoring
│   │   │   ├── debt-to-equity.ts         # D/E ratio scoring (<0.5, 0.5-1.25, >1.25)
│   │   │   ├── current-ratio.ts          # Current ratio (>2, 1-2, <1)
│   │   │   ├── interest-coverage.ts      # EBIT / Interest (>10, 5-10, 3-5, <3)
│   │   │   ├── pe-vs-industry.ts         # Company P/E vs Industry benchmark ratio
│   │   │   └── roa.ts                    # Return on Assets vs sector minimum
│   │   ├── bank-variant.ts               # 9-point bank/NBFC legacy scoring engine
│   │   └── red-flags.ts                  # Hard red-flag evaluation & explanation engine
│   ├── stage-b/                          # Stage B: Deep Trend Analysis Engine
│   │   ├── engine.ts                     # Stage B 10-point orchestrator
│   │   ├── rules/
│   │   │   ├── quarterly-sales-trend.ts  # 8-quarter YoY sales consistency
│   │   │   ├── quarterly-opm-trend.ts    # 8-quarter YoY OPM trajectory
│   │   │   ├── annual-sales-trend.ts     # 5-year annual revenue growth pattern
│   │   │   ├── annual-opm-trend.ts       # 5-year annual operating margin stability
│   │   │   ├── net-profit-trend.ts       # PAT & NPM simultaneous expansion
│   │   │   ├── balance-sheet-reserves.ts # Reserves expansion vs borrowings reduction
│   │   │   ├── cfo-vs-pat.ts             # Cash from Operations / Net Profit forensic check
│   │   │   ├── debtor-days-trend.ts      # Debtor days trend & >120 days hard stop
│   │   │   ├── roce-trend.ts             # Multi-year ROCE trajectory
│   │   │   └── shareholding-pattern.ts   # Promoter/FII/DII/Public holding matrix
│   │   └── trend-classifier.ts           # Deterministic trend classification algorithms
│   ├── stage-c/                          # Stage C: Moat & Business Quality
│   │   ├── engine.ts                     # Moat score calculator (≥3/5 pass check)
│   │   ├── moat-rubric.ts                # Non-copyability, 10Y durability, pricing power
│   │   └── business-model-metrics.ts     # Subscription, manufacturing, marketplace criteria
│   ├── stage-d/                          # Stage D: Valuation Framework
│   │   ├── engine.ts                     # Multi-model valuation aggregator
│   │   ├── models/
│   │   │   ├── pe-valuation.ts           # Normalised EPS × target P/E multiple
│   │   │   ├── peg-valuation.ts          # PEG calculation & valuation band classifier
│   │   │   ├── pb-valuation.ts           # Sector-specific Price-to-Book fair value
│   │   │   └── dcf-valuation.ts          # 2-stage DCF, terminal value & WACC calculator
│   │   ├── margin-of-safety.ts           # 20% discount calculation & buy zone ceiling
│   │   └── sensitivity.ts                # DCF discount rate vs terminal growth matrix
│   ├── stage-e/                          # Stage E: Technical Timing & Context
│   │   ├── patterns/
│   │   │   ├── candlestick.ts            # Hammer, Engulfing, Morning Star detectors
│   │   │   └── moving-averages.ts        # 20, 50, 200 SMA/EMA & Golden Cross checks
│   │   └── entry-context.ts              # Confluence check: Buy Zone + Technical Confirmation
│   ├── stage-f/                          # Stage F: Buy Plan & Portfolio Risk
│   │   ├── position-sizer.ts             # Risk budget / (Entry - Stop) sizing formula
│   │   ├── risk-limits.ts                # Single-stock (10%) & Sector (30%) limits
│   │   └── order-plan.ts                 # Order staging, limit prices, target laddering
│   └── stage-g/                          # Stage G: Monitoring & Review Engine
│       ├── alert-evaluator.ts            # Fundamental & technical trigger evaluations
│       ├── exit-rules.ts                 # Thesis broken, hard flag, stop hit, target reach
│       └── journal-metrics.ts            # Realised return, CAGR, holding period metrics
├── tests/                                # Vitest unit test suite
│   ├── stage-a.test.ts                   # Threshold boundary and red-flag unit tests
│   ├── stage-b.test.ts                   # Trend evaluation and shareholding tests
│   ├── stage-c.test.ts                   # Moat rubric tests
│   ├── stage-d.test.ts                   # Valuation formulas and sensitivity tests
│   ├── stage-f.test.ts                   # Position sizing and risk limit tests
│   └── golden-fixtures/                  # Hand-calculated reference data (TCS, HUL)
│       ├── tcs-stage-a.json
│       └── hul-stage-a.json
├── package.json
└── tsconfig.json
```

---

### 2.3. `packages/contracts/` — Validation Schemas, DTOs & Contracts
Shared Zod schemas and OpenAPI contract definitions used by the API, web, and future mobile clients.

```
packages/contracts/
├── src/
│   ├── index.ts                          # Public exports
│   ├── enums/                            # Shared domain enums
│   │   ├── sector.ts                     # IT, Pharma, FMCG, Banking, Auto, etc.
│   │   ├── period-type.ts                # Annual, Quarterly, TTM
│   │   ├── stage-verdict.ts              # Exceptional, Excellent, Good, Avoid
│   │   ├── flag-severity.ts              # HardStop, ConditionalWarning, QualityWarning
│   │   └── moat-type.ts                  # Brand, NetworkEffect, CostAdvantage, SwitchingCost
│   ├── models/                           # Core entity DTO schemas
│   │   ├── company.ts                    # Company profile schema
│   │   ├── financial-statement.ts        # Normalised P&L, Balance Sheet, Cash Flow
│   │   ├── price-bar.ts                  # OHLCV price series
│   │   ├── analysis-run.ts               # Stage result and flag trigger schemas
│   │   ├── trade-plan.ts                 # Order plan, risk budget, sizing schema
│   │   └── alert.ts                      # Alert notification schema
│   ├── api/                              # Request & Response HTTP contracts
│   │   ├── common.ts                     # Uniform ApiResponse envelope, Pagination params
│   │   ├── companies.ts                  # /api/v1/companies request/response
│   │   ├── analyses.ts                   # /api/v1/analyses request/response
│   │   ├── valuations.ts                 # /api/v1/valuations request/response
│   │   ├── trade-plans.ts                # /api/v1/trade-plans request/response
│   │   └── portfolio.ts                  # /api/v1/portfolio request/response
│   └── openapi/                          # OpenAPI 3.1 generator
│       └── generate-spec.ts              # Script compiling Zod schemas into openapi.json
├── package.json
└── tsconfig.json
```

---

### 2.4. `packages/db/` — PostgreSQL Database & Prisma ORM
Houses the database schema, migration history, client client factory, and data repositories.

```
packages/db/
├── prisma/
│   ├── schema.prisma                     # Prisma relational data model definition
│   ├── migrations/                       # Immutable SQL migration files
│   │   └── 20261115000000_init/
│   │       └── migration.sql
│   └── seeds/                            # Database seeding scripts
│       ├── seed.ts                       # Main database seeder
│       ├── sector-benchmarks.json        # Initial handwritten note benchmark values
│       └── sample-companies.json         # Reference companies for development
├── src/
│   ├── index.ts                          # Exports prisma client and repositories
│   ├── client.ts                         # PrismaClient singleton with PgBouncer tuning
│   ├── repositories/                     # Data access repository classes
│   │   ├── company-repository.ts         # Company profile & ticker lookups
│   │   ├── financials-repository.ts      # Financial periods & statement persistence
│   │   ├── analysis-repository.ts        # Immutable analysis run snapshots
│   │   ├── trade-plan-repository.ts      # Active/historical trade plan persistence
│   │   ├── portfolio-repository.ts       # Positions and transaction ledgers
│   │   ├── alert-repository.ts           # System alert lifecycle management
│   │   └── audit-repository.ts           # Append-only audit event logger
│   └── utils/
│       ├── transaction.ts                # Unit of work transaction wrapper
│       └── soft-delete.ts                # Logical deletion middleware
├── package.json
└── tsconfig.json
```

---

### 2.5. `packages/data-providers/` — Market & Financial Data Adapters
Adapters for importing data from CSV/Excel and future external market data APIs.

```
packages/data-providers/
├── src/
│   ├── index.ts                          # Public exports
│   ├── interfaces/                       # Standard provider interfaces
│   │   ├── financial-provider.ts         # Financial statements provider interface
│   │   └── market-data-provider.ts       # OHLCV price bars provider interface
│   ├── csv/                              # CSV / Excel file import adapter
│   │   ├── parser.ts                     # Streaming CSV parser with row validation
│   │   ├── statement-mapper.ts           # Maps Screener.in / raw CSV rows to DTOs
│   │   └── validator.ts                  # Sanity checks for units, dates, sign conventions
│   └── external/                         # External licensed API adapters (Future)
│       ├── base-client.ts                # Resilient HTTP client with retry & rate-limit
│       └── mock-provider.ts              # Deterministic mock provider for tests
├── package.json
└── tsconfig.json
```

---

### 2.6. `packages/ui/` — Design System & Shared Component Library
Reusable UI component primitives built with Tailwind CSS, Radix UI, and shadcn/ui.

```
packages/ui/
├── src/
│   ├── index.ts                          # Component exports
│   ├── components/                       # Primitive UI elements
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx
│   │   ├── table.tsx
│   │   ├── tooltip.tsx
│   │   ├── slider.tsx
│   │   └── progress.tsx
│   ├── charts/                           # Chart visual primitives
│   │   ├── lightweight-candlestick.tsx   # TradingView Lightweight Chart wrapper
│   │   ├── trend-line-chart.tsx          # Multi-year metric trajectory chart
│   │   └── valuation-gauge.tsx           # Margin of safety visual gauge
│   └── lib/
│       └── utils.ts                      # cn() class merging utility (clsx + tailwind-merge)
├── package.json
└── tsconfig.json
```

---

### 2.7. `packages/config/` — Shared Engineering Tooling Configurations
Standardises formatting, linting, TypeScript compiler options, and test runners across packages.

```
packages/config/
├── eslint/
│   ├── base.js                           # Base ESLint rules (strict boundaries)
│   ├── next.js                           # Next.js specific linting
│   └── react.js                          # React specific linting
├── typescript/
│   ├── base.json                         # Strict TypeScript base configuration
│   ├── nextjs.json                       # Next.js App Router tsconfig
│   └── react-library.json                # React package tsconfig
├── prettier/
│   └── index.json                        # Shared code formatting options
├── vitest/
│   └── vitest.base.ts                    # Vitest base runner configuration
└── package.json
```

---

### 2.8. `services/worker/` — Background Daemon & Job Queue
Background process executing long-running and scheduled jobs via `pg-boss`.

```
services/worker/
├── src/
│   ├── index.ts                          # Worker daemon entry point & shutdown hooks
│   ├── queue.ts                          # pg-boss client initialization
│   ├── jobs/                             # Background job consumers
│   │   ├── process-csv-import.ts         # Asynchronous financial statement ingestion
│   │   ├── evaluate-daily-alerts.ts      # Price & fundamental alert checker
│   │   ├── rescore-watchlist-stocks.ts   # Batch rescoring on benchmark revisions
│   │   └── daily-data-quality-audit.ts   # Stale data detection & anomaly logger
│   └── scheduler.ts                      # Cron-like recurring job definitions
├── Dockerfile                            # Production container image for worker
├── package.json
└── tsconfig.json
```

---

## 3. Package Resolution & Path Aliases

All packages are referenced across the monorepo using their scoped names via `pnpm:` protocol:

```json
{
  "dependencies": {
    "@stock-assistant/core": "workspace:*",
    "@stock-assistant/contracts": "workspace:*",
    "@stock-assistant/db": "workspace:*",
    "@stock-assistant/ui": "workspace:*",
    "@stock-assistant/data-providers": "workspace:*"
  }
}
```

Path aliases inside `apps/web/tsconfig.json`:
- `@/*` -> `./*`
- `@components/*` -> `./components/*`
- `@features/*` -> `./components/features/*`
- `@hooks/*` -> `./hooks/*`
- `@lib/*` -> `./lib/*`
