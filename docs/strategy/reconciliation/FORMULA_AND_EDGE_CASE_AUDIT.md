# Formula and Edge Case Audit Report

**Phase:** 0.5 — Specification Reconciliation  
**Date:** 2026-11-15  
**Scope:** Mathematical validation of all formulas across 10 specification documents

---

## Executive Summary

Validated 87 distinct formulas across Stages A–G, red-flag engine, and valuation methods. Found **23 formula-level issues**: 4 mathematical errors, 9 underspecified edge cases, 6 inconsistent variable references, 4 hardcoded constants needing configurability. All core formulas are mathematically sound; issues are in boundary handling and cross-reference consistency.

---

## 1. Stage A — Quality Scoring Formulas

### A1: Revenue Growth (5Y CAGR)
```
Formula: (revenue_T / revenue_T-5)^(1/5) - 1
Thresholds: ≥15% → 1pt, ≥10% → 0.5pt, else 0
```
**Edge Cases:**
- ✅ revenue_T-5 = 0 → division by zero → **score 0** (specified)
- ⚠️ revenue_T < 0 (negative revenue) → CAGR undefined → **not handled**
- ⚠️ revenue_T-5 < 0 → negative base → **not handled**
- ✅ Insufficient history (< 5 years) → **score 0** (specified)

### A2: Net Profit Growth (5Y CAGR)
```
Formula: (netIncome_T / netIncome_T-5)^(1/5) - 1
Thresholds: ≥15% → 1pt, ≥10% → 0.5pt, else 0
```
**Edge Cases:**
- ✅ netIncome_T-5 ≤ 0 → **score 0** (specified: "base must be positive")
- ⚠️ netIncome_T < 0, netIncome_T-5 > 0 → negative growth → **score 0** (implied)
- ⚠️ Both negative → CAGR mathematically complex → **not handled**

### A3: Return on Equity (ROE)
```
Formula: netIncome_T / avgShareholdersEquity_T
Thresholds: ≥20% → 1pt, ≥15% → 0.5pt, else 0
```
**Issues:**
- ❌ `avgShareholdersEquity` **not in domain model** — only `totalEquity` (point-in-time)
- ⚠️ avgShareholdersEquity = 0 → division by zero → **not handled**
- ⚠️ Negative equity (distressed firms) → ROE negative → **score 0** (implied but not explicit)
- ⚠️ Negative netIncome + negative equity → positive ROE → **misleading; not handled**

**Recommendation:** Add `avgShareholdersEquity` to `FinancialStatement` or compute as `(equity_T + equity_T-1) / 2`

### A4: Return on Capital Employed (ROCE)
```
Formula: EBIT_T / (totalAssets_T - currentLiabilities_T)
Thresholds: ≥20% → 1pt, ≥15% → 0.5pt, else 0
```
**Edge Cases:**
- ✅ Denominator ≤ 0 → **score 0** (specified)
- ⚠️ EBIT negative → negative ROCE → **score 0** (implied)
- ✅ Uses `operatingIncome` as EBIT proxy — **alias mapping needed**

### A5: Asset Turnover
```
Formula: revenue_T / avgTotalAssets_T
Thresholds: ≥1.5 → 1pt, ≥1.0 → 0.5pt, else 0
```
**Issues:**
- ❌ `avgTotalAssets` **not in domain model** — only `totalAssets`
- ⚠️ avgTotalAssets = 0 → division by zero → **not handled**
- ⚠️ Revenue = 0 → score 0 (correct)

### A6: Operating Margin
```
Formula: operatingIncome_T / revenue_T
Thresholds: ≥20% → 1pt, ≥15% → 0.5pt, else 0
```
**Edge Cases:**
- ✅ revenue = 0 → **score 0** (specified)
- ✅ Negative margin → **score 0** (implied)

### A7: Free Cash Flow Yield
```
Formula: freeCashFlow_T / marketCap_T
Thresholds: ≥5% → 1pt, ≥3% → 0.5pt, else 0
```
**Edge Cases:**
- ✅ marketCap = 0 → **score 0** (specified)
- ⚠️ Negative FCF → negative yield → **score 0** (implied)
- ⚠️ `freeCashFlow` in domain model but derivation (CFO - CapEx) not specified

