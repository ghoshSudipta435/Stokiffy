# API Architecture & Contract Specification

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** API Architecture, Design Principles & Endpoint Catalog  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  
**Audience:** Backend Architects, API Engineers, Mobile Developers, Frontend Engineers  

---

## 1. Architectural Strategy: Next.js Route Handlers as Modular Monolith

### Architectural Evaluation
A foundational design question for Phase 0 is whether **Next.js App Router Route Handlers** (`apps/web/app/api/v1/*`) are sufficient to serve as the unified API gateway, or whether an independent Node.js backend (e.g. NestJS, Express, FastAPI, or Go microservices) is required immediately.

**Architectural Decision:** Next.js Route Handlers are **architecturally superior and fully sufficient** for the modular monolith in this phase, for the following reasons:
1. **Zero Microservice Tax:** Eliminates operational complexity, cross-service networking overhead, container clustering, independent deployment orchestration, and distributed tracing during initial phases.
2. **Unified Type Safety:** Shared workspace packages (`@stock-assistant/contracts`, `@stock-assistant/core`, `@stock-assistant/db`) can be consumed directly by route handlers without publishing npm packages or maintaining duplicate protobuf/OpenAPI code generators.
3. **Identical HTTP Contract for Mobile:** Because Route Handlers run standard Web Request/Response primitives, they expose an identical, standard RESTful HTTP interface. A future Flutter or React Native mobile client consumes `/api/v1` in exactly the same way as an external native app would consume any standalone backend.
4. **Clean Separation of Concerns:** Route Handlers act purely as HTTP controllers: they validate incoming Zod payloads, check authentication, call domain services in `@stock-assistant/core`, and persist via `@stock-assistant/db`. No business logic lives in route files.

*Service Extraction Path:* If traffic or computational demands scale in later phases, the application service layer can be extracted into an independent containerized backend with zero rewrite of domain logic or API contracts.

---

## 2. API Design Principles & Conventions

1. **Base URL & Versioning:**
   All public RESTful endpoints are strictly prefixed under `/api/v1/`. Breaking changes will be introduced via `/api/v2/`.
2. **Uniform Response Envelope:**
   Every API response (success or failure) is wrapped in a consistent JSON structure.
3. **Cursor-Based Pagination:**
   All collection endpoints implement cursor-based pagination for deterministic scrolling and stable infinite loading across web and mobile.
4. **Stateless Authentication:**
   Supports dual authentication:
   - Web App: Encrypted, HTTP-only, `SameSite=Strict` session cookies via Auth.js.
   - Mobile App: `Authorization: Bearer <JWT>` header with RS256/EdDSA asymmetric token verification.
5. **Idempotent Writes:**
   State-altering endpoints (e.g., trade plan creation, order submission, flag overrides) accept an `Idempotency-Key` header (UUID v4) to prevent duplicate execution during network retries.
6. **UTC Timestamps & ISO 8601:**
   All datetime attributes are transmitted in UTC formatted as ISO 8601 strings (e.g. `2026-11-15T12:34:56.789Z`).
7. **Opaque Identifiers:**
   Database IDs are opaque strings (CUID2 or UUID v7) rather than sequential auto-incrementing integers, preventing enumeration attacks across client boundaries.

---

## 3. Uniform Response & Error Envelope

### 3.1. Success Envelope (`ApiResponse<T>`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_01hb4c5d6e7f8g9h",
    "timestamp": "2026-11-15T12:34:56.789Z",
    "version": "1.0.0"
  }
}
```

### 3.2. Paginated Success Envelope (`PaginatedApiResponse<T>`)
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "cursor": "cuid_01hb4c5d6e7f8g9h",
    "limit": 25,
    "hasMore": true,
    "totalCount": 142
  },
  "meta": {
    "requestId": "req_01hb4c5d6e7f8g9h",
    "timestamp": "2026-11-15T12:34:56.789Z",
    "version": "1.0.0"
  }
}
```

