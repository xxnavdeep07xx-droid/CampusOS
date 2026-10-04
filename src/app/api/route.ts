import { NextResponse } from "next/server";

/**
 * GET /api — service index.
 *
 * A tiny discovery document so hitting the API root in a browser or during a
 * smoke test returns something useful instead of a placeholder string.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      service: "CampusOS API",
      version: "1.0.0",
      documentation: "https://github.com/xxnavdeep07xx-droid/CampusOS",
      health: "/api/health",
      note: "All data endpoints require an authenticated Supabase session cookie.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