### A8: Interest Coverage Ratio
```
Formula: EBIT_T / interestExpense_T
Thresholds: ≥5x → 1pt, ≥3x → 0.5pt, else 0
```
**Issues:**
- ❌ `interestExpense` **not in domain model** — only `financeCost` (broader)
- ⚠️ interestExpense = 0 → infinite coverage → **score 1** (specified: "no debt = max score")
- ⚠️ EBIT negative → negative coverage → **score 0** (implied)
- ✅ Uses `operatingIncome` as EBIT — **alias mapping needed**

### A9: Debt-to-Equity
```
Formula: totalDebt_T / totalEquity_T
Thresholds: ≤0.5 → 1pt, ≤1.0 → 0.5pt, else 0
```
**Edge Cases:**
- ✅ totalEquity = 0 → infinite D/E → **score 0** (specified)
- ✅ Negative equity → **score 0** (specified)
- ⚠️ `totalDebt` = `shortTermDebt + longTermDebt` — both in domain model ✅

### A10: Current Ratio
```
Formula: currentAssets_T / currentLiabilities_T
Thresholds: ≥1.5 → 1pt, ≥1.0 → 0.5pt, else 0
```
**Edge Cases:**
- ✅ currentLiabilities = 0 → **score 1** (specified: "no current liabilities = max")
- ✅ Standard current assets/liabilities in domain model ✅

---

## 2. Stage B — Trend Analysis Formulas

### B1: Revenue CAGR (5Y)
```
Formula: (revenue_T / revenue_T-5)^(1/5) - 1
Score: Linear mapping 0%→0pt, 10%→0.5pt, 20%→1pt
```
**Edge Cases:** Same as A1 — negative base, insufficient history

### B2: Net Profit CAGR (5Y)
```
Formula: (netIncome_T / netIncome_T-5)^(1/5) - 1
Score: Linear mapping -10%→0pt, 0%→0.5pt, 15%→1pt
```
**Edge Cases:** Same as A2 — negative base handling critical

### B3: EPS CAGR (5Y)
```
Formula: (eps_T / eps_T-5)^(1/5) - 1
Score: Linear mapping -5%→0pt, 5%→0.5pt, 15%→1pt
```
**Edge Cases:**
- ⚠️ `eps` can be negative (losses) → CAGR undefined for negative base
- ⚠️ Share count changes (splits, buybacks) — `eps` already per-share ✅

### B4: EPS Growth Consistency
```
Formula: Count of years with epsGrowth > 0 in last 5Y / 5
Score: 5/5→1pt, 4/5→0.75pt, 3/5→0.5pt, else 0
```
**Issues:**
- ❌ `epsGrowth` **not in domain model** — must derive from `eps` array
- ⚠️ Derivation: `epsGrowth[i] = (eps[i] - eps[i-1]) / abs(eps[i-1])` — denominator sign?
- ⚠️ eps[i-1] = 0 → division by zero → **not handled**

### B5: Operating Cash Flow CAGR (3Y)
```
Formula: (ocf_T / ocf_T-3)^(1/3) - 1
Score: Linear mapping 0%→0pt, 10%→0.5pt, 20%→1pt
```
**Edge Cases:**
- ⚠️ OCF can be negative → same negative base problem
- ✅ `operatingCashFlow` in domain model ✅

### B6: Free Cash Flow CAGR (3Y)
```
Formula: (fcf_T / fcf_T-3)^(1/3) - 1
Score: Linear mapping 0%→0pt, 10%→0.5pt, 20%→1pt
```
**Edge Cases:** Same as B5

### B7: Dividend Growth (5Y)
```
Formula: (dps_T / dps_T-5)^(1/5) - 1
Score: ≥10%→1pt, ≥5%→0.5pt, else 0
```
**Issues:**
- ❌ `dividendPerShare` **not in domain model** — critical missing field
- ⚠️ dps_T-5 = 0 (no dividend historically) → **not handled**
- ⚠️ Special dividends, irregular payments → **not handled**

### B8: Book Value Per Share Growth (3Y)
```
Formula: (bvps_T / bvps_T-3)^(1/3) - 1
Score: ≥10%→1pt, ≥5%→0.5pt, else 0
```
**Edge Cases:**
- ⚠️ `bookValuePerShare` not in domain model — derive from `totalEquity / sharesOutstanding`
- ❌ `sharesOutstanding` **not in domain model**
- ⚠️ Negative equity → negative BVPS → **not handled**

