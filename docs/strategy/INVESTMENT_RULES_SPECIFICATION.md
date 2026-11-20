# Investment Rules Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Source:** Personal_Stock_Assistant_Updated_Strategy_Blueprint.docx + Handwritten Notes (Stock selection.pdf)

---

## 1. Overview

This document is the master specification for the Personal Stock Market Assistant's investment engine. It consolidates all scoring rules, red-flag logic, valuation methods, technical entry criteria, position sizing, and monitoring/exit rules into a single authoritative reference.

**Scope:** Stages A through G of the investment lifecycle  
**Domain:** Indian listed equities (initial)  
**Architecture:** Pure TypeScript domain logic (`packages/core`), consumed by Next.js web app and future mobile client  
**Data:** Manual/CSV import initially; licensed provider integration post-MVP

---

## 2. Stage Gate Summary

| Stage | Purpose | Max Score | Pass Gate | Hard Stop Behaviour |
|-------|---------|-----------|-----------|---------------------|
| A — Quick Screening | Financial quality gate | 10 (non-financial) / 9 (bank/NBFC legacy) | ≥6.5/10 (non-fin) or ≥5.5/9 (bank) AND no hard flags | Blocks progression to Stage B |
| B — Deep Trend Analysis | Multi-year/quarterly consistency | 10 | ≥6.5/10 AND no hard flags | Blocks progression to Stage C |
| C — Business Model & Moat | Business quality & durability | 5 moat tests (1 pt each) | ≥3/5 AND Test 1 (non-copyability) passes | Conditional — requires review if failed |
| D — Valuation | Fair value & margin of safety | 4 methods (P/E, PEG, P/B, DCF) | ≥20% discount to selected fair value + confidence | Valuation warning blocks BUY-READY |
| E — Technical Entry | Timing & pattern confirmation | Pattern + context + confirmation | Setup confirmed + price in buy zone + invalidation defined | No auto-buy; signal candidate only |
| F — Buy Plan & Portfolio Risk | Controlled exposure | Position size + risk limits | Risk budget satisfied + concentration limits met | Blocks trade plan if limits breached |
| G — Monitor, Sell & Review | Thesis tracking & exit | Alerts + journal + review | Explicit hold/trim/sell decision recorded | No auto-sell in MVP |

**Critical Rule:** A hard-stop red flag at any stage **cannot** be overridden by a passing score. Progression requires both: (a) no active hard stops, and (b) minimum score threshold met.

---

## 3. Red-Flag Taxonomy

| Class | Meaning | System Behaviour | Override |
|-------|---------|------------------|----------|
| **HARD_STOP** | Source-defined condition blocking next stage | Pipeline stops; show all triggers, values, thresholds, source dates | Requires written reason, timestamp, user identity, before/after state; original flag preserved |
| **CONDITIONAL_WARNING** | Risk needing context (cyclical decline, one-offs, unusual leverage) | Visible; requires written explanation + explicit user decision; default: hold progression | Same audit trail; flag not erased |
| **DATA_QUALITY_WARNING** | Missing, stale, inconsistent, restated, unverified data | Mark result incomplete/provisional; never infer pass from missing data | User may acknowledge but data quality status persists |
| **VALUATION_WARNING** | Potentially expensive, value-trap risk, weak assumptions, low DCF confidence | Blocks BUY-READY status; valuation research continues | User may proceed to research but not to trade plan |

**Override Rules:**
- Every override creates an immutable audit record
- Original flag is never deleted or hidden
- Override requires: reason (free text), timestamp, user ID, flag ID, before/after state
- Override does not change the underlying score — only permits progression with documented exception

---

## 4. Sector Classification & Benchmark Handling

### 4.1 Industry Benchmarks (Note-Derived v1 Assumptions)

| Industry | OPM Range | Typical P/E | Minimum ROA | Notes |
|----------|-----------|-------------|-------------|-------|
| IT Services | 22–28% | 20 | 20% | |
| Pharma | 25–35% | 25 | Not specified | |
| FMCG | 18–25% | 30 | 15% | |
| Paints | 18–28% | 30 | Not specified | |
| Automobiles | 8–12% | 15 | Not specified | |
| Retail | 5–8% | Not specified | Not specified | |
| Steel & Metals | 8–15% | Not specified | Not specified | |
| Banks | Not specified | 15 | 0.8% | D/E, Current Ratio, Interest Coverage marked "unsuitable/review" |
| Commodities | Not specified | 8 | Not specified | |
| Manufacturing | Not specified | Not specified | 8% | |
| Capital Intensive | Not specified | Not specified | 5% | |

**Warning:** These are user's handwritten note values, not verified current sector medians. Store as editable, versioned assumptions. Validate by sub-sector before live scoring.

### 4.2 Financial Sector Special Handling

**Legacy Bank/NBFC Score (9 points):** Removes Debt/Equity from Stage A. Maximum score = 9.

**Unsuitable Ratios for Banks/NBFCs (Mark as "Review Required"):**
- Debt/Equity → Not applicable (removed from scoring)
- Current Ratio → Not directly comparable; mark unsuitable
- Interest Coverage → Not a standard bank solvency measure; mark unsuitable

**Required: Dedicated Bank/NBFC Scorecard (Future)**
Before relying on bank scores, build a scorecard using:
- Capital Adequacy Ratio (CAR)
- Gross/Net NPA (GNPA/NNPA)
- Provision Coverage Ratio (PCR)
- Net Interest Margin (NIM)
- CASA Ratio
- Credit Cost
- Liquidity Coverage Ratio (LCR)
- Asset Quality Trends

---

## 5. Scoring Engine Contract (Domain Model)

Every scoring rule returns a structured result:

```typescript
interface ScoringRuleResult {
  ruleKey: string;                    // e.g., "STAGE_A_SALES_GROWTH"
  points: number;                     // Points awarded (0 to maxPoints)
  maxPoints: number;                  // Maximum possible for this rule
  inputs: Record<string, unknown>;    // Raw input values used
  explanation: string;                // Human-readable rationale
  redFlags: RedFlag[];                // Any flags triggered
  dataQuality: DataQualityInfo;       // Source, freshness, completeness
  ruleSetVersion: string;             // e.g., "stage-a-v1.0"
}

interface RedFlag {
  id: string;
  class: 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';
  message: string;
  threshold: string;
  actualValue: unknown;
  source: string;                     // 'handwritten-notes' | 'blueprint' | 'engineering-default'
  timestamp: string;                  // ISO 8601
}

interface DataQualityInfo {
  source: string;                     // Provider / manual / derived
  fetchedAt: string;                  // ISO 8601
  reportedPeriod: string;             // e.g., "FY2024"
  currency: string;                   // e.g., "INR"
  unit: string;                       // e.g., "CRORE"
  adjustmentStatus: 'reported' | 'restated' | 'estimated' | 'manual';
  quality: 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
  isMissing: boolean;
}
```

**Determinism Requirements:**
- Same inputs + same ruleSetVersion = identical outputs
- No dependency on React, Next.js, database, external AI, or randomness
- All thresholds, formulas, and weights are configuration (JSON/YAML), not hard-coded
- Financial calculations use `decimal.js` or `big.js` — never native `number` for money

---

## 6. Stage A — Quick Screening (10-Point Engine)

### 6.1 Non-Financial Companies (10 Points)

