import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const runStageASchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  snapshotId: z.string().optional(),
});

/**
 * Stage A Analysis API Route (Neutral Placeholder Interface)
 *
 * ARCHITECTURAL BOUNDARY & GOVERNANCE COMPLIANCE:
 * - This endpoint does NOT execute financial scoring or PASS/FAIL evaluations.
 * - Stage A deterministic calculation engines are encapsulated in `packages/core` (Workstream B).
 * - All financial thresholds (Market Cap, Volume, Promoter Pledge, ROCE, D/E) remain
 *   strictly PENDING USER DECISION (User Decisions 1-5).
 * - This route acts as a neutral interface placeholder for Phase 1B core engine integration.
 */
export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const body = await req.json();
  const parsed = runStageASchema.parse(body);

  const placeholderResponse = {
    interface: 'STAGE_A_SCREENING_PLACEHOLDER',
    companyId: parsed.companyId,
    status: 'NOT_IMPLEMENTED',
    message: 'Stage A calculation engine is in packages/core and awaiting user policy decision approvals. No financial analysis executed.',
    userDecisionsPending: [
      'DECISION_01_MARKET_CAP_CUTOFF',
      'DECISION_02_MEDIAN_VOLUME_WINDOW',
      'DECISION_03_PROMOTER_PLEDGE_TOLERANCE',
      'DECISION_04_MINIMUM_ROCE_THRESHOLD',
      'DECISION_05_MAXIMUM_DEBT_TO_EQUITY',
    ],
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return createSuccessResponse(placeholderResponse, requestId, 200);
});