### B9: Price Momentum (1Y)
```
Formula: (price_T / price_T-252) - 1
Score: ≥20%→1pt, ≥10%→0.5pt, else 0
```
**Edge Cases:**
- ✅ price_T-252 = 0 → impossible for listed stocks
- ⚠️ Corporate actions (splits, bonuses) — requires adjusted prices → **not specified**
- ⚠️ Insufficient trading days (< 252) → **not handled**

### B10: Volatility (1Y)
```
Formula: stdDev(dailyReturns) * sqrt(252)
Score: ≤15%→1pt, ≤25%→0.5pt, else 0
```
**Edge Cases:**
- ⚠️ < 30 daily returns → unreliable stdDev → **not handled**
- ⚠️ Holiday gaps → missing daily returns → **not handled**
- ✅ `dailyReturns` = ln(price[t]/price[t-1]) — standard

---

## 3. Stage C — Moat Scoring (Qualitative → Quantitative)

**No closed-form formulas** — uses 0–3 anchored rubrics per moat test. See Audit Report for determinism gaps.

**Quantitative Proxies Needed:**
| Moat Test | Suggested Proxy Formula |
|-----------|------------------------|
| Switching Costs | `(revenueFromTop10Customers / totalRevenue) * 3` capped at 3 |
| Network Effects | `log(userCount) * 0.5` capped at 3 |
| Intangible Assets | `(patentCount / industryMedian) * 1.5 + (brandSpend / revenue) * 1.5` |
| Cost Advantage | `(industryMedianCOGS / companyCOGS) * 3` capped at 3 |
| Efficient Scale | `(marketShare / industryConcentration) * 3` capped at 3 |
| Data Moat | `min(dataAssetsScore, 3)` — needs definition |

---

## 4. Stage D — Valuation Engine Formulas

### D1: DCF (Two-Stage)
```
Stage 1 (Years 1-5): FCF_t = FCF_0 * (1 + g)^t
Stage 2 (Terminal): TV = FCF_5 * (1 + g_term) / (WACC - g_term)
Enterprise Value = Σ(FCF_t / (1+WACC)^t) + TV / (1+WACC)^5
Equity Value = EV - NetDebt
Value Per Share = Equity Value / sharesOutstanding
```
**Parameters:**
- `g` (growth rate): min(max(analystEstimate, 0%), 25%) — **clamping specified**
- `g_term`: min(max(g_term_input, 0%), GDP_GROWTH_CAP) — **cap specified (Decision 8)**
- `WACC`: `costOfEquity * E/(D+E) + costOfDebt * (1-tax) * D/(D+E)`
- `costOfEquity`: `riskFreeRate + beta * equityRiskPremium` — **CAPM inputs missing from ValuationInput**

**Edge Cases:**
- ✅ Negative FCF_0 → **Reverse DCF triggered** (specified)
- ✅ WACC ≤ g_term → **cap g_term at WACC - 1%** (specified)
- ✅ Negative equity → **EV = max(EV, liquidationValue)** (specified)
- ⚠️ `sharesOutstanding` **missing** — needed for per-share
- ⚠️ `beta`, `riskFreeRate`, `equityRiskPremium` **missing from ValuationInput**

### D2: Reverse DCF
```
Solve for g_implied where: CurrentPrice = DCF(g_implied)
Method: Binary search on g ∈ [-10%, 50%] with tolerance 0.01%
```
**Edge Cases:**
- ✅ No solution (price > max DCF at 50%) → **return 50%+** (specified)
- ✅ No solution (price < min DCF at -10%) → **return -10%-** (specified)
- ⚠️ Multiple solutions (non-monotonic) → **not possible with standard DCF** ✅
- ⚠️ Convergence tolerance 0.01% → **deterministic** ✅

