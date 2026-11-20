import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { defaultFileStagingService } from '@/lib/services/file-staging.service';
import { defaultIngestionQueueService } from '@/lib/queue/ingestion-queue.service';

export const dynamic = 'force-dynamic';

/**
 * Generic CSV File Upload Route
 *
 * Implements Phase 1B Cycle 2A Ingestion Architecture:
 * 1. Authentication enforcement (tenant scoping)
 * 2. Technical validation (size, MIME, extension, empty check, content check)
 * 3. SHA-256 calculation and deduplication check
 * 4. Persistent file staging via IFileStorage (LocalDiskStorageService)
 * 5. Job dispatch to pg-boss queue (file-ingestion)
 * 6. Returns HTTP 202 Accepted with job ticket
 */
export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  // 1. Authenticate user
  let session;
  try {
    session = await requireAuth(req);
  } catch {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Authentication is required to upload files.',
      401,
      requestId
    );
  }

  // 2. Extract and inspect multipart form-data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Invalid multipart/form-data request body.',
      400,
      requestId,
      [{ field: 'body', message: 'Expected valid multipart/form-data' }]
    );
  }

  const file = formData.get('file') as File | null;
  const fileType = (formData.get('fileType') as string) || 'GENERIC_CSV';

  if (!file) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'No file was uploaded. Please provide a CSV file.',
      400,
      requestId,
      [{ field: 'file', message: 'File is required' }]
    );
  }

  // 3. Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // 4. Validate metadata and content via FileStagingService
  const validation = defaultFileStagingService.validateFile(fileBuffer, file.name, file.type);
  if (!validation.valid) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      validation.error || 'File validation failed.',
      400,
      requestId,
      [{ field: validation.field || 'file', message: validation.error || 'Validation error' }]
    );
  }

  // 5. Stage file & check for duplicate
  let stagingResult;
  try {
    stagingResult = await defaultFileStagingService.stageFile(
      fileBuffer,
      file.name,
      file.type,
      session.user.id,
      fileType
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'File staging failure';
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      `Failed to stage file: ${errorMsg}`,
      500,
      requestId
    );
  }

  // 6. If duplicate active or completed job is found, return the existing ticket
  if (stagingResult.isDuplicate && stagingResult.existingJob) {
    const existing = stagingResult.existingJob;
    return createSuccessResponse(
      {
        jobId: existing.jobId,
        fileType: existing.fileType,
        fileName: existing.fileName,
        fileSizeBytes: existing.fileSizeBytes,
        sha256Hash: existing.sha256Hash,
        status: existing.status,
        queue: existing.queue,
        enqueuedAt: existing.enqueuedAt,
        message:
          existing.status === 'COMPLETED'
            ? 'File with identical content was previously ingested. Returning existing job record.'
            : 'File with identical content is already queued or processing. Returning active job ticket.',
        isDuplicate: true,
      },
      requestId,
      202
    );
  }

  // 7. Enqueue new job to pg-boss queue
  const stagedFile = stagingResult.stagedFile!;
  const jobId = `job_${crypto.randomUUID().slice(0, 12)}`;

  let jobRecord;
  try {
    jobRecord = await defaultIngestionQueueService.enqueueIngestionJob({
      jobTicketId: jobId,
      storageKey: stagedFile.storageKey,
      fileName: file.name,
      fileSizeBytes: stagedFile.fileSizeBytes,
      sha256Hash: stagingResult.sha256Hash,
      userId: session.user.id,
      fileType,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Queue dispatch failed';
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      `Failed to enqueue ingestion job: ${errorMsg}`,
      503,
      requestId
    );
  }

  // 8. Return HTTP 202 Accepted with job ticket
  const jobTicket = {
    jobId: jobRecord.jobId,
    fileType: jobRecord.fileType,
    fileName: jobRecord.fileName,
    fileSizeBytes: jobRecord.fileSizeBytes,
    sha256Hash: jobRecord.sha256Hash,
    status: jobRecord.status,
    queue: jobRecord.queue,
    enqueuedAt: jobRecord.enqueuedAt,
    message: jobRecord.message,
    isDuplicate: false,
  };

  return createSuccessResponse(jobTicket, requestId, 202);
});
