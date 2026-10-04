/**
 * Environment helpers.
 *
 * CampusOS needs Supabase credentials before any auth or data call can work.
 * Instead of throwing a 500 deep inside a render, the app checks
 * `isSupabaseConfigured()` and shows a setup notice — so a fresh clone (or a
 * deploy with missing env vars) fails loudly *and* usefully.
 */

/** Values that only ever appear in templates / CI stubs. */
const PLACEHOLDER = /(your[-_]|placeholder|example\.com|changeme|^__|<|>)/i;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) return false;
  if (PLACEHOLDER.test(url) || PLACEHOLDER.test(anon)) return false;
  if (!/^https?:\/\//.test(url)) return false;

  return true;
}

/** True when the server-only service-role key is present (invites, admin reads). */
export function hasServiceRoleKey(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return Boolean(key) && !PLACEHOLDER.test(key);
}

/** True when the Google Drive integration is configured (all three vars set). */
export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

/** Absolute site URL, used for invite links, QR codes and sitemap entries. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
