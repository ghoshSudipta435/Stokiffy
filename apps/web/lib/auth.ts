import { NextRequest } from 'next/server';
import { env } from './env';

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'VIEWER';
  };
  expiresAt: string;
}

/**
 * Session verification boundary for Web Workstation.
 * In Phase 1A personal workstation mode (env.PERSONAL_MODE === true), returns the default owner session.
 *
 * NOTE ON SCOPE & COMPLIANCE:
 * Mobile authentication, bearer token issuance, token refresh, and mobile-specific auth flows
 * are NOT implemented in Phase 1A and are deferred to Phase 8.
 */
export async function getSession(_req?: NextRequest): Promise<UserSession | null> {
  // If running in personal mode:
  if (env.PERSONAL_MODE) {
    return {
      user: {
        id: 'owner_user_01',
        email: 'investor@stokiffy.local',
        name: 'Stokiffy Investor',
        role: 'OWNER',
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  return null;
}

export async function requireAuth(req?: NextRequest): Promise<UserSession> {
  const session = await getSession(req);
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
