import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { resolveStagingDir } from './path-resolver.js';

export interface StoredFileDescriptor {
  storageKey: string;
  originalFileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  mimeType: string;
  userId: string;
  stagedAt: string;
  fileType: string;
  absolutePath?: string;
}

const STORAGE_KEY_REGEX = /^stage_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export class WorkerStorageService {
  private readonly stagingDirectory: string;

  constructor(customDir?: string) {
    this.stagingDirectory = resolveStagingDir(customDir);
  }

  public getStagingDirectory(): string {
    return this.stagingDirectory;
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
    if (!resolved.startsWith(this.stagingDirectory)) {
      throw new Error('SECURITY_VIOLATION: Attempted path traversal detected');
    }
    return resolved;
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

  public async getFileContent(storageKey: string, userId: string): Promise<string> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      throw new Error(`FILE_NOT_FOUND: Staged file "${storageKey}" does not exist for user "${userId}"`);
    }

    const dataPath = this.getFilePath(storageKey, '.data');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`FILE_NOT_FOUND: Staged file data for "${storageKey}" is missing on disk`);
    }

    return fs.promises.readFile(dataPath, 'utf-8');
  }

  public async getFileStream(storageKey: string, userId: string): Promise<Readable> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      throw new Error(`FILE_NOT_FOUND: Staged file "${storageKey}" does not exist for user "${userId}"`);
    }

    const dataPath = this.getFilePath(storageKey, '.data');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`FILE_NOT_FOUND: Staged file data for "${storageKey}" is missing on disk`);
    }

    return fs.createReadStream(dataPath);
  }

  public async deleteFile(storageKey: string, userId: string): Promise<boolean> {
    const meta = await this.getMetadata(storageKey, userId);
    if (!meta) {
      return false;
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

export const defaultWorkerStorage = new WorkerStorageService();
