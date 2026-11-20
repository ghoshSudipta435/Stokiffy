/**
 * Base domain types used across all stages.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 3.1.
 */

export type ISODateString = string;
export type Currency = 'INR';
export type Unit = 'CRORE' | 'LAKH' | 'MILLION' | 'RAW' | 'PERCENTAGE' | 'RATIO';
export type AdjustmentStatus = 'reported' | 'restated' | 'estimated' | 'manual';
export type DataQuality = 'verified' | 'unverified' | 'stale' | 'missing' | 'inconsistent';
export type EvidenceTag =
  | 'verified-fact'
  | 'company-claim'
  | 'analyst-estimate'
  | 'inference'
  | 'news-report'
  | 'user-input';
export type Sector = 'non-financial' | 'bank' | 'nbfc' | 'insurance' | 'other-financial';
export type StageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface DataProvenance {
  source: string;
  fetchedAt: ISODateString;
  reportedPeriod: string;
  currency: Currency;
  unit: Unit;
  adjustmentStatus: AdjustmentStatus;
  quality: DataQuality;
  isMissing: boolean;
  sourceDocumentRef?: string;
}

export interface RedFlagBase {
  id: string;
  flagKey: string;
  stage: StageId;
  ruleKey?: string;
  message: string;
  threshold: string;
  actualValue: unknown;
  expectedValue?: unknown;
  source: 'handwritten-notes' | 'blueprint' | 'engineering-default' | 'user-configured';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'RESOLVED' | 'EXPIRED';
  companyId: string;
  analysisRunId: string;
  ruleSetVersion: string;
  dataSnapshotId: string;
  isOverride: boolean;
}

export interface RedFlag extends RedFlagBase {
  class:
    | 'HARD_STOP'
    | 'CONDITIONAL_WARNING'
    | 'DATA_QUALITY_WARNING'
    | 'VALUATION_WARNING';
  createdAt: ISODateString;
  acknowledgedAt?: ISODateString;
  acknowledgedBy?: string;
  acknowledgedReason?: string;
  overriddenAt?: ISODateString;
  overriddenBy?: string;
  overrideReason?: string;
  resolvedAt?: ISODateString;
  resolutionReason?: string;
  originalFlagId?: string;
}

export interface RedFlagLifecycle {
  status: RedFlag['status'];
  actedAt: ISODateString;
  actedBy: string;
  reason: string;
}
