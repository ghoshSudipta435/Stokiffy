/**
 * Stage C — Business Model & Moat domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.3.
 */

import type { DataProvenance, EvidenceTag, ISODateString } from './base.js';
import type { RedFlag } from './base.js';

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
}

export interface StageCInput {
  companyId: string;
  asOfDate: ISODateString;
  businessModel: BusinessModelAnswer[];
  moatTests: MoatTestResult[];
  dataProvenance: DataProvenance;
}

export interface StageCOutput {
  stage: 'C';
  moatScore: number;
  moatPass: boolean;
  businessModelComplete: boolean;
  tests: MoatTestResult[];
  overallConfidence: 'high' | 'medium' | 'low';
  flags: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
