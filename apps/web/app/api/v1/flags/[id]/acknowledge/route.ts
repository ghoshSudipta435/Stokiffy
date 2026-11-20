import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// Generic technical validation schema - does not mandate invented policy minimums
const acknowledgeSchema = z.object({
  reason: z.string().min(1, 'Reason or justification is required'),
});

// Demonstration flag lookup dictionary for routing infrastructure
const DEMO_FLAGS_STATE: Record<
  string,
  {
    id: string;
    code: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  }
> = {
  flg_01: {
    id: 'flg_01',
    code: 'WARN_HIGH_SUBSIDIARY_DEBT',
    severity: 'WARNING',
    status: 'ACTIVE',
  },
  flg_02: {
    id: 'flg_02',
    code: 'AUDIT_QUALIFIED_OPINION',
    severity: 'HARD',
    status: 'ACTIVE',
  },
};

/**
 * Flag Acknowledgment Route (Policy-Neutral Technical Interface)
 *
 * POLICY COMPLIANCE NOTE:
 * In accordance with Phase 1A governance, no unapproved operational policy
 * (e.g., hard-block zero tolerance, mandatory character counts, or automated disqualification)
 * is enforced here. Decision 20 remains strictly PENDING USER DECISION.
 */
export const POST = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const flagId = String(params.id || '');
  const flag = DEMO_FLAGS_STATE[flagId];

  if (!flag) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Flag with id '${flagId}' not found in demonstration state`,
      404,
      requestId
    );
  }

  const body = await req.json();
  const parsed = acknowledgeSchema.parse(body);

  const updatedFlag = {
    ...flag,
    status: 'ACKNOWLEDGED' as const,
    acknowledgment: {
      acknowledgedBy: 'owner_user_01',
      acknowledgedAt: new Date().toISOString(),
      reason: parsed.reason,
    },
    policyNote: 'Policy semantics for flag overrides and grace periods remain pending user decision.',
  };

  return createSuccessResponse(updatedFlag, requestId);
});
