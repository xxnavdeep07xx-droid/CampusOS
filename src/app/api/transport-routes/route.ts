import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TransportRoute } from "@/lib/types";

/**
 * POST /api/transport-routes
 * Body: { schoolId, routeName, vehicleNumber?, driverName?, driverPhone? }
 */
export async function POST(request: Request) {
  let body: {
    schoolId?: string; routeName?: string; vehicleNumber?: string;
    driverName?: string; driverPhone?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const routeName = body.routeName?.trim();
  if (!schoolId || !routeName) {
    return NextResponse.json({ error: "schoolId and routeName are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile || (profile.role !== "principal" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Only principals/staff can create routes." }, { status: 403 });
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json({ error: "School mismatch." }, { status: 403 });
  }

  const { data: row, error } = await admin.from("transport_routes").insert({
    school_id: schoolId, route_name: routeName,
    vehicle_number: body.vehicleNumber?.trim() ?? "",
    driver_name: body.driverName?.trim() ?? "",
    driver_phone: body.driverPhone?.trim() ?? "",
  }).select("*").single();

  if (error) {
    return NextResponse.json({
      error: "Could not create route. Make sure Phase 8 migration is applied. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ route: row as TransportRoute });
}

/**
 * GET /api/transport-routes?schoolId=...
 * Returns all routes for the school, joined with their stops.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "Missing schoolId." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: routes, error } = await admin.from("transport_routes")
    .select("*, stops:transport_stops(*)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({
      error: "Could not load routes. Make sure Phase 8 migration is applied. " + error.message,
    }, { status: 500 });
  }

  // Sort stops by position within each route.
  const sorted = (routes ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    stops: Array.isArray(r.stops) ? (r.stops as Array<Record<string, unknown>>).sort((a, b) => (a.position as number) - (b.position as number)) : [],
  }));

  return NextResponse.json({ routes: sorted });
}
