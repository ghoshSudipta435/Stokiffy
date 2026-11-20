import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalDiskStorageService } from './local-disk-storage';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('LocalDiskStorageService', () => {
  let tempDir: string;
  let storage: LocalDiskStorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-storage-test-'));
    storage = new LocalDiskStorageService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('saves file and generates secure storage key with restricted permissions', async () => {
    const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'test.csv',
      mimeType: 'text/csv',
      userId: 'user_123',
      sha256Hash: 'hash_abc',
    });

    expect(descriptor.storageKey).toMatch(/^stage_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    expect(descriptor.originalFileName).toBe('test.csv');
    expect(descriptor.fileSizeBytes).toBe(content.length);
    expect(descriptor.userId).toBe('user_123');

    // Verify file exists on disk
    const dataPath = path.join(tempDir, `${descriptor.storageKey}.data`);
    const metaPath = path.join(tempDir, `${descriptor.storageKey}.meta.json`);
    expect(fs.existsSync(dataPath)).toBe(true);
    expect(fs.existsSync(metaPath)).toBe(true);

    // Verify POSIX mode (0600: read/write owner only)
    const stats = fs.statSync(dataPath);
    // In POSIX mode, mode & 0o777 gives the exact permissions
    if (process.platform !== 'win32') {
      expect(stats.mode & 0o777).toBe(0o600);
    }
  });

  it('retrieves saved file buffer for authenticated owner', async () => {
    const content = Buffer.from('Symbol,Net Profit\nHUL,2000\n');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'hul.csv',
      mimeType: 'text/csv',
      userId: 'user_123',
      sha256Hash: 'hash_xyz',
    });

    const retrieved = await storage.getFileBuffer(descriptor.storageKey, 'user_123');
    expect(retrieved.toString('utf-8')).toBe(content.toString('utf-8'));
  });

  it('blocks cross-user file retrieval', async () => {
    const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'tcs.csv',
      mimeType: 'text/csv',
      userId: 'user_owner',
      sha256Hash: 'hash_tcs',
    });

    await expect(storage.getFileBuffer(descriptor.storageKey, 'user_attacker')).rejects.toThrow(
      /ACCESS_DENIED/
    );
  });

  it('rejects path traversal attempts in storageKey', async () => {
    await expect(storage.getFileBuffer('../../etc/passwd', 'user_123')).rejects.toThrow(
      /INVALID_STORAGE_KEY/
    );
    await expect(storage.getFileBuffer('stage_../../../etc', 'user_123')).rejects.toThrow(
      /INVALID_STORAGE_KEY/
    );
  });

  it('rejects path traversal attempts in userId', async () => {
    const content = Buffer.from('test');
    await expect(
      storage.saveFile(content, {
        originalFileName: 'test.csv',
        mimeType: 'text/csv',
        userId: '../../attacker',
        sha256Hash: 'hash',
      })
    ).rejects.toThrow(/INVALID_USER_ID/);
  });

  it('verifies file existence accurately', async () => {
    const content = Buffer.from('test');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'test.csv',
      mimeType: 'text/csv',
      userId: 'user_123',
      sha256Hash: 'hash',
    });

    expect(await storage.exists(descriptor.storageKey, 'user_123')).toBe(true);
    expect(await storage.exists(descriptor.storageKey, 'other_user')).toBe(false);
    expect(await storage.exists('stage_00000000-0000-0000-0000-000000000000', 'user_123')).toBe(false);
  });

  it('deletes staged file and metadata idempotently', async () => {
    const content = Buffer.from('test');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'test.csv',
      mimeType: 'text/csv',
      userId: 'user_123',
      sha256Hash: 'hash',
    });

    const deleted = await storage.deleteFile(descriptor.storageKey, 'user_123');
    expect(deleted).toBe(true);

    // Second delete is idempotent and returns false
    const deletedAgain = await storage.deleteFile(descriptor.storageKey, 'user_123');
    expect(deletedAgain).toBe(false);

    expect(await storage.exists(descriptor.storageKey, 'user_123')).toBe(false);
  });

  it('prevents unauthorized user from deleting files', async () => {
    const content = Buffer.from('test');
    const descriptor = await storage.saveFile(content, {
      originalFileName: 'test.csv',
      mimeType: 'text/csv',
      userId: 'user_owner',
      sha256Hash: 'hash',
    });

    await expect(storage.deleteFile(descriptor.storageKey, 'attacker')).rejects.toThrow(
      /ACCESS_DENIED/
    );
    expect(await storage.exists(descriptor.storageKey, 'user_owner')).toBe(true);
  });
});
