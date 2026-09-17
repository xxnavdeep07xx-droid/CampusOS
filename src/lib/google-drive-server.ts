import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/google-drive";
import type { GoogleDriveConnection } from "@/lib/types";

/**
 * Get a valid (non-expired) Google access token for the given teacher.
 *
 * If the stored access token is still valid (not within 60s of expiry),
 * return it as-is. Otherwise, use the refresh token to get a new access
 * token, update the DB row, and return the new token.
 *
 * Returns null if the teacher has no Google Drive connection.
 *
 * Throws if the refresh fails (e.g. user revoked access).
 */
export async function getValidAccessToken(teacherId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: connRow } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("teacher_id", teacherId)
    .single();
  if (!connRow) return null;

  const conn = connRow as GoogleDriveConnection;

  // Check if the current access token is still valid (with a 60s buffer).
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  const now = Date.now();
  const bufferMs = 60_000; // refresh if expiring within 60s

  if (expiresAt - now > bufferMs) {
    return conn.access_token;
  }

  // Token expired (or about to) — refresh it.
  const newTokens = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  // Update the DB row with the new access token + expiry.
  await admin
    .from("google_drive_connections")
    .update({
      access_token: newTokens.access_token,
      expires_at: newExpiresAt,
      // Google sometimes returns a new refresh_token — store it if present.
      ...(newTokens.refresh_token ? { refresh_token: newTokens.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", teacherId);

  return newTokens.access_token;
}

/**
 * Fetch the teacher's Google Drive connection (for UI display).
 * Returns null if not connected.
 */
export async function getConnection(teacherId: string): Promise<GoogleDriveConnection | null> {
  const admin = createAdminClient();
  const { data: connRow } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("teacher_id", teacherId)
    .single();
  if (!connRow) return null;
  return connRow as GoogleDriveConnection;
}
