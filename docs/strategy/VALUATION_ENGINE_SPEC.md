# Valuation Engine Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-d-v1.0`

---

## 1. Purpose

Stage D estimates fair value using **four complementary methods** and applies a **margin of safety** to determine a maximum buy price. Methods are not averaged blindly — the engine selects a primary method by sector/business model and uses others as cross-checks.

**Core Rule (from notes):** Invest only when market price ≥ 20% below fair value.
```
Maximum Buy Price = Fair Value × 0.80
```

---

## 2. Method Selection Principle

| Business Type | Primary Method | Cross-Check Methods |
|---------------|----------------|---------------------|
| Stable earnings, mature | P/E | PEG, P/B |
| Predictable growth | PEG | P/E, DCF |
| Asset-heavy / Financial | P/B | P/E, DCF |
| Cash-flow visible, long runway | DCF | P/E, PEG |
| Cyclical | Mid-cycle P/E + DCF scenarios | P/B, PEG (limited) |
| Asset-light, high growth | PEG + DCF | P/E (limited) |

**Rule:** Display each method's fair value, assumptions, applicability, and confidence separately. Show a **valuation range** (low–high across suitable methods), not a single number.

---

## 3. Method 1: P/E Valuation (Primary in Notes)

### 3.1 Formulas

| Component | Formula |
|-----------|---------|
| Relative P/E (x) | `Company P/E ÷ Industry/Peer P/E` |
| Fair Value/Share | `Normalised EPS × Selected Fair P/E Multiple` |
| Over/Undervaluation % | `(Market Price − Fair Value) ÷ Fair Value × 100` |
| Target Price | `Forecast EPS at Horizon × Assumed Exit P/E` |

### 3.2 Inputs Required

| Input | Source | Notes |
|-------|--------|-------|
| Current Market Price | Price feed | Adjusted for splits/bonuses |
| Reported EPS (Latest FY) | Financials | Check for exceptionals |
| Normalised EPS | Derived | Remove one-offs, cyclical peaks |
| Industry/Peer Median P/E | Benchmark config | Dated, sourced, peer set defined |
| Selected Fair P/E Multiple | User/Analyst | Default: Industry median; adjustable |
| Forecast EPS (Horizon) | User/Analyst | Clearly labelled assumption |
| Assumed Exit P/E | User/Analyst | Default: Industry median; adjustable |

### 3.3 Normalised Earnings Rules

1. **Identify exceptional items:** Gains/losses on asset sales, impairment, restructuring, tax one-offs
2. **Cyclical adjustment:** For cyclical sectors, use mid-cycle earnings (average of peak/trough or 5Y avg)
3. **Dilution adjustment:** Use diluted share count; factor in known warrants/ESOPs/QIPs
4. **Negative EPS:** P/E not measurable (N/M) → method **unsuitable**

### 3.4 Industry P/E Source (v1)

- **Static note-derived table** (editable) for testing
- **Later:** Dated peer median with source, peer set, calculation method
- **Never** use single-company "industry P/E" from data provider without verification

### 3.5 Applicability & Confidence

| Condition | Applicability | Confidence |
|-----------|---------------|------------|
| Positive normalised EPS, stable earnings | Suitable | High |
| Positive EPS, cyclical | Limited (use mid-cycle) | Medium |
| Negative/zero EPS | Unsuitable | N/A |
| No reliable industry peer group | Limited | Low |
| Exceptional items > 20% of PBT | Limited | Medium |

### 3.6 Valuation Warning

- Company P/E > 2× Industry P/E → `STAGE_D_PE_EXPENSIVE` (VALUATION_WARNING)
- Not automatic avoid — requires context (growth, quality)

---

## 4. Method 2: PEG (Growth-Adjusted P/E)

### 4.1 Formula

```
PEG = P/E ÷ Earnings Growth Rate (% as number)
Example: P/E 34, Growth 50% → PEG = 34 ÷ 50 = 0.68
```

### 4.2 Inputs Required

| Input | Source | Notes |
|-------|--------|-------|
| Current P/E | Market price / EPS | Trailing or forward |
| Earnings Growth Rate (%) | **Critical choice** | See below |