| # | Metric | Max Points | Formula / Threshold | Hard Flag |
|---|--------|------------|---------------------|-----------|
| 1 | Sales Growth | 1.0 | +0.5 if latest FY YoY > 0 AND 5Y CAGR > 0; +0.5 if latest FY YoY > 5Y CAGR | Latest FY YoY < 0 OR 5Y CAGR < 0 |
| 2 | Profit Growth | 1.0 | +0.5 if latest FY YoY > 0 AND 5Y CAGR > 0; +0.5 if latest FY YoY > 5Y CAGR | Latest FY YoY < 0 OR 5Y CAGR < 0 |
| 3 | Operating Profit Margin | 1.0 | +0.5 if 1Y OPM > industry min AND 5Y OPM > industry min; +0.5 if above AND 1Y OPM > 5Y OPM | None explicit; missing benchmark = unscored |
| 4 | ROE | 1.0 | +0.5 if ≥20%; +0.25 if 10%–<20%; +0.5 if 1Y ROE > 5Y ROE | ROE < 10% |
| 5 | ROCE | 1.0 | Same scoring as ROE | ROCE < 10% |
| 6 | Debt/Equity | 1.0 | <0.5: 1.0; 0.5–1.25: 0.5; >1.25: 0 | D/E > 1.25 |
| 7 | Current Ratio | 1.0 | >2: 1.0; 1–2: 0.5; <1: 0 | Current Ratio < 1 |
| 8 | Interest Coverage | 1.0 | >10: 1.0; 5–10: 0.5; 3–5: 0.25; <3: 0 | Interest Coverage < 3 |
| 9 | P/E vs Industry | 1.0 | x = Co P/E ÷ Ind P/E; 0.8≤x≤2: 1; 2<x≤2.5: 0.5; 2.5<x≤3: 0.25; x<0.8: 1 + value-trap review | x > 3 |
| 10 | ROA | 1.0 | +0.5 if ROA ≥ industry min; +0.5 if 1Y ROA > 5Y avg ROA | None explicit; missing benchmark = unscored |

### 6.2 Bank/NBFC Legacy (9 Points)

| # | Metric | Max Points | Notes |
|---|--------|------------|-------|
| 1 | Sales Growth | 1.0 | Same as non-financial |
| 2 | Profit Growth | 1.0 | Same as non-financial |
| 3 | Operating Profit Margin | 1.0 | Same; industry benchmark required |
| 4 | ROE | 1.0 | Same scoring |
| 5 | ROCE | 1.0 | Same scoring |
| 6 | **DELETED** | — | Debt/Equity removed |
| 7 | Current Ratio | 1.0 | **Marked "unsuitable/review required"** |
| 8 | Interest Coverage | 1.0 | **Marked "unsuitable/review required"** |
| 9 | P/E vs Industry | 1.0 | Same scoring |
| 10 | ROA | 1.0 | Same scoring |

**Verdict Bands:**

| Non-Financial Score | Bank/NBFC Score | Verdict |
|---------------------|-----------------|---------|
| ≥ 8.5 | ≥ 7.5 | Exceptional |
| ≥ 7.5 | ≥ 6.5 | Excellent |
| ≥ 6.5 | ≥ 5.5 | Good |
| < 6.5 | < 5.5 | Avoid / Does Not Pass |

**Gate to Stage B:** No hard flags AND score ≥ 6.5 (non-fin) / ≥ 5.5 (bank)

### 6.3 Edge Cases & Missing Data

| Scenario | Handling |
|----------|----------|
| Missing industry benchmark | Mark check "benchmark missing"; no points; not a hard flag; requires user/analyst mapping |
| Negative/zero EPS → invalid P/E | Mark P/E check "not measurable"; no points; not a pass |
| Current Ratio exactly 1.0 | Scores 0.5 (falls in 1–2 band); not a hard flag (hard flag is <1) |
| D/E exactly 0.5 or 1.25 | 0.5 scores 1.0 (<0.5); 1.25 scores 0.5 (0.5–1.25 inclusive upper?) — **DECISION NEEDED: inclusive/exclusive boundaries** |
| Restated financials | Flag as `adjustmentStatus: 'restated'`; use latest restated values; preserve original for audit |
| Data older than 12 months | `quality: 'stale'`; DATA_QUALITY_WARNING; do not auto-pass |
| One-off gains/losses in profit growth | CONDITIONAL_WARNING; require user review of normalized profit |

---

## 7. Stage B — Deep Trend Analysis (10-Point Engine)

### 7.1 Scoring Allocation

| Block | Item | Max Points | Trend Classification Rules |
|-------|------|------------|----------------------------|
| **Quarterly (2 pts)** | Sales YoY | 1.0 | Consistently rising: 1; rising with fluctuations: 0.75; flat/other: **HARD_FLAG** |
| | OPM YoY | 1.0 | Increasing: 1; mostly constant with occasional rise: 0.75; constant: 0.5; mostly constant with few declines: 0.25; consistently falling: **HARD_FLAG** |
| **P&L — 5Y (3 pts)** | Sales 5Y | 1.0 | Consistently up: 1; up with flat periods: 0.75; up with a dip: 0.5; flat: 0.25; declining: **HARD_FLAG** |
| | OPM 5Y | 1.0 | Same rubric as Sales 5Y |
| | Net Profit | 1.0 | Profit & margin both rising: 1; profit rising, margin constant: 0.75; profit rising, margin fluctuating: 0.5; profit rising but margin falling OR profit falling: **HARD_FLAG** |
| **Balance Sheet (1 pt)** | Reserves vs Borrowings | 1.0 | Reserves up / borrowings down: 1; reserves up / borrowings flat: 0.75; both up: 0.5; both flat: 0.25; other: **HARD_FLAG** |
| **Cash Flows (1 pt)** | CFO Trend | 1.0 | Apply net-profit rubric to CFO; also compare cumulative CFO vs cumulative PAT (forensic check) |
| **Ratios (2 pts)** | Debtor Days | 1.0 | Consistently falling: 1; almost constant: 0.75; fluctuating: 0.5; rising: **FLAG**; >120 days OR >50% rise in 5Y: **HARD_FLAG** |
| | ROCE Trend | 1.0 | Consistently rising: 1; maintained: 0.75; rising but fluctuating: 0.5; falling: **HARD_FLAG** |
| **Shareholding (1 pt)** | Pattern | 1.0 | See Shareholding Scoring Table below |

### 7.2 Shareholding Pattern Scoring

| Promoter | FII + DII | Public | Points | Notes |
|----------|-----------|--------|--------|-------|
| Up | Up | Down | 1.00 | Ideal |
| Up | Flat | Down | 0.75 | |
| Up | Down | Down | 0.75 | |
| Flat | Up | Down | 0.50 | |
| Up | Down | Up | 0.00 | Incomplete/unclear source rule — **REVIEW REQUIRED** |
| Down | Down | Up | **HARD_FLAG** | Public rising while promoter/FII/DII all falling |
| Any | Any | ≥ 50% | **HARD_FLAG** | Public holding ≥ 50% (source heuristic) |

**Additional Recommended Checks (Not in Original Notes):**
- Promoter pledge % and trend
- Promoter holding dilution
- Preferential allotments, warrants, QIP/ESOP dilution
- Sudden institutional exits

