# Frontend Architecture: Financial Research Dashboard

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** Frontend Architecture & UI Engineering Specification  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  
**Audience:** Senior Next.js Engineers, Frontend Architects, UI/UX Engineers  

---

## 1. Architectural Philosophy & UX Paradigm

The Personal Stock Market Assistant frontend is designed as a **high-density, professional financial research workstation**, deliberately distinct from generic SaaS templates or consumer trading apps.

### Core Frontend Principles
1. **Zero Financial Calculation in React:**
   All scoring formulas, compound growth rates (CAGR), valuation bands (DCF, PEG), position sizing formulas, and red-flag evaluations are computed by `@stock-assistant/core` or retrieved via `/api/v1`. The frontend is strictly a presentational and interactive shell.
2. **Server-First Data Fetching:**
   Initial page renders, static metadata, and server state hydration are managed via Next.js React Server Components (RSC). Client Components (`"use client"`) are restricted to interactive leaves (e.g. valuation sliders, interactive charting crosshairs, data-table column filters, and modal dialogs).
3. **Optimistic & Resilient Server State:**
   Data fetching and mutations are orchestrated by **TanStack Query (v5)**. Server responses are typed through `@stock-assistant/contracts`.
4. **Information Density & Visual Hierarchy:**
   The UI utilizes compact typography, monospace tabular figures for monetary amounts (`font-mono tabular-nums`), color-coded audit tags, and clear visual separation between hard-stop red flags and soft conditional warnings.
5. **Universal Responsive Design:**
   While optimized for a multi-monitor desktop workstation, the layout degrades gracefully to tablets and mobile viewports via responsive flex/grid systems and bottom navigation sheets.

---

## 2. Next.js App Router Structure & Route Groups

The application leverages Next.js 14+ App Router route groups `(auth)` and `(dashboard)` to isolate layout trees and middleware protection:

```
apps/web/app/
├── (auth)/                               # Unauthenticated / Authentication Layout
│   ├── layout.tsx                        # Clean, focused layout with brand header
│   ├── login/page.tsx                    # Secure password / session login
│   └── error/page.tsx                    # Authentication error boundary
│
└── (dashboard)/                          # Authenticated Application Shell
    ├── layout.tsx                        # Global shell: Sidebar, Topbar, Alert Bar
    ├── dashboard/                        # Screen 1: Executive Overview & Funnel
    │   └── page.tsx
    ├── screener/                         # Screen 2: Stage A Screener & Ingestion
    │   ├── page.tsx
    │   └── loading.tsx
    ├── companies/                        # Screen 3: Deep Company Research
    │   └── [symbol]/
    │       ├── layout.tsx                # Company header, live price, stage tabs
    │       ├── page.tsx                  # Stage overview summary
    │       ├── stage-a/page.tsx          # Stage A: 10-Check Gatekeeper Scorecard
    │       ├── stage-b/page.tsx          # Stage B: Multi-Year & Quarterly Trends
    │       ├── stage-c/page.tsx          # Stage C: Moat Questionnaire & Evidence
    │       ├── stage-d/page.tsx          # Stage D: Valuation Models & Sensitivity
    │       └── financials/page.tsx       # Income Statement, Balance Sheet, Cash Flow
    ├── watchlists/                       # Screen 4: Watchlist Comparison
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── trade-planner/                    # Screen 5: Position Sizer & Buy Plan
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── portfolio/                        # Screen 6: Portfolio & Sector Allocations
    │   ├── page.tsx
    │   └── transactions/page.tsx
    ├── monitoring/                       # Screen 7: Active Alert Center
    │   └── page.tsx
    ├── journal/                          # Screen 8: Trade Journal & Post-Mortem
    │   ├── page.tsx
    │   └── [id]/page.tsx
    └── settings/                         # Screen 9: Risk Settings & Benchmarks
        ├── page.tsx
        └── benchmarks/page.tsx
```

---

## 3. Detailed Screen Architecture (Screens 1 to 10)

