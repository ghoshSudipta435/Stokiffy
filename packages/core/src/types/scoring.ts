/**
 * Universal scoring rule result and stage score types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 3.2.
 */

import type { DataProvenance, RedFlag, StageId } from './base.js';

export interface ScoringRuleResult {
  ruleKey: string;
  points: number;
  maxPoints: number;
  inputs: Record<string, unknown>;
  explanation: string;
  redFlags: RedFlag[];
  dataQuality: DataProvenance;
  ruleSetVersion: string;
}

export interface StageScore {
  stage: StageId;
  totalPoints: number;
  maxPoints: number;
  ruleResults: ScoringRuleResult[];
  verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  hardStops: RedFlag[];
  conditionalWarnings: RedFlag[];
  dataQualityWarnings: RedFlag[];
  valuationWarnings: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
  dataSnapshotId: string;
}

export type ISODateString = string;