### 7.3 Data Requirements

- Quarterly: Minimum 8 comparable quarters (YoY to reduce seasonality)
- Annual: 5 full fiscal years, consistent periods, restatements identified
- Consolidated statements by default; standalone as secondary
- Trend labels generated from deterministic rules, not AI judgement

### 7.4 Gate to Stage C

**Proposed Default:** No hard flags AND score ≥ 6.5/10  
**Note:** This threshold is from the blueprint, not explicitly settled in handwritten notes. **REQUIRES USER APPROVAL.**

---

## 8. Stage C — Business Model & Moat Assessment

### 8.1 Three Business Model Questions (Evidence-Based)

1. **Value Creation:** Product/service, customer, customer problem, why solution matters
2. **Value Capture:** Pricing power, revenue streams (recurring vs one-time), gross margin, cash conversion
3. **Scalability:** Can serve 10x customers with ~2x costs? Asset intensity, capacity, working capital, incremental returns

### 8.2 Business Model Categories & Metrics

| Model | Key Metrics / Evidence |
|-------|------------------------|
| Subscription | MRR/ARR, churn, net revenue retention, CAC payback, LTV |
| Marketplace | GMV, take rate, active buyers/sellers, repeat frequency, contribution margin, network liquidity |
| Branded Manufacturing | Brand strength, pricing power, gross/operating margin, distribution reach, repeat purchase |
| Commodity Manufacturing | Cost curve, capacity utilization, input-cost sensitivity, balance-sheet resilience, cycle position |
| Asset-light vs Asset-heavy | ROCE/ROA, capex, working capital needs, FCF, incremental capital returns |
| Freemium | Free-to-paid conversion, retention, acquisition cost, engagement, scale economics |

### 8.3 Five Moat Types

1. **Brand Moat** — Trusted brand, pricing power
2. **Network-Effect Moat** — Value increases with participants
3. **Cost-Advantage Moat** — Scale, location, technology, procurement, supply chain
4. **Switching-Cost Moat** — Meaningful time/risk/expense to leave
5. **Regulatory/Patent Moat** — Durable, enforceable licences/patents/barriers

### 8.4 Five Moat Tests (Proposed Scoring)

| Test | Question | Pass Condition | Points |
|------|----------|----------------|--------|
| 1 | Can competitors easily copy the business? | **No** — supported by patents, cost structure, distribution, network, data, brand, or switching costs | 1 (only if answer is No) |
| 2 | Can the advantage last 10+ years? | Evidence of durability, reinvestment, customer behaviour, threat analysis | 1 |
| 3 | Has ROE been high & consistent for 10+ years? | Historical ROE series; explain leverage, buybacks, accounting effects | 1 |
| 4 | Can the company raise prices without losing customers? | Price/mix, volume, retention, market-share, margin evidence | 1 |
| 5 | Is market share stable or growing over 5+ years? | Reliable market-share series + addressable market definition | 1 |

**Proposed Pass Rule:** ≥ 3/5 AND Test 1 must pass  
**Evidence Requirement:** Every answer must cite verified facts, company claims, analyst estimates, or inference — clearly tagged. Unsubstantiated conclusions labelled as such.

**Note:** Stage C scoring is a **proposed rule**; handwritten notes do not assign Stage C points. **REQUIRES USER APPROVAL.**

---

## 9. Stage D — Valuation Framework (Four Methods)

### 9.1 Method Selection Principle

Methods are **complementary, not interchangeable**. Choose relevant methods by business type. Show a range, not false precision. Do not average incompatible methods blindly.

### 9.2 Method 1: P/E Valuation (Primary in Notes)

| Component | Formula |
|-----------|---------|
| Relative P/E | Company P/E ÷ Industry/Peer P/E |
| Fair Value/Share | Normalised EPS × Selected Fair P/E Multiple |
| Over/Undervaluation % | (Market Price − Fair Value) ÷ Fair Value × 100 |
| Target Price | Forecast EPS at Horizon × Assumed Exit P/E |

**Rules:**
- Use normalised earnings (investigate exceptional items, cyclical peaks, dilution, negative EPS)
- Company P/E > 2× Industry P/E → **VALUATION_WARNING** (not automatic avoid; requires context)
- Industry P/E source: editable note-derived baseline for testing; later prefer dated peer median with source/peer set

### 9.3 Method 2: PEG (Growth-Adjusted P/E)

| Component | Formula |
|-----------|---------|
| PEG | P/E ÷ Earnings Growth Rate (% as number, e.g., 34 ÷ 50 = 0.68) |

**Note-Derived Bands:**
- < 1: Potentially undervalued
- 1–1.5: Fair
- 1.5–2: Getting expensive
- > 2: Overvalued warning

**Applicability:** Predictable positive earnings growth only. Avoid when earnings negative, highly cyclical, unstable, or low-base distorted. Growth rates must be normalised and forward-looking; assumptions clearly labelled.

### 9.4 Method 3: Price-to-Book (P/B)

| Component | Formula |
|-----------|---------|
| P/B | Market Price/Share ÷ Book Value/Share |
| Book Value | (Total Assets − Total Liabilities) ÷ Shares Outstanding |

**Sector Bands (Note-Derived):**

| Sector | Cheap | Fair/Reasonable | Expensive Warning |
|--------|-------|-----------------|-------------------|
| Banks | < 1.5 | 1.5–2.0 fair; 2–3 reasonable | > 3 |
| Manufacturing | < 1.5 | 1.5–3 | > 3 |
| Real Estate | < 1.5 | 1.5–4 | > 4 |

**Applicability:** Most useful for asset-heavy and financial businesses. For asset-light, intangibles make book value less informative.

### 9.5 Method 4: Discounted Cash Flow (DCF)

**Inputs:**
- Forecast horizon (years)
- Revenue/FCF growth assumptions
- Operating assumptions (margins, tax, reinvestment)
- Discount rate / WACC
- Terminal growth rate
- Net debt

**Outputs:**
- Bear / Base / Bull scenarios
- Sensitivity tables (discount rate × terminal growth)
- Fair value per share = (PV of FCFs + PV of Terminal Value − Net Debt) ÷ Shares Outstanding

**Flags:**
- Unstable cash flow
- Negative FCF
- High terminal-value dependence (> 70% of value)
- Assumptions outside reasonable range

**Label:** "Simplified Educational Calculator" in MVP (per notes)

### 9.6 Margin of Safety & Valuation Decision

**Core Rule (from notes):** Invest only when market price ≥ 20% below fair value.

```
Maximum Buy Price = Fair Value × (1 − 20%) = Fair Value × 0.80
```

**Display Requirements (Per Method):**
- Fair value
- Key assumptions
- As-of date
- Applicability (suitable / limited / unsuitable)
- Confidence rating (High / Medium / Low)

**Decision Logic:**
- Select primary method by sector/business model
- Use other methods as cross-checks
- Show valuation range + confidence rating
- Low-confidence valuation → blocks BUY-READY even if arithmetic shows 20% upside
- Cyclical companies: use mid-cycle earnings + scenario analysis
- Include dilution, net debt, cash, subsidiaries, corporate actions where data available

---

## 10. Stage E — Technical Entry & Timing

### 10.1 Candlestick Patterns (Signal Candidates Only)

