# User Decision Register

**Phase:** 0.5 — Specification Reconciliation  
**Date:** 2026-11-15  
**Source:** `INVESTMENT_RULES_SPECIFICATION.md` Section 14 (15 Decisions)  
**Status:** All 15 decisions **PENDING** — require user resolution before Phase 1 implementation

---

## Executive Summary

15 user decisions identified in the master specification that materially affect formula behavior, threshold values, data requirements, and enforcement logic. Each decision has technical consequences, implementation complexity, and downstream dependencies documented below. **No defaults assumed** — all require explicit user approval.

---

## Decision Register

### Decision 1: Minimum Market Capitalization Filter
**Question:** What is the minimum market cap for universe inclusion?
**Current Spec:** ₹500 Cr (referenced in Stage F, Decision 1)
**Options:**
- A) ₹500 Cr (current)
- B) ₹1,000 Cr
- C) ₹2,000 Cr
- D) No minimum (liquidity-only filter)
- E) Custom value: ₹____ Cr

**Technical Consequences:**
- Affects `StageFInput.universe` size and `PortfolioConstructionInput` candidate count
- Lower cap → more microcaps → higher volatility, lower liquidity, more red flags
- Higher cap → fewer candidates → concentration risk, may miss multibaggers
- Impacts `universe.minMarketCap` config key (Decision 14)

**Dependencies:** Stage F (universe), Stage E (liquidity), Red-Flag (liquidity flags)
**Complexity:** Low (single config parameter)
**Recommended:** A) ₹500 Cr — aligns with NSE SME threshold, balances breadth/quality

---

### Decision 2: Minimum Daily Liquidity Threshold
**Question:** What minimum average daily turnover is required?
**Current Spec:** ₹1 Cr/day (referenced in Stage E, Decision 2)
**Options:**
- A) ₹1 Cr/day (current)
- B) ₹50 L/day
- C) ₹5 Cr/day
- D) % of market cap (e.g., 0.1% daily)
- E) Custom value: ₹____/day

**Technical Consequences:**
- Affects `StageEInput` filtering and `TechnicalInput` volume validation
- Impacts `universe.minDailyLiquidity` config key
- Lower threshold → more illiquid names → slippage risk, manipulation risk
- Higher threshold → excludes smallcaps, reduces universe size
- % of market cap approach auto-scales but adds computation

**Dependencies:** Stage E (volume confirmation), Stage F (position sizing), Red-Flag (liquidity)
**Complexity:** Low (config parameter)
**Recommended:** A) ₹1 Cr/day — standard for Indian institutional participation

---

### Decision 3: Minimum Financial History Requirement
**Question:** How many years of financial history are required for each stage?
**Current Spec:** Stage A: 5Y, Stage B: 5Y/3Y mixed, Stage D: 10Y DCF, Stage E: 252 days
**Options:**
- A) Uniform 5Y for all fundamental stages (A, B, C, D)
- B) Stage-specific: A=5Y, B=3Y (trend), C=3Y, D=10Y, E=1Y
- C) Minimum 3Y universal, with graceful degradation (partial scores)
- D) Custom per stage: A=___, B=___, C=___, D=___, E=___

**Technical Consequences:**
- Affects `StageAInput`, `StageBInput`, `StageCInput`, `StageDInput`, `StageEInput` validation
- Impacts `universe.minHistoryYears` config (Decision 14)
- Uniform 5Y → excludes recent IPOs (Zomato, Paytm, etc.)
- Stage-specific → complex validation logic, inconsistent scoring basis
- Graceful degradation → requires partial scoring rules for each sub-rule (significant work)

**Dependencies:** All Stages A–E, Red-Flag (consistent loss flag needs 8 quarters)
**Complexity:** Medium (validation logic changes)
**Recommended:** C) Minimum 3Y universal with graceful degradation — balances coverage and data quality

---

### Decision 4: Red-Flag Hard-Block Thresholds
**Question:** Should Critical red flags be absolute hard-blocks, or allow override?
**Current Spec:** Critical = Hard Block (no new positions, exit existing)
**Options:**
- A) Absolute hard-block (current) — no exceptions
- B) Hard-block with 3-day grace for data errors (per Red-Flag Spec Section 4)
- C) Hard-block with manual override (audit trail required)
- D) Configurable per flag type

