import type { IFileStorage, StoredFileDescriptor } from '../storage/file-storage.interface';
import { defaultLocalStorage } from '../storage/local-disk-storage';
import { FileHashService } from './file-hash.service';
import { IngestionStatusService, defaultIngestionStatusService, IngestionJobRecord } from './ingestion-status.service';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel', ''];

export interface StagingValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

export interface StagingResult {
  isDuplicate: boolean;
  existingJob?: IngestionJobRecord;
  stagedFile?: StoredFileDescriptor;
  sha256Hash: string;
}

export class FileStagingService {
  constructor(
    private readonly storage: IFileStorage = defaultLocalStorage,
    private readonly statusService: IngestionStatusService = defaultIngestionStatusService
  ) {}

  /**
   * Technical validation of file metadata and content before staging.
   */
  public validateFile(
    fileBuffer: Buffer | Uint8Array,
    fileName: string,
    mimeType: string
  ): StagingValidationResult {
    // 1. File existence / size check
    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        valid: false,
        field: 'file',
        error: 'Uploaded file is empty. Please provide a valid CSV file with data.',
      };
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        field: 'size',
        error: `File size (${Math.round(fileBuffer.length / 1024 / 1024)}MB) exceeds maximum allowed 25MB limit.`,
      };
    }

    // 2. Extension check
    const lowerName = fileName.toLowerCase();
    if (!lowerName.endsWith('.csv')) {
      return {
        valid: false,
        field: 'fileName',
        error: 'Invalid file extension. Only .csv files are supported.',
      };
    }

    // 3. MIME type check
    const normalizedMime = mimeType ? mimeType.toLowerCase().trim() : '';
    if (normalizedMime && !ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      return {
        valid: false,
        field: 'mimeType',
        error: `Unsupported MIME type "${mimeType}". Only CSV media types are accepted.`,
      };
    }

    // 4. Content sanity check (not binary or executable, no null bytes, valid text)
    const preview = fileBuffer.subarray(0, Math.min(fileBuffer.length, 4096));
    for (let i = 0; i < preview.length; i++) {
      if (preview[i] === 0) {
        return {
          valid: false,
          field: 'file',
          error: 'File content appears to be binary or corrupted. Null bytes detected.',
        };
      }
    }

    // Check for delimiter presence in first 2048 bytes
    const textPreview = Buffer.from(preview).toString('utf-8');
    if (!textPreview.includes(',') && !textPreview.includes(';') && !textPreview.includes('\t')) {
      return {
        valid: false,
        field: 'file',
        error: 'Invalid CSV content: No recognizable column delimiters found in header row.',
      };
    }

    return { valid: true };
  }

  /**
   * Stages file to storage, calculating SHA-256 and checking for reusable jobs.
   */
  public async stageFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    fileType = 'GENERIC_CSV'
  ): Promise<StagingResult> {
    const validation = this.validateFile(fileBuffer, fileName, mimeType);
    if (!validation.valid) {
      throw new Error(`VALIDATION_FAILED: ${validation.error}`);
    }

    const sha256Hash = FileHashService.computeSha256(fileBuffer);

    // Check for tenant-scoped active or completed duplicate
    const existingJob = await this.statusService.findReusableJobForUser(userId, sha256Hash);
    if (existingJob) {
      return {
        isDuplicate: true,
        existingJob,
        sha256Hash,
      };
    }

    // Save to persistent storage
    const stagedFile = await this.storage.saveFile(fileBuffer, {
      originalFileName: fileName,
      mimeType: mimeType || 'text/csv',
      userId,
      sha256Hash,
      fileType,
    });

    return {
      isDuplicate: false,
      stagedFile,
      sha256Hash,
    };
  }
}

export const defaultFileStagingService = new FileStagingService();