| Pattern | Interpretation | System Treatment |
|---------|----------------|------------------|
| Bullish Engulfing | Potential bullish reversal | Candidate; require trend/level context + confirmation |
| Hammer | Potential bullish reversal after decline | Check location, proportions, next-session confirmation |
| Inverted Hammer | Potential bullish reversal after decline | Require confirmation; false signals common |
| Morning Star | Potential bullish reversal | Validate 3-candle structure + support context |
| Dragonfly Doji | Potential rejection of lower prices | Context + confirmation required |
| Three White Soldiers | Strong bullish sequence | Check overextension + nearby resistance |
| Bearish Engulfing | Potential bearish reversal | Warning for existing positions; not auto-short |
| Evening Star | Potential bearish reversal | Confirm pattern + support break |
| Shooting Star | Potential bearish reversal | Require resistance/context + confirmation |

**Critical:** Never describe a pattern as predictive certainty. Pattern = signal candidate only.

### 10.2 Required Technical Context (Proposed Enhancements)

- Daily & weekly trend
- 20/50/200-day moving averages
- Volume analysis
- Support/resistance levels
- Relative strength vs benchmark
- ATR-based volatility
- Gap risk

### 10.3 Entry Eligibility

Technical entry is eligible **only when**:
1. Price is inside/near the valuation buy zone (≤ Max Buy Price from Stage D)
2. Selected setup is confirmed (pattern + next candle confirmation)
3. Invalidation level defined
4. Risk/reward shown before user approval

**Data:** Use adjusted OHLCV (splits, bonuses, dividends accounted for).

---

## 11. Stage F — Buy Plan, Position Sizing & Portfolio Controls

### 11.1 Default Risk Parameters (Editable, User-Confirmed)

| Parameter | Default | Description |
|-----------|---------|-------------|
| Portfolio Risk per Trade | 1% | % of portfolio value risked on single trade |
| Max Single-Stock Exposure | 10% | % of portfolio in one stock |
| Max Sector Exposure | 30% | % of portfolio in one sector |

### 11.2 Position Sizing Formula

```
Risk Budget = Portfolio Value × Risk Percentage (e.g., 1%)
Quantity = floor( Risk Budget ÷ (Entry Price − Stop Price) )
```

**Adjustments:**
- Lot size (round to nearest lot)
- Liquidity (max % of daily volume)
- Transaction costs (brokerage, STT, stamp duty, etc.)
- Gap risk (stop may not execute at exact price)

**Display Before Approval:**
- Planned loss at stop
- Portfolio exposure % (post-trade)
- Sector exposure % (post-trade)
- Cash remaining

### 11.3 Trade Plan Record

Must store:
- Thesis summary
- Expected holding period
- Entry rationale
- Stop/invalidation price
- Targets (multiple)
- Position size
- Planned review date
- Rule-set version used

**Gate:** Plan blocked if breaches user-defined exposure/risk limits unless explicit override recorded.

**Disclaimer:** Stop-loss is not a guarantee; gaps/illiquidity can cause execution beyond stop.

---

## 12. Stage G — Monitoring, Sell Decisions & Post-Trade Review

### 12.1 Monitoring Triggers

| Category | Triggers |
|----------|----------|
| **Price Alerts** | Reaches entry zone, target, stop/invalidation, fair value, configured overvaluation threshold |
| **Fundamental Alerts** | New quarterly results; deterioration in sales/profit/OPM; falling ROCE; weak cash conversion; rising debtor days; debt increase; governance/shareholding flags |
| **Thesis Alerts** | Key moat assumption broken; major customer lost; regulation change; product economics deteriorate; management credibility weakens |
| **Portfolio Alerts** | Stock/sector concentration breaches; correlated exposure; cash buffer; drawdown limits |

### 12.2 Sell/Trim Decision Framework (Proposed Defaults)

| Trigger | Workflow |
|---------|----------|
| Original thesis invalidated | Prompt review; show broken assumption; require explicit hold/exit decision |
| Hard fundamental red flag appears | High-priority review; no auto-sell |
| Stop/invalidation price reached | Show risk-plan breach; user-configured action; execution manual |
| Price reaches fair value/target | Review expected return, updated fundamentals, valuation; consider trim/hold |
| Price materially exceeds fair value | Flag overvaluation; show updated margin of safety + scenarios |
| No thesis progress / opportunity cost | Scheduled review prompt; no arbitrary time-based selling |

### 12.3 Trade Journal

**Record per Transaction:**
- Date, quantity, price, fees/taxes
- Reason (linked to rule triggers)
- Portfolio context (exposure %, sector %)

**Calculations:**
- Realised/unrealised P&L (consistent method)
- Return % (time-weighted or money-weighted — **DECISION NEEDED**)
- Corporate actions & dividends shown separately

**Post-Trade Review:**
- Which rule worked / which assumption failed
- Execution quality (slippage, timing)
- Emotional/behavioural error
- Lesson learned

**Immutability:** Original decision snapshot preserved; no hindsight edits to historical rationale.

---

## 13. Data Provenance & Quality Standards

Every data point must carry:

```typescript
interface DataProvenance {
  provider: string;           // e.g., 'manual-csv', 'screener-in', 'bse', 'nse'
  fetchedAt: string;          // ISO 8601
  reportedPeriod: string;     // e.g., 'FY2024-Q3'
  currency: string;           // 'INR'
  unit: string;               // 'CRORE' | 'LAKH' | 'MILLION' | 'RAW'
  adjustmentStatus: 'reported' | 'restated' | 'estimated' | 'manual';
  quality: 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
  sourceDocumentRef?: string; // Filing URL, PDF page, etc.
}
```

**Rules:**
- Point-in-time snapshots: never overwrite historical analysis inputs when provider revises a value
- Missing field → display "not available"; mark analysis incomplete or use documented alternative
- Avoid scraping where terms prohibit; prefer licensed APIs, exchange/company filings, user imports
- Stale data (> 12 months for annual, > 3 months for quarterly) → DATA_QUALITY_WARNING

---

## 14. Unresolved Ambiguities Requiring User Decisions

| # | Ambiguity | Options | Recommended Default |
|---|-----------|---------|---------------------|
| 1 | D/E boundary inclusivity: 0.5 and 1.25 — which band? | (a) <0.5 / 0.5–1.25 / >1.25 (b) ≤0.5 / 0.5<×≤1.25 / >1.25 | (a) — standard interpretation |
| 2 | Current Ratio exactly 1.0 — hard flag or 0.5 pts? | Hard flag (<1) vs 0.5 pts (1–2 band) | 0.5 pts (hard flag is <1) |
| 3 | P/E x < 0.8: award 1 pt + value-trap review — mandatory or optional? | Mandatory review block vs warning only | Mandatory review (per notes) |
| 4 | Industry P/E source for testing | Note-derived static table vs dynamic peer median | Static table v1; dynamic later |
| 5 | Stage B pass threshold | ≥6.5/10 (blueprint) vs other | ≥6.5/10 |
| 6 | Stage C scoring & pass rule | 5 tests × 1 pt; ≥3 + Test 1 pass | As proposed |
| 7 | Bank/NBFC scorecard timeline | Build in Phase 0 vs later phase | Legacy 9-pt for continuity; dedicated scorecard Phase 2+ |
| 8 | Return calculation method | Time-weighted (TWR) vs Money-weighted (MWR) | TWR for portfolio; MWR for individual trades |
| 9 | DCF in MVP | Full simplified calculator vs placeholder only | Simplified calculator labelled "educational" |
| 10 | PEG growth rate: historical CAGR vs analyst forward estimate | Historical 5Y CAGR vs consensus forward | Both shown; user selects; label clearly |
| 11 | Shareholding "Up/Down/Up" row scoring 0 with review — confirm? | Score 0 + review vs score 0.25 | Score 0 + review (per notes) |
| 12 | Public holding ≥50% hard flag — universal or configurable? | Configurable threshold; default 50% | Configurable, default 50% |
| 13 | "Consistently rising" definition for quarterly trends | Strict (all 8 quarters up) vs majority up | Majority up with no more than 1 decline |
| 14 | CFO vs PAT cumulative comparison — scoring impact? | Forensic flag only vs point deduction | Forensic flag (DATA_QUALITY_WARNING if divergence > 20%) |
| 15 | Valuation confidence rating scale | High/Medium/Low vs numeric 0–1 | High/Medium/Low with criteria |

