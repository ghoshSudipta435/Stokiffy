import crypto from 'node:crypto';

export class FileHashService {
  /**
   * Computes SHA-256 hash from a Buffer or Uint8Array.
   */
  public static computeSha256(content: Buffer | Uint8Array): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Computes SHA-256 hash from a string.
   */
  public static computeSha256FromString(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
  }
}
