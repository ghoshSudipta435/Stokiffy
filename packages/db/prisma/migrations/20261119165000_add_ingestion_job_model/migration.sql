-- Migration: add_ingestion_job_model
-- Creates the durable IngestionJob table for CSV ingestion job processing
-- Partial unique index on (userId, sha256Hash) prevents duplicate reusable jobs
-- while allowing failed jobs to be re-uploaded.

-- Create table
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "failureCategory" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "sha256Hash" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "retryLimit" INTEGER NOT NULL DEFAULT 3,
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER,
    "errorSummary" TEXT,
    "objectDeleted" BOOLEAN NOT NULL DEFAULT false,
    "objectDeletedAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regular indexes
CREATE INDEX "IngestionJob_userId_idx" ON "IngestionJob"("userId");
CREATE INDEX "IngestionJob_userId_status_idx" ON "IngestionJob"("userId", "status");
CREATE INDEX "IngestionJob_nextRetryAt_idx" ON "IngestionJob"("nextRetryAt");
CREATE INDEX "IngestionJob_objectDeleted_idx" ON "IngestionJob"("objectDeleted");
CREATE INDEX "IngestionJob_userId_sha256Hash_idx" ON "IngestionJob"("userId", "sha256Hash");

-- Partial unique index for reusable ingestion jobs
-- Prevents duplicate QUEUED/PROCESSING/VALIDATING/COMPLETED jobs for same user+hash
-- Failed jobs do NOT block re-upload (excluded from partial index predicate)
CREATE UNIQUE INDEX 
"IngestionJob_userId_sha256Hash_reusable_unique" 
ON "IngestionJob" ("userId", "sha256Hash") 
WHERE "status" IN ('QUEUED', 'PROCESSING', 'VALIDATING', 'COMPLETED');