---

## 15. Hard-Stop & Conditional-Warning Matrix

### Stage A Hard Stops (Non-Financial)

| Rule | Threshold | Flag ID |
|------|-----------|---------|
| Sales Growth | Latest FY YoY < 0 OR 5Y CAGR < 0 | `STAGE_A_SALES_GROWTH_NEGATIVE` |
| Profit Growth | Latest FY YoY < 0 OR 5Y CAGR < 0 | `STAGE_A_PROFIT_GROWTH_NEGATIVE` |
| ROE | < 10% | `STAGE_A_ROE_BELOW_10` |
| ROCE | < 10% | `STAGE_A_ROCE_BELOW_10` |
| Debt/Equity | > 1.25 | `STAGE_A_DEBT_EQUITY_HIGH` |
| Current Ratio | < 1 | `STAGE_A_CURRENT_RATIO_LOW` |
| Interest Coverage | < 3 | `STAGE_A_INT_COVERAGE_LOW` |
| P/E vs Industry | x > 3 | `STAGE_A_PE_VS_INDUSTRY_HIGH` |

### Stage A Conditional Warnings (Non-Financial)

| Rule | Condition | Flag ID |
|------|-----------|---------|
| P/E vs Industry | x < 0.8 | `STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP` |
| Sales/Profit Growth | One-off base effect suspected | `STAGE_A_GROWTH_BASE_EFFECT` |
| ROE | Unusually high ROE with high leverage | `STAGE_A_ROE_LEVERAGE_DRIVEN` |
| Missing Industry Benchmark | OPM, ROA, or P/E benchmark unavailable | `STAGE_A_BENCHMARK_MISSING` |

### Stage B Hard Stops

| Rule | Threshold | Flag ID |
|------|-----------|---------|
| Quarterly Sales YoY | Not consistently rising (flat/declining pattern) | `STAGE_B_Q_SALES_TREND_FAIL` |
| Quarterly OPM YoY | Consistently falling | `STAGE_B_Q_OPM_TREND_FAIL` |
| 5Y Sales | Declining | `STAGE_B_5Y_SALES_DECLINING` |
| 5Y OPM | Declining | `STAGE_B_5Y_OPM_DECLINING` |
| Net Profit | Profit falling OR (profit rising but margin falling) | `STAGE_B_NET_PROFIT_TREND_FAIL` |
| Reserves vs Borrowings | Pattern not in {up/down, up/flat, up/up, flat/flat} | `STAGE_B_RESERVES_BORROWINGS_FAIL` |
| Debtor Days | > 120 days OR > 50% rise in 5Y | `STAGE_B_DEBTOR_DAYS_HIGH` |
| ROCE Trend | Falling | `STAGE_B_ROCE_TREND_FALLING` |
| Shareholding | Public rising while promoter/FII/DII all falling | `STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL` |
| Shareholding | Public ≥ 50% | `STAGE_B_PUBLIC_HOLDING_GE_50` |

### Stage B Conditional Warnings

| Rule | Condition | Flag ID |
|------|-----------|---------|
| Quarterly Sales | Rising with fluctuations | `STAGE_B_Q_SALES_FLUCTUATING` |
| Quarterly OPM | Mostly constant with few declines | `STAGE_B_Q_OPM_SOME_DECLINES` |
| Debtor Days | Rising (but not hard flag) | `STAGE_B_DEBTOR_DAYS_RISING` |
| Shareholding | Incomplete pattern (e.g., Up/Down/Up) | `STAGE_B_SHAREHOLDING_INCOMPLETE` |
| Promoter Pledge | Rising or high (> 20%) | `STAGE_B_PROMOTER_PLEDGE_HIGH` |
| Institutional Exit | Sudden FII/DII drop > 5% in quarter | `STAGE_B_INSTITUTIONAL_EXIT` |

---

## 16. Domain Model Proposal (TypeScript Interfaces)

### 16.1 Core Scoring Types

```typescript
// packages/core/src/types/scoring.ts

export type FlagClass = 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';

export interface RedFlag {
  id: string;
  class: FlagClass;
  message: string;
  threshold: string;
  actualValue: unknown;
  source: 'handwritten-notes' | 'blueprint' | 'engineering-default' | 'user-configured';
  timestamp: string; // ISO 8601
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  overrideReason?: string;
}

export interface DataQualityInfo {
  source: string;
  fetchedAt: string;
  reportedPeriod: string;
  currency: string;
  unit: string;
  adjustmentStatus: 'reported' | 'restated' | 'estimated' | 'manual';
  quality: 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
  isMissing: boolean;
  sourceDocumentRef?: string;
}

export interface ScoringRuleResult {
  ruleKey: string;
  points: number;
  maxPoints: number;
  inputs: Record<string, unknown>;
  explanation: string;
  redFlags: RedFlag[];
  dataQuality: DataQualityInfo;
  ruleSetVersion: string;
}

export interface StageScore {
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  totalPoints: number;
  maxPoints: number;
  ruleResults: ScoringRuleResult[];
  verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  hardStops: RedFlag[];
  conditionalWarnings: RedFlag[];
  dataQualityWarnings: RedFlag[];
  valuationWarnings: RedFlag[];
  calculatedAt: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
```

### 16.2 Stage A Types

```typescript
// packages/core/src/types/stage-a.ts

export interface StageAInput {
  companyId: string;
  asOfDate: string; // ISO 8601
  financials: {
    sales: { latestFy: number; fy5yAgo: number; cagr5y: number };
    profit: { latestFy: number; fy5yAgo: number; cagr5y: number };
    operatingProfit: { latestFy: number; fy5yAgo: number };
    revenue: { latestFy: number; fy5yAgo: number };
    netProfit: { latestFy: number; fy5yAgo: number };
    totalDebt: number;
    totalEquity: number;
    currentAssets: number;
    currentLiabilities: number;
    interestExpense: number;
    ebit: number;
    eps: number;
    peRatio: number;
    industryPeRatio: number;
    roa: { latestFy: number; avg5y: number };
    industryRoaMin?: number;
    roe: { latestFy: number; avg5y: number };
    roce: { latestFy: number; avg5y: number };
    opm: { latestFy: number; avg5y: number };
    industryOpmMin?: number;
  };
  sector: 'non-financial' | 'bank' | 'nbfc' | 'insurance' | 'other-financial';
  dataProvenance: DataProvenance;
}

export type StageAOutput = StageScore & { stage: 'A' };
```

