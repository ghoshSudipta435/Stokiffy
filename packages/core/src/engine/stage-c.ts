/**
 * Stage C (Business Model & Moat Quality) Deterministic Evaluation Engine
 *
 * Implements the 5-point moat testing engine and 3-question business model validation
 * covering competitive copyability (inverted mandatory test), durable advantage (10+ years),
 * ROE consistency (10+ years with optional financial series cross-check), pricing power,
 * and market share stability/growth.
 *
 * Strictly adheres to evidence provenance and anti-hallucination discipline.
 * Pure TypeScript implementation using Decimal.js for exact arithmetic.
 * Zero external framework dependencies.
 */

import Decimal from 'decimal.js';
import { roundDecimal } from '../common/decimal.js';
import type {
  BusinessModelCategory,
  MoatTestResult,
  MoatType,
  StageCInput,
  StageCOutput,
  StageCRuleResult,
  StageCVerdictBand,
} from '../types/stage-c.js';
import type { DataProvenance, RedFlag } from '../types/base.js';

export interface StageCConfig {
  ruleSetVersion?: string | undefined;
  minPassScore?: number | undefined;
  requireVerifiedEvidence?: boolean | undefined;
  unsubstantiatedPenalty?: boolean | undefined;
}

export const DEFAULT_RULE_SET_VERSION = 'stage-c-v1.0';
export const DEFAULT_MIN_PASS_SCORE = 3.0;
export const MAX_POSSIBLE_SCORE = 5.0;

export const CATEGORY_RELEVANT_METRICS: Record<BusinessModelCategory, string[]> = {
  SUBSCRIPTION: ['MRR/ARR', 'Churn', 'Net Revenue Retention', 'CAC Payback', 'LTV/CAC'],
  MARKETPLACE: [
    'GMV',
    'Take Rate',
    'Active Buyers/Sellers',
    'Repeat Frequency',
    'Contribution Margin',
    'Network Liquidity',
  ],
  BRANDED_MANUFACTURING: [
    'Brand Strength',
    'Pricing Power',
    'Gross/Operating Margin',
    'Distribution Reach',
    'Repeat Purchase Rate',
  ],
  COMMODITY_MANUFACTURING: [
    'Cost Curve Position',
    'Capacity Utilization',
    'Input-Cost Sensitivity',
    'Balance Sheet Resilience',
    'Cycle Position',
  ],
  ASSET_LIGHT: [
    'ROCE/ROA',
    'Capex/Revenue',
    'Working Capital Needs',
    'FCF Conversion',
    'Incremental Capital Returns',
  ],
  ASSET_HEAVY: [
    'ROCE/ROA',
    'Capex/Revenue',
    'Working Capital Needs',
    'FCF Conversion',
    'Incremental Capital Returns',
  ],
  FREEMIUM: [
    'Free-to-Paid Conversion',
    'Retention by Cohort',
    'Acquisition Cost',
    'Engagement (DAU/MAU)',
    'Scale Economics',
  ],
};

export const MOAT_TYPE_DESCRIPTIONS: Record<MoatType, string> = {
  BRAND: 'Trusted brand enabling pricing power and premium vs peers',
  NETWORK_EFFECT: 'Value increases with participants, liquidity, and data advantages',
  COST_ADVANTAGE: 'Structural cost leadership through scale, process, or location',
  SWITCHING_COST: 'High time, risk, or financial expense for customers to migrate',
  REGULATORY_PATENT: 'Durable legal barriers, patents, licenses, or government protection',
};

const TEST_DEFINITIONS: Record<
  1 | 2 | 3 | 4 | 5,
  {
    ruleKey: string;
    testName: string;
    defaultQuestion: string;
  }
> = {
  1: {
    ruleKey: 'moatNonCopyability',
    testName: 'Non-Copyability',
    defaultQuestion: 'Can competitors easily copy the business?',
  },
  2: {
    ruleKey: 'moatDurability',
    testName: 'Durability (10+ Years)',
    defaultQuestion: 'Can the advantage last 10+ years?',
  },
  3: {
    ruleKey: 'moatRoeConsistency',
    testName: 'Historical ROE Consistency (10+ Years)',
    defaultQuestion: 'Has ROE been high & consistent for 10+ years?',
  },
  4: {
    ruleKey: 'moatPricingPower',
    testName: 'Pricing Power',
    defaultQuestion: 'Can the company raise prices without losing customers?',
  },
  5: {
    ruleKey: 'moatMarketShare',
    testName: 'Market Share Stability/Growth (5+ Years)',
    defaultQuestion: 'Is market share stable or growing over 5+ years?',
  },
};