### Screen 1: Dashboard (`/dashboard`)
- **Pipeline Funnel Widget:** Visual representation of stocks across stages: Stage A (Passed) ➔ Stage B (Consistent) ➔ Stage C (Moat Verified) ➔ Stage D (Buy Zone) ➔ Active Holdings.
- **Urgent Action / Alert Banner:** High-priority notifications (thesis invalidation triggers, hard fundamental flags, stop breaches).
- **Portfolio Summary Card:** Total equity, available cash buffer, unrealized P&L, day change, and current sector concentration gauge.
- **Watchlist Price Ticker:** Live/latest prices with distance-to-fair-value indicators.

### Screen 2: Stock Screener (`/screener`)
- **Filter Bar:** Sector filter, market-cap bucket, Stage A verdict filter (Exceptional, Excellent, Good, Avoid), red-flag presence filter.
- **Stage A Data Table:** High-density table displaying: Symbol, Sector, Stage A Score (/10 or /9 for banks), Hard Red Flag indicator, Sales Growth, ROE, ROCE, D/E, and Interest Coverage.
- **Quick CSV Import Trigger:** Header action allowing instant upload of financial CSV files for screening.

### Screen 3: Company Research Center (`/companies/[symbol]`)
Shared `layout.tsx` renders persistent stock banner:
- Symbol, Company Name, Industry, Current Market Price, 52-Week High/Low.
- Overall Stage Progression Status Badge (e.g. "Stage D: In Valuation Buy Zone").
- Tabbed Navigation:
  - **Overview:** Executive summary, key statistics, and stage progression timeline.
  - **Stage A (Gatekeeper):** Interactive 10-point checklist. Expanding any card reveals the formula, input values, sector benchmark comparison, points awarded, and textual explanation.
  - **Stage B (Trends):** Synchronized multi-panel trend charts: 8-quarter YoY Sales & OPM, 5-year Revenue & PAT, Reserves vs Borrowings, Debtor Days, and Shareholding breakdown (Promoter vs FII vs DII vs Public).
  - **Stage C (Moat):** 5-test assessment form with substantiated vs unsubstantiated evidence tags, pricing power proof, and competitor copyability analysis.
  - **Stage D (Valuation):** Valuation comparison matrix (P/E, PEG, P/B, DCF). Interactive DCF scenario sliders (discount rate, terminal growth rate) and 20% Margin of Safety buy ceiling indicator.
  - **Financial Statements:** Interactive multi-year spreadsheet view for Consolidated and Standalone statements.

### Screen 4: Watchlist & Multi-Stock Comparison (`/watchlists`)
- Side-by-side comparative table for shortlisted equities.
- Comparison metrics: Valuation discount %, Stage A score, ROE 5Y CAGR, Debt/Equity, Moat rating.
- Inline tagging for user research priorities.

### Screen 5: Trade Planner & Risk Sizing (`/trade-planner`)
- **Position Sizing Calculator:**
  - Inputs: Selected Stock, Target Entry Price, Invalidation / Stop Price, Risk Budget % (default 1%).
  - Real-time Output: Calculated Share Quantity, Total Capital Required, Max Potential Rupee Loss at Stop.
- **Portfolio Exposure Preview:** Interactive gauge showing resulting single-stock allocation % (vs 10% cap) and sector concentration % (vs 30% cap).
- **Thesis & Invalidation Record:** Compulsory fields for entry rationale, expected holding timeframe, and quantitative invalidation conditions.

### Screen 6: Portfolio & Position Tracking (`/portfolio`)
- **Open Holdings Ledger:** Average buy price, current price, quantity, current value, unrealized P&L, distance to target, distance to stop.
- **Sector Diversification Treemap / Pie Chart:** Visual breakdown of invested capital across sectors.
- **Manual Trade Entry Form:** Record executed buys, partial trims, and dividend receipts.

