# Stokiffy 📈

> **Personal Stock Market Assistant** — An institutional-grade, deterministic investment pipeline for Indian equities (NSE & BSE) powered by an automated 7-stage evaluation engine (Stages A through G).

---

## Architecture Overview

Stokiffy guides investment decisions through 7 deterministic evaluation stages:

| Stage | Domain Focus | Key Rules & Outputs |
| :--- | :--- | :--- |
| **Stage A** | **Initial Quality Screen** | ROCE, ROE, D/E, Current Ratio, Interest Coverage, and Promoter Pledge checks. Denominator adapts to `/9` for banks. |
| **Stage B** | **Deep Trend Analysis** | 3-to-10-year rolling trends for Sales, Operating Margins, Net Margins, and FCF generation. |
| **Stage C** | **Competitive Advantage / Moat** | 5-part economic moat evaluation (pricing power, switching costs, cost advantage, network effects, intangibles). |
| **Stage D** | **Valuation Engine** | Multi-methodology valuation (DCF, Price-to-Earnings, Price-to-Book, Historical Multiples) with Margin-of-Safety gating. |
| **Stage E** | **Technical Entry & Timing** | Daily OHLCV price-bar analysis, candlestick pattern recognition (Bullish Engulfing, Hammer, Morning Star), RSI, and 200 SMA support zones. |
| **Stage F** | **Buy Plan & Position Sizing** | Risk-budget calculations (fixed fractional risk $\le 1.5\%$, stock cap $\le 10\%$, sector cap $\le 25\%$) with formal override tracking. |
| **Stage G** | **Monitoring & Sell Decisions** | Real-time price breach alerts, quarterly thesis audits, stop-loss / target trims, and immutable trade journaling. |

---

## Quick Start (1-Command Local Setup)

### Prerequisites
- **Node.js** $\ge 20$
- **pnpm** $\ge 9.0$
- **Docker** and **Docker Compose**

### 1. Launch PostgreSQL 16
Start the containerized PostgreSQL instance with persistent volume and healthcheck:
```bash
docker compose up -d
```

### 2. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Default values in `.env.example` match the `docker-compose.yml` PostgreSQL container out of the box).*

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Run Migrations & Seed Database
Apply Prisma database migrations and seed baseline rule sets, benchmarks, and starter watchlists:
```bash
# Generate Prisma Client & Run Migrations
pnpm --filter @stock-assistant/db prisma:generate
pnpm --filter @stock-assistant/db exec prisma migrate deploy

# Seed Initial Data (v1 RuleSet, Sector Benchmarks, Owner Watchlist)
pnpm --filter @stock-assistant/db db:seed
```

### 5. Start Development Servers
Start both the web application (Next.js on `http://localhost:3000`) and the background worker (`pg-boss` queue processor) concurrently:
```bash
pnpm dev
```

---

## Ingesting Data & Manual Entry

Stokiffy provides live REST API endpoints under `/api/v1` for manual data entry and historical price imports:

### 1. Create a Company
```bash
curl -X POST http://localhost:3000/api/v1/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "symbol": "TCS",
    "name": "Tata Consultancy Services Ltd",
    "exchange": "NSE",
    "sector": "IT services",
    "industry": "Software Services"
  }'
```

### 2. Add / Upsert Financial Statements
```bash
curl -X POST http://localhost:3000/api/v1/companies/TCS/financials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "periodType": "annual",
    "fiscalYear": "FY2024",
    "revenue": 240893,
    "operatingProfit": 61245,
    "netProfit": 46099,
    "totalEquity": 90500,
    "totalDebt": 0,
    "currentAssets": 85000,
    "currentLiabilities": 38000,
    "ebit": 61245,
    "eps": 127.35
  }'
```
*(Omitted numeric fields are safely preserved as `null`—never coerced to `0`—and tagged with `MANUAL_ENTRY` provenance).*

### 3. Import Daily OHLCV Price Bars (CSV or JSON)
Upload daily price bars via raw CSV or JSON with built-in geometry validation (`high >= max(open, close)`, `low <= min(open, close)`, positive prices, non-negative volume):

```bash
curl -X POST http://localhost:3000/api/v1/companies/TCS/price-bars \
  -H "Content-Type: text/csv" \
  -H "Authorization: Bearer dev-token" \
  --data-binary $'Date,Open,High,Low,Close,Volume,Adj Close\n2024-03-25,3200,3250,3180,3240,1500000,3240\n2024-03-26,3245,3260,3210,3225,980000,3225'
```

---

## Verification & Testing

Run the comprehensive test suites and quality gates across all packages:

```bash
# Typecheck all packages
pnpm typecheck

# Run all unit and golden-fixture test suites
pnpm test

# Run specific package tests
pnpm --filter @stock-assistant/core test           # Stages A–G & Golden Fixture Tests
pnpm --filter @stock-assistant/data-providers test  # CSV & OHLCV Parser Tests
pnpm --filter @stock-assistant/web test            # API Route & Service Tests
pnpm --filter @stokiffy/worker test               # Background Job & Concurrency Tests

# Production Build
pnpm build
```

---

## Production Deployment (Vercel + Neon PostgreSQL)

Stokiffy is configured for zero-configuration deployment to **Vercel** backed by serverless **Neon PostgreSQL**.

### 1. Vercel Project Settings
- **Framework Preset:** Next.js
- **Root Directory:** `./`
- **Build Command:** `pnpm --filter @stock-assistant/db prisma:generate && pnpm --filter @stock-assistant/web build` (automatically picked up from `vercel.json`)
- **Output Directory:** `apps/web/.next`

### 2. Environment Variables Configuration
Configure these production environment variables in your Vercel Project Dashboard (`Settings > Environment Variables`):

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon pooled connection string with SSL & 30s timeout for compute wakeups | `postgresql://neondb_owner:***@ep-***.aws.neon.tech/neondb?sslmode=require&connect_timeout=30` |
| `NEXTAUTH_URL` | Production URL of your Vercel deployment | `https://your-stokiffy.vercel.app` |
| `NEXTAUTH_SECRET` | 32-byte secret for signing JWT session tokens | Run `openssl rand -hex 32` |
| `ADMIN_EMAIL` | Workstation owner login email | `investor@stokiffy.local` |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of your workstation master passphrase | Generated via `node -e 'console.log(require("bcryptjs").hashSync("mypassphrase", 10))'` |
| `ALLOW_PERSONAL_DEV_AUTH` | Enforce real NextAuth password login & route guards | `false` |
| `NODE_ENV` | Next.js production mode | `production` |

### 3. Generate Master Passphrase Hash
Generate a secure bcrypt hash for your `ADMIN_PASSWORD_HASH`:
```bash
# Using the monorepo's local bcryptjs dependency:
pnpm --filter @stock-assistant/web exec node -e "console.log(require('bcryptjs').hashSync('YOUR_STRONG_PASSPHRASE', 10))"

# Or standard Node (if bcryptjs is available globally):
node -e "console.log(require('bcryptjs').hashSync('YOUR_STRONG_PASSPHRASE', 10))"
```

### 4. Database Health Monitoring
Verify database connectivity at any time using the unauthenticated health probe:
```bash
curl -i https://your-stokiffy.vercel.app/api/health
```
Returns `200 OK`:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-11-22T12:00:00.000Z"
}
```
*(Returns `503 Service Unavailable` if PostgreSQL is unreachable).*

