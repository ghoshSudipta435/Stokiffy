import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createPaginatedResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

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

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.parse(searchParams);

  const userCompanies = await prisma.company.findMany({
    where: { userId },
    select: { id: true },
  });
  const userCompanyIds = userCompanies.map((c) => c.id);

  const flags = await prisma.redFlag.findMany({
    where: {
      companyId: { in: userCompanyIds },
      ...(parsed.companyId ? { companyId: parsed.companyId } : {}),
      ...(parsed.severity ? { severity: parsed.severity } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
    },
    include: { analysisRun: { include: { company: true } } },
    take: parsed.limit,
    orderBy: { createdAt: 'desc' },
  });

  const data: RedFlagDTO[] = flags.map((flag) => {
    const company = flag.analysisRun.company;
    const dto: RedFlagDTO = {
      id: flag.id,
      companyId: flag.companyId,
      symbol: company.symbol,
      companyName: company.name,
      category: flag.class,
      code: flag.flagKey,
      title: flag.message,
      severity: flag.severity as 'HARD' | 'WARNING',
      status: flag.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
      detectedAt: flag.createdAt.toISOString(),
      isDemoData: false,
      evidence: {
        indicator: flag.ruleKey ?? flag.flagKey,
        description: flag.message,
        sourceDocument: flag.source,
      },
    };
    if (flag.acknowledgedAt) {
      dto.acknowledgment = {
        acknowledgedBy: flag.acknowledgedBy ?? '',
        acknowledgedAt: flag.acknowledgedAt.toISOString(),
        reason: flag.acknowledgedReason ?? '',
      };
    }
    return dto;
  });

  return createPaginatedResponse(
    data,
    { limit: parsed.limit, hasMore: false, totalCount: data.length },
    requestId
  );
});
