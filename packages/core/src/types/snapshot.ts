/**
 * Data snapshot and reproducibility types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 8.
 */

import type { DataProvenance, ISODateString, StageId } from './base.js';

export interface AnalysisSnapshot {
  id: string;
  companyId: string;
  stage: StageId;
  input: unknown;
  output: unknown;
  ruleSetVersion: string;
  configHash: string;
  createdAt: ISODateString;
  createdBy: string;
}

export interface DataSnapshot {
  id: string;
  companyId: string;
  asOfDate: ISODateString;
  financials: Record<string, unknown>;
  marketData: Record<string, unknown>;
  provenance: Record<string, DataProvenance>;
  capturedAt: ISODateString;
}