function createRedFlag(params: {
  flagKey: string;
  ruleKey?: string | undefined;
  message: string;
  threshold: string;
  actualValue: unknown;
  expectedValue?: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
  class: 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';
  companyId: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): RedFlag {
  const flag: RedFlag = {
    id: `flag_${params.flagKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    flagKey: params.flagKey,
    stage: 'C',
    message: params.message,
    threshold: params.threshold,
    actualValue: params.actualValue,
    source: 'blueprint',
    severity: params.severity,
    status: 'ACTIVE',
    companyId: params.companyId,
    analysisRunId: '',
    ruleSetVersion: params.ruleSetVersion,
    dataSnapshotId: params.dataSnapshotId ?? '',
    isOverride: false,
    class: params.class,
    createdAt: new Date().toISOString(),
  };

  if (params.ruleKey !== undefined) {
    flag.ruleKey = params.ruleKey;
  }
  if (params.expectedValue !== undefined) {
    flag.expectedValue = params.expectedValue;
  }

  return flag;
}

/**
 * Calculates overall evidence confidence score based on direct evidence presence and verified facts.
 * Section 4.4 of BUSINESS_MODEL_AND_MOAT_SPEC.md.
 */
function calculateOverallConfidence(
  tests: MoatTestResult[],
  hasVerifiedFact: boolean
): 'high' | 'medium' | 'low' | 'unsubstantiated' {
  const totalDirectEvidenceCount = tests.reduce(
    (acc, t) => acc + (t.evidence?.filter((e) => e.relevance === 'direct').length ?? 0),
    0
  );

  if (tests.length === 0 || totalDirectEvidenceCount === 0) {
    return 'unsubstantiated';
  }

  // If no verified facts exist anywhere, confidence is capped at 'low'
  if (!hasVerifiedFact) {
    return 'low';
  }

  const highConfidenceTests = tests.filter(
    (t) =>
      t.confidence === 'high' &&
      t.evidence?.some((e) => e.tags?.includes('verified-fact'))
  ).length;

  const totalWithDirectEvidence = tests.filter((t) =>
    t.evidence?.some((e) => e.relevance === 'direct')
  ).length;

  if (highConfidenceTests >= 4 && totalWithDirectEvidence === 5) {
    return 'high';
  }
  if (highConfidenceTests >= 2 && totalWithDirectEvidence >= 3) {
    return 'medium';
  }
  return 'low';
}

/**
 * Evaluates Stage C (Business Model & Moat Quality) for a single company.
 * Deterministic pure function: StageCInput -> StageCOutput.
 */
export function scoreStageC(input: StageCInput, config?: StageCConfig): StageCOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const minPassScore = config?.minPassScore ?? DEFAULT_MIN_PASS_SCORE;
  const companyId = input.companyId;
  const maxPossibleScore = MAX_POSSIBLE_SCORE;

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'engine-derived',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'MOAT_ANALYSIS',
    currency: 'INR',
    unit: 'RAW',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];
  const dataQualityWarnings: RedFlag[] = [];
  const evidenceGaps: string[] = [];

  // ==========================================================================
  // 1. Business Model Evaluation (3 Core Questions + Category Validation)
  // ==========================================================================
  const requiredQuestions: Array<'value-creation' | 'value-capture' | 'scalability'> = [
    'value-creation',
    'value-capture',
    'scalability',
  ];

  const bmAnswers = input.businessModel ?? [];
  let businessModelComplete = true;

  for (const qId of requiredQuestions) {
    const answerObj = bmAnswers.find((a) => a.questionId === qId);
    const hasText = !!answerObj?.answer && answerObj.answer.trim().length > 0;
    const hasEvidence = !!answerObj?.evidence && answerObj.evidence.length > 0;

    if (!answerObj || !hasText || !hasEvidence) {
      businessModelComplete = false;
      const detail = !answerObj
        ? 'missing'
        : !hasText
        ? 'empty answer text'
        : 'lacks supporting evidence';
      const gapMsg = `Business model question '${qId}' is ${detail}.`;
      evidenceGaps.push(gapMsg);

      const flag = createRedFlag({
        flagKey: 'STAGE_C_BUSINESS_MODEL_INCOMPLETE',
        ruleKey: `businessModel_${qId}`,
        message: `Business model assessment incomplete: '${qId}' is ${detail}.`,
        threshold: 'All 3 core business model questions must be answered with supporting evidence',
        actualValue: { questionId: qId, present: !!answerObj, hasText, hasEvidence },
        expectedValue: 'Complete answer with >= 1 evidence item',
        severity: 'high',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      dataQualityWarnings.push(flag);
    }
  }

  // ==========================================================================
  // 2. Anti-Hallucination & Evidence Tag Provenance Check
  // ==========================================================================
  const allMoatTests = input.moatTests ?? [];
  const allTestEvidence = allMoatTests.flatMap((t) => t.evidence ?? []);
  const allBmEvidence = bmAnswers.flatMap((b) => b.evidence ?? []);
  const combinedEvidence = [...allTestEvidence, ...allBmEvidence];

  const hasVerifiedFact = combinedEvidence.some((e) => e.tags?.includes('verified-fact'));
  const allEvidenceOnlyInference =
    combinedEvidence.length > 0 &&
    combinedEvidence.every(
      (e) => (e.tags ?? []).length > 0 && e.tags.every((t) => t === 'inference')
    );

  if (combinedEvidence.length > 0 && (!hasVerifiedFact || allEvidenceOnlyInference)) {
    const flag = createRedFlag({
      flagKey: 'STAGE_C_UNSUBSTANTIATED_CLAIM',
      ruleKey: 'evidenceIntegrity',
      message:
        'Stage C moat evaluation relies entirely on inferences or unverified claims without any verified-fact evidence.',
      threshold: 'At least one verified-fact evidence citation required across assessment',
      actualValue: {
        totalEvidenceItems: combinedEvidence.length,
        verifiedFactCount: 0,
        tagsUsed: Array.from(new Set(combinedEvidence.flatMap((e) => e.tags ?? []))),
      },
      expectedValue: '>= 1 verified-fact citation',
      severity: 'medium',
      class: 'CONDITIONAL_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    conditionalWarnings.push(flag);
  }

  // ==========================================================================
  // 3. Five Moat Tests Evaluation
  // ==========================================================================
  const ruleResults: StageCRuleResult[] = [];
  const updatedMoatTests: MoatTestResult[] = [];
  let test1Passed = false;

  for (const testId of [1, 2, 3, 4, 5] as const) {
    const def = TEST_DEFINITIONS[testId];
    const testInput = allMoatTests.find((t) => t.testId === testId);

    const questionText = testInput?.question ?? def.defaultQuestion;
    const answer = testInput?.answer ?? 'uncertain';
    const evidenceList = testInput?.evidence ?? [];
    const directEvidence = evidenceList.filter((e) => e.relevance === 'direct');
    const isDirectSubstantiated = directEvidence.length > 0;

    let points = 0.0;
    let passed = false;
    let unsubstantiated = false;
    let explanation = '';
    const testFlags: RedFlag[] = [];

    if (!testInput) {
      // Test missing entirely from input
      unsubstantiated = true;
      explanation = `Test ${testId} (${def.testName}) was omitted from assessment. Scored 0 pts.`;
      evidenceGaps.push(`Test ${testId} (${def.testName}) missing.`);

      const flag = createRedFlag({
        flagKey: 'STAGE_C_EVIDENCE_MISSING',
        ruleKey: def.ruleKey,
        message: `Test ${testId} (${def.testName}) is missing and lacks evidence.`,
        threshold: 'Test must be completed with >= 1 direct evidence citation',
        actualValue: 'missing',
        expectedValue: 'completed test with direct evidence',
        severity: 'high',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
        dataSnapshotId: input.dataSnapshotId,
      });
      testFlags.push(flag);
      dataQualityWarnings.push(flag);
    } else if (testId === 1) {
      // ========================================================================
      // Test 1: Non-Copyability (INVERTED & MANDATORY)
      // "Can competitors easily copy the business?"
      // Answer = 'no' -> PASS (1 pt, if substantiated)
      // Answer = 'yes' -> HARD STOP (0 pts, copyable by competitors)
      // Answer = 'uncertain' -> CONDITIONAL_WARNING (0 pts)
      // ========================================================================
      if (answer === 'no') {
        if (!isDirectSubstantiated) {
          unsubstantiated = true;
          points = 0.0;
          passed = false;
          explanation =
            "Test 1 answer is 'no' (cannot easily copy), but lacks direct supporting evidence. Scored 0 pts.";
          evidenceGaps.push('Test 1 (Non-Copyability) lacks direct supporting evidence.');

          const flag = createRedFlag({
            flagKey: 'STAGE_C_EVIDENCE_MISSING',
            ruleKey: def.ruleKey,
            message: 'Test 1 (Non-Copyability) lacks direct supporting evidence.',
            threshold: '>= 1 direct evidence item required',
            actualValue: { directEvidenceCount: directEvidence.length },
            expectedValue: '>= 1 direct evidence item',
            severity: 'high',
            class: 'DATA_QUALITY_WARNING',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          testFlags.push(flag);
          dataQualityWarnings.push(flag);
        } else {
          unsubstantiated = false;
          points = 1.0;
          passed = true;
          test1Passed = true;
          explanation =
            'Competitors cannot easily copy the business (Non-Copyability substantiated with direct evidence). Scored 1.0 pt.';
        }
      } else if (answer === 'yes') {
        // Business IS easily copyable -> Critical Hard Stop
        points = 0.0;
        passed = false;
        unsubstantiated = false;
        explanation =
          'Hard Stop: Business is easily copyable by competitors. Moat protection fails.';

        const copyableFlag = createRedFlag({
          flagKey: 'STAGE_C_MOAT_COPYABLE',
          ruleKey: def.ruleKey,
          message: 'Hard Stop: Business is easily copyable by competitors. Moat protection fails.',
          threshold: 'Competitors cannot easily copy business (answer = no)',
          actualValue: answer,
          expectedValue: 'no',
          severity: 'critical',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        testFlags.push(copyableFlag);
        hardStops.push(copyableFlag);

        // Also emit STAGE_C_MOAT_TEST1_FAIL for spec compatibility
        const test1FailFlag = createRedFlag({
          flagKey: 'STAGE_C_MOAT_TEST1_FAIL',
          ruleKey: def.ruleKey,
          message:
            'Test 1 (Non-Copyability) failed: Business lacks structural protection against competitor duplication.',
          threshold: 'Test 1 must pass for Stage C gate progression',
          actualValue: answer,
          expectedValue: 'no',
          severity: 'high',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        testFlags.push(test1FailFlag);
        conditionalWarnings.push(test1FailFlag);
      } else {
        // Answer is uncertain
        points = 0.0;
        passed = false;
        unsubstantiated = false;
        explanation =
          'Test 1 is uncertain: Competitor copyability cannot be ruled out. Scored 0 pts.';

        const flag = createRedFlag({
          flagKey: 'STAGE_C_MOAT_TEST1_UNCERTAIN',
          ruleKey: def.ruleKey,
          message: 'Test 1 uncertain: Competitor copyability cannot be ruled out.',
          threshold: 'Competitors cannot easily copy business (answer = no)',
          actualValue: answer,
          expectedValue: 'no',
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        testFlags.push(flag);
        conditionalWarnings.push(flag);
      }
    } else {
      // ========================================================================
      // Tests 2–5: Standard Tests
      // Answer = 'yes' -> PASS (1 pt, if substantiated)
      // Answer = 'no' -> FAIL (0 pts)
      // Answer = 'uncertain' -> CONDITIONAL_WARNING (0 pts)
      // ========================================================================
      if (answer === 'yes') {
        if (!isDirectSubstantiated) {
          unsubstantiated = true;
          points = 0.0;
          passed = false;
          explanation = `Test ${testId} (${def.testName}) answered 'yes', but lacks direct supporting evidence. Scored 0 pts.`;
          evidenceGaps.push(`Test ${testId} (${def.testName}) lacks direct supporting evidence.`);

          const flag = createRedFlag({
            flagKey: 'STAGE_C_EVIDENCE_MISSING',
            ruleKey: def.ruleKey,
            message: `Test ${testId} (${def.testName}) lacks direct supporting evidence.`,
            threshold: '>= 1 direct evidence item required',
            actualValue: { directEvidenceCount: directEvidence.length },
            expectedValue: '>= 1 direct evidence item',
            severity: 'high',
            class: 'DATA_QUALITY_WARNING',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          testFlags.push(flag);
          dataQualityWarnings.push(flag);
        } else {
          unsubstantiated = false;
          points = 1.0;
          passed = true;
          explanation = `Test ${testId} (${def.testName}) passed with substantiated direct evidence. Scored 1.0 pt.`;
        }
      } else if (answer === 'no') {
        unsubstantiated = false;
        points = 0.0;
        passed = false;
        explanation = `Test ${testId} (${def.testName}) criteria not met (answer = 'no'). Scored 0 pts.`;
      } else {
        // Uncertain
        unsubstantiated = false;
        points = 0.0;
        passed = false;

        const rationaleLower = (testInput.rationale ?? '').toLowerCase();
        const isUnavailable =
          rationaleLower.includes('unavailable') ||
          rationaleLower.includes('missing') ||
          rationaleLower.includes('not available');

        let flagKey = `STAGE_C_MOAT_TEST${testId}_UNCERTAIN`;
        let flagMsg = `Test ${testId} (${def.testName}) answer is uncertain.`;

        if (testId === 5 && isUnavailable) {
          flagKey = 'STAGE_C_MARKET_SHARE_UNAVAILABLE';
          flagMsg = 'Market share series data is unavailable or inconclusive.';
          explanation = 'Market share data is unavailable or inconclusive. Scored 0 pts.';
        } else if (testId === 3 && isUnavailable) {
          flagKey = 'STAGE_C_ROE_HISTORY_INCOMPLETE';
          flagMsg = '10Y historical ROE data is unavailable or incomplete.';
          explanation = '10Y historical ROE data is unavailable or incomplete. Scored 0 pts.';
        } else {
          explanation = `Test ${testId} (${def.testName}) answer is uncertain. Scored 0 pts.`;
        }

        const flag = createRedFlag({
          flagKey,
          ruleKey: def.ruleKey,
          message: flagMsg,
          threshold: 'Criteria must be substantiated with affirmative evidence',
          actualValue: answer,
          expectedValue: 'yes',
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
          dataSnapshotId: input.dataSnapshotId,
        });
        testFlags.push(flag);
        conditionalWarnings.push(flag);
      }

      // Special Check for Test 3: Optional 10Y ROE series cross-check
      if (testId === 3 && input.roeHistory10y) {
        const roeSeries = input.roeHistory10y.filter((v): v is number => v !== null);
        if (roeSeries.length < 8) {
          const roeIncompleteFlag = createRedFlag({
            flagKey: 'STAGE_C_ROE_HISTORY_INCOMPLETE',
            ruleKey: def.ruleKey,
            message: `10Y ROE history is incomplete (${roeSeries.length} years of data provided, >= 8 recommended).`,
            threshold: '>= 8 valid years in 10Y ROE history',
            actualValue: { validPeriods: roeSeries.length },
            expectedValue: '>= 8 valid periods',
            severity: 'medium',
            class: 'DATA_QUALITY_WARNING',
            companyId,
            ruleSetVersion,
            dataSnapshotId: input.dataSnapshotId,
          });
          testFlags.push(roeIncompleteFlag);
          dataQualityWarnings.push(roeIncompleteFlag);
        } else {
          const avgRoe = roeSeries.reduce((s, v) => s + v, 0) / roeSeries.length;
          const hasNegative = roeSeries.some((v) => v < 0);
          const yearsBelow10 = roeSeries.filter((v) => v < 10).length;

          if (answer === 'yes' && (avgRoe < 12 || hasNegative || yearsBelow10 >= 3)) {
            const distortionFlag = createRedFlag({
              flagKey: 'STAGE_C_ROE_INCONSISTENCY',
              ruleKey: def.ruleKey,
              message: `10Y ROE history shows volatile/inconsistent returns (avg ${avgRoe.toFixed(1)}%, ${yearsBelow10} years < 10%) despite affirmative answer.`,
              threshold: 'Consistently high ROE (>= 12% avg, no negative years)',
              actualValue: { avgRoe, hasNegative, yearsBelow10 },
              expectedValue: 'Consistently high ROE',
              severity: 'medium',
              class: 'CONDITIONAL_WARNING',
              companyId,
              ruleSetVersion,
              dataSnapshotId: input.dataSnapshotId,
            });
            testFlags.push(distortionFlag);
            conditionalWarnings.push(distortionFlag);
          }
        }
      }
    }

    ruleResults.push({
      ruleKey: def.ruleKey,
      points,
      maxPoints: 1.0,
      inputs: {
        testId,
        question: questionText,
        answer,
        confidence: testInput?.confidence ?? 'low',
        directEvidenceCount: directEvidence.length,
        unsubstantiated,
      },
      explanation,
      redFlags: testFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
      testId,
      testName: def.testName,
      passed,
      unsubstantiated,
    });

    updatedMoatTests.push({
      testId,
      question: questionText,
      answer,
      passes: passed,
      evidence: evidenceList,
      confidence: testInput?.confidence ?? 'low',
      rationale: testInput?.rationale ?? explanation,
      completedAt: testInput?.completedAt ?? new Date().toISOString(),
      completedBy: testInput?.completedBy ?? 'engine',
      unsubstantiated,
    });
  }

  // ==========================================================================
  // 4. Score Aggregation, Verdict Bands & Gate Logic
  // ==========================================================================
  let totalScoreDec = new Decimal(0);
  for (const r of ruleResults) {
    totalScoreDec = totalScoreDec.plus(r.points);
  }
  const totalPoints = roundDecimal(totalScoreDec, 2).toNumber();

  let verdictBand: StageCVerdictBand = 'AVOID';
  if (totalPoints >= 4.5) {
    verdictBand = 'EXCEPTIONAL';
  } else if (totalPoints >= 3.5) {
    verdictBand = 'EXCELLENT';
  } else if (totalPoints >= 3.0) {
    verdictBand = 'GOOD';
  } else {
    verdictBand = 'AVOID';
  }

  // Flag low moat score if below min pass score (Spec Scenario C-04)
  if (totalPoints < minPassScore) {
    const lowScoreFlag = createRedFlag({
      flagKey: 'STAGE_C_MOAT_SCORE_BELOW_3',
      ruleKey: 'moatScoreGate',
      message: `Moat score of ${totalPoints.toFixed(2)}/5.0 is below minimum passing threshold of ${minPassScore}.`,
      threshold: `>= ${minPassScore}`,
      actualValue: totalPoints,
      expectedValue: minPassScore,
      severity: 'high',
      class: 'CONDITIONAL_WARNING',
      companyId,
      ruleSetVersion,
      dataSnapshotId: input.dataSnapshotId,
    });
    conditionalWarnings.push(lowScoreFlag);
  }

  const overallConfidence = calculateOverallConfidence(updatedMoatTests, hasVerifiedFact);

  // Moat pass condition: score >= minPassScore AND Test 1 (Non-Copyability) passed
  const moatPass = totalPoints >= minPassScore && test1Passed;

  // Stage C Gate: Moat passes AND zero Hard Stops AND business model is complete
  const hasHardStops = hardStops.length > 0;
  const gatePassed = moatPass && !hasHardStops && businessModelComplete;
  const canProceedToStageD = gatePassed;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (!businessModelComplete && bmAnswers.length === 0 && allMoatTests.length === 0) {
    verdict = 'INCOMPLETE';
  } else if (!gatePassed) {
    verdict = 'FAIL';
  } else if (conditionalWarnings.length > 0 || dataQualityWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const message = gatePassed
    ? `Stage C business model and moat evaluation PASSED with ${totalPoints.toFixed(2)}/${maxPossibleScore} (${verdictBand}). Eligible for Stage D valuation.`
    : hasHardStops
    ? `Stage C evaluation BLOCKED by ${hardStops.length} HARD STOP red flag(s). Score: ${totalPoints.toFixed(2)}/${maxPossibleScore}.`
    : !test1Passed
    ? `Stage C evaluation BLOCKED: Test 1 (Non-Copyability) did not pass. Moat protection required.`
    : !businessModelComplete
    ? 'Stage C evaluation INCOMPLETE: 3 core business model questions must be answered with supporting evidence.'
    : `Stage C evaluation FAILED score threshold (${totalPoints.toFixed(2)}/${maxPossibleScore} < ${minPassScore}). Band: ${verdictBand}.`;

  const allFlags: RedFlag[] = [
    ...hardStops,
    ...conditionalWarnings,
    ...dataQualityWarnings,
  ];

  return {
    stage: 'C',
    companyId: input.companyId,
    asOfDate: input.asOfDate,
    executedAt: new Date().toISOString(),
    ruleSetVersion,
    message,
    totalPoints,
    maxPoints: maxPossibleScore,
    maxPossibleScore,
    minPassScore,
    moatScore: totalPoints,
    moatPass,
    gatePassed,
    canProceedToStageD,
    verdictBand,
    businessModelComplete,
    businessModelCategory: input.businessModelCategory,
    moatTypes: input.moatTypes,
    tests: updatedMoatTests,
    overallConfidence,
    evidenceGaps,
    ruleResults,
    verdict,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings: [],
    flags: allFlags,
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
  };
}

/**
 * Interface alias for ScoringEngine.assessStageC compatibility.
 */
export const assessStageC = scoreStageC;