**Technical Consequences:**
- Affects `RedFlagEngine.enforce()` and `StageGInput.exitTriggers`
- **Direct conflict:** Red-Flag Spec says "3-day grace for data errors"; Stage G says "Critical → Immediate Exit"
- Option B/C requires override workflow, audit logging, notification system
- Option D requires per-flag configuration matrix

**Dependencies:** Red-Flag Engine, Stage G (Exit Rules), Stage F (Portfolio Construction)
**Complexity:** Medium (override workflow) to High (per-flag config)
**Recommended:** B) Hard-block with 3-day grace for data errors — resolves spec conflict, practical

---

### Decision 5: Promoter Pledge Threshold (Critical Flag)
**Question:** At what promoter pledge percentage should a Critical flag trigger?
**Current Spec:** > 30% (Red-Flag Spec)
**Options:**
- A) > 30% (current)
- B) > 20%
- C) > 50%
- D) Tiered: >20% Major, >30% Critical
- E) Custom: >___%

**Technical Consequences:**
- Affects `RedFlagInput.promoterPledgePct` validation
- Impacts `redflag.promoterPledgeThreshold` config (Decision 14)
- Lower threshold → more Critical flags → more blocked/exited positions
- Requires `promoterPledgePct` field in data pipeline (currently missing from domain model)

**Dependencies:** Red-Flag Engine, Data Provider (promoter pledge data source)
**Complexity:** Low (threshold change) but High (data sourcing)
**Recommended:** A) > 30% — SEBI threshold for disclosure, widely tracked

---

### Decision 6: Related Party Transaction Threshold (Critical Flag)
**Question:** What % of revenue from related party transactions triggers Critical flag?
**Current Spec:** > 10% of revenue (Red-Flag Spec)
**Options:**
- A) > 10% (current)
- B) > 5%
- C) > 20%
- D) Absolute amount: > ₹100 Cr
- E) Custom: >___%

**Technical Consequences:**
- Affects `RedFlagInput.relatedPartyTxn` and `revenue` validation
- Impacts `redflag.relatedPartyThreshold` config
- Requires `relatedPartyTxn` field in data pipeline (missing from domain model)
- % of revenue scales with company size; absolute amount doesn't

**Dependencies:** Red-Flag Engine, Data Provider (RPT data from annual reports)
**Complexity:** Low (threshold) but High (data extraction from PDFs)
**Recommended:** A) > 10% — standard governance threshold

---

### Decision 7: Auditor Qualification Treatment
**Question:** Which auditor opinions trigger Critical flag?
**Current Spec:** Any qualification (not "unqualified") = Critical (Red-Flag Spec)
**Options:**
- A) Only "adverse" and "disclaimer" = Critical; "qualified" = Major
- B) Any non-"unqualified" = Critical (current)
- C) "Qualified" = Major, "Adverse/Disclaimer" = Critical
- D) Configurable per opinion type

**Technical Consequences:**
- Affects `RedFlagInput.auditorQualification` enum validation
- Requires `auditorQualification` field (missing from domain model)
- Enum values: `unqualified` | `qualified` | `adverse` | `disclaimer`
- Option A/C more nuanced; Option B simpler but noisier

**Dependencies:** Red-Flag Engine, Data Provider (auditor report parsing)
**Complexity:** Low
**Recommended:** C) "Qualified" = Major, "Adverse/Disclaimer" = Critical — proportionate

---

### Decision 8: DCF Terminal Growth Cap & Asset-Based Discounts
**Question:** What cap on terminal growth rate, and what asset liquidation discounts?
**Current Spec:** Terminal growth capped at GDP growth (~6%); Asset discounts: Cash 100%, Receivables 80%, Inventory 50%, PPE 30%, Intangibles 0%, Other 20%
**Options:**
- A) Current values (GDP cap, fixed discounts)
- B) Terminal cap = Risk-free rate (currently ~7%)
- C) Terminal cap = Risk-free rate - 1% (more conservative)
- D) Configurable discounts per asset class (Decision 14)
- E) Industry-specific discounts

