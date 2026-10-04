import { NextResponse } from "next/server";
import { hasServiceRoleKey, isGoogleDriveConfigured, isSupabaseConfigured } from "@/lib/env";

/**
 * GET /api/health — liveness + configuration probe.
 *
 * Returns 200 whenever the server is up. `checks` reports which optional
 * integrations are wired up so a deploy can be verified with a single curl:
 *
 *   curl -s https://your-domain.com/api/health | jq
 *
 * Deliberately exposes booleans only — never the values of the keys.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const supabase = isSupabaseConfigured();

  return NextResponse.json(
    {
      status: "ok",
      service: "campusos",
      time: new Date().toISOString(),
      checks: {
        supabase,
        serviceRoleKey: hasServiceRoleKey(),
        googleDrive: isGoogleDriveConfigured(),
      },
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