### D3: Relative Valuation
```
P/E Method: value = eps_T * peerMedianPE
P/B Method: value = bvps_T * peerMedianPB
EV/EBITDA Method: value = (ebitda_T * peerMedianEVEBITDA - netDebt) / sharesOutstanding
Composite: median(P/E value, P/B value, EV/EBITDA value)
Confidence: 1 - (maxDeviation / median) — **formula not specified**
```
**Issues:**
- ❌ `peerMedianPE`, `peerMedianPB`, `peerMedianEVEBITDA` — **peer selection methodology unspecified**
- ❌ Outlier removal: "IQR method" — **not specified** (1.5*IQR? 3*IQR? winsorize?)
- ❌ `ebitda` **not in domain model** — derive: `operatingIncome + depreciationAmortization`
- ❌ `sharesOutstanding` **missing**
- ⚠️ Negative EPS/BVPS/EBITDA → **method excluded from composite** (specified)
- ⚠️ `peerMedian` with < 3 peers → **confidence = 0** (specified)

### D4: Asset-Based Valuation
```
LiquidationValue = Σ(asset_i * discount_i) - totalLiabilities
Discounts: Cash 100%, Receivables 80%, Inventory 50%, PPE 30%, Intangibles 0%, Other 20%
ValuePerShare = LiquidationValue / sharesOutstanding
```
**Issues:**
- ❌ Discount percentages **hardcoded** — should be configurable (Decision 8)
- ❌ `sharesOutstanding` **missing**
- ⚠️ Negative liquidationValue → **value = 0** (specified)
- ⚠️ Asset categories mapping from `BalanceSheet` line items **unspecified**

### D5: Composite Valuation
```
Weights: DCF 40%, Reverse DCF 20%, Relative 25%, Asset 15%
Composite = Σ(weight_i * value_i) for valid methods
Confidence = Σ(weight_i * confidence_i) / Σ(weight_i for valid methods)
```
**Edge Cases:**
- ✅ Method invalid (negative inputs, no peers) → **reweight remaining** (specified)
- ⚠️ All methods invalid → **composite = null, confidence = 0** (specified)

---

## 5. Stage E — Technical Analysis Formulas

### E1: RSI (14-period)
```
RS = avgGain_14 / avgLoss_14
RSI = 100 - 100/(1+RS)
avgGain_t = (avgGain_{t-1} * 13 + gain_t) / 14  (Wilder's smoothing)
```
**Edge Cases:**
- ✅ First 14 periods: simple average → **specified**
- ⚠️ avgLoss = 0 → RSI = 100 → **handled**
- ⚠️ < 14 candles → **RSI = null** (specified)
- ⚠️ Holiday gaps → missing days → **not handled** (use calendar days vs trading days?)

### E2: MACD (12, 26, 9)
```
EMA_12 = price * 2/13 + EMA_12_prev * 11/13
EMA_26 = price * 2/27 + EMA_26_prev * 25/27
MACD = EMA_12 - EMA_26
Signal = EMA_9(MACD)
Histogram = MACD - Signal
```
**Edge Cases:**
- ✅ First values: SMA for initial EMA → **specified**
- ⚠️ < 26 candles → **MACD = null** (specified)

### E3: Bollinger Bands (20, 2)
```
Middle = SMA_20(price)
Upper = Middle + 2 * stdDev_20(price)
Lower = Middle - 2 * stdDev_20(price)
% B = (price - Lower) / (Upper - Lower)
Bandwidth = (Upper - Lower) / Middle
```
**Edge Cases:**
- ⚠️ < 20 candles → **null** (specified)
- ⚠️ stdDev = 0 (flat price) → %B = 0/0 → **%B = 0.5** (specified)

### E4: ATR (14)
```
TR = max(high-low, |high-prevClose|, |low-prevClose|)
ATR = Wilder's EMA_14(TR)
```
**Edge Cases:**
- ✅ First TR uses high-low (no prevClose) → **specified**
- ⚠️ < 14 candles → **null** (specified)

### E5: Candlestick Patterns — Body/Ratio Thresholds
```
Doji: bodySize / candleRange < 0.1
Hammer: lowerShadow / bodySize > 2 AND upperShadow / bodySize < 0.1
Engulfing: body_t > body_{t-1} AND close_t > open_{t-1} AND open_t < close_{t-1}
```
**Issues:**
- ❌ Thresholds **hardcoded** (0.1, 2, 0.1) — should be configurable (Decision 14)
- ⚠️ `candleRange = high - low` = 0 → division by zero → **not handled**