**Technical Consequences:**
- Affects `ValuationEngine.DCF()` and `AssetBased()` methods
- Impacts `valuation.dcf.terminalGrowthCap` and `valuation.assetBased.discounts.*` configs
- GDP cap ≈ 6% (India nominal); Risk-free ≈ 7% (10Y G-sec)
- Configurable discounts → 6 parameters, industry-specific → matrix

**Dependencies:** Stage D (Valuation), Stage G (Valuation Reversion Exit)
**Complexity:** Low (config) to Medium (industry matrix)
**Recommended:** C) Terminal cap = Risk-free - 1% (≈6%), D) Configurable discounts — conservative, flexible

---

### Decision 9: Kelly Criterion Cap
**Question:** What maximum fraction of Kelly bet to allow?
**Current Spec:** 25% (referenced in Stage F, typical industry practice)
**Options:**
- A) 25% (current)
- B) 50% (half-Kelly)
- C) 10% (conservative)
- D) Full Kelly (100%) — not recommended
- E) Custom: ___%

**Technical Consequences:**
- Affects `PortfolioConstruction.kellySizing()` 
- Impacts `portfolio.kellyCap` config
- Full Kelly → high volatility, drawdown risk
- Half-Kelly (50%) → 75% of Kelly return with 50% volatility
- Quarter-Kelly (25%) → 50% of Kelly return with 25% volatility

**Dependencies:** Stage F (Portfolio Construction), Stage A–E (winRate, avgWin/avgLoss provenance)
**Complexity:** Low
**Recommended:** B) 50% (half-Kelly) — better risk/return, industry standard for discretionary

---

### Decision 10: Portfolio Volatility Target
**Question:** What annualized portfolio volatility target?
**Current Spec:** 15% (referenced in Stage F)
**Options:**
- A) 15% (current)
- B) 10% (conservative)
- C) 20% (aggressive)
- D) Dynamic: based on market regime (VIX/NIFTY vol)
- E) Custom: ___%

**Technical Consequences:**
- Affects `PortfolioConstruction.volatilityTargeting()`
- Impacts `portfolio.targetVolatility` config
- Lower target → smaller positions, more cash, lower returns
- Dynamic regime → requires market volatility data, regime detection logic

**Dependencies:** Stage F, Stage E (volatility regimes)
**Complexity:** Low (static) to High (dynamic)
**Recommended:** A) 15% — reasonable for Indian equity long-only

---

### Decision 11: Correlation Lookback & Limits
**Question:** What lookback period and correlation limits for portfolio construction?
**Current Spec:** 252 days lookback, pairwise ≤ 0.7, portfolio avg < 0.5
**Options:**
- A) Current (252d, 0.7, 0.5)
- B) 504d (2Y) lookback, 0.6 pairwise, 0.4 avg
- C) 126d (6M) lookback, 0.8 pairwise, 0.6 avg
- D) Configurable all three (Decision 14)
- E) Dynamic: expand lookback in low-vol regimes

**Technical Consequences:**
- Affects `PortfolioConstruction.correlationMatrix()` and limits
- Impacts `portfolio.correlationLookback`, `maxPairwiseCorrelation`, `maxAvgCorrelation` configs
- Shorter lookback → more responsive but noisier correlations
- Longer lookback → stable but lagging
- Dynamic → regime detection needed

**Dependencies:** Stage F, Stage E (market regimes)
**Complexity:** Low (config) to Medium (dynamic)
**Recommended:** D) Configurable all three — allows tuning, start with A) as defaults

---

### Decision 12: Red-Flag Grace Period for Data Errors
**Question:** How long to allow for data correction before Critical flag enforcement?
**Current Spec:** 3 days (Red-Flag Spec Section 4) — **CONFLICTS** with Stage G "Immediate Exit"
**Options:**
- A) 3 days (Red-Flag Spec)
- B) 0 days — Immediate (Stage G Spec)
- C) 1 day
- D) 5 days (week)
- E) Per-flag configurable

**Technical Consequences:**
- **CRITICAL CONFLICT** — must be resolved before Phase 1
- Affects `RedFlagEngine.enforce()` and `StageG.exitTriggers.redFlagOverride`
- Requires `RedFlagOutput.gracePeriodExpiry` field
- Needs data error detection logic (how to know it's a data error?)

**Dependencies:** Red-Flag Engine, Stage G, Data Provider (data quality flags)
**Complexity:** Medium (grace period tracking, error classification)
**Recommended:** A) 3 days — aligns with Red-Flag Spec, practical for corporate action corrections