### 4.3 Growth Rate Selection (Decision Required)

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **Historical 5Y CAGR** | Past earnings CAGR | Objective, verifiable | Backward-looking |
| **Analyst Forward Estimate** | Consensus next 1-3Y growth | Forward-looking | May be optimistic, not always available |
| **User-Specified** | Manual input | Flexible | Subjective |
| **Both Shown** | Display both, user selects | Transparent | More complex UI |

**Recommendation:** Show both Historical CAGR and Analyst Forward (if available). User selects for PEG calc. Label clearly.

### 4.4 Note-Derived PEG Bands

| PEG Range | Interpretation |
|-----------|----------------|
| < 1.0 | Potentially undervalued |
| 1.0 – 1.5 | Fair |
| 1.5 – 2.0 | Getting expensive |
| > 2.0 | Overvalued warning |

### 4.5 Applicability

| Condition | Applicability |
|-----------|---------------|
| Predictable positive earnings growth | Suitable |
| Negative/unstable earnings | Unsuitable |
| Highly cyclical | Unsuitable |
| Low base distortion (e.g., post-loss recovery) | Unsuitable |
| Growth rate ≤ 0 | Unsuitable |

### 4.6 Confidence Factors

- Growth rate source (verified-fact > analyst-estimate > inference)
- Growth stability (low variance in historical growth → higher confidence)
- PEG < 1 with low confidence → not proof of undervaluation

---

## 5. Method 3: Price-to-Book (P/B)

### 5.1 Formula

```
P/B = Market Price per Share ÷ Book Value per Share
Book Value = (Total Assets − Total Liabilities) ÷ Shares Outstanding
```

### 5.2 Inputs Required

| Input | Source |
|-------|--------|
| Market Price | Price feed |
| Total Assets | Balance sheet |
| Total Liabilities | Balance sheet |
| Shares Outstanding | Capital structure |

### 5.3 Sector Bands (Note-Derived)

| Sector | Cheap | Fair / Reasonable | Expensive Warning |
|--------|-------|-------------------|-------------------|
| **Banks** | < 1.5 | 1.5–2.0 fair; 2–3 reasonable | > 3 |
| **Manufacturing** | < 1.5 | 1.5–3 | > 3 |
| **Real Estate** | < 1.5 | 1.5–4 | > 4 |

**Other sectors:** Not specified in notes — mark Limited/Unsuitable.

### 5.4 Applicability

| Business Type | Applicability |
|---------------|---------------|
| Banks / NBFCs / Financial | Suitable (primary) |
| Asset-heavy manufacturing | Suitable |
| Real estate / REITs | Suitable |
| Asset-light (IT, services, platforms) | Limited — intangibles not in book value |
| Negative equity | Unsuitable (P/B N/M) |

### 5.5 Adjustments (Recommended)

- **Intangible assets:** Consider tangible BV = (Total Assets - Intangibles - Goodwill) / Shares
- **Revaluation reserves:** Include if realizable
- **Subsidiaries:** Consolidated BV includes minority interest adjustment

---

## 6. Method 4: Discounted Cash Flow (DCF)

### 6.1 Formula

```
Fair Value = (Σ FCF_t / (1+WACC)^t  for t=1..n) + Terminal Value / (1+WACC)^n - Net Debt
Terminal Value = FCF_n × (1 + g) / (WACC - g)
Fair Value per Share = Fair Value ÷ Shares Outstanding
```

### 6.2 Required Inputs

| Input | Description | Typical Range / Notes |
|-------|-------------|----------------------|
| Forecast Horizon (n) | Years of explicit FCF forecast | 5–10 (default 5) |
| Revenue Growth (Years 1–n) | Annual % | Taper to terminal |
| Operating Margin (Years 1–n) | % | Stable or improving |
| Tax Rate | % | Statutory + effective adjustments |
| Reinvestment Rate | Capex - Depreciation + ΔWC / NOPAT | Linked to growth: g = ROIC × Reinvestment |
| WACC | Cost of equity × E/(D+E) + Cost of debt × D/(D+E) × (1-t) | 9–13% typical |
| Terminal Growth (g) | Perpetuity growth | ≤ GDP growth (4–6% India) |
| Net Debt | Total Debt - Cash & Equivalents | Current balance sheet |
| Shares Outstanding | Diluted | Include known dilution |

