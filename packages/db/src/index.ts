/**
 * @stock-assistant/db — Public exports
 *
 * PostgreSQL database layer with Prisma ORM and repository pattern.
 * Phase 1A: Schema, client, and repository interfaces only.
 * No migrations are run; no production database is accessed.
 */

export { prisma, default } from './client.js';
export { runInTransaction } from './utils/transaction.js';

export {
  CompanyRepository,
} from './repositories/company-repository.js';
export {
  FinancialsRepository,
} from './repositories/financials-repository.js';
export {
  AnalysisRepository,
} from './repositories/analysis-repository.js';
export {
  TradePlanRepository,
} from './repositories/trade-plan-repository.js';
export {
  PortfolioRepository,
} from './repositories/portfolio-repository.js';
export {
  AlertRepository,
} from './repositories/alert-repository.js';
export {
  AuditRepository,
} from './repositories/audit-repository.js';
export {
  IngestionJobRepository,
  REUSABLE_STATUSES,
  TERMINAL_STATUSES,
  JobLeaseConflictError,
  StaleLeaseError,
  InvalidStatusTransitionError,
  TerminalStateError,
} from './repositories/ingestion-job-repository.js';