### Screen 7: Monitoring Center & Alert Desk (`/monitoring`)
- Filterable feed categorised into:
  - Fundamental Alerts (new quarterly results, margin compression, debt spike).
  - Valuation Alerts (stock entering 20% margin-of-safety buy zone).
  - Technical Alerts (candlestick pattern confirmed at key support).
  - Portfolio Alerts (position exceeding maximum exposure limit).
- Action buttons: "Acknowledge", "Open Research", "Trigger Thesis Review".

### Screen 8: Trade Journal & Post-Trade Review (`/journal`)
- History of completed/closed investments.
- Post-Mortem Audit Form: Did the original thesis play out? Was the exit disciplined? Identification of emotional or cognitive biases.
- Performance Attribution: Returns driven by earnings growth vs P/E multiple expansion.

### Screen 9: Settings & Rule-Set Versioning (`/settings`)
- Configuration of risk defaults (Risk per trade %, Max stock %, Max sector %).
- Rule-set version manager (view active scoring rules, draft custom rule variants, audit changelog).
- Sector benchmark editor: Customize note-derived baseline thresholds per sector.

### Screen 10: Data Ingestion & Quality Manager (`/settings/data`)
- CSV file dropzone supporting Screener.in and standard exchange filing formats.
- Ingestion error log and column-mapping preview.
- Data Provenance Inspector: View reported date, currency, adjustment flags, and source tags for any company.

---

## 4. Component Hierarchy & Organization

Components are organized into three distinct tiers:

```
apps/web/components/
├── layout/                               # App shell and structural frames
│   ├── app-sidebar.tsx                   # Desktop navigation sidebar
│   ├── app-topbar.tsx                    # Search bar, command palette, profile
│   ├── alert-bar.tsx                     # Top banner for critical warnings
│   └── mobile-nav.tsx                    # Responsive mobile navigation drawer
│
├── features/                             # Domain-specific smart components
│   ├── screener/
│   │   ├── screener-table.tsx            # Stage A data grid
│   │   ├── score-pill.tsx                # Verdict badge (Exceptional/Avoid)
│   │   └── red-flag-list.tsx             # Collapsible trigger list
│   ├── company-research/
│   │   ├── stage-a-card.tsx              # Single check explanation card
│   │   ├── stage-b-trend-grid.tsx        # Multi-chart synchronization grid
│   │   ├── stage-c-moat-test.tsx         # Moat test question item
│   │   └── stage-d-scenario-slider.tsx   # DCF assumption sliders
│   ├── trade-planner/
│   │   ├── position-calculator.tsx       # Dynamic sizing widget
│   │   └── exposure-gauge.tsx            # Radial progress for portfolio caps
│   └── portfolio/
│       ├── holdings-table.tsx            # Active position table
│       └── allocation-chart.tsx          # Sector allocation bar/donut
│
└── shared/                               # Dumb, highly reusable UI primitives
    ├── data-table/                       # Reusable TanStack Table wrapper
    │   ├── data-table.tsx
    │   ├── data-table-pagination.tsx
    │   └── data-table-toolbar.tsx
    ├── financial/
    │   ├── currency-display.tsx          # ₹ Lakhs/Crores aware formatter
    │   ├── percentage-change.tsx         # Colored (+/-) percentage display
    │   └── flag-badge.tsx                # Hard Stop vs Warning indicator
    └── states/
        ├── loading-card.tsx              # Skeleton loader
        ├── error-card.tsx                # Retryable error boundary state
        └── empty-state.tsx               # Empty list / no results view
```

---

## 5. Server Component vs Client Component Boundaries

