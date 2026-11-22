import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSession, requireAuth, authOptions, authorizeCredentials } from './auth';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}));

describe('Authentication & Auth Guard (apps/web/lib/auth.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Personal Dev Auth Fallback', () => {
    it('returns default owner session when ALLOW_PERSONAL_DEV_AUTH is true', async () => {
      process.env.ALLOW_PERSONAL_DEV_AUTH = 'true';

      const session = await getSession();

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('owner_user_01');
      expect(session?.user.email).toBe('investor@stokiffy.local');
      expect(session?.user.role).toBe('OWNER');
    });

    it('returns default owner session when PERSONAL_MODE is true and dev auth is not false', async () => {
      delete process.env.ALLOW_PERSONAL_DEV_AUTH;
      process.env.PERSONAL_MODE = 'true';

      const session = await getSession();

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('owner_user_01');
    });
  });

  describe('Production Auth Guard (ALLOW_PERSONAL_DEV_AUTH = false)', () => {
    beforeEach(() => {
      process.env.ALLOW_PERSONAL_DEV_AUTH = 'false';
      process.env.PERSONAL_MODE = 'false';
      process.env.ADMIN_EMAIL = 'admin@example.com';
    });

    it('returns null when no request or session is provided', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it('throws UNAUTHORIZED when requireAuth fails to get a session', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
    });

    it('returns session when valid JWT token is present on request', async () => {
      const mockToken = {
        id: 'usr_prod_123',
        email: 'admin@example.com',
        name: 'Production Admin',
        role: 'OWNER',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      vi.mocked(getToken).mockResolvedValueOnce(mockToken as any);

      const req = new NextRequest('http://localhost:3000/api/v1/companies');
      const session = await getSession(req);

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('usr_prod_123');
      expect(session?.user.email).toBe('admin@example.com');
      expect(session?.user.role).toBe('OWNER');
    });

    it('returns session from getServerSession fallback when req token is not present', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'usr_session_456',
          email: 'admin@example.com',
          name: 'Session Admin',
          role: 'OWNER',
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      } as any);

      const session = await getSession();

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('usr_session_456');
      expect(session?.user.email).toBe('admin@example.com');
    });
  });

  describe('Credentials Provider (authorizeCredentials)', () => {
    const safeHash = (pwd: string) => {
      const fn = (bcrypt as any).hashSync || (bcrypt as any).default?.hashSync;
      return fn(pwd, 10);
    };

    it('authorizes successfully when password matches ADMIN_PASSWORD_HASH', async () => {
      const password = 'my-secret-passphrase';
      const hash = safeHash(password);

      process.env.ADMIN_EMAIL = 'trader@stokiffy.com';
      process.env.ADMIN_PASSWORD_HASH = hash;

      const user = await authorizeCredentials({
        email: 'trader@stokiffy.com',
        password,
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe('trader@stokiffy.com');
      expect(user?.id).toBe('owner_user_01');
      expect(user?.role).toBe('OWNER');
    });

    it('rejects authorization when email does not match', async () => {
      process.env.ADMIN_EMAIL = 'trader@stokiffy.com';
      process.env.ADMIN_PASSWORD = 'password123';

      const user = await authorizeCredentials({
        email: 'wrong@stokiffy.com',
        password: 'password123',
      });

      expect(user).toBeNull();
    });

    it('rejects authorization when password does not match bcrypt hash', async () => {
      const hash = safeHash('correct-passphrase');

      process.env.ADMIN_EMAIL = 'trader@stokiffy.com';
      process.env.ADMIN_PASSWORD_HASH = hash;

      const user = await authorizeCredentials({
        email: 'trader@stokiffy.com',
        password: 'wrong-passphrase',
      });

      expect(user).toBeNull();
    });
  });
});