### 16.3 Stage B Types

```typescript
// packages/core/src/types/stage-b.ts

export interface QuarterlyTrendPoint {
  period: string; // e.g., 'FY2024-Q3'
  salesYoY: number;
  opmYoY: number;
}

export interface AnnualTrendPoint {
  period: string; // e.g., 'FY2024'
  sales: number;
  opm: number;
  netProfit: number;
  netMargin: number;
  reserves: number;
  borrowings: number;
  cfo: number;
  pat: number;
  debtorDays: number;
  roce: number;
}

export interface ShareholdingPoint {
  period: string;
  promoterPct: number;
  fiiPct: number;
  diiPct: number;
  publicPct: number;
  promoterPledgePct?: number;
}

export interface StageBInput {
  companyId: string;
  asOfDate: string;
  quarterly: QuarterlyTrendPoint[]; // min 8 quarters
  annual: AnnualTrendPoint[]; // 5 years
  shareholding: ShareholdingPoint[]; // quarterly history
  dataProvenance: DataProvenance;
}

export type StageBOutput = StageScore & { stage: 'B' };
```

### 16.4 Stage C Types

```typescript
// packages/core/src/types/stage-c.ts

export interface BusinessModelAnswer {
  questionId: 'value-creation' | 'value-capture' | 'scalability';
  answer: string;
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  tags: ('verified-fact' | 'company-claim' | 'analyst-estimate' | 'inference')[];
}

export interface MoatTestResult {
  testId: 1 | 2 | 3 | 4 | 5;
  question: string;
  answer: 'yes' | 'no' | 'uncertain';
  evidence: EvidenceItem[];
  passes: boolean; // For test 1: passes = (answer === 'no')
  confidence: 'high' | 'medium' | 'low';
}

export interface EvidenceItem {
  id: string;
  description: string;
  source: string;
  sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
  date: string;
  tags: string[];
}

export interface StageCInput {
  companyId: string;
  asOfDate: string;
  businessModel: BusinessModelAnswer[];
  moatTests: MoatTestResult[];
  dataProvenance: DataProvenance;
}

export interface StageCOutput {
  stage: 'C';
  moatScore: number; // 0-5
  moatPass: boolean; // >=3 AND test1 passes
  businessModelComplete: boolean;
  tests: MoatTestResult[];
  overallConfidence: 'high' | 'medium' | 'low';
  calculatedAt: string;
  ruleSetVersion: string;
}
```

### 16.5 Stage D Types

```typescript
// packages/core/src/types/stage-d.ts

export type ValuationMethod = 'PE' | 'PEG' | 'PB' | 'DCF';

export interface ValuationMethodResult {
  method: ValuationMethod;
  fairValue: number; // per share
  assumptions: Record<string, unknown>;
  applicability: 'suitable' | 'limited' | 'unsuitable';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  asOfDate: string;
  scenarios?: { bear: number; base: number; bull: number };
  sensitivity?: Record<string, number[]>;
}

export interface ValuationOutput {
  stage: 'D';
  methods: ValuationMethodResult[];
  primaryMethod: ValuationMethod;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number; // fairValue * 0.80
  marginOfSafetyPct: number; // (fairValue - marketPrice) / fairValue * 100
  buyReady: boolean; // marginOfSafety >= 20% AND confidence NOT low
  valuationWarnings: RedFlag[];
  calculatedAt: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
```

### 16.6 Stage E Types

```typescript
// packages/core/src/types/stage-e.ts

export interface CandlestickPattern {
  name: 'bullish-engulfing' | 'hammer' | 'inverted-hammer' | 'morning-star' 
       | 'dragonfly-doji' | 'three-white-soldiers' | 'bearish-engulfing' 
       | 'evening-star' | 'shooting-star';
  detectedAt: string; // date of pattern completion
  timeframe: 'daily' | 'weekly';
  confirmation: boolean; // next candle confirmed
  context: {
    trend: 'uptrend' | 'downtrend' | 'sideways';
    supportLevel?: number;
    resistanceLevel?: number;
    volumeSpike: boolean;
    nearMovingAverage?: '20' | '50' | '200';
  };
}

export interface TechnicalSetup {
  pattern: CandlestickPattern;
  entryZone: { low: number; high: number };
  invalidationLevel: number;
  stopLoss: number;
  targets: number[];
  riskReward: number;
  inBuyZone: boolean; // entryZone overlaps with valuation maxBuyPrice
}

export interface StageEInput {
  companyId: string;
  asOfDate: string;
  adjustedOhlcv: OhlcvBar[]; // daily + weekly
  valuationMaxBuyPrice: number;
  dataProvenance: DataProvenance;
}

export interface StageEOutput {
  stage: 'E';
  setups: TechnicalSetup[];
  eligible: boolean; // at least one setup with inBuyZone=true AND confirmation=true
  calculatedAt: string;
  ruleSetVersion: string;
}
```

### 16.7 Stage F Types

```typescript
// packages/core/src/types/stage-f.ts

export interface PortfolioSnapshot {
  totalValue: number;
  cash: number;
  positions: Position[];
  sectorExposure: Record<string, number>; // sector -> value
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  sector: string;
}

export interface TradePlan {
  id: string;
  companyId: string;
  thesis: string;
  expectedHoldingPeriod: string; // e.g., '12-24 months'
  entryRationale: string;
  entryZone: { low: number; high: number };
  stopLoss: number;
  targets: number[];
  positionSize: number; // quantity
  riskBudget: number; // currency
  portfolioExposurePct: number; // post-trade
  sectorExposurePct: number; // post-trade
  plannedReviewDate: string;
  status: 'draft' | 'ready' | 'executed' | 'cancelled' | 'expired';
  overrides: OverrideRecord[];
  ruleSetVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverrideRecord {
  flagId: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
  beforeState: unknown;
  afterState: unknown;
}

export interface StageFInput {
  companyId: string;
  tradePlanDraft: Partial<TradePlan>;
  portfolio: PortfolioSnapshot;
  riskConfig: {
    riskPerTradePct: number; // default 1%
    maxStockExposurePct: number; // default 10%
    maxSectorExposurePct: number; // default 30%
  };
  valuationMaxBuyPrice: number;
  technicalSetup: TechnicalSetup; // from Stage E
}

export interface StageFOutput {
  stage: 'F';
  tradePlan: TradePlan;
  riskChecks: {
    withinRiskBudget: boolean;
    withinStockLimit: boolean;
    withinSectorLimit: boolean;
    sufficientLiquidity: boolean;
  };
  blocked: boolean; // any risk check failed without override
  calculatedAt: string;
  ruleSetVersion: string;
}
```

### 16.8 Stage G Types

