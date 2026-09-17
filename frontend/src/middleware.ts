import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge Middleware for route protection.
 * Prevents unauthenticated users from accessing /dashboard and /portal routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // Protect /dashboard and all subroutes
  if (pathname.startsWith('/dashboard')) {
    if (!refreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect /portal and all subroutes
  if (pathname.startsWith('/portal')) {
    if (!refreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If authenticated user visits /login or /register, redirect to app
  if (pathname === '/login' || pathname === '/register') {
    if (refreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/portal/:path*',
    '/login',
    '/register',
  ],
};
