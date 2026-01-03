import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/'];
const PROTECTED_PATHS = ['/dashboard'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Si intenta acceder a ruta protegida sin token, redirigir a login
  if (PROTECTED_PATHS.some(path => pathname.startsWith(path)) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si está en login/register con token, redirigir a dashboard
  if (PUBLIC_PATHS.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
