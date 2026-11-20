import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { defaultIngestionStatusService } from '@/lib/services/ingestion-status.service';

export const dynamic = 'force-dynamic';

/**
 * Job Status and Row Validation Summary API
 *
 * GET /api/v1/ingestion/jobs/[id]
 *
 * Implements Section 11 requirements:
 * - Authenticated access
 * - Strict job ownership verification (no cross-user visibility)
 * - Explicit lifecycle status (QUEUED, PROCESSING, VALIDATING, COMPLETED, FAILED)
 * - Structured validation and row-error summary
 * - Zero internal storage path exposure
 */
export const GET = apiHandler(async (req: NextRequest, { requestId, params }) => {
  // 1. Authenticate user
  let session;
  try {
    session = await requireAuth(req);
  } catch {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Authentication is required to query job status.',
      401,
      requestId
    );
  }

  const jobId = typeof params['id'] === 'string' ? params['id'] : Array.isArray(params['id']) ? params['id'][0] : '';
  if (!jobId) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Job ID parameter is required.',
      400,
      requestId,
      [{ field: 'id', message: 'Job ID cannot be empty' }]
    );
  }

  // 2. Fetch job scoped to authenticated user
  const job = await defaultIngestionStatusService.getJobForUser(jobId, session.user.id);
  if (!job) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Job "${jobId}" was not found or does not belong to your account.`,
      404,
      requestId
    );
  }

  // 3. Return sanitized job response (excluding internal paths)
  const responseData = {
    jobId: job.jobId,
    status: job.status,
    queue: job.queue,
    fileName: job.fileName,
    fileSizeBytes: job.fileSizeBytes,
    sha256Hash: job.sha256Hash,
    fileType: job.fileType,
    enqueuedAt: job.enqueuedAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    processedCount: job.processedCount,
    validRowCount: job.validRowCount,
    warningsCount: job.warningsCount,
    errorsSummary: job.errorsSummary || [],
    message: job.message,
    error: job.error,
  };

  return createSuccessResponse(responseData, requestId, 200);
});
