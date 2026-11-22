/**
 * Stage C — Business Model & Moat domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.3 and BUSINESS_MODEL_AND_MOAT_SPEC.md.
 */

import type { DataProvenance, EvidenceTag, ISODateString, RedFlag } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

export type BusinessModelCategory =
  | 'SUBSCRIPTION'
  | 'MARKETPLACE'
  | 'BRANDED_MANUFACTURING'
  | 'COMMODITY_MANUFACTURING'
  | 'ASSET_LIGHT'
  | 'ASSET_HEAVY'
  | 'FREEMIUM';

export type MoatType =
  | 'BRAND'
  | 'NETWORK_EFFECT'
  | 'COST_ADVANTAGE'
  | 'SWITCHING_COST'
  | 'REGULATORY_PATENT';

export type StageCVerdictBand = 'EXCEPTIONAL' | 'EXCELLENT' | 'GOOD' | 'AVOID';

export interface EvidenceItem {
  id: string;
  description: string;
  source: string;
  sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
  date: ISODateString;
  tags: EvidenceTag[];
  relevance: 'direct' | 'supporting' | 'contextual';
}

export interface BusinessModelAnswer {
  questionId: 'value-creation' | 'value-capture' | 'scalability';
  answer: string;
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  tags: EvidenceTag[];
  completedAt: ISODateString;
  completedBy: string;
}

export interface MoatTestResult {
  testId: 1 | 2 | 3 | 4 | 5;
  question: string;
  answer: 'yes' | 'no' | 'uncertain';
  passes: boolean;
  evidence: EvidenceItem[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  completedAt: ISODateString;
  completedBy: string;
  unsubstantiated?: boolean | undefined;
}

export interface StageCRuleResult extends ScoringRuleResult {
  testId: 1 | 2 | 3 | 4 | 5;
  testName: string;
  passed: boolean;
  unsubstantiated: boolean;
}

export interface StageCInput {
  companyId: string;
  asOfDate: ISODateString;
  businessModel: BusinessModelAnswer[];
  businessModelCategory?: BusinessModelCategory | undefined;
  moatTypes?: MoatType[] | undefined;
  moatTests: MoatTestResult[];
  roeHistory10y?: (number | null)[] | undefined;
  dataProvenance?: DataProvenance | undefined;
  dataSnapshotId?: string | undefined;
}

export interface StageCOutput extends StageScore {
  stage: 'C';
  companyId?: string | undefined;
  asOfDate?: ISODateString | undefined;
  executedAt?: ISODateString | undefined;
  message?: string | undefined;
  moatScore: number;
  maxPossibleScore: number;
  minPassScore: number;
  moatPass: boolean;
  gatePassed: boolean;
  canProceedToStageD: boolean;
  verdictBand: StageCVerdictBand;
  businessModelComplete: boolean;
  businessModelCategory?: BusinessModelCategory | undefined;
  moatTypes?: MoatType[] | undefined;
  tests: MoatTestResult[];
  overallConfidence: 'high' | 'medium' | 'low' | 'unsubstantiated';
  evidenceGaps: string[];
  flags: RedFlag[];
  ruleResults: StageCRuleResult[];
}
