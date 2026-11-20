import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import type { IFileStorage, SaveFileOptions, StoredFileDescriptor } from './file-storage.interface';
import { resolveStagingDir } from './path-resolver';

const STORAGE_KEY_REGEX = /^stage_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export class LocalDiskStorageService implements IFileStorage {
  private readonly stagingDirectory: string;

  constructor(stagingDirectory?: string) {
    this.stagingDirectory = resolveStagingDir(stagingDirectory);
  }

  public getStagingDirectory(): string {
    return this.stagingDirectory;
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.stagingDirectory)) {
      fs.mkdirSync(this.stagingDirectory, { recursive: true, mode: 0o700 });
    }
  }

  private validateKey(storageKey: string): void {
    if (!storageKey || !STORAGE_KEY_REGEX.test(storageKey)) {
      throw new Error(`INVALID_STORAGE_KEY: Key "${storageKey}" does not conform to secure storage format`);
    }
  }

  private validateUser(userId: string): void {
    if (!userId || !USER_ID_REGEX.test(userId)) {
      throw new Error(`INVALID_USER_ID: User ID "${userId}" contains disallowed characters`);
    }
  }

  private getFilePath(storageKey: string, ext = '.data'): string {
    this.validateKey(storageKey);
    const resolved = path.resolve(this.stagingDirectory, `${storageKey}${ext}`);
    // Path traversal defense
    if (!resolved.startsWith(this.stagingDirectory)) {
      throw new Error('SECURITY_VIOLATION: Attempted path traversal detected');
    }
    return resolved;
  }

  public async saveFile(
    content: Buffer | Uint8Array,
    options: SaveFileOptions
  ): Promise<StoredFileDescriptor> {
    this.validateUser(options.userId);
    this.ensureDirectory();

    const uuid = crypto.randomUUID();
    const storageKey = `stage_${uuid}`;
    const dataPath = this.getFilePath(storageKey, '.data');
    const metaPath = this.getFilePath(storageKey, '.meta.json');

    const descriptor: StoredFileDescriptor = {
      storageKey,
      originalFileName: options.originalFileName,
      fileSizeBytes: content.length,
      sha256Hash: options.sha256Hash,
      mimeType: options.mimeType,
      userId: options.userId,
      stagedAt: new Date().toISOString(),
      fileType: options.fileType || 'GENERIC_CSV',
      absolutePath: dataPath,
    };

    // Write file with restricted POSIX permissions (0600: read/write owner only)
    await fs.promises.writeFile(dataPath, content, { mode: 0o600 });
    await fs.promises.writeFile(metaPath, JSON.stringify(descriptor, null, 2), { mode: 0o600, encoding: 'utf-8' });

    return descriptor;
  }

  public async getMetadata(storageKey: string, userId: string): Promise<StoredFileDescriptor | null> {
    this.validateKey(storageKey);
    this.validateUser(userId);

    const metaPath = this.getFilePath(storageKey, '.meta.json');
    if (!fs.existsSync(metaPath)) {
      return null;
    }

    const raw = await fs.promises.readFile(metaPath, 'utf-8');
    const descriptor: StoredFileDescriptor = JSON.parse(raw);

    if (descriptor.userId !== userId) {
      throw new Error(`ACCESS_DENIED: Staged file "${storageKey}" does not belong to user "${userId}"`);
    }

    return descriptor;
  }

  public async getFileBuffer(storageKey: string, userId: string): Promise<Buffer> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      throw new Error(`FILE_NOT_FOUND: Staged file "${storageKey}" does not exist`);
    }

    const dataPath = this.getFilePath(storageKey, '.data');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`FILE_NOT_FOUND: Staged file data for "${storageKey}" is missing on disk`);
    }

    return fs.promises.readFile(dataPath);
  }

  public async getFileStream(storageKey: string, userId: string): Promise<Readable> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      throw new Error(`FILE_NOT_FOUND: Staged file "${storageKey}" does not exist`);
    }

    const dataPath = this.getFilePath(storageKey, '.data');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`FILE_NOT_FOUND: Staged file data for "${storageKey}" is missing on disk`);
    }

    return fs.createReadStream(dataPath);
  }

  public async exists(storageKey: string, userId: string): Promise<boolean> {
    try {
      const meta = await this.getMetadata(storageKey, userId);
      if (!meta) return false;
      const dataPath = this.getFilePath(storageKey, '.data');
      return fs.existsSync(dataPath);
    } catch {
      return false;
    }
  }

  public async deleteFile(storageKey: string, userId: string): Promise<boolean> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      return false; // Idempotent: file already gone or not found
    }

    const dataPath = this.getFilePath(storageKey, '.data');
    const metaPath = this.getFilePath(storageKey, '.meta.json');

    let deleted = false;
    if (fs.existsSync(dataPath)) {
      await fs.promises.unlink(dataPath);
      deleted = true;
    }
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath);
      deleted = true;
    }

    return deleted;
  }
}

export const defaultLocalStorage = new LocalDiskStorageService();
