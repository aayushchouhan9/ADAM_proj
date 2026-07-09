import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

// Define paths that require authentication
const PROTECTED_PREFIXES = [
  '/board',
  '/dashboard',
  '/api/tasks',
  '/api/import',
  '/api/board',
  '/api/comments',
  '/api/stats',
  '/api/activity',
  '/api/users',
  '/api/stream',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // Verify the JWT token using jose (Edge compatible)
  const user = token ? await verifyToken(token) : null;

  const isApiRoute = pathname.startsWith('/api/');
  const isLoginRoute = pathname === '/login';

  // Check if pathname starts with any protected prefix
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );

  // 1. If authenticated user tries to access /login, redirect to /board
  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL('/board', request.url));
  }

  // 2. If unauthenticated user tries to access a protected route
  if (!user && isProtectedRoute) {
    if (isApiRoute) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Authentication token is missing or invalid' },
        { status: 401 }
      );
    } else {
      // Redirect UI requests to the login page
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

// Config to specify matching paths
export const config = {
  matcher: [
    '/board/:path*',
    '/dashboard/:path*',
    '/login',
    '/api/tasks/:path*',
    '/api/import/:path*',
    '/api/board/:path*',
    '/api/comments/:path*',
    '/api/stats/:path*',
    '/api/activity/:path*',
    '/api/users/:path*',
    '/api/stream/:path*',
  ],
};
