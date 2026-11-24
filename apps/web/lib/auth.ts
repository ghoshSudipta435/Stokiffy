import './env';
import { NextRequest } from 'next/server';
import type { NextAuthOptions, Session, User } from 'next-auth';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'VIEWER';
  };
  expiresAt: string;
}

const DEFAULT_SECRET = 'stokiffy-default-dev-secret-do-not-use-in-production-1234';

function safeCompareSync(password: string, hash: string): boolean {
  try {
    const fn = (bcrypt as any).compareSync || (bcrypt as any).default?.compareSync;
    if (typeof fn === 'function') {
      return fn(password, hash);
    }
  } catch {
    return false;
  }
  return false;
}

export async function authorizeCredentials(
  credentials?: Record<string, string>
): Promise<(User & { role: 'OWNER' }) | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const configuredEmail = (process.env.ADMIN_EMAIL || 'investor@stokiffy.local').trim().toLowerCase();
  const inputEmail = credentials.email.trim().toLowerCase();

  if (inputEmail !== configuredEmail) {
    return null;
  }

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plainPassword = process.env.ADMIN_PASSWORD;
  const isDevFallback =
    process.env.ALLOW_PERSONAL_DEV_AUTH === 'true' ||
    (process.env.ALLOW_PERSONAL_DEV_AUTH !== 'false' && process.env.PERSONAL_MODE === 'true') ||
    process.env.NODE_ENV !== 'production';

  let isValid = false;

  if (passwordHash) {
    isValid = safeCompareSync(credentials.password, passwordHash);
  } else if (plainPassword) {
    isValid = credentials.password === plainPassword;
  } else if (isDevFallback) {
    // In local dev/fallback mode without password hash set, any non-empty password is accepted
    isValid = credentials.password.length > 0;
  }

  if (!isValid) {
    return null;
  }

  return {
    id: 'owner_user_01',
    email: configuredEmail,
    name: 'Stokiffy Investor',
    role: 'OWNER',
  } as User & { role: 'OWNER' };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || DEFAULT_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Workstation Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'investor@stokiffy.local' },
        password: { label: 'Passphrase', type: 'password' },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'OWNER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub || 'owner_user_01';
        (session.user as any).role = token.role || 'OWNER';
      }
      return session;
    },
  },
};

/**
 * Session verification boundary for Web Workstation.
 * When ALLOW_PERSONAL_DEV_AUTH === 'true' (or PERSONAL_MODE === 'true' in dev/test),
 * returns the default owner session.
 * In production, validates the JWT session via NextAuth.
 */
export async function getSession(req?: NextRequest): Promise<UserSession | null> {
  const allowDevAuth =
    process.env.ALLOW_PERSONAL_DEV_AUTH === 'true' ||
    (process.env.ALLOW_PERSONAL_DEV_AUTH !== 'false' && process.env.PERSONAL_MODE === 'true') ||
    (process.env.NODE_ENV === 'development' && process.env.ALLOW_PERSONAL_DEV_AUTH !== 'false');

  if (allowDevAuth) {
    return {
      user: {
        id: 'owner_user_01',
        email: process.env.ADMIN_EMAIL || 'investor@stokiffy.local',
        name: 'Stokiffy Investor',
        role: 'OWNER',
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // 1. Try to extract from request cookies via getToken (works in API route handlers)
  if (req) {
    try {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET || DEFAULT_SECRET,
      });

      if (token) {
        return {
          user: {
            id: (token.id as string) || (token.sub as string) || 'owner_user_01',
            email: token.email || process.env.ADMIN_EMAIL || 'investor@stokiffy.local',
            name: token.name || 'Stokiffy Investor',
            role: (token.role as 'OWNER' | 'VIEWER') || 'OWNER',
          },
          expiresAt: token.exp
            ? new Date((token.exp as number) * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    } catch {
      // Fall through to getServerSession
    }
  }

  // 2. Fallback to NextAuth getServerSession
  try {
    const nextAuthSession = await getServerSession(authOptions);
    if (nextAuthSession?.user) {
      return {
        user: {
          id: (nextAuthSession.user as any).id || 'owner_user_01',
          email: nextAuthSession.user.email || process.env.ADMIN_EMAIL || 'investor@stokiffy.local',
          name: nextAuthSession.user.name || 'Stokiffy Investor',
          role: ((nextAuthSession.user as any).role as 'OWNER' | 'VIEWER') || 'OWNER',
        },
        expiresAt: nextAuthSession.expires || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  } catch {
    // Outside request context
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