### 6.3 Scenario Requirements

| Scenario | Growth | Margin | WACC | Terminal g |
|----------|--------|--------|------|------------|
| **Bear** | Low | Compressed | High | Low |
| **Base** | Central | Current | Central | Central |
| **Bull** | High | Expanded | Low | High |

### 6.4 Sensitivity Table (Required Output)

| WACC \ Terminal g | g-1% | g | g+1% |
|-------------------|------|---|------|
| WACC-1% |  |  |  |
| WACC |  | **Base** |  |
| WACC+1% |  |  |  |

### 6.5 Flags (Valuation Warnings)

| Flag ID | Condition |
|---------|-----------|
| `STAGE_D_DCF_TERMINAL_DEPENDENCE` | Terminal Value > 70% of Total Value |
| `STAGE_D_DCF_UNSTABLE_CASH_FLOW` | FCF negative in >1 of last 5 years or CV > 50% |
| `STAGE_D_DCF_ASSUMPTIONS_UNREASONABLE` | WACC < 7% or > 18%; g > 6%; ROIC < WACC in steady state |
| `STAGE_D_DCF_NEGATIVE_FCF` | Latest FCF negative |

### 6.6 MVP Label

**Source notes describe DCF as "introductory".** MVP must label: *"Simplified Educational Calculator — not a precise valuation"*

---

## 7. Margin of Safety & Buy Decision

### 7.1 Core Calculation

```
Margin of Safety % = (Fair Value - Market Price) / Fair Value × 100
Maximum Buy Price = Fair Value × 0.80
Buy Ready = (Margin of Safety ≥ 20%) AND (Confidence ≠ Low)
```

### 7.2 Multi-Method Decision Logic

```typescript
function determineBuyReady(methods: ValuationMethodResult[], marketPrice: number): ValuationOutput {
  // Filter suitable methods
  const suitable = methods.filter(m => m.applicability === 'suitable');
  const limited = methods.filter(m => m.applicability === 'limited');
  
  // Primary method selection
  const primary = selectPrimaryMethod(suitable, limited);
  
  // Valuation range from suitable methods
  const fairValues = suitable.map(m => m.fairValue);
  const range = { 
    low: Math.min(...fairValues), 
    high: Math.max(...fairValues) 
  };
  
  // Margin of safety on primary
  const mos = (primary.fairValue - marketPrice) / primary.fairValue * 100;
  const maxBuyPrice = primary.fairValue * 0.80;
  
  // Confidence gate
  const confidenceOk = primary.confidence !== 'low';
  
  // Valuation warnings
  const warnings = methods.flatMap(m => m.flags).filter(f => f.class === 'VALUATION_WARNING');
  
  return {
    methods,
    primaryMethod: primary.method,
    valuationRange: range,
    maxBuyPrice,
    marginOfSafetyPct: mos,
    buyReady: mos >= 20 && confidenceOk && warnings.length === 0,
    valuationWarnings: warnings,
  };
}
```

### 7.3 Do Not Average Blindly

**Anti-Patterns to Avoid:**
- ❌ Average P/E, PEG, P/B, DCF fair values
- ❌ Weight by arbitrary scores
- ❌ "Consensus" fair value across incompatible methods

**Correct Approach:**
- Select **one primary method** by business type
- Show others as **cross-checks** (supporting / contradicting)
- If cross-checks **strongly contradict** primary → lower confidence, flag for review
- Range = min/max of **suitable** methods only

### 7.4 Cyclical Companies

- Use **mid-cycle earnings** for P/E and DCF base case
- Run scenarios: Peak / Mid / Trough
- Margin of safety applied to **mid-cycle fair value**
- Document cycle position assumption

### 7.5 Corporate Actions & Adjustments

| Adjustment | Applied To |
|------------|------------|
| Share dilution (ESOP, warrants, QIP) | All per-share metrics |
| Net debt (Debt - Cash) | DCF, P/B (if using enterprise value) |
| Subsidiary value (listed) | Sum-of-parts cross-check |
| Cash & investments (excess) | Add to DCF value; consider in P/B |

