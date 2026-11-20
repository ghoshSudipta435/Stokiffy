# Business Model and Moat Specification

**Version:** 1.0  
**Date:** 15 November 2026  
**Status:** Draft — Pending User Approval  
**Rule Set Version:** `stage-c-v1.0`

---

## 1. Purpose

Stage C assesses the **business quality and durability** independent of current financial metrics. The handwritten notes emphasize: *"Great business plus temporarily weak numbers may be an opportunity; great numbers plus weak business may be temporary success."*

This stage captures **evidence-backed assessments**, not subjective scores. Every conclusion must cite sources and distinguish verified facts from inferences.

---

## 2. Business Model Assessment (Three Questions)

### 2.1 Question 1: Value Creation
**How does the company create value?**
- Identify: Product/Service, Customer, Customer Problem, Why Solution Matters
- Evidence: Customer testimonials, case studies, problem-solution fit, market research

### 2.2 Question 2: Value Capture
**How does the company capture value?**
- Explain: Pricing power, Revenue streams (recurring vs one-time), Gross margin, Cash conversion
- Evidence: Pricing history, cohort retention, margin trends, FCF/revenue ratio

### 2.3 Question 3: Scalability
**Is the model scalable? Could it serve 10x customers with ~2x costs?**
- Assess: Asset intensity, Capacity constraints, Working capital needs, Incremental returns on capital
- Evidence: Historical incremental ROCE, capex/revenue ratio, operating leverage

### 2.4 Business Model Categories & Key Metrics

| Model | Key Metrics / Evidence |
|-------|------------------------|
| **Subscription** | MRR/ARR, Churn (logo & revenue), Net Revenue Retention, CAC Payback, LTV/CAC |
| **Marketplace** | GMV, Take Rate, Active Buyers/Sellers, Repeat Frequency, Contribution Margin, Network Liquidity |
| **Branded Manufacturing** | Brand Strength (unaided awareness), Pricing Power, Gross/Operating Margin, Distribution Reach, Repeat Purchase Rate |
| **Commodity Manufacturing** | Cost Curve Position, Capacity Utilization, Input-Cost Sensitivity, Balance Sheet Resilience, Cycle Position |
| **Asset-Light vs Asset-Heavy** | ROCE/ROA, Capex/Revenue, Working Capital Needs, FCF Conversion, Incremental Capital Returns |
| **Freemium** | Free-to-Paid Conversion, Retention by Cohort, Acquisition Cost, Engagement (DAU/MAU), Scale Economics |

### 2.5 Business Model Data Model

```typescript
// packages/core/src/types/stage-c.ts

export interface BusinessModelAnswer {
  questionId: 'value-creation' | 'value-capture' | 'scalability';
  answer: string;                          // Narrative answer
  evidence: EvidenceItem[];                // Supporting evidence
  confidence: 'high' | 'medium' | 'low';
  tags: EvidenceTag[];                     // Source classification
  completedAt: string;
  completedBy: string;
}

export type EvidenceTag = 
  | 'verified-fact'        // From audited filings, official data
  | 'company-claim'        // From management commentary, presentations
  | 'analyst-estimate'     // From broker reports, consensus
  | 'inference'            // Engine/User derived
  | 'news-report'          // Media coverage
  | 'user-input';          // Manual entry

export interface EvidenceItem {
  id: string;
  description: string;
  source: string;                          // Filing URL, transcript, report, etc.
  sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
  date: string;                            // ISO 8601
  tags: EvidenceTag[];
  relevance: 'direct' | 'supporting' | 'contextual';
}
```

**Rule:** Every answer must have ≥1 evidence item. Answers without evidence → `confidence: 'low'` and tagged `unsubstantiated`.

---

## 3. Five Moat Types (Framework)

| Moat Type | Description | Key Indicators |
|-----------|-------------|----------------|
| **Brand Moat** | Trusted brand enabling pricing power | Unaided awareness, price premium vs peers, customer loyalty, repeat purchase |
| **Network-Effect Moat** | Value increases with participants | Metcalfe's law dynamics, switching costs from network, liquidity, data advantages |
| **Cost-Advantage Moat** | Structural cost leadership | Scale economies, proprietary process, location, procurement, supply chain control |
| **Switching-Cost Moat** | High time/risk/expense to leave | Integration depth, data lock-in, retraining cost, contractual, regulatory |
| **Regulatory/Patent Moat** | Durable legal barriers | Patents (remaining life), licenses, regulatory approvals, government contracts |

---

## 4. Five Moat Tests (Proposed Scoring)

### 4.1 Test Definitions

