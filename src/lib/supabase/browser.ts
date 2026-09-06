import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Uses the @supabase/ssr createBrowserClient so that the session cookie is
 * automatically read/written across SSR + client navigation. Reads the
 * NEXT_PUBLIC_* env vars — safe to expose to the browser.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon || anon.startsWith("__")) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see supabase/README.md)."
    );
  }

  return createBrowserClient(url, anon);
}
