import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createPaginatedResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  companyId: z.string().optional(),
  severity: z.enum(['HARD', 'WARNING']).optional(),
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface RedFlagDTO {
  id: string;
  companyId: string;
  symbol: string;
  companyName: string;
  category: string;
  code: string;
  title: string;
  severity: 'HARD' | 'WARNING';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  detectedAt: string;
  isDemoData: boolean;
  evidence: {
    indicator: string;
    description: string;
    sourceDocument?: string;
  };
  acknowledgment?: {
    acknowledgedBy: string;
    acknowledgedAt: string;
    reason: string;
  };
}

// Clearly identified demonstration fixtures for technical UI rendering
const DEMO_FLAGS: RedFlagDTO[] = [
  {
    id: 'flg_01',
    companyId: 'comp_demo_01',
    symbol: 'DEMOCORP',
    companyName: 'Demonstration Equities Ltd.',
    category: 'GOVERNANCE_FINANCIAL_STRUCTURE',
    code: 'WARN_SUBSIDIARY_LEVERAGE',
    title: 'Subsidiary Leverage Disparity (Demonstration Flag)',
    severity: 'WARNING',
    status: 'ACTIVE',
    detectedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    isDemoData: true,
    evidence: {
      indicator: 'Consolidated vs Standalone Debt Disparity',
      description: 'Demonstration evidence item for UI layout verification only.',
      sourceDocument: 'FY24 Demonstration Note',
    },
  },
  {
    id: 'flg_02',
    companyId: 'comp_demo_02',
    symbol: 'AUDITDEMO',
    companyName: 'Sample Audit Review Ltd.',
    category: 'AUDIT_INTEGRITY',
    code: 'HARD_AUDITOR_QUALIFIED_OPINION',
    title: 'Auditor Qualified Opinion (Demonstration Flag)',
    severity: 'HARD',
    status: 'ACTIVE',
    detectedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    isDemoData: true,
    evidence: {
      indicator: 'Statutory Audit Report Opinion',
      description: 'Demonstration evidence item for UI layout verification only.',
      sourceDocument: 'Q2 Demonstration Review',
    },
  },
];

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.parse(searchParams);

  let filtered = [...DEMO_FLAGS];

  if (parsed.companyId) {
    filtered = filtered.filter((f) => f.companyId === parsed.companyId);
  }
  if (parsed.severity) {
    filtered = filtered.filter((f) => f.severity === parsed.severity);
  }
  if (parsed.status) {
    filtered = filtered.filter((f) => f.status === parsed.status);
  }

  return createPaginatedResponse(
    filtered,
    {
      limit: parsed.limit,
      hasMore: false,
      totalCount: filtered.length,
    },
    requestId
  );
});
