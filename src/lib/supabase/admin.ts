import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * BYPASSES Row Level Security. Only import this in:
 *   - server-side route handlers (app/api/star-star/route.ts)
 *   - server actions
 *   - middleware (when you need to look up invitation tokens without a session)
 *
 * NEVER import this from a Client Component, never leak it into the browser
 * bundle, and never log its keys.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole || serviceRole.startsWith("__")) {
    throw new Error(
      "Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local (see supabase/README.md)."
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
