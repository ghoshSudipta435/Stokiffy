import type { Readable } from 'node:stream';

export interface StoredFileDescriptor {
  storageKey: string;
  originalFileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  mimeType: string;
  userId: string;
  stagedAt: string;
  fileType: string;
  /** Internal filesystem path — strictly omitted from API responses */
  absolutePath?: string;
}

export interface SaveFileOptions {
  originalFileName: string;
  mimeType: string;
  userId: string;
  sha256Hash: string;
  fileType?: string;
}

export interface IFileStorage {
  saveFile(
    content: Buffer | Uint8Array,
    options: SaveFileOptions
  ): Promise<StoredFileDescriptor>;

  getFileBuffer(storageKey: string, userId: string): Promise<Buffer>;
  getFileStream(storageKey: string, userId: string): Promise<Readable>;
  getMetadata(storageKey: string, userId: string): Promise<StoredFileDescriptor | null>;
  exists(storageKey: string, userId: string): Promise<boolean>;
  deleteFile(storageKey: string, userId: string): Promise<boolean>;
}