---

### Decision 13: Take-Profit Scaling Levels
**Question:** At what profit levels and what fractions to scale out?
**Current Spec:** +20%→30%, +40%→30%, +60%→40% (Stage G)
**Options:**
- A) Current (20/40/60, 30/30/40)
- B) +15%→25%, +30%→25%, +50%→50%
- C) +25%→33%, +50%→33%, +75%→34%
- D) Trailing take-profit (e.g., trail 10% from peak)
- E) Fully configurable levels and scales (Decision 14)

**Technical Consequences:**
- Affects `StageGExitEngine.takeProfitScaling()`
- Impacts `exit.takeProfitLevels.*` and `exit.takeProfitScales.*` configs
- Must sum to 100% (or ≤100% with remainder at final exit)
- Trailing → more complex, requires peak tracking

**Dependencies:** Stage G, Stage F (position tracking)
**Complexity:** Low (config) to Medium (trailing)
**Recommended:** E) Fully configurable — allows strategy tuning, start with A) as defaults

---

### Decision 14: Configuration Externalization
**Question:** Should all hardcoded thresholds be externalized to configuration files?
**Current Spec:** 32 hardcoded constants identified (see Formula Audit)
**Options:**
- A) Yes, all 32 constants → YAML/JSON config with schema validation
- B) Only "strategic" thresholds (≈15) → config; "tactical" (candlestick ratios) → code constants
- C) No, keep in code with `const` declarations
- D) Environment-specific configs (dev/staging/prod)

**Technical Consequences:**
- Affects **all Stages A–G, Red-Flag, Valuation**
- Requires `ConfigService` with schema validation, hot-reload, versioning
- Option A: Maximum flexibility, more complex deployment
- Option B: Pragmatic balance — strategic = business decisions, tactical = algorithm internals
- Option D: Needed for multi-environment anyway

**Dependencies:** All engines, Deployment pipeline
**Complexity:** Medium (config service) to High (full externalization)
**Recommended:** B) Strategic thresholds → config (15 params), Tactical → code constants — pragmatic

**Strategic (Config):** Market cap, liquidity, history years, terminal growth cap, asset discounts, Kelly cap, vol target, correlation lookback/limits, solver tolerance, ATR params, max hold, fundamental drop, TP levels/scales, val reversion, RSI/MACD exhaustion, drift thresholds, red-flag thresholds
**Tactical (Code):** Candlestick ratios (0.1, 2.0), volume spike (1.5), gap (0.5%), S/R cluster (0.5%), Wilder smoothing periods (14, 26, 9, 20)

---

### Decision 15: Data Provider & Universe Definition
**Question:** Which data vendor(s) for fundamentals, prices, corporate actions, and red-flag fields?
**Current Spec:** Not specified — architecture assumes `IDataProvider` contract
**Options:**
- A) NSE/BSE official (free, delayed, limited fundamentals)
- B) Screener.in / TickerTape (free, good fundamentals, no API)
- C) Premium: Bloomberg/Refinitiv (expensive, complete, API)
- D) Hybrid: NSE prices + Screener fundamentals + manual red-flag fields
- E) Custom: Build data pipeline from PDF annual reports + NSE feeds

**Technical Consequences:**
- **Fundamental blocker** for Phase 1 — no data = no engine
- Affects `IDataProvider` implementation, `FinancialStatement` completeness, red-flag fields
- Missing fields: `promoterPledgePct`, `relatedPartyTxn`, `auditorQualification`, `dividendPerShare`, `beta`, `sharesOutstanding`, `avgShareholdersEquity`
- Corporate action adjustment (splits, bonuses) critical for Stage B9, E

**Dependencies:** **ALL STAGES**, Domain Model completeness
**Complexity:** High (data engineering project)
**Recommended:** D) Hybrid for MVP: NSE/BSE API (prices, corporate actions) + Screener.in scrape (fundamentals) + manual entry for red-flag fields (promoter pledge, RPT, auditor) — lowest cost, covers 90% needs