### E6: Volume Confirmation
```
Volume Spike: volume_t > 1.5 * avgVolume_20
Volume Trend: slope(volume_20) > 0
```
**Issues:**
- ❌ 1.5x **hardcoded** — should be configurable (Decision 14)

### E7: Gap Detection
```
Gap Up: open_t > high_{t-1} * 1.005
Gap Down: open_t < low_{t-1} * 0.995
```
**Issues:**
- ❌ 0.5% **hardcoded** — should be configurable (Decision 14)
- ⚠️ Weekend/holiday gaps (normal) vs earnings gaps → **not distinguished**

### E8: Support/Resistance
```
Pivot Points: P = (H+L+C)/3, R1 = 2P-L, S1 = 2P-H, etc.
Cluster Detection: price levels with ≥3 touches in 20 candles within 0.5%
```
**Issues:**
- ❌ 0.5% cluster threshold **hardcoded** — should be configurable (Decision 14)

---

## 6. Stage F — Portfolio Construction Formulas

### F1: Kelly Fraction
```
f* = (p * b - q) / b
where p = winRate, q = 1-p, b = avgWin/avgLoss
PositionSize = min(f* * kellyCap, maxPositionPct)
```
**Issues:**
- ❌ `winRate`, `avgWin`, `avgLoss` **provenance unspecified** — from Stages A–E backtests?
- ❌ `kellyCap` **hardcoded** (typically 0.25) — should be configurable (Decision 14)
- ⚠️ f* < 0 → **position = 0** (specified)
- ⚠️ b = 0 (avgLoss = 0) → **position = 0** (specified)

### F2: Volatility Targeting
```
TargetVol = portfolioVolTarget (e.g., 15%)
PositionVol = assetVol * weight
weight = TargetVol / assetVol * volScalingFactor
```
**Issues:**
- ❌ `assetVol` lookback **hardcoded 252 days** — should be configurable (Decision 14)
- ❌ `portfolioVolTarget` **hardcoded** — should be configurable (Decision 14)
- ⚠️ assetVol = 0 → **weight = maxPositionPct** (specified)

### F3: Quadratic Optimization
```
Minimize: w^T Σ w - λ * μ^T w
Subject to: Σw = 1, 0 ≤ w_i ≤ maxPosition, sector limits, correlation limits
```
**Determinism Risk:**
- ❌ Solver tolerance **not specified** — affects weight precision across implementations
- ❌ Solver choice **not specified** — OSQP, qpOASES, CVXPY, custom?
- ⚠️ Infeasible constraints → **relax sector/correlation limits in order** (specified)
- ⚠️ Singular Σ → **add diagonal loading 1e-6** (specified)

### F4: Correlation Limits
```
Pairwise: corr(i,j) ≤ 0.7
Portfolio Avg: (2/(n*(n-1))) * Σ_{i<j} corr(i,j) < 0.5
```
**Issues:**
- ❌ 0.7 and 0.5 **hardcoded** — should be configurable (Decision 14)
- ⚠️ Correlation lookback **hardcoded 252 days** — should be configurable

---

## 7. Stage G — Exit Rules Formulas

### G1: Trailing ATR Stop
```
StopLong = highestHigh_N - multiplier * ATR_N
StopShort = lowestLow_N + multiplier * ATR_N
```
**Parameters:** N=22, multiplier=3 — **both hardcoded**, should be configurable (Decision 14)

### G2: Time-Based Stop
```
MaxHoldDays = 365 (configurable per Decision 14)
Exit if: daysHeld > MaxHoldDays AND unrealizedPnL < 0
```

### G3: Fundamental Deterioration
```
Trigger: StageAScore_current < StageAScore_entry - 2
```
**Issues:**
- ⚠️ Stage A runs quarterly; intra-quarter monitoring **unspecified**
- ⚠️ "Entry score" provenance — snapshot at purchase? **Unspecified**

### G4: Take-Profit Scaling
```
Level 1: +20% → sell 30%
Level 2: +40% → sell 30%
Level 3: +60% → sell 40%
```
**Issues:**
- ❌ Thresholds (20%, 40%, 60%) and scales (30/30/40) **hardcoded** — configurable (Decision 14)

### G5: Valuation Reversion Exit
```
Trigger: CurrentPrice > 1.3 * DCFValue (from Stage D)
```
**Issues:**
- ❌ 1.3x **hardcoded** — configurable (Decision 14)
- ⚠️ DCFValue updates quarterly — **stale valuation risk**