To achieve maximum performance and SEO while preserving interactive rich dashboard capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│               Server Component (page.tsx)                   │
│  - Fetches company data & snapshot from API/Service         │
│  - Generates OpenGraph metadata & SEO tags                  │
│  - Renders structural HTML, headers, and SSR tables         │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Client Component Boundary                 │   │
│   │                 ("use client")                      │   │
│   │                                                     │   │
│   │  - ValuationSlider (Interactive DCF WACC/Growth)    │   │
│   │  - TradingView Lightweight Candlestick Chart        │   │
│   │  - TanStack Table (Client sorting, column toggle)   │   │
│   │  - TradePlan Calculator (Real-time math updates)    │   │
│   │  - Interactive Override Modal Dialog                │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Boundary Rule
A component must remain a Server Component **unless** it:
1. Uses React state or lifecycle hooks (`useState`, `useReducer`, `useEffect`).
2. Attaches DOM event listeners (`onClick`, `onChange`, `onKeyDown`).
3. Uses browser-only APIs (`window`, `localStorage`, `ResizeObserver`).
4. Wraps client-only libraries (e.g. Lightweight Charts, Radix interactive primitives).

---

## 6. Client State & Server State Architecture

State is strictly partitioned between server cache and client-local state:

### 6.1. Server State: TanStack Query (v5)
- **All remote data is managed by TanStack Query.**
- Cache keys follow a deterministic hierarchical tuple:
  ```ts
  export const queryKeys = {
    companies: {
      all: ['companies'] as const,
      detail: (symbol: string) => ['companies', symbol] as const,
      financials: (symbol: string) => ['companies', symbol, 'financials'] as const,
      analyses: (symbol: string) => ['companies', symbol, 'analyses'] as const,
    },
    screener: (filters: ScreenerFilters) => ['screener', filters] as const,
    portfolio: ['portfolio'] as const,
    alerts: ['alerts'] as const,
  };
  ```
- **Stale Time Configuration:**
  - Company historical financials: `Infinity` (immutable until new filing uploaded).
  - Screener results: `5 minutes`.
  - Portfolio positions: `30 seconds`.
  - Market prices: `1 minute` during market hours.

### 6.2. Client UI State: Zustand
- Only transient, browser-owned UI state is managed in Zustand:
  - Sidebar collapse/expand state.
  - Active research tab selection.
  - Chart synchronization crosshairs.
  - Temporary trade plan draft buffer.

---

## 7. Charting Architecture

The application requires two distinct charting capabilities:

1. **Market Price & Technical Analysis:**
   - Powered by **TradingView Lightweight Charts** (Canvas-based, high performance).
   - Features: Daily/Weekly OHLCV candlesticks, 20/50/200-day Simple & Exponential Moving Averages, volume histogram, support/resistance price lines.
2. **Fundamental Multi-Year Trends & Valuation Ranges:**
   - Powered by **Recharts / Visx** (SVG-based, accessible, theme-integrated).
   - Features: 8-quarter YoY margin trajectory, 5-year Sales vs PAT dual-axis bar charts, shareholding stacked area charts, DCF sensitivity tornado charts.

---

## 8. Financial Formatting & Internationalization (Indian Equity Focus)

Financial values must adhere to Indian numbering and currency conventions:

```ts
// apps/web/lib/formatters.ts
export function formatINR(amount: number | string, options?: { inCrores?: boolean }): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return 'N/A';
  
  if (options?.inCrores) {
    const crores = value / 10_000_000;
    return `₹${crores.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  }
  
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
```

Rules:
- Monospace font numbers: `font-mono tabular-nums` for all tabular financial columns.
- Currency sign: Explicit `₹` symbol (never ambiguous `$` or missing currency).
- Missing data: Formatted as explicit `N/A` or `Not Available` with tooltip explanation, **never** rendered as `0` or `0.00`.

---

## 9. Error, Loading, and Empty State Standards

Every dashboard view implements a strict 3-state UX lifecycle:
1. **Loading State:** Content-matched Skeleton components (`<Skeleton className="h-8 w-full" />`), matching exact table rows and chart aspect ratios to prevent Layout Shift (CLS).
2. **Empty State:** Distinct illustrations with helpful call-to-actions (e.g. "No companies analyzed yet. Click 'Import Financials' or run Stage A on a symbol").
3. **Error State:** Granular error cards with error codes, human explanations, and a "Retry" button linked to TanStack Query's `refetch()`.
