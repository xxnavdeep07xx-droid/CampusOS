import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * CampusOS middleware — OPTIMIZED for performance.
 *
 * Only runs on /dashboard/* and auth routes (not on every page/API route).
 * This avoids the Supabase getUser() call (which adds ~200ms per request)
 * on static pages like the landing page, API routes, and assets.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  const isAuthRoute = path === "/login" || path.startsWith("/register");

  // Skip middleware entirely for non-auth, non-dashboard routes.
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in + trying to hit a protected route → bounce to /login.
  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Logged in + on an auth route → bounce to /dashboard.
  const hasToken = request.nextUrl.searchParams.has("token");
  if (user && isAuthRoute && !(path.startsWith("/register") && hasToken)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Only run on dashboard + auth routes — skip everything else.
    "/dashboard/:path*",
    "/login",
    "/register/:path*",
  ],
};
