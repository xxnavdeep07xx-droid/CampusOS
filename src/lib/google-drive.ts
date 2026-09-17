/**
 * Google Drive OAuth helpers.
 *
 * This module centralizes all Google OAuth + Drive API configuration so the
 * routes don't repeat themselves. Tokens are stored in the
 * `google_drive_connections` table (migration 0014).
 *
 * Required env vars (set these in .env.local + Vercel):
 *   GOOGLE_CLIENT_ID       — OAuth client ID from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET   — OAuth client secret
 *   GOOGLE_REDIRECT_URI    — e.g. https://campusos-smoky.vercel.app/api/google-drive/callback
 *
 * Scopes requested:
 *   - https://www.googleapis.com/auth/drive.file — read/write files created
 *     by the app (doesn't see all of the user's Drive, only app-created files)
 *   - https://www.googleapis.com/auth/userinfo.email — get the user's email
 *   - https://www.googleapis.com/auth/userinfo.profile — get profile info
 *
 * For a broader "see all my Drive files" scope, swap drive.file → drive
 * (requires Google verification — drive.file is the safer default).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID env var is not set.");
  return id;
}

export function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET env var is not set.");
  return secret;
}

export function getGoogleRedirectUri(): string {
  // Allow override via env var, otherwise derive from the request origin.
  const explicit = process.env.GOOGLE_REDIRECT_URI;
  if (explicit) return explicit;
  // Fall back to a sensible default — the caller should pass the origin.
  return "https://campos-smoky.vercel.app/api/google-drive/callback";
}

export function isGoogleDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Build the Google OAuth consent URL.
 * `state` carries the teacher's user ID so the callback knows who to
 * store the tokens for. (Google ignores the state param — it's returned
 * verbatim in the redirect.)
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // request a refresh token
    prompt: "consent", // force consent so we always get a refresh_token
    state,
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/**
 * Exchange an authorization code for OAuth tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`
    );
  }
  return json as GoogleTokenResponse;
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token refresh failed: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`
    );
  }
  return json as GoogleTokenResponse;
}

/**
 * Fetch the Google user's profile info (id, email, name, picture).
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google userinfo fetch failed: HTTP ${res.status}`);
  }
  return json as GoogleUserInfo;
}
