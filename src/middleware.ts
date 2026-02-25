import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const loggedIn = request.headers.get('cookie')?.includes('mc_logged_in=true');
  if (!loggedIn && request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
