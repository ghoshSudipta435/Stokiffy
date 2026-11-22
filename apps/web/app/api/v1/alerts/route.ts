import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status'); // 'active' | 'acknowledged'
  const severity = searchParams.get('severity'); // 'info' | 'warning' | 'critical'
  const companyId = searchParams.get('companyId');
  const type = searchParams.get('type');
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

  const whereClause: any = {
    userId,
  };

  if (status === 'active') {
    whereClause.acknowledgedAt = null;
  } else if (status === 'acknowledged') {
    whereClause.acknowledgedAt = { not: null };
  }

  if (severity) {
    whereClause.severity = severity;
  }

  if (companyId) {
    whereClause.companyId = companyId;
  }

  if (type) {
    whereClause.type = type;
  }

  const alerts = await prisma.alert.findMany({
    where: whereClause,
    orderBy: { triggeredAt: 'desc' },
    take: limit,
  });

  const data = alerts.map((a) => ({
    id: a.id,
    companyId: a.companyId,
    type: a.type,
    severity: a.severity,
    message: a.message,
    triggeredAt: a.triggeredAt.toISOString(),
    acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
    acknowledgedBy: a.acknowledgedBy,
    data: a.data,
    relatedTradePlanId: a.relatedTradePlanId,
  }));

  return createSuccessResponse(data, requestId);
});
