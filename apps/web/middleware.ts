import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/screener',
  '/companies',
  '/watchlists',
  '/trade-planner',
  '/portfolio',
  '/monitoring',
  '/journal',
  '/settings',
];

const DEFAULT_SECRET = 'stokiffy-default-dev-secret-do-not-use-in-production-1234';

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const pathname = request.nextUrl.pathname;

  const isDevAuth =
    process.env.ALLOW_PERSONAL_DEV_AUTH === 'true' ||
    (process.env.ALLOW_PERSONAL_DEV_AUTH !== 'false' && process.env.PERSONAL_MODE === 'true');

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // If route is protected and personal dev auth is disabled, verify session token
  if (isProtectedRoute && !isDevAuth) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || DEFAULT_SECRET,
    });

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If already logged in and visiting /login in production, redirect to /dashboard
  if (pathname === '/login' && !isDevAuth) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || DEFAULT_SECRET,
    });
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Clone request headers and inject request-id
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach Security Headers
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
