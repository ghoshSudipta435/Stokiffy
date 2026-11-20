/**
 * Domain-specific error classes for the investment engine.
 * All errors carry structured context for API error envelope mapping.
 */

/**
 * Base domain error with structured context.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context ?? undefined;
  }
}

/**
 * Thrown when a financial calculation encounters missing or invalid data.
 * Never coerces missing values to zero.
 */
export class MissingDataError extends DomainError {
  readonly field: string;
  readonly stage: string;

  constructor(field: string, stage: string, message?: string) {
    super(
      message ?? `Missing data for field "${field}" in stage "${stage}"`,
      'MISSING_DATA',
      { field, stage }
    );
    this.name = 'MissingDataError';
    this.field = field;
    this.stage = stage;
  }
}

/**
 * Thrown when a division-by-zero or undefined denominator is encountered.
 */
export class DivisionByZeroError extends DomainError {
  readonly operation: string;
  readonly denominator: unknown;

  constructor(operation: string, denominator: unknown) {
    super(
      `Division by zero in operation "${operation}" with denominator: ${String(denominator)}`,
      'DIVISION_BY_ZERO',
      { operation, denominator }
    );
    this.name = 'DivisionByZeroError';
    this.operation = operation;
    this.denominator = denominator;
  }
}

/**
 * Thrown when a value falls outside an acceptable range.
 */
export class OutOfRangeError extends DomainError {
  readonly field: string;
  readonly actualValue: unknown;
  readonly min: number | undefined;
  readonly max: number | undefined;

  constructor(
    field: string,
    actualValue: unknown,
    min?: number,
    max?: number
  ) {
    super(
      `Field "${field}" value ${String(actualValue)} is out of range${
        min !== null && min !== undefined && max !== null && max !== undefined
          ? ` [${min}, ${max}]`
          : ''
      }`,
      'OUT_OF_RANGE',
      { field, actualValue, min, max }
    );
    this.name = 'OutOfRangeError';
    this.field = field;
    this.actualValue = actualValue;
    this.min = min ?? undefined;
    this.max = max ?? undefined;
  }
}

/**
 * Thrown when a rule set version is invalid or incompatible.
 */
export class InvalidRuleSetError extends DomainError {
  readonly ruleSetVersion: string;
  readonly stage: string;

  constructor(ruleSetVersion: string, stage: string) {
    super(
      `Invalid or incompatible rule set version "${ruleSetVersion}" for stage "${stage}"`,
      'INVALID_RULE_SET',
      { ruleSetVersion, stage }
    );
    this.name = 'InvalidRuleSetError';
    this.ruleSetVersion = ruleSetVersion;
    this.stage = stage;
  }
}

/**
 * Thrown when an analysis snapshot cannot be reproduced deterministically.
 */
export class DeterminismError extends DomainError {
  readonly snapshotId: string;

  constructor(snapshotId: string, message: string) {
    super(message, 'DETERMINISM_ERROR', { snapshotId });
    this.name = 'DeterminismError';
    this.snapshotId = snapshotId;
  }
}

/**
 * Type guard to check if an error is a DomainError.
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Extracts a structured error context from any error value.
 */
export function extractErrorContext(error: unknown): {
  code: string;
  message: string;
  context?: Record<string, unknown>;
} {
  if (isDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      ...(error.context !== undefined ? { context: error.context } : {}),
    };
  }
  if (error instanceof Error) {
    return {
      code: error.name === 'Error' ? 'UNKNOWN_ERROR' : error.name,
      message: error.message,
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
  };
}
