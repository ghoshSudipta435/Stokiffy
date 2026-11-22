import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma, JournalRepository } from '@stock-assistant/db';
import { AppendJournalReviewRequestSchema } from '@stock-assistant/contracts';
import { validatePostTradeReview } from '@stock-assistant/core';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const id = params.id as string;

  const body = await req.json();
  const parsed = AppendJournalReviewRequestSchema.parse(body);

  // Validate using core post-trade review validator
  const validation = validatePostTradeReview(parsed.review);
  if (!validation.valid) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      `Post-trade review validation failed: ${validation.missingFields.join(', ')}`,
      400,
      requestId
    );
  }

  const repo = new JournalRepository(prisma);
  const updated = await repo.appendReview(id, userId, {
    rulesWorked: parsed.review.rulesWorked,
    assumptionsFailed: parsed.review.assumptionsFailed,
    executionQuality: parsed.review.executionQuality,
    slippage: parsed.review.slippage,
    behaviouralNotes: parsed.review.behaviouralNotes,
    lesson: parsed.review.lesson,
    reviewedAt: new Date(parsed.review.reviewedAt),
    reviewedBy: parsed.review.reviewedBy,
  });

  // Append AuditEvent
  await prisma.auditEvent.create({
    data: {
      userId,
      action: 'APPEND_JOURNAL_REVIEW',
      entityType: 'JournalEntry',
      entityId: id,
      reason: `Post-trade review appended: execution quality "${parsed.review.executionQuality}", lesson: "${parsed.review.lesson.slice(0, 50)}..."`,
      afterState: {
        journalEntryId: id,
        reviewedAt: updated.reviewedAt?.toISOString(),
        reviewedBy: updated.reviewedBy,
        executionQuality: parsed.review.executionQuality,
      },
    },
  });

  return createSuccessResponse(
    {
      id: updated.id,
      tradePlanId: updated.tradePlanId,
      date: updated.date.toISOString(),
      action: updated.action,
      quantity: Number(updated.quantity),
      price: Number(updated.price),
      fees: Number(updated.fees),
      taxes: Number(updated.taxes),
      reason: updated.reason,
      review: updated.review,
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
      reviewedBy: updated.reviewedBy,
    },
    requestId
  );
});
