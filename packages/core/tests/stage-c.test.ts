/**
 * Stage C (Business Model & Moat Quality) Vitest Unit Tests
 *
 * Verifies:
 * 1. Business Model Evaluation:
 *    - Completeness check across all 3 core questions (value-creation, value-capture, scalability)
 *    - Incomplete/empty answers or answers without evidence trigger DATA_QUALITY_WARNING
 *    - Category support (SUBSCRIPTION, MARKETPLACE, BRANDED_MANUFACTURING, etc.)
 * 2. Moat Types Classification:
 *    - BRAND, NETWORK_EFFECT, COST_ADVANTAGE, SWITCHING_COST, REGULATORY_PATENT
 * 3. Five Moat Tests Scoring:
 *    - Test 1 (Non-Copyability) Inverted & Mandatory logic:
 *      * answer 'no' + direct evidence -> 1.0 pt, passes
 *      * answer 'yes' -> 0.0 pt, HARD_STOP (STAGE_C_MOAT_COPYABLE), blocks gate even if 4/5
 *      * answer 'uncertain' -> 0.0 pt, CONDITIONAL_WARNING (STAGE_C_MOAT_TEST1_UNCERTAIN)
 *    - Tests 2-5 standard checks (1.0 pt for affirmative substantiated answer)
 *    - Unsubstantiated answers (lacking direct evidence) score 0.0 pts & flag STAGE_C_EVIDENCE_MISSING
 * 4. Anti-Hallucination & Provenance Discipline:
 *    - Inference-only evidence flags STAGE_C_UNSUBSTANTIATED_CLAIM & caps confidence at 'low'
 *    - Direct evidence absence flags 'unsubstantiated' confidence
 *    - Verified-fact evidence enables 'high' or 'medium' confidence
 * 5. 10Y ROE Consistency Cross-Check:
 *    - Insufficient data (< 8 years) flags STAGE_C_ROE_HISTORY_INCOMPLETE
 *    - Negative / volatile returns with affirmative answer flags STAGE_C_ROE_INCONSISTENCY
 * 6. Market Share Uncertainty:
 *    - Inconclusive/unavailable data flags STAGE_C_MARKET_SHARE_UNAVAILABLE
 * 7. Gate Progression & Verdict Bands:
 *    - Pass condition: score >= 3.0, Test 1 passed, zero hard stops, business model complete
 *    - Bands: EXCEPTIONAL (>=4.5), EXCELLENT (>=3.5), GOOD (>=3.0), AVOID (<3.0)
 * 8. Mathematical & Property Invariants:
 *    - 0 <= points <= 1.0 per rule
 *    - 0 <= totalPoints <= 5.0
 *    - Determinism across repeated executions
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageC,
  assessStageC,
  CATEGORY_RELEVANT_METRICS,
  MOAT_TYPE_DESCRIPTIONS,
  type StageCInput,
  type EvidenceItem,
  type BusinessModelAnswer,
  type MoatTestResult,
  type EvidenceTag,
} from '../src/index.js';

function createDirectEvidence(id: string, tags: EvidenceTag[] = ['verified-fact']): EvidenceItem {
  return {
    id,
    description: `Direct verified evidence for ${id}`,
    source: 'https://bseindia.com/filings/doc.pdf',
    sourceType: 'filing',
    date: '2024-03-31T00:00:00.000Z',
    tags,
    relevance: 'direct',
  };
}

function createSupportingEvidence(id: string, tags: EvidenceTag[] = ['inference']): EvidenceItem {
  return {
    id,
    description: `Supporting analysis for ${id}`,
    source: 'internal-research-note',
    sourceType: 'derived',
    date: '2024-03-31T00:00:00.000Z',
    tags,
    relevance: 'supporting',
  };
}

function createCompleteBusinessModel(): BusinessModelAnswer[] {
  return [
    {
      questionId: 'value-creation',
      answer: 'Manufactures premium jewelry and precision watches with unmatched customer trust.',
      evidence: [createDirectEvidence('bm-vc-1')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      questionId: 'value-capture',
      answer: 'Command pricing power with gross margins over 28% and consistent cash conversion.',
      evidence: [createDirectEvidence('bm-vcap-1')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      questionId: 'scalability',
      answer: 'Asset-light retail franchise model allows 10x store growth with minimal capex.',
      evidence: [createDirectEvidence('bm-scale-1')],
      confidence: 'high',
      tags: ['verified-fact'],
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
  ];
}

function createPassingMoatTests(): MoatTestResult[] {
  return [
    {
      testId: 1,
      question: 'Can competitors easily copy the business?',
      answer: 'no',
      passes: true,
      evidence: [createDirectEvidence('t1-direct')],
      confidence: 'high',
      rationale:
        '3000+ store distribution footprint, high brand trust, and curated sourcing cannot be duplicated.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      testId: 2,
      question: 'Can the advantage last 10+ years?',
      answer: 'yes',
      passes: true,
      evidence: [createDirectEvidence('t2-direct')],
      confidence: 'high',
      rationale:
        'Sustained brand equity and shift towards organized retail will endure over decades.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      testId: 3,
      question: 'Has ROE been high & consistent for 10+ years?',
      answer: 'yes',
      passes: true,
      evidence: [createDirectEvidence('t3-direct')],
      confidence: 'high',
      rationale: 'Historical ROE averaged > 25% without excessive financial leverage.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      testId: 4,
      question: 'Can the company raise prices without losing customers?',
      answer: 'yes',
      passes: true,
      evidence: [createDirectEvidence('t4-direct')],
      confidence: 'high',
      rationale: 'Consistently passed on gold rate hikes and maker charges without volume loss.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
    {
      testId: 5,
      question: 'Is market share stable or growing over 5+ years?',
      answer: 'yes',
      passes: true,
      evidence: [createDirectEvidence('t5-direct')],
      confidence: 'high',
      rationale: 'Organized market share expanded from 4% to 8% over the past 5 years.',
      completedAt: '2024-03-31T00:00:00.000Z',
      completedBy: 'analyst-1',
    },
  ];
}

function createHealthyStageCInput(): StageCInput {
  return {
    companyId: 'TEST_TITAN',
    asOfDate: '2024-03-31T00:00:00.000Z',
    businessModelCategory: 'BRANDED_MANUFACTURING',
    moatTypes: ['BRAND', 'NETWORK_EFFECT'],
    businessModel: createCompleteBusinessModel(),
    moatTests: createPassingMoatTests(),
    roeHistory10y: [24, 25, 27, 26, 28, 29, 25, 27, 30, 31],
    dataSnapshotId: 'snap_test_001',
  };
}

describe('Stage C — Business Model & Moat Evaluation Engine', () => {
  // ==========================================================================
  // 1. Comprehensive Passing Wide-Moat Company
  // ==========================================================================
  describe('Wide Moat Perfect Execution', () => {
    it('scores 5.0 / 5.0 for a wide-moat company with verified evidence', () => {
      const input = createHealthyStageCInput();
      const output = scoreStageC(input);

      expect(output.stage).toBe('C');
      expect(output.totalPoints).toBe(5.0);
      expect(output.maxPossibleScore).toBe(5.0);
      expect(output.minPassScore).toBe(3.0);
      expect(output.moatScore).toBe(5.0);
      expect(output.moatPass).toBe(true);
      expect(output.gatePassed).toBe(true);
      expect(output.canProceedToStageD).toBe(true);
      expect(output.verdictBand).toBe('EXCEPTIONAL');
      expect(output.verdict).toBe('PASS');
      expect(output.businessModelComplete).toBe(true);
      expect(output.overallConfidence).toBe('high');
      expect(output.hardStops).toHaveLength(0);
      expect(output.evidenceGaps).toHaveLength(0);
      expect(output.ruleResults).toHaveLength(5);
      expect(output.tests.every((t) => t.passes)).toBe(true);
    });

    it('works identically via assessStageC alias', () => {
      const input = createHealthyStageCInput();
      const out1 = scoreStageC(input);
      const out2 = assessStageC(input);

      expect(out1.totalPoints).toBe(out2.totalPoints);
      expect(out1.gatePassed).toBe(out2.gatePassed);
      expect(out1.verdict).toBe(out2.verdict);
    });
  });

  // ==========================================================================
  // 2. Test 1 (Non-Copyability) Inverted & Mandatory Logic
  // ==========================================================================
  describe('Test 1 — Non-Copyability (Inverted & Mandatory)', () => {
    it('awards 1.0 pt when answer is "no" (cannot easily copy) and substantiated', () => {
      const input = createHealthyStageCInput();
      const output = scoreStageC(input);
      const test1Rule = output.ruleResults.find((r) => r.testId === 1);

      expect(test1Rule).toBeDefined();
      expect(test1Rule?.points).toBe(1.0);
      expect(test1Rule?.passed).toBe(true);
      expect(output.hardStops).toHaveLength(0);
    });

    it('triggers critical HARD STOP (STAGE_C_MOAT_COPYABLE) when answer is "yes" (easily copyable)', () => {
      const input = createHealthyStageCInput();
      // Change Test 1 answer to 'yes' (competitors CAN copy)
      input.moatTests[0] = {
        ...input.moatTests[0]!,
        answer: 'yes',
        rationale: 'Low capital requirement and generic white-label products allow easy cloning.',
      };

      const output = scoreStageC(input);
      const test1Rule = output.ruleResults.find((r) => r.testId === 1);

      expect(test1Rule?.points).toBe(0.0);
      expect(test1Rule?.passed).toBe(false);
      expect(output.moatScore).toBe(4.0); // Other 4 tests passed
      expect(output.moatPass).toBe(false); // Fails because Test 1 failed!
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageD).toBe(false);
      expect(output.verdict).toBe('FAIL');

      const copyableStop = output.hardStops.find((f) => f.flagKey === 'STAGE_C_MOAT_COPYABLE');
      expect(copyableStop).toBeDefined();
      expect(copyableStop?.severity).toBe('critical');
      expect(copyableStop?.class).toBe('HARD_STOP');

      const test1FailWarning = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_MOAT_TEST1_FAIL'
      );
      expect(test1FailWarning).toBeDefined();
    });

    it('emits CONDITIONAL_WARNING (STAGE_C_MOAT_TEST1_UNCERTAIN) when answer is "uncertain"', () => {
      const input = createHealthyStageCInput();
      input.moatTests[0] = {
        ...input.moatTests[0]!,
        answer: 'uncertain',
        rationale: 'Uncertain whether patent protection will hold against incoming generic substitutes.',
      };

      const output = scoreStageC(input);
      const test1Rule = output.ruleResults.find((r) => r.testId === 1);

      expect(test1Rule?.points).toBe(0.0);
      expect(test1Rule?.passed).toBe(false);
      expect(output.moatPass).toBe(false);
      expect(output.gatePassed).toBe(false);

      const uncertainFlag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_MOAT_TEST1_UNCERTAIN'
      );
      expect(uncertainFlag).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. Minimum Passing Score & Gate Progression
  // ==========================================================================
  describe('Gate Progression & Score Thresholds', () => {
    it('passes gate when score is exactly 3.0 and Test 1 passes (Scenario C-02)', () => {
      const input = createHealthyStageCInput();
      // Tests 1, 2, 3 pass; Tests 4, 5 fail
      input.moatTests[3] = {
        ...input.moatTests[3]!,
        answer: 'no',
        rationale: 'Price elastic; customers churn when prices are raised.',
      };
      input.moatTests[4] = {
        ...input.moatTests[4]!,
        answer: 'no',
        rationale: 'Market share has eroded by 200 bps.',
      };

      const output = scoreStageC(input);

      expect(output.totalPoints).toBe(3.0);
      expect(output.moatPass).toBe(true);
      expect(output.gatePassed).toBe(true);
      expect(output.canProceedToStageD).toBe(true);
      expect(output.verdictBand).toBe('GOOD');
      expect(output.verdict).toBe('PASS');
    });

    it('fails gate when score is 2.0 even if Test 1 passes (Scenario C-04)', () => {
      const input = createHealthyStageCInput();
      // Tests 1, 2 pass; Tests 3, 4, 5 fail
      input.moatTests[2] = { ...input.moatTests[2]!, answer: 'no' };
      input.moatTests[3] = { ...input.moatTests[3]!, answer: 'no' };
      input.moatTests[4] = { ...input.moatTests[4]!, answer: 'no' };

      const output = scoreStageC(input);

      expect(output.totalPoints).toBe(2.0);
      expect(output.moatPass).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageD).toBe(false);
      expect(output.verdictBand).toBe('AVOID');
      expect(output.verdict).toBe('FAIL');

      const below3Flag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_MOAT_SCORE_BELOW_3'
      );
      expect(below3Flag).toBeDefined();
    });

    it('supports custom minPassScore configuration', () => {
      const input = createHealthyStageCInput();
      // Score 4.0 with tests 1, 2, 3, 4 passing
      input.moatTests[4] = { ...input.moatTests[4]!, answer: 'no' };

      // Config requiring minPassScore 4.5
      const output = scoreStageC(input, { minPassScore: 4.5 });

      expect(output.totalPoints).toBe(4.0);
      expect(output.minPassScore).toBe(4.5);
      expect(output.moatPass).toBe(false);
      expect(output.gatePassed).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Evidence Substantiation & Anti-Hallucination Discipline
  // ==========================================================================
  describe('Evidence Provenance & Anti-Hallucination', () => {
    it('scores 0.0 pts and flags STAGE_C_EVIDENCE_MISSING when a passing answer lacks direct evidence', () => {
      const input = createHealthyStageCInput();
      // Test 4 has answer 'yes' but only supporting/contextual evidence (no direct)
      input.moatTests[3] = {
        ...input.moatTests[3]!,
        answer: 'yes',
        evidence: [createSupportingEvidence('t4-supporting')],
      };

      const output = scoreStageC(input);
      const test4Rule = output.ruleResults.find((r) => r.testId === 4);

      expect(test4Rule?.points).toBe(0.0);
      expect(test4Rule?.passed).toBe(false);
      expect(test4Rule?.unsubstantiated).toBe(true);

      const missingEvidenceFlag = output.dataQualityWarnings.find(
        (f) => f.flagKey === 'STAGE_C_EVIDENCE_MISSING' && f.ruleKey === 'moatPricingPower'
      );
      expect(missingEvidenceFlag).toBeDefined();
      expect(output.evidenceGaps).toContain('Test 4 (Pricing Power) lacks direct supporting evidence.');
    });

    it('flags STAGE_C_UNSUBSTANTIATED_CLAIM and sets confidence to low when all evidence is inference-only (Scenario C-10)', () => {
      const input = createHealthyStageCInput();
      // Replace all evidence tags with 'inference'
      input.businessModel = input.businessModel.map((bm) => ({
        ...bm,
        evidence: [createDirectEvidence(bm.questionId, ['inference'])],
      }));
      input.moatTests = input.moatTests.map((t) => ({
        ...t,
        evidence: [createDirectEvidence(`t${t.testId}`, ['inference'])],
      }));

      const output = scoreStageC(input);

      expect(output.totalPoints).toBe(5.0);
      expect(output.overallConfidence).toBe('low');
      expect(output.verdict).toBe('CONDITIONAL');

      const unsubstantiatedClaimFlag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_UNSUBSTANTIATED_CLAIM'
      );
      expect(unsubstantiatedClaimFlag).toBeDefined();
    });

    it('returns "unsubstantiated" confidence when no tests have direct evidence', () => {
      const input = createHealthyStageCInput();
      input.moatTests = input.moatTests.map((t) => ({
        ...t,
        evidence: [],
      }));

      const output = scoreStageC(input);
      expect(output.overallConfidence).toBe('unsubstantiated');
    });

    it('returns "medium" confidence when >= 2 tests are high-confidence with verified facts and >= 3 have direct evidence', () => {
      const input = createHealthyStageCInput();
      // Only tests 1 and 2 have verified facts + high confidence
      input.moatTests[0] = {
        ...input.moatTests[0]!,
        confidence: 'high',
        evidence: [createDirectEvidence('t1', ['verified-fact'])],
      };
      input.moatTests[1] = {
        ...input.moatTests[1]!,
        confidence: 'high',
        evidence: [createDirectEvidence('t2', ['verified-fact'])],
      };
      input.moatTests[2] = {
        ...input.moatTests[2]!,
        confidence: 'low',
        evidence: [createDirectEvidence('t3', ['company-claim'])],
      };
      input.moatTests[3] = {
        ...input.moatTests[3]!,
        confidence: 'low',
        evidence: [],
      };
      input.moatTests[4] = {
        ...input.moatTests[4]!,
        confidence: 'low',
        evidence: [],
      };

      const output = scoreStageC(input);
      expect(output.overallConfidence).toBe('medium');
    });
  });

  // ==========================================================================
  // 5. Business Model Completeness & Validation
  // ==========================================================================
  describe('Business Model Completeness', () => {
    it('flags STAGE_C_BUSINESS_MODEL_INCOMPLETE and blocks gate when a question is missing', () => {
      const input = createHealthyStageCInput();
      // Omit 'scalability'
      input.businessModel = input.businessModel.filter((b) => b.questionId !== 'scalability');

      const output = scoreStageC(input);

      expect(output.businessModelComplete).toBe(false);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageD).toBe(false);

      const bmFlag = output.dataQualityWarnings.find(
        (f) => f.flagKey === 'STAGE_C_BUSINESS_MODEL_INCOMPLETE'
      );
      expect(bmFlag).toBeDefined();
      expect(output.evidenceGaps).toContain("Business model question 'scalability' is missing.");
    });

    it('flags STAGE_C_BUSINESS_MODEL_INCOMPLETE when answer text is blank or whitespace', () => {
      const input = createHealthyStageCInput();
      input.businessModel[1] = {
        ...input.businessModel[1]!,
        answer: '   ',
      };

      const output = scoreStageC(input);

      expect(output.businessModelComplete).toBe(false);
      expect(output.gatePassed).toBe(false);
      const bmFlag = output.dataQualityWarnings.find(
        (f) => f.flagKey === 'STAGE_C_BUSINESS_MODEL_INCOMPLETE'
      );
      expect(bmFlag).toBeDefined();
    });

    it('flags STAGE_C_BUSINESS_MODEL_INCOMPLETE when answer has no evidence items', () => {
      const input = createHealthyStageCInput();
      input.businessModel[0] = {
        ...input.businessModel[0]!,
        evidence: [],
      };

      const output = scoreStageC(input);

      expect(output.businessModelComplete).toBe(false);
      expect(output.gatePassed).toBe(false);
      const bmFlag = output.dataQualityWarnings.find(
        (f) => f.flagKey === 'STAGE_C_BUSINESS_MODEL_INCOMPLETE'
      );
      expect(bmFlag).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. 10Y ROE Consistency Cross-Check
  // ==========================================================================
  describe('10Y ROE History Cross-Check (Test 3)', () => {
    it('flags STAGE_C_ROE_HISTORY_INCOMPLETE when fewer than 8 historical periods are provided', () => {
      const input = createHealthyStageCInput();
      input.roeHistory10y = [24, 25, 27, 26]; // only 4 periods

      const output = scoreStageC(input);

      const roeIncompleteFlag = output.dataQualityWarnings.find(
        (f) => f.flagKey === 'STAGE_C_ROE_HISTORY_INCOMPLETE'
      );
      expect(roeIncompleteFlag).toBeDefined();
    });

    it('flags STAGE_C_ROE_INCONSISTENCY when ROE history shows negative years or low average despite affirmative answer', () => {
      const input = createHealthyStageCInput();
      input.roeHistory10y = [6, 8, 4, -5, 11, 7, 9, 8, 5, 6]; // avg ~5.9%, negative year

      const output = scoreStageC(input);

      const inconsistencyFlag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_ROE_INCONSISTENCY'
      );
      expect(inconsistencyFlag).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. Market Share Data Missing
  // ==========================================================================
  describe('Test 5 Market Share Handling', () => {
    it('flags STAGE_C_MARKET_SHARE_UNAVAILABLE when rationale mentions unavailable data', () => {
      const input = createHealthyStageCInput();
      input.moatTests[4] = {
        ...input.moatTests[4]!,
        answer: 'uncertain',
        rationale: 'Reliable market share series is unavailable for fragmented unorganized sector.',
      };

      const output = scoreStageC(input);

      const msFlag = output.conditionalWarnings.find(
        (f) => f.flagKey === 'STAGE_C_MARKET_SHARE_UNAVAILABLE'
      );
      expect(msFlag).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. Business Categories & Moat Types Metadata
  // ==========================================================================
  describe('Categories and Moat Types Metadata', () => {
    it('preserves business model category and moat types in output', () => {
      const input = createHealthyStageCInput();
      input.businessModelCategory = 'SUBSCRIPTION';
      input.moatTypes = ['SWITCHING_COST', 'NETWORK_EFFECT'];

      const output = scoreStageC(input);

      expect(output.businessModelCategory).toBe('SUBSCRIPTION');
      expect(output.moatTypes).toEqual(['SWITCHING_COST', 'NETWORK_EFFECT']);
    });

    it('provides relevant metrics for each business model category', () => {
      expect(CATEGORY_RELEVANT_METRICS.SUBSCRIPTION).toContain('MRR/ARR');
      expect(CATEGORY_RELEVANT_METRICS.MARKETPLACE).toContain('GMV');
      expect(CATEGORY_RELEVANT_METRICS.BRANDED_MANUFACTURING).toContain('Pricing Power');
      expect(CATEGORY_RELEVANT_METRICS.COMMODITY_MANUFACTURING).toContain('Cost Curve Position');
      expect(CATEGORY_RELEVANT_METRICS.ASSET_LIGHT).toContain('Incremental Capital Returns');
      expect(CATEGORY_RELEVANT_METRICS.FREEMIUM).toContain('Free-to-Paid Conversion');
    });

    it('provides descriptive summaries for all 5 moat types', () => {
      expect(MOAT_TYPE_DESCRIPTIONS.BRAND).toBeDefined();
      expect(MOAT_TYPE_DESCRIPTIONS.NETWORK_EFFECT).toBeDefined();
      expect(MOAT_TYPE_DESCRIPTIONS.COST_ADVANTAGE).toBeDefined();
      expect(MOAT_TYPE_DESCRIPTIONS.SWITCHING_COST).toBeDefined();
      expect(MOAT_TYPE_DESCRIPTIONS.REGULATORY_PATENT).toBeDefined();
    });
  });

  // ==========================================================================
  // 9. Verdict Bands
  // ==========================================================================
  describe('Verdict Bands', () => {
    it('assigns EXCEPTIONAL for 5.0 points', () => {
      const output = scoreStageC(createHealthyStageCInput());
      expect(output.verdictBand).toBe('EXCEPTIONAL');
    });

    it('assigns EXCELLENT for 4.0 points', () => {
      const input = createHealthyStageCInput();
      input.moatTests[4] = { ...input.moatTests[4]!, answer: 'no' };
      const output = scoreStageC(input);
      expect(output.totalPoints).toBe(4.0);
      expect(output.verdictBand).toBe('EXCELLENT');
    });

    it('assigns GOOD for 3.0 points', () => {
      const input = createHealthyStageCInput();
      input.moatTests[3] = { ...input.moatTests[3]!, answer: 'no' };
      input.moatTests[4] = { ...input.moatTests[4]!, answer: 'no' };
      const output = scoreStageC(input);
      expect(output.totalPoints).toBe(3.0);
      expect(output.verdictBand).toBe('GOOD');
    });

    it('assigns AVOID for < 3.0 points', () => {
      const input = createHealthyStageCInput();
      input.moatTests[2] = { ...input.moatTests[2]!, answer: 'no' };
      input.moatTests[3] = { ...input.moatTests[3]!, answer: 'no' };
      input.moatTests[4] = { ...input.moatTests[4]!, answer: 'no' };
      const output = scoreStageC(input);
      expect(output.totalPoints).toBe(2.0);
      expect(output.verdictBand).toBe('AVOID');
    });
  });

  // ==========================================================================
  // 10. Invariants and Determinism
  // ==========================================================================
  describe('Invariants & Determinism', () => {
    it('satisfies bounds: 0 <= totalPoints <= 5.0 and each rule <= 1.0', () => {
      const output = scoreStageC(createHealthyStageCInput());

      expect(output.totalPoints).toBeGreaterThanOrEqual(0);
      expect(output.totalPoints).toBeLessThanOrEqual(5.0);

      for (const rule of output.ruleResults) {
        expect(rule.points).toBeGreaterThanOrEqual(0);
        expect(rule.points).toBeLessThanOrEqual(1.0);
        expect(rule.maxPoints).toBe(1.0);
      }
    });

    it('produces deterministic output across consecutive invocations', () => {
      const input = createHealthyStageCInput();
      const run1 = scoreStageC(input);
      const run2 = scoreStageC(input);

      expect(run1.totalPoints).toBe(run2.totalPoints);
      expect(run1.moatPass).toBe(run2.moatPass);
      expect(run1.gatePassed).toBe(run2.gatePassed);
      expect(run1.verdict).toBe(run2.verdict);
      expect(run1.verdictBand).toBe(run2.verdictBand);
      expect(run1.hardStops.length).toBe(run2.hardStops.length);
      expect(run1.conditionalWarnings.length).toBe(run2.conditionalWarnings.length);
      expect(run1.dataQualityWarnings.length).toBe(run2.dataQualityWarnings.length);
    });
  });
});