---

## 8. Valuation Output Data Model

```typescript
// packages/core/src/types/stage-d.ts

export type ValuationMethod = 'PE' | 'PEG' | 'PB' | 'DCF';
export type Applicability = 'suitable' | 'limited' | 'unsuitable';
export type Confidence = 'high' | 'medium' | 'low';

export interface ValuationMethodResult {
  method: ValuationMethod;
  fairValue: number;                    // Per share
  assumptions: Record<string, unknown>; // All inputs used
  applicability: Applicability;
  confidence: Confidence;
  explanation: string;                  // Human-readable rationale
  asOfDate: string;                     // ISO 8601
  scenarios?: {
    bear: number;
    base: number;
    bull: number;
  };
  sensitivity?: Record<string, number[]>; // For DCF
  flags: RedFlag[];                     // Valuation warnings + data quality
}

export interface ValuationOutput {
  stage: 'D';
  methods: ValuationMethodResult[];
  primaryMethod: ValuationMethod;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number;                  // Primary fairValue × 0.80
  marginOfSafetyPct: number;            // Based on primary
  buyReady: boolean;                    // MOS ≥ 20% AND confidence ≠ low AND no valuation warnings
  valuationWarnings: RedFlag[];
  calculatedAt: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
```

---

## 9. Missing Data Behaviour

| Missing Input | Method Impact | Flag |
|---------------|---------------|------|
| Industry P/E | P/E: Limited/Unsuitable | `STAGE_D_PEER_MEDIAN_UNAVAILABLE` |
| Normalised EPS | P/E: Unsuitable | `STAGE_D_NORMALISED_EARNINGS_UNAVAILABLE` |
| Negative EPS | P/E, PEG: Unsuitable | `STAGE_D_EPS_NEGATIVE` |
| Growth rate | PEG: Unsuitable | `STAGE_D_GROWTH_RATE_UNAVAILABLE` |
| Book value / Negative equity | P/B: Unsuitable | `STAGE_D_BOOK_VALUE_NEGATIVE` |
| FCF history < 3 years | DCF: Limited | `STAGE_D_INSUFFICIENT_FCF_HISTORY` |
| WACC inputs missing | DCF: Unsuitable | `STAGE_D_DCF_INPUTS_MISSING` |
| Market price stale > 1 day | All: DATA_QUALITY_WARNING | `STAGE_D_PRICE_STALE` |

---

## 10. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| P/E fair value < 0 (negative EPS) | Method unsuitable; not in range |
| PEG growth rate = 0 | Unsuitable; division by zero |
| P/B with negative equity | Unsuitable; flag |
| DCF: WACC ≤ g | Terminal value infinite → flag `ASSUMPTIONS_UNREASONABLE` |
| DCF: Terminal value > 80% of total | Flag `TERMINAL_DEPENDENCE`; confidence = low |
| Multiple suitable methods give wildly different FV | Range wide; confidence = low; flag for review |
| Market price > all fair values | MOS negative; buyReady = false; valuation warning |
| Primary method confidence = low | buyReady = false even if MOS ≥ 20% |
| User overrides valuation warning | Override record created; buyReady may pass but flagged |

---

## 11. Configuration