### 3.3. Error Envelope (RFC 7807 Compliant)
```json
{
  "success": false,
  "error": {
    "code": "HARD_RED_FLAG_BLOCKED",
    "message": "Company cannot progress to Stage B due to triggered hard red flags.",
    "details": [
      {
        "field": "roce",
        "value": 8.2,
        "threshold": 10.0,
        "message": "ROCE 8.2% is below the required 10.0% minimum threshold."
      },
      {
        "field": "interestCoverage",
        "value": 2.4,
        "threshold": 3.0,
        "message": "Interest coverage 2.4x is below the required 3.0x threshold."
      }
    ],
    "requestId": "req_01hb4c5d6e7f8g9h",
    "timestamp": "2026-11-15T12:34:56.789Z"
  }
}
```

### Standard Error Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Request schema violation (Zod details included) |
| `400` | `HARD_RED_FLAG_BLOCKED` | Attempted stage progression despite active hard flags |
| `401` | `UNAUTHORIZED` | Missing or invalid authentication credentials |
| `403` | `FORBIDDEN` | Access denied to requested user resource |
| `404` | `RESOURCE_NOT_FOUND` | Company, analysis, or trade plan not found |
| `409` | `CONFLICT` | Concurrent modification or duplicate resource |
| `422` | `UNPROCESSABLE_ENTITY`| Business logic violation (e.g. risk cap exceeded) |
| `429` | `RATE_LIMITED` | Too many requests; retry after specified backoff |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure (details redacted) |

---

## 4. Comprehensive RESTful Endpoint Catalog

### 4.1. Authentication & Session (`/api/v1/auth`)
- `POST /api/v1/auth/token`: Exchange user credentials or refresh token for a mobile Bearer JWT.
- `POST /api/v1/auth/token/refresh`: Refresh an expired access token using a long-lived refresh token.
- `GET /api/v1/auth/me`: Retrieve currently authenticated user profile and configured permissions.
- `POST /api/v1/auth/logout`: Revoke active mobile refresh tokens / invalidate web session.

### 4.2. Universe & Companies (`/api/v1/companies`)
- `GET /api/v1/companies`: Search and list companies. Supports filtering by sector, market cap, and stage status.
- `GET /api/v1/companies/{id}`: Detailed company profile including exchange tickers, ISIN, sector, and industry.
- `GET /api/v1/companies/{id}/financials`: Historical financial statements (Income Statement, Balance Sheet, Cash Flow) across annual and quarterly periods with point-in-time provenance tags.
- `GET /api/v1/companies/{id}/prices`: Historical daily/weekly OHLCV candlestick price bars.
- `GET /api/v1/companies/{id}/shareholding`: Historical quarterly shareholding breakdown (Promoter, FII, DII, Public, Pledge %).

### 4.3. Watchlists (`/api/v1/watchlists`)
- `GET /api/v1/watchlists`: List all user-created research queues and watchlists.
- `POST /api/v1/watchlists`: Create a new watchlist.
- `GET /api/v1/watchlists/{id}`: Retrieve watchlist details with live stock valuations and stage statuses.
- `POST /api/v1/watchlists/{id}/items`: Add a company symbol to a watchlist.
- `DELETE /api/v1/watchlists/{id}/items/{itemId}`: Remove a company from a watchlist.

### 4.4. Analysis & Gatekeeping: Stages A & B (`/api/v1/analyses`)
- `POST /api/v1/analyses/stage-a`: Execute Stage A screening for a company using an active rule set.
  - *Response:* Overall score (/10 or /9), verdict, breakdown of all 10 checks, active red flags, and gate passage eligibility.
- `GET /api/v1/analyses/{id}`: Retrieve historical analysis run snapshot with exact inputs and rule version.
- `POST /api/v1/analyses/{id}/stage-b`: Execute Stage B deep trend analysis (YoY quarterly and 5Y annual checks).
  - *Response:* Score /10, trend consistency classifications, forensic CFO vs PAT findings, debtor days flags.
- `POST /api/v1/analyses/{id}/override`: Submit a documented human override for a conditional warning.
  - *Request Body:* `{ flagId, reason, approvedBy }`
  - *Audit:* Automatically appends to immutable `audit_events` ledger.