| Test # | Question | Pass Condition | Evidence Expected |
|--------|----------|----------------|-------------------|
| **1** | **Can competitors easily copy the business?** | **Answer = No** — supported by patents, cost structure, distribution, network, data, brand, or switching costs | Patents, cost analysis, distribution maps, network metrics, brand studies, switching cost analysis |
| **2** | **Can the advantage last 10+ years?** | Evidence of durability, reinvestment, customer behaviour, threat analysis | Reinvestment track record, R&D spend, customer retention curves, competitive threat assessment |
| **3** | **Has ROE been high & consistent for 10+ years?** | Historical ROE series; explain leverage, buybacks, accounting effects | 10Y ROE series, decomposition (DuPont), buyback history, accounting policy changes |
| **4** | **Can the company raise prices without losing customers?** | Price/mix, volume, retention, market-share, margin evidence | Price increase history, volume impact, retention cohorts, market share stability |
| **5** | **Is market share stable or growing over 5+ years?** | Reliable market-share series + addressable market definition | Market share data (industry reports), TAM/SAM/SOM analysis, competitive positioning |

### 4.2 Scoring Rules (Proposed — Requires Approval)

- **Each test:** 1 point if passed, 0 if failed/uncertain
- **Test 1 (Non-Copyability):** **Must pass** for overall moat pass
- **Overall Pass:** ≥ 3/5 points **AND** Test 1 passes
- **Evidence Required:** Every test answer must cite ≥1 `EvidenceItem` with `relevance: 'direct'`
- **Unsubstantiated Answers:** Score 0 for that test; flag `STAGE_C_EVIDENCE_MISSING`

### 4.3 Moat Test Data Model

```typescript
export interface MoatTestResult {
  testId: 1 | 2 | 3 | 4 | 5;
  question: string;
  answer: 'yes' | 'no' | 'uncertain';
  // For Test 1: pass = (answer === 'no')
  // For Tests 2-5: pass = (answer === 'yes')
  passes: boolean;
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;                       // Why this answer
  completedAt: string;
  completedBy: string;
}

export interface MoatAssessment {
  companyId: string;
  asOfDate: string;
  businessModel: BusinessModelAnswer[];    // 3 questions
  moatTests: MoatTestResult[];             // 5 tests
  moatScore: number;                       // 0-5
  moatPass: boolean;                       // score >= 3 AND test1.passes
  overallConfidence: 'high' | 'medium' | 'low';
  ruleSetVersion: string;
  dataProvenance: DataProvenance;
}
```

### 4.4 Confidence Calculation

```typescript
function calculateMoatConfidence(tests: MoatTestResult[]): 'high' | 'medium' | 'low' {
  const highConfidenceTests = tests.filter(t => t.confidence === 'high' && t.evidence.some(e => e.tags.includes('verified-fact'))).length;
  const totalWithDirectEvidence = tests.filter(t => t.evidence.some(e => e.relevance === 'direct')).length;
  
  if (highConfidenceTests >= 4 && totalWithDirectEvidence === 5) return 'high';
  if (highConfidenceTests >= 2 && totalWithDirectEvidence >= 3) return 'medium';
  return 'low';
}
```

**Low Confidence Effect:** Stage C output includes `overallConfidence: 'low'` → Stage D valuation confidence capped at 'low' → BUY-READY blocked.

---

## 5. AI Assistant Role in Stage C

**Appropriate (Good AI Use):**
- Draft moat/business-model questions for user
- Identify evidence gaps in user's answers
- Summarize company filings/transcripts with citations to source documents
- Compare competing explanations and list risks for human review
- Flag unsubstantiated claims

**Inappropriate (Must Remain Deterministic/Controlled):**
- Assigning moat scores or pass/fail
- Creating market share data or financial estimates without source
- Replacing human judgement on "can advantage last 10+ years"
- Presenting AI inference as verified fact

**Implementation:** AI-generated analysis stored separately with `sourceType: 'inference'` and `tags: ['inference']`. Never mixed with `verified-fact` evidence.

---

## 6. Stage C Gate to Stage D

**Proposed (Requires Approval):**
- Moat score ≥ 3/5
- Test 1 (Non-Copyability) passes
- Business model questions all answered with ≥1 evidence each
- No `STAGE_C_EVIDENCE_MISSING` flags unacknowledged

**If Gate Fails:**
- Stage D valuation can still be run (research mode)
- But `moatPass: false` and `overallConfidence: 'low'` propagate to valuation
- BUY-READY blocked at Stage D/F

---

## 7. Missing Data Behaviour

| Scenario | Handling |
|----------|----------|
| Business model question unanswered | `STAGE_C_BUSINESS_MODEL_INCOMPLETE` (DATA_QUALITY_WARNING) |
| Moat test answer 'uncertain' | Scores 0; `STAGE_C_MOAT_TEST{n}_UNCERTAIN` (CONDITIONAL_WARNING) |
| Moat test answer without evidence | Scores 0; `STAGE_C_EVIDENCE_MISSING` (DATA_QUALITY_WARNING) |
| Market share data unavailable | Test 5: answer 'uncertain'; flag `STAGE_C_MARKET_SHARE_UNAVAILABLE` |
| 10Y ROE history unavailable | Test 3: answer 'uncertain'; flag `STAGE_C_ROE_HISTORY_INCOMPLETE` |

