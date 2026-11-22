import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, AlertRepository } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const acknowledgedBy = body.acknowledgedBy || session.user.email || userId;

  const repo = new AlertRepository(prisma);
  const updated = await repo.acknowledge(id, userId, acknowledgedBy);

  // Append AuditEvent
  await prisma.auditEvent.create({
    data: {
      userId,
      action: 'ACKNOWLEDGE_ALERT',
      entityType: 'Alert',
      entityId: id,
      reason: body.notes || `Alert ${id} acknowledged by ${acknowledgedBy}`,
      afterState: {
        alertId: id,
        type: updated.type,
        severity: updated.severity,
        acknowledgedAt: updated.acknowledgedAt?.toISOString(),
        acknowledgedBy: updated.acknowledgedBy,
      },
    },
  });

  return createSuccessResponse(
    {
      id: updated.id,
      companyId: updated.companyId,
      type: updated.type,
      severity: updated.severity,
      message: updated.message,
      triggeredAt: updated.triggeredAt.toISOString(),
      acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: updated.acknowledgedBy,
      data: updated.data,
    },
    requestId
  );
});