### 4.5. Moat Assessment: Stage C (`/api/v1/moat-assessments`)
- `GET /api/v1/companies/{id}/moat-assessments`: Retrieve qualitative moat evaluations.
- `POST /api/v1/companies/{id}/moat-assessments`: Submit or update a 5-test moat assessment with substantiated evidence links.
  - *Requirements:* Enforces verification of Test 1 (Non-copyability) and overall score ≥ 3/5 to achieve moat clearance.

### 4.6. Valuation Suite: Stage D (`/api/v1/valuations`)
- `POST /api/v1/companies/{id}/valuations`: Calculate multi-model valuation summary (P/E, PEG, P/B, DCF).
  - *Request Body:* Custom assumptions (WACC, terminal growth, target P/E, normalised EPS).
  - *Response:* Fair value per share for each method, composite fair value range, 20% margin-of-safety buy ceiling price, valuation confidence label, and DCF sensitivity table.
- `GET /api/v1/companies/{id}/valuations/latest`: Retrieve the latest approved valuation snapshot.

### 4.7. Trade Planner & Risk Limits: Stage F (`/api/v1/trade-plans`)
- `POST /api/v1/trade-plans`: Create a disciplined trade plan.
  - *Request Body:* `{ companyId, entryPrice, stopPrice, targetPrices, thesis, invalidationCondition }`
  - *Validation Engine:* Calculates position sizing based on user's portfolio risk budget (default 1%). Automatically evaluates single-stock exposure (<= 10%) and sector concentration (<= 30%). Blocks creation if hard risk limits are breached without override.
- `GET /api/v1/trade-plans`: List active, pending, or closed trade plans.
- `GET /api/v1/trade-plans/{id}`: Retrieve a specific trade plan with portfolio impact simulation.
- `PATCH /api/v1/trade-plans/{id}`: Modify an open trade plan (requires change rationale).

### 4.8. Portfolio & Execution Ledger: Stages F & G (`/api/v1/portfolio`)
- `GET /api/v1/portfolio/summary`: Aggregated portfolio statistics (Total capital, cash buffer, sector exposure breakdown, unrealised P&L).
- `GET /api/v1/portfolio/positions`: List open holdings with live stop-loss and fair-value distances.
- `POST /api/v1/portfolio/transactions`: Manually record an executed transaction (BUY, SELL, TRIM, DIVIDEND).
  - *Idempotency-Key:* Required on all transaction posts.

### 4.9. Monitoring & Alert Desk: Stage G (`/api/v1/alerts`)
- `GET /api/v1/alerts`: List active and historical alerts (price alerts, fundamental deterioration, thesis invalidation, quarterly result filings).
- `POST /api/v1/alerts/{id}/acknowledge`: Mark an alert as acknowledged with review notes.

### 4.10. Rule-Sets & Benchmarks (`/api/v1/rule-sets`)
- `GET /api/v1/rule-sets`: List all published and draft rule-set versions.
- `GET /api/v1/rule-sets/{id}`: Retrieve full scoring rule definitions and sector benchmark ratios.
- `POST /api/v1/rule-sets/draft`: Create a new draft rule version based on an existing set.
- `POST /api/v1/rule-sets/{id}/publish`: Immutably publish a draft rule set for production scoring.

### 4.11. Data Ingestion & Quality (`/api/v1/ingestion`)
- `POST /api/v1/ingestion/upload-csv`: Upload raw financial statement CSV (Screener.in format or custom).
  - Enqueues an asynchronous ingestion job via `pg-boss`. Returns a `jobId`.
- `GET /api/v1/ingestion/status/{jobId}`: Check ingestion status, parsing progress, and row-level validation errors.

---

## 5. OpenAPI Specification & Mobile SDK Generation

To guarantee seamless mobile development without API drift:
1. Every route schema is defined in `@stock-assistant/contracts` using Zod.
2. An automated build step (`pnpm openapi:generate`) compiles Zod definitions into an `openapi.json` (OpenAPI 3.1) document.
3. Mobile client developers can generate type-safe HTTP client SDKs (Dart for Flutter, TypeScript for React Native) directly from `openapi.json` using open-source generators (`openapicmd` or `openapi-generator-cli`).