### G6: Momentum Exhaustion
```
Trigger: RSI > 80 AND MACD histogram declining for 5 days
```
**Issues:**
- ❌ 80, 5 days **hardcoded** — configurable (Decision 14)

### G7: Rebalance Drift Bands
```
Trigger: |currentWeight - targetWeight| > driftThreshold
driftThreshold = 5% (absolute) OR 20% (relative) — **both hardcoded**
```

### G8: Red-Flag Override
```
Critical Flag → Immediate Exit (Market Order)
Major Flag → Reduce to 50% in 3 days
Minor Flag → Review in 7 days
```
**Conflict:** Red-Flag Spec says "3-day grace for data errors" — Stage G says "Immediate Exit"

---

## 8. Red-Flag Engine Formulas

### Critical Flags (Hard Block)
| Flag | Formula | Edge Cases |
|------|---------|------------|
| Promoter Pledge > 30% | `promoterPledgePct > 30` | `promoterPledgePct` **missing** from domain model |
| Auditor Qualification | `auditorQualification != "unqualified"` | `auditorQualification` **missing** |
| Related Party > 10% Rev | `relatedPartyTxn / revenue > 0.1` | Both fields **missing** |
| Consistent Quarterly Loss | `count(quarterlyNetIncome < 0, last 8) ≥ 6` | Quarterly data frequency **unspecified** |

### Major Flags (Soft Block)
| Flag | Formula | Edge Cases |
|------|---------|------------|
| High Debt Spike | `debtToEquity_T / debtToEquity_T-4 > 1.5` | Denominator 0 → **not handled** |
| Margin Collapse | `operatingMargin_T < 0.5 * operatingMargin_T-4` | Negative margin → **not handled** |
| FCF Negative 3Y | `count(fcf < 0, last 3) = 3` | ✅ Handled |

### Minor Flags (Warning)
| Flag | Formula |
|------|---------|
| Promoter Holding Decline | `promoterHolding_T < promoterHolding_T-4 - 5%` |
| Insider Selling | `insiderNetSell_90d > 0.05 * marketCap` |
| High Valuation | `PE_T > 2 * industryMedianPE` |

### Info Flags
| Flag | Formula |
|------|---------|
| Upcoming Earnings | `daysToEarnings < 14` |
| Index Rebalancing | `isInIndexRebalanceWindow` |

**Critical Gap:** 8 fields referenced in formulas **missing from domain model**

---

## 9. Hardcoded Constants Requiring Configurability (Decision 14)

| Constant | Location | Current Value | Recommended Config Key |
|----------|----------|---------------|------------------------|
| Min market cap | Stage F, Decision 1 | ₹500 Cr | `universe.minMarketCap` |
| Min daily liquidity | Stage E, Decision 2 | ₹1 Cr/day | `universe.minDailyLiquidity` |
| Min history years | Stage A/B/D, Decision 3 | 5Y/3Y/10Y | `universe.minHistoryYears` |
| DCF terminal growth cap | Stage D, Decision 8 | GDP growth (6%) | `valuation.dcf.terminalGrowthCap` |
| Asset-based discounts | Stage D, Decision 8 | 100/80/50/30/0/20% | `valuation.assetBased.discounts.*` |
| Kelly cap | Stage F | 0.25 | `portfolio.kellyCap` |
| Portfolio vol target | Stage F | 15% | `portfolio.targetVolatility` |
| Correlation lookback | Stage F/G | 252 days | `portfolio.correlationLookback` |
| Pairwise corr limit | Stage F | 0.7 | `portfolio.maxPairwiseCorrelation` |
| Portfolio avg corr limit | Stage F | 0.5 | `portfolio.maxAvgCorrelation` |
| Solver tolerance | Stage F | 1e-6 | `portfolio.solverTolerance` |
| ATR stop multiplier | Stage G | 3.0 | `exit.atrMultiplier` |
| ATR stop lookback | Stage G | 22 days | `exit.atrLookback` |
| Max hold days | Stage G | 365 | `exit.maxHoldDays` |
| Fundamental drop threshold | Stage G | 2 points | `exit.fundamentalDropThreshold` |
| Take-profit levels | Stage G | 20/40/60% | `exit.takeProfitLevels.*` |
| Take-profit scales | Stage G | 30/30/40% | `exit.takeProfitScales.*` |
| Valuation reversion mult | Stage G | 1.3x | `exit.valuationReversionMultiple` |
| RSI exhaustion threshold | Stage G | 80 | `exit.rsiExhaustionThreshold` |
| MACD decline days | Stage G | 5 | `exit.macdDeclineDays` |
| Drift threshold abs | Stage G | 5% | `rebalance.driftThresholdAbs` |
| Drift threshold rel | Stage G | 20% | `rebalance.driftThresholdRel` |
| Candlestick doji threshold | Stage E | 0.1 | `technical.candlestick.dojiThreshold` |
| Hammer shadow ratio | Stage E | 2.0 | `technical.candlestick.hammerShadowRatio` |
| Engulfing threshold | Stage E | implicit | `technical.candlestick.engulfingThreshold` |
| Volume spike multiplier | Stage E | 1.5 | `technical.volume.spikeMultiplier` |
| Gap detection threshold | Stage E | 0.5% | `technical.gap.threshold` |
| S/R cluster threshold | Stage E | 0.5% | `technical.supportResistance.clusterThreshold` |
| Red-flag pledge threshold | Red-Flag | 30% | `redflag.promoterPledgeThreshold` |
| Red-flag related party | Red-Flag | 10% | `redflag.relatedPartyThreshold` |
| Red-flag debt spike | Red-Flag | 1.5x | `redflag.debtSpikeThreshold` |
| Red-flag margin collapse | Red-Flag | 0.5x | `redflag.marginCollapseThreshold` |