**Never** infer a pass from missing data.

---

## 8. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Test 1 passes but only 2 other tests pass (score=3) | **Pass** (≥3 AND Test 1) |
| Test 1 fails but 4 other tests pass (score=4) | **Fail** (Test 1 mandatory) |
| All tests 'uncertain' with evidence explaining uncertainty | Score 0; moatPass=false; confidence=low |
| Competitor copyability: "partially" | Treat as 'uncertain' → score 0; requires binary yes/no |
| Advantage duration: "5-7 years visible" | Treat as 'uncertain' for 10+ year test |
| ROE high but driven by leverage | Test 3: answer 'no' (not sustainable high ROE) |
| Price increases attempted but volume dropped | Test 4: answer 'no' (no pricing power) |
| Market share data from different sources/definitions | Flag inconsistency; require single reliable source |

---

## 9. Configuration

```yaml
# config/stage-c-v1.0.yaml
stageC:
  version: "1.0"
  moatTests:
    - testId: 1
      key: "non-copyability"
      question: "Can competitors easily copy the business?"
      passCondition: "answer === 'no'"
      mandatory: true
      evidenceRequired: true
    - testId: 2
      key: "durability"
      question: "Can the advantage last 10+ years?"
      passCondition: "answer === 'yes'"
      mandatory: false
      evidenceRequired: true
    - testId: 3
      key: "roe-consistency"
      question: "Has ROE been high & consistent for 10+ years?"
      passCondition: "answer === 'yes'"
      mandatory: false
      evidenceRequired: true
    - testId: 4
      key: "pricing-power"
      question: "Can the company raise prices without losing customers?"
      passCondition: "answer === 'yes'"
      mandatory: false
      evidenceRequired: true
    - testId: 5
      key: "market-share"
      question: "Is market share stable or growing over 5+ years?"
      passCondition: "answer === 'yes'"
      mandatory: false
      evidenceRequired: true
  passRules:
    minScore: 3
    test1MustPass: true
  confidence:
    highThreshold: 4
    mediumThreshold: 2
  evidence:
    minDirectEvidencePerTest: 1
    unverifiedFactPenalty: true
```

---

## 10. Test Scenarios

| Test ID | Scenario | Moat Score | Moat Pass? | Confidence | Flags |
|---------|----------|------------|------------|------------|-------|
| C-01 | All 5 tests pass with verified evidence | 5 | Yes | High | None |
| C-02 | Tests 1,2,3 pass; 4,5 fail | 3 | Yes | Medium | None |
| C-03 | Tests 2,3,4,5 pass; Test 1 fails | 4 | **No** (Test 1 mandatory) | Medium | `STAGE_C_MOAT_TEST1_FAIL` |
| C-04 | Only 2 tests pass | 2 | No | Low | `STAGE_C_MOAT_SCORE_BELOW_3` |
| C-05 | Test 1 uncertain, others pass | 4 | No | Low | `STAGE_C_MOAT_TEST1_UNCERTAIN` |
| C-06 | Test 3 passes but evidence is 'inference' only | 4 | No | Low | `STAGE_C_EVIDENCE_MISSING` |
| C-07 | Business model Q2 unanswered | N/A | N/A | N/A | `STAGE_C_BUSINESS_MODEL_INCOMPLETE` |
| C-08 | Market share data unavailable | 4 (if others pass) | Yes/No | Low | `STAGE_C_MARKET_SHARE_UNAVAILABLE` |
| C-09 | 10Y ROE history missing | 4 (if others pass) | Yes/No | Low | `STAGE_C_ROE_HISTORY_INCOMPLETE` |
| C-10 | All answers 'inference', no verified facts | 5 | Yes | **Low** | `STAGE_C_UNSUBSTANTIATED_CLAIM` |

---

## 11. Decisions Requiring Approval

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Moat scoring enabled? | Yes (5 tests × 1 pt) vs No (evidence only) | Yes, with proposed rules |
| 2 | Test 1 mandatory for pass? | Yes vs No | Yes |
| 3 | Minimum moat score | 3/5 vs other | 3/5 |
| 4 | Evidence requirement per test | ≥1 direct vs flexible | ≥1 direct |
| 5 | Low confidence blocks BUY-READY? | Yes vs warning only | Yes (propagates to Stage D) |
| 6 | AI role in evidence gathering | Draft questions only vs also suggest evidence | Draft questions + gap identification |

---

*End of Business Model and Moat Specification*