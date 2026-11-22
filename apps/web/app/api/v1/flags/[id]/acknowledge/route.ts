import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

const acknowledgeSchema = z.object({
  reason: z.string().min(1, 'Reason or justification is required'),
});

export const POST = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const flagId = String(params.id || '');

  const flag = await prisma.redFlag.findUnique({
    where: { id: flagId },
    include: { analysisRun: { include: { company: true } } },
  });

  if (!flag) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Flag with id '${flagId}' not found`,
      404,
      requestId
    );
  }

  const isOwner = flag.analysisRun.userId === userId;
  if (!isOwner) {
    return createErrorResponse('FORBIDDEN', 'You do not own this flag', 403, requestId);
  }

  const body = await req.json();
  const parsed = acknowledgeSchema.parse(body);

  const beforeState = {
    status: flag.status,
    acknowledgedAt: flag.acknowledgedAt,
    acknowledgedBy: flag.acknowledgedBy,
    acknowledgedReason: flag.acknowledgedReason,
  };

  const updatedFlag = await prisma.redFlag.update({
    where: { id: flagId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
      acknowledgedReason: parsed.reason,
    },
  });

  await prisma.flagOverride.create({
    data: {
      flagId,
      userId,
      reason: parsed.reason,
      decision: 'ACKNOWLEDGED',
      beforeState,
      afterState: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId,
      action: 'FLAG_ACKNOWLEDGED',
      entityType: 'RedFlag',
      entityId: flagId,
      beforeState,
      afterState: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString(),
      },
      reason: parsed.reason,
    },
  });

  return createSuccessResponse(
    {
      ...updatedFlag,
      acknowledgment: {
        acknowledgedBy: userId,
        acknowledgedAt: updatedFlag.acknowledgedAt?.toISOString() ?? new Date().toISOString(),
        reason: parsed.reason,
      },
    },
    requestId
  );
});