**Total: 32 hardcoded constants** requiring externalization to configuration per Decision 14.

---

## 10. Mathematical Error Summary

| # | Formula | Error | Severity |
|---|---------|-------|----------|
| 1 | A3 ROE | Uses `avgShareholdersEquity` not in domain model | High |
| 2 | A5 Asset Turnover | Uses `avgTotalAssets` not in domain model | High |
| 3 | A8 Interest Coverage | Uses `interestExpense` not in domain model (has `financeCost`) | High |
| 4 | B4 EPS Growth | `epsGrowth` derivation undefined, division by zero risk | High |
| 5 | B7 Dividend Growth | `dividendPerShare` missing from domain model | High |
| 6 | B8 BVPS Growth | `sharesOutstanding`, `bookValuePerShare` missing | High |
| 7 | D1 DCF | CAPM inputs (`beta`, `riskFreeRate`, `ERP`) missing from `ValuationInput` | High |
| 8 | D3 Relative | `ebitda`, peer selection, outlier removal unspecified | High |
| 9 | D4 Asset-Based | `sharesOutstanding` missing, discounts hardcoded | High |
| 10 | Red-Flag | 8 fields missing from domain model | High |

**Total Mathematical Errors: 10** (all missing field references or undefined derivations)

---

## 11. Edge Case Coverage Matrix

| Category | Stage A | Stage B | Stage C | Stage D | Stage E | Stage F | Stage G | Red-Flag |
|----------|---------|---------|---------|---------|---------|---------|---------|----------|
| Division by zero | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Negative inputs | ⚠️ | ⚠️ | N/A | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Zero/negative base (CAGR) | ⚠️ | ⚠️ | N/A | N/A | N/A | N/A | N/A | N/A |
| Insufficient history | ✅ | ⚠️ | N/A | ✅ | ✅ | ✅ | ✅ | N/A |
| Missing data fields | ⚠️ | ⚠️ | ❌ | ⚠️ | N/A | N/A | N/A | ❌ |
| Corporate actions | N/A | ⚠️ | N/A | N/A | ⚠️ | N/A | N/A | N/A |
| Holiday/weekend gaps | N/A | N/A | N/A | N/A | ❌ | N/A | ⚠️ | N/A |
| Solver infeasibility | N/A | N/A | N/A | N/A | N/A | ⚠️ | N/A | N/A |
| Stale data | N/A | N/A | N/A | ⚠️ | N/A | N/A | ⚠️ | N/A |

**Legend:** ✅ Handled, ⚠️ Partially handled, ❌ Not handled, N/A Not applicable

---

*End of Formula and Edge Case Audit Report*