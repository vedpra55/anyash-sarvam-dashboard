import { NextRequest, NextResponse } from "next/server";
import { isPublicPath, SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

/**
 * Next.js 16 Proxy convention (successor to middleware.ts).
 * Runs before requests to protect private operator dashboard routes while
 * keeping public onboarding flows and carrier webhooks open.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check if route is public
  if (isPublicPath(pathname)) {
    // If user is already authenticated and visits /login, redirect to dashboard
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token && (await verifySessionToken(token))) {
        const from = request.nextUrl.searchParams.get("from") || "/";
        const redirectUrl = new URL(from.startsWith("/") ? from : "/", request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
    return NextResponse.next();
  }

  // 2. Private route: verify session token
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  // 3. Unauthenticated access:
  // For API endpoints, return 401 Unauthorized JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized. Please unlock the dashboard session." },
      { status: 401 },
    );
  }

  // For UI pages, redirect to /login with return URL
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static build assets)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - static file extensions (svg, png, jpg, jpeg, gif, webp, otf, ttf, woff, woff2)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|otf|ttf|woff|woff2)$).*)",
  ],
};