```typescript
// packages/core/src/types/stage-g.ts

export type AlertType = 
  | 'price-entry-zone' | 'price-target' | 'price-stop' | 'price-fair-value' | 'price-overvalued'
  | 'fundamental-results' | 'fundamental-deterioration' | 'fundamental-governance'
  | 'thesis-broken' | 'thesis-risk'
  | 'portfolio-concentration' | 'portfolio-drawdown' | 'portfolio-correlation';

export interface Alert {
  id: string;
  companyId?: string;
  type: AlertType;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  data: Record<string, unknown>;
}

export interface SellDecision {
  id: string;
  companyId: string;
  trigger: AlertType;
  decision: 'sell' | 'trim' | 'hold';
  reason: string;
  quantity?: number; // for trim
  price?: number;
  decidedAt: string;
  decidedBy: string;
  originalThesisSnapshot: string;
}

export interface JournalEntry {
  id: string;
  tradePlanId: string;
  date: string;
  action: 'buy' | 'trim' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  reason: string;
  ruleTriggers: string[];
  portfolioContext: PortfolioSnapshot;
  realisedPnl?: number;
  unrealisedPnl?: number;
  returnPct?: number; // TWR or MWR
  corporateActions: CorporateAction[];
  review?: PostTradeReview;
}

export interface PostTradeReview {
  rulesWorked: string[];
  assumptionsFailed: string[];
  executionQuality: 'good' | 'fair' | 'poor';
  slippage: number;
  behaviouralNotes: string;
  lesson: string;
  reviewedAt: string;
}

export interface CorporateAction {
  type: 'dividend' | 'split' | 'bonus' | 'rights' | 'buyback';
  date: string;
  ratio?: string;
  amount?: number;
}

export interface StageGInput {
  portfolio: PortfolioSnapshot;
  alerts: Alert[];
  openPositions: Position[];
  tradeHistory: JournalEntry[];
}

export interface StageGOutput {
  stage: 'G';
  activeAlerts: Alert[];
  pendingReviews: SellDecision[];
  journalEntries: JournalEntry[];
  portfolioHealth: {
    concentrationOk: boolean;
    drawdownOk: boolean;
    cashBufferOk: boolean;
  };
  calculatedAt: string;
}
```

---

## 17. Rule Validation Test Cases (Summary)

### 17.1 Stage A Test Scenarios

| Test ID | Scenario | Expected Score | Expected Flags |
|---------|----------|----------------|----------------|
| A-01 | All metrics ideal | 10.0 | None |
| A-02 | Sales growth negative latest FY | 0 for rule 1 | HARD_STOP: `STAGE_A_SALES_GROWTH_NEGATIVE` |
| A-03 | ROE 8% | 0.25 for rule 4 | HARD_STOP: `STAGE_A_ROE_BELOW_10` |
| A-04 | D/E 1.5 | 0 for rule 6 | HARD_STOP: `STAGE_A_DEBT_EQUITY_HIGH` |
| A-05 | Current ratio 0.8 | 0 for rule 7 | HARD_STOP: `STAGE_A_CURRENT_RATIO_LOW` |
| A-06 | Interest coverage 2.5 | 0 for rule 8 | HARD_STOP: `STAGE_A_INT_COVERAGE_LOW` |
| A-07 | P/E vs Industry x = 3.5 | 0 for rule 9 | HARD_STOP: `STAGE_A_PE_VS_INDUSTRY_HIGH` |
| A-08 | P/E vs Industry x = 0.7 | 1.0 for rule 9 | CONDITIONAL: `STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP` |
| A-09 | Missing industry OPM benchmark | Rule 3 unscored | DATA_QUALITY: `STAGE_A_BENCHMARK_MISSING` |
| A-10 | Bank sector — D/E removed | Max 9 pts | Current Ratio & Int Coverage marked unsuitable |
| A-11 | Boundary: D/E exactly 0.5 | 1.0 or 0.5 | **DECISION NEEDED** |
| A-12 | Boundary: Current ratio exactly 1.0 | 0.5 | None (hard flag is <1) |
| A-13 | Negative EPS → invalid P/E | Rule 9: N/M | DATA_QUALITY: missing |
| A-14 | Restated financials used | Normal scoring | DataQuality.adjustmentStatus='restated' |
| A-15 | Data stale > 12 months | Normal scoring | DATA_QUALITY_WARNING: stale |

### 17.2 Stage B Test Scenarios