```yaml
# config/stage-d-v1.0.yaml
stageD:
  version: "1.0"
  marginOfSafety: 0.20  # 20%
  primaryMethodSelection:
    priority:
      - sector: ["Banks", "NBFC", "Insurance"]
        primary: "PB"
        crossChecks: ["PE", "DCF"]
      - sector: ["IT Services", "Pharma", "FMCG", "Consumer"]
        primary: "PE"
        crossChecks: ["PEG", "DCF"]
      - businessModel: ["Subscription", "Marketplace", "Asset-Light Growth"]
        primary: "PEG"
        crossChecks: ["PE", "DCF"]
      - businessModel: ["Commodity Manufacturing", "Asset-Heavy", "Cyclical"]
        primary: "DCF"
        crossChecks: ["PE", "PB"]
      - default:
        primary: "PE"
        crossChecks: ["PEG", "PB", "DCF"]
  pe:
    industryPeSource: "config/benchmarks.yaml"  # Static v1
    maxPeRatioForFair: 2.0  # x = Co/Industry; >2 = warning
    valueTrapThreshold: 0.8  # x < 0.8 = value trap review
  peg:
    growthRateOptions: ["historical-5y-cagr", "analyst-forward", "user-specified"]
    bands:
      undervalued: 1.0
      fair: [1.0, 1.5]
      expensive: [1.5, 2.0]
      overvalued: 2.0
  pb:
    sectorBands:
      Banks: { cheap: 1.5, fair: [1.5, 2.0], reasonable: [2.0, 3.0], expensive: 3.0 }
      Manufacturing: { cheap: 1.5, fair: [1.5, 3.0], expensive: 3.0 }
      RealEstate: { cheap: 1.5, fair: [1.5, 4.0], expensive: 4.0 }
  dcf:
    defaultHorizon: 5
    defaultTerminalGrowth: 0.05
    waccRange: [0.07, 0.18]
    terminalDependenceThreshold: 0.70
    unstableFcfThreshold: 0.50  # CV of FCF
    label: "Simplified Educational Calculator"
  confidence:
    highCriteria:
      - "primary method applicability === 'suitable'"
      - "assumptions sourced from verified-fact"
      - "cross-checks support primary"
    lowCriteria:
      - "primary method applicability === 'limited'"
      - "key assumptions are inference"
      - "cross-checks contradict primary"
      - "DCF terminal dependence > 70%"
```

---

## 12. Test Scenarios

| Test ID | Scenario | Primary | Fair Value | MOS | BuyReady | Flags |
|---------|----------|---------|------------|-----|----------|-------|
| D-01 | EPS 50, Fair P/E 25, Price 1000 | PE | 1250 | 20% | Yes | None |
| D-02 | EPS 50, Fair P/E 25, Price 1100 | PE | 1250 | 12% | No | MOS_INSUFFICIENT |
| D-03 | P/E 30, Growth 40% | PEG | PEG=0.75 | N/A | N/A | PEG_UNDERVALUED |
| D-04 | P/E 40, Growth 15% | PEG | PEG=2.67 | N/A | N/A | PEG_OVERVALUED |
| D-05 | Price 200, BVPS 100, Bank | PB | P/B=2.0 | Fair | N/A | None |
| D-06 | DCF: FCF 100Cr, g=12%, WACC=10%, g_term=5%, 5Y, NetDebt=0, Shares=10Cr | DCF | ~1450 | Calc | Calc | SENSITIVITY_REQUIRED |
| D-07 | Cyclical: Peak EPS used | PE | Overstated | False high | No (if detected) | CYCLICAL_PEAK_EARNINGS |
| D-08 | DCF terminal value 85% of total | DCF | Calc | Calc | No (confidence=low) | TERMINAL_DEPENDENCE |
| D-09 | Negative EPS | PE/PEG | N/M | N/A | No | EPS_NEGATIVE |
| D-10 | Low confidence primary, MOS 25% | Any | Calc | 25% | **No** | LOW_CONFIDENCE |
| D-11 | User overrides VALUATION_WARNING | Any | Calc | Calc | Yes (with override) | OVERRIDE_RECORD |

---

## 13. Decisions Requiring Approval

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Primary method selection logic | Configurable priority table vs user choice | Configurable table (sector + business model) |
| 2 | PEG growth rate source | Historical CAGR vs Analyst forward vs Both shown | Both shown, user selects |
| 3 | DCF in MVP scope | Full simplified vs placeholder | Full simplified, labelled educational |
| 4 | Margin of safety % | 20% (notes) vs configurable | 20% default, user-configurable |
| 5 | BuyReady requires no valuation warnings? | Yes vs warning only | Yes (strict) |
| 6 | Confidence gate for BuyReady | Low confidence blocks vs warning | Blocks |
| 7 | Cyclical adjustment default | Mid-cycle earnings vs peak | Mid-cycle with scenarios |
| 8 | Valuation range = min/max of suitable only? | Yes vs all methods | Suitable only |

---

*End of Valuation Engine Specification*