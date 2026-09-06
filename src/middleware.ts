import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * CampusOS middleware.
 *
 * Responsibilities:
 *   1. Refresh the Supabase session cookie on every request (so it stays alive
 *      while the user is active and expires when they're idle).
 *   2. Protect `/dashboard/*` routes — redirect unauthenticated users to /login.
 *   3. Bounce already-authenticated users away from `/login` and `/register/*`
 *      → send them to `/dashboard`.
 *
 * Note: the matcher below excludes _next/static, _next/image, favicon, and
 * any asset-like path so this only runs on real pages + API routes.
 */
export async function middleware(request: NextRequest) {
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

  // IMPORTANT: do not run any code between createServerClient and
  // supabase.auth.getUser — the cookie refresh happens here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  const isAuthRoute =
    path === "/login" || path.startsWith("/register");

  // Not logged in + trying to hit a protected route → bounce to /login.
  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Logged in + on an auth route (e.g. /login) → bounce to /dashboard.
  // Exception: /register/* routes that carry an invite token are still
  // allowed, so an authenticated principal can preview an invite link they
  // just generated.
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
    /*
     * Match all request paths except for:
     *   - _next/static       (static assets)
     *   - _next/image        (image optimization files)
     *   - favicon.*          (favicon files)
     *   - public assets      (*.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp, *.ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