---

## Decision Dependency Graph

```
Decision 15 (Data Provider) 
    │
    ├─→ Decision 1 (Market Cap) ──→ Stage F Universe
    ├─→ Decision 2 (Liquidity) ──→ Stage E, F
    ├─→ Decision 3 (History) ──→ Stages A, B, C, D, E
    ├─→ Decision 5,6,7 (Red-Flag Thresholds) ──→ Red-Flag Engine
    │       │
    │       └─→ Decision 12 (Grace Period) ──→ Stage G Conflict Resolution
    │
    ├─→ Decision 8 (Valuation Params) ──→ Stage D, G
    ├─→ Decision 9,10,11 (Portfolio Params) ──→ Stage F
    ├─→ Decision 13 (Exit Params) ──→ Stage G
    └─→ Decision 14 (Config Strategy) ──→ ALL STAGES
```

**Critical Path:** Decision 15 → Decisions 1-3,5-7 → Stage Implementation
**Conflict Resolution:** Decision 12 must be resolved before Stage G implementation

---

## Decision Tracking Template

| # | Decision | Status | Owner | Due Date | Resolution | Notes |
|---|----------|--------|-------|----------|------------|-------|
| 1 | Min Market Cap | PENDING | | | | |
| 2 | Min Liquidity | PENDING | | | | |
| 3 | Min History | PENDING | | | | |
| 4 | Hard-Block Override | PENDING | | | | |
| 5 | Pledge Threshold | PENDING | | | | |
| 6 | RPT Threshold | PENDING | | | | |
| 7 | Auditor Treatment | PENDING | | | | |
| 8 | DCF/Asset Params | PENDING | | | | |
| 9 | Kelly Cap | PENDING | | | | |
| 10 | Vol Target | PENDING | | | | |
| 11 | Correlation Params | PENDING | | | | |
| 12 | Grace Period | PENDING | | | **CONFLICT** |
| 13 | TP Scaling | PENDING | | | | |
| 14 | Config Strategy | PENDING | | | | |
| 15 | Data Provider | PENDING | | | **BLOCKER** |

---

## Technical Observations for User

### High-Impact Decisions (Resolve First)
1. **Decision 15 (Data Provider)** — Absolute blocker. No data = no implementation. Recommend hybrid approach for MVP.
2. **Decision 12 (Grace Period)** — Spec contradiction between Red-Flag (3 days) and Stage G (immediate). Must pick one.
3. **Decision 3 (History)** — Affects 5 stages. Uniform vs stage-specific changes validation logic significantly.

### Medium-Impact Decisions
4. **Decision 14 (Config Strategy)** — Architectural choice. Recommended: strategic→config, tactical→code.
5. **Decision 8 (Valuation Params)** — Affects Stage D composite and Stage G valuation exit. Conservative defaults recommended.
6. **Decision 9/10/11 (Portfolio Params)** — Interrelated. Kelly cap + vol target + correlation limits determine portfolio shape.

### Lower-Impact (Can Use Defaults)
7. **Decisions 1, 2, 5, 6, 7, 13** — Single thresholds, easily changed later via config (Decision 14).

### Data Field Dependencies
The following domain model fields **require Decision 15 resolution**:
- `promoterPledgePct` (Decision 5)
- `relatedPartyTxn` (Decision 6)
- `auditorQualification` (Decision 7)
- `dividendPerShare` (Stage B7)
- `beta` (Stage D CAPM)
- `sharesOutstanding` (Stage D per-share, Stage B8)
- `avgShareholdersEquity` (Stage A3)
- `bookValuePerShare` or components (Stage B8)

---

## Recommended Resolution Order

1. **Week 1:** Decision 15 (Data Provider) — spike/prototype data pipeline
2. **Week 1:** Decision 12 (Grace Period) — resolve spec conflict
3. **Week 2:** Decision 3 (History) — define validation strategy
4. **Week 2:** Decision 14 (Config Strategy) — implement ConfigService
5. **Week 3:** Decisions 1, 2, 5, 6, 7, 8, 9, 10, 11, 13 — set defaults, externalize to config
6. **Ongoing:** Revisit after Phase 1 backtesting

---

*End of User Decision Register*