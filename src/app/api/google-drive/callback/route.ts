import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchGoogleUserInfo } from "@/lib/google-drive";

/**
 * GET /api/google-drive/callback?code=...&state=USER_ID
 *
 * Google redirects here after the teacher grants consent. We exchange the
 * auth code for tokens, fetch the user's Google profile info, and store
 * everything in the google_drive_connections table.
 *
 * After storing, redirect back to the Teacher Drive page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // teacher's user ID
  const error = url.searchParams.get("error");

  // User denied consent
  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/teacher/drive?google_error=access_denied", url.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/teacher/drive?google_error=missing_params", url.origin)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify the signed-in user matches the `state` (teacher ID we sent).
  if (!user || user.id !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/teacher/drive?google_error=auth_mismatch", url.origin)
    );
  }

  const redirectUri = `${url.origin}/api/google-drive/callback`;

  try {
    // Exchange the code for tokens.
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on the FIRST consent (when
      // prompt=consent is set, it should always return one). If missing,
      // the user may have previously connected and revoked — ask them to
      // reconnect from Google account settings.
      return NextResponse.redirect(
        new URL("/dashboard/teacher/drive?google_error=no_refresh_token", url.origin)
      );
    }

    // Fetch the Google user's profile info.
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    // Upsert the connection row (one per teacher — UNIQUE constraint on teacher_id).
    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from("google_drive_connections")
      .upsert(
        {
          teacher_id: user.id,
          google_user_id: userInfo.id,
          google_email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expires_at: expiresAt,
          scope: tokens.scope,
          picture_url: userInfo.picture,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "teacher_id" }
      );

    if (upsertErr) {
      console.error("Failed to store Google Drive connection:", upsertErr);
      return NextResponse.redirect(
        new URL("/dashboard/teacher/drive?google_error=storage_failed", url.origin)
      );
    }

    // Success — redirect back to the Drive page with a success flag.
    return NextResponse.redirect(
      new URL("/dashboard/teacher/drive?google_connected=1", url.origin)
    );
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/teacher/drive?google_error=${encodeURIComponent(
          err instanceof Error ? err.message : "unknown"
        )}`,
        url.origin
      )
    );
  }
}
