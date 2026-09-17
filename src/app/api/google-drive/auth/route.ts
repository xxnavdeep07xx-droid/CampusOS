import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-drive";

/**
 * GET /api/google-drive/auth
 *
 * Redirects the teacher to Google's OAuth consent screen. After consent,
 * Google redirects back to /api/google-drive/callback with the auth code.
 *
 * The `state` param carries the teacher's user ID so the callback knows
 * who to store the tokens for. Google returns `state` verbatim.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Derive the redirect URI from the request origin (so it works on
  // localhost + any Vercel preview URL).
  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/google-drive/callback`;

  const authUrl = buildAuthUrl(redirectUri, user.id);
  return NextResponse.redirect(authUrl);
}