| Test ID | Scenario | Expected Score | Expected Flags |
|---------|----------|----------------|----------------|
| B-01 | All trends ideal | 10.0 | None |
| B-02 | Quarterly sales flat | 0 for Q-Sales | HARD_STOP: `STAGE_B_Q_SALES_TREND_FAIL` |
| B-03 | Quarterly OPM consistently falling | 0 for Q-OPM | HARD_STOP: `STAGE_B_Q_OPM_TREND_FAIL` |
| B-04 | 5Y sales declining | 0 for 5Y-Sales | HARD_STOP: `STAGE_B_5Y_SALES_DECLINING` |
| B-05 | Net profit rising but margin falling | 0 for Net Profit | HARD_STOP: `STAGE_B_NET_PROFIT_TREND_FAIL` |
| B-06 | Reserves down, borrowings up | 0 for Reserves | HARD_STOP: `STAGE_B_RESERVES_BORROWINGS_FAIL` |
| B-07 | Debtor days 130 | 0 for Debtor Days | HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH` |
| B-08 | Debtor days rose 60% in 5Y | 0 for Debtor Days | HARD_STOP: `STAGE_B_DEBTOR_DAYS_HIGH` |
| B-09 | ROCE trend falling | 0 for ROCE Trend | HARD_STOP: `STAGE_B_ROCE_TREND_FALLING` |
| B-10 | Public rising, promoter/FII/DII falling | 0 for Shareholding | HARD_STOP: `STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL` |
| B-11 | Public holding 52% | 0 for Shareholding | HARD_STOP: `STAGE_B_PUBLIC_HOLDING_GE_50` |
| B-12 | Shareholding Up/Down/Up | 0 + review | CONDITIONAL: `STAGE_B_SHAREHOLDING_INCOMPLETE` |
| B-13 | Promoter pledge 25% rising | Normal scoring | CONDITIONAL: `STAGE_B_PROMOTER_PLEDGE_HIGH` |
| B-14 | FII drops 8% in one quarter | Normal scoring | CONDITIONAL: `STAGE_B_INSTITUTIONAL_EXIT` |
| B-15 | Only 6 quarters available | Reduced confidence | DATA_QUALITY_WARNING: insufficient quarters |

### 17.3 Stage C Test Scenarios

| Test ID | Scenario | Moat Score | Pass? |
|---------|----------|------------|-------|
| C-01 | All 5 tests pass | 5 | Yes |
| C-02 | Tests 1,2,3 pass; 4,5 fail | 3 | Yes (Test 1 passes) |
| C-03 | Tests 2,3,4 pass; Test 1 fails | 3 | **No** (Test 1 must pass) |
| C-04 | Only 2 tests pass | 2 | No |
| C-05 | Test 1 uncertain, others pass | 4 | No (Test 1 must be 'no') |
| C-06 | Evidence missing for Test 3 | 4 | No (unsubstantiated = fails) |

### 17.4 Stage D Test Scenarios

| Test ID | Scenario | Method | Expected Fair Value | Notes |
|---------|----------|--------|---------------------|-------|
| D-01 | Normalised EPS 50, Fair P/E 25 | P/E | 1250 | |
| D-02 | P/E 30, Growth 40% | PEG | PEG=0.75 | Undervalued band |
| D-03 | P/E 40, Growth 15% | PEG | PEG=2.67 | Overvalued warning |
| D-04 | Price 200, BVPS 100, Bank | P/B | P/B=2.0 | Fair band |
| D-05 | DCF: FCF 100Cr, growth 12%, WACC 10%, terminal 5%, 5Y horizon | DCF | ~1450 | Scenario sensitivity required |
| D-06 | Cyclical co: peak EPS used | P/E | Overstated | Must use mid-cycle |
| D-07 | Negative EPS | P/E | N/M | Mark unsuitable |
| D-08 | DCF terminal value > 80% of total | DCF | Flagged | VALUATION_WARNING: high terminal dependence |
| D-09 | Margin of safety calc: FV 1000, Price 750 | All | MOS=25% | BuyReady if confidence not low |
| D-10 | Margin of safety: FV 1000, Price 850 | All | MOS=15% | Not BuyReady |

### 17.5 Stage E Test Scenarios

| Test ID | Scenario | Expected |
|---------|----------|----------|
| E-01 | Bullish engulfing at support, confirmed, in buy zone | Eligible = true |
| E-02 | Hammer but not confirmed | Eligible = false |
| E-03 | Pattern confirmed but price > maxBuyPrice | Eligible = false |
| E-04 | Bearish engulfing on held position | Alert generated, not auto-sell |
| E-05 | Three white soldiers but at resistance | Context flag: overextension |

### 17.6 Stage F Test Scenarios

| Test ID | Portfolio | Trade | Risk Check | Expected |
|---------|-----------|-------|------------|----------|
| F-01 | 1Cr, 1% risk, entry 100, stop 95 | Qty = 2000 | All pass | Ready |
| F-02 | Same, but stock already 9% of portfolio | Qty = 2000 → 11% | Stock limit fail | Blocked |
| F-03 | Same, sector already 28% | Qty = 2000 → 32% | Sector limit fail | Blocked |
| F-04 | Stop = entry (zero risk) | Division by zero | Error | Blocked |
| F-05 | Illiquid: qty > 5% daily volume | Adjusted qty | Liquidity fail | Blocked/Reduced |

### 17.7 Stage G Test Scenarios

| Test ID | Trigger | Decision | Expected |
|---------|---------|----------|----------|
| G-01 | Stop hit | Sell | Journal entry + position closed |
| G-02 | Thesis broken | Hold (with reason) | Alert acknowledged, position kept |
| G-03 | Fair value reached | Trim 50% | Position reduced, journal updated |
| G-04 | Overvalued 30% | Hold | Valuation warning, review scheduled |

### 17.8 Cross-Stage Workflow Tests

| Test ID | Scenario | Expected |
|---------|----------|----------|
| WF-01 | Stage A hard stop → attempt Stage B | Blocked at API level |
| WF-02 | Stage A pass, Stage B hard stop | Stage C blocked |
| WF-03 | Stage A conditional warning overridden → Stage B | Override audit record exists |
| WF-04 | Stage D valuation low confidence → Stage F | BUY-READY = false, trade plan blocked |
| WF-05 | Stage F risk limit breach + override | Trade plan status 'ready' with override record |

---

## 18. Files Created in This Specification Phase

```
docs/strategy/
├── INVESTMENT_RULES_SPECIFICATION.md       (this file)
├── STAGE_A_SCORING_SPEC.md
├── STAGE_B_SCORING_SPEC.md
├── RED_FLAG_ENGINE_SPEC.md
├── BUSINESS_MODEL_AND_MOAT_SPEC.md
├── VALUATION_ENGINE_SPEC.md
├── TECHNICAL_ANALYSIS_SPEC.md
├── PORTFOLIO_RISK_AND_EXIT_SPEC.md
├── DOMAIN_MODEL_SPEC.md
└── RULE_VALIDATION_TEST_CASES.md
```

---

## 19. Verification Performed

- [x] Read and parsed `Personal_Stock_Assistant_Updated_Strategy_Blueprint.docx` completely
- [x] Extracted all Stage A scoring rules, thresholds, and verdict bands
- [x] Extracted Stage B 10-point allocation and trend classifications
- [x] Extracted red-flag taxonomy and gate behaviours
- [x] Extracted Stage C business model questions and 5 moat tests
- [x] Extracted 4 valuation methods with formulas and bands
- [x] Extracted Stage E candlestick patterns and technical context
- [x] Extracted Stage F position sizing and portfolio limits
- [x] Extracted Stage G monitoring triggers and sell framework
- [x] Identified all benchmark tables and sector classifications
- [x] Identified bank/NBFC legacy scoring and unsuitable ratios
- [x] Identified all ambiguities requiring user decisions (15 items)
- [x] Mapped all rules to deterministic TypeScript domain interfaces
- [x] Created test scenarios for every scoring threshold and edge case

---

## 20. Decisions Requiring User Approval

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | D/E boundary inclusivity (0.5, 1.25) | <0.5 / 0.5–1.25 / >1.25 vs ≤0.5 / 0.5<×≤1.25 / >1.25 | Option A |
| 2 | Stage B pass threshold | ≥6.5/10 vs other | ≥6.5/10 |
| 3 | Stage C scoring & pass rule | 5 tests × 1; ≥3 + Test 1 | As proposed |
| 4 | Bank/NBFC dedicated scorecard timing | Phase 0 vs Phase 2+ | Legacy 9-pt now; dedicated Phase 2+ |
| 5 | Return calculation method | TWR vs MWR | TWR portfolio; MWR trades |
| 6 | PEG growth rate source | Historical CAGR vs forward estimate | Both shown, user selects |
| 7 | Public holding ≥50% flag | Configurable (default 50%) | Configurable, default 50% |
| 8 | "Consistently rising" quarterly definition | Strict (all up) vs majority up | Majority up, max 1 decline |
| 9 | CFO vs PAT divergence threshold | Forensic flag only vs point deduction | Flag if >20% divergence |
| 10 | Valuation confidence scale | High/Med/Low vs numeric | High/Med/Low with criteria |
| 11 | DCF in MVP scope | Full simplified vs placeholder | Simplified, labelled educational |
| 12 | Shareholding Up/Down/Up scoring | 0 + review vs 0.25 | 0 + review |
| 13 | Industry P/E source v1 | Static table vs dynamic | Static v1; dynamic later |
| 14 | P/E x < 0.8 value-trap review | Mandatory block vs warning | Mandatory review |
| 15 | Current ratio exactly 1.0 | Hard flag vs 0.5 pts | 0.5 pts |

---

## 21. Recommended Next Phase

**Phase 1 — Foundation (per Roadmap)**
1. Initialize TypeScript monorepo (pnpm, Turbo)
2. Create `packages/core` with domain types and scoring engine skeleton
3. Implement Stage A engine with all 10 rules, red flags, and bank variant
4. Add `packages/contracts` with Zod schemas for all DTOs
5. Set up PostgreSQL + Prisma with initial schema (companies, financials, analyses)
6. Create Next.js web app with `/api/v1/analyses/stage-a` endpoint
7. Build CSV/manual import for financial data
8. Write unit tests for every Stage A rule (using test cases in Section 17)
9. CI pipeline: lint, typecheck, test, build

**Gate to Phase 2:** Stage A engine passes all unit tests, explains every point, blocks hard flags correctly, and produces deterministic outputs on fixed test fixtures.

---

*End of Investment Rules Specification*