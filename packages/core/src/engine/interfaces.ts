/**
 * Pure engine interfaces for the investment engine.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 5.
 *
 * These are interfaces only — no implementations.
 * Implementations of scoring engines belong to Phase 1B+.
 */

import type { StageAInput, StageAOutput } from '../types/stage-a.js';
import type { StageBInput, StageBOutput } from '../types/stage-b.js';
import type { StageCInput, StageCOutput } from '../types/stage-c.js';
import type { StageDInput, StageDOutput } from '../types/stage-d.js';
import type { StageEInput, StageEOutput } from '../types/stage-e.js';
import type { StageFInput, StageFOutput } from '../types/stage-f.js';
import type { StageGInput, StageGOutput } from '../types/stage-g.js';
import type { RedFlag } from '../types/base.js';
import type { StageScore } from '../types/scoring.js';

export interface OverrideRecord {
  flagId: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}

export interface StageGateResult {
  canProceed: boolean;
  blockedBy: RedFlag[];
  requiresAcknowledgment: RedFlag[];
  overrides: OverrideRecord[];
}

export interface OverrideRequest {
  flagId: string;
  userId: string;
  reason: string;
  decision: 'acknowledge' | 'override';
}

export interface AcknowledgmentRequest {
  flagId: string;
  userId: string;
  reason: string;
}

/**
 * Scoring engine interface — all stages.
 * Each method is a pure function: Input → Output.
 */
export interface ScoringEngine {
  scoreStageA(input: StageAInput): StageAOutput;
  scoreStageB(input: StageBInput): StageBOutput;
  assessStageC(input: StageCInput): StageCOutput;
  valueStageD(input: StageDInput): StageDOutput;
  analyzeStageE(input: StageEInput): StageEOutput;
  planStageF(input: StageFInput): StageFOutput;
  monitorStageG(input: StageGInput): StageGOutput;
}

/**
 * Flag engine interface — red flag lifecycle and gate enforcement.
 */
export interface FlagEngine {
  evaluateStageGate(
    stage: StageScore['stage'],
    flags: RedFlag[],
    overrides: OverrideRecord[]
  ): StageGateResult;

  applyOverride(
    flag: RedFlag,
    request: OverrideRequest
  ): { updatedFlag: RedFlag; overrideRecord: OverrideRecord };

  acknowledgeFlag(
    flag: RedFlag,
    request: AcknowledgmentRequest
  ): RedFlag;
}

/**
 * Placeholder error thrown when an engine method is called but not yet implemented.
 * This is intentional for Phase 1A — engine implementations are deferred to Phase 1B.
 */
export class EngineNotImplementedError extends Error {
  constructor(method: string) {
    super(`Engine method "${method}" is not implemented in Phase 1A. Deferred to Phase 1B.`);
    this.name = 'EngineNotImplementedError';
  }
}
