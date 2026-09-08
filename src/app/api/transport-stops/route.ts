import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TransportStop } from "@/lib/types";

/**
 * POST /api/transport-stops
 * Body: { routeId, stopName, pickupTime?, dropTime?, position? }
 */
export async function POST(request: Request) {
  let body: {
    routeId?: string; stopName?: string; pickupTime?: string;
    dropTime?: string; position?: number;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const routeId = body.routeId?.trim();
  const stopName = body.stopName?.trim();
  if (!routeId || !stopName) {
    return NextResponse.json({ error: "routeId and stopName are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile || (profile.role !== "principal" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Only principals/staff can create stops." }, { status: 403 });
  }

  // Verify the route belongs to the caller's school.
  const { data: route } = await admin.from("transport_routes").select("school_id").eq("id", routeId).single();
  if (!route || (route as { school_id: string }).school_id !== profile.school_id) {
    return NextResponse.json({ error: "Route not found or not in your school." }, { status: 403 });
  }

  // If position not provided, use the next available.
  let position = body.position;
  if (position == null) {
    const { count } = await admin.from("transport_stops").select("*", { count: "exact", head: true }).eq("route_id", routeId);
    position = count ?? 0;
  }

  const { data: row, error } = await admin.from("transport_stops").insert({
    route_id: routeId, stop_name: stopName,
    pickup_time: body.pickupTime || null, drop_time: body.dropTime || null,
    position,
  }).select("*").single();

  if (error) {
    return NextResponse.json({
      error: "Could not create stop. Make sure Phase 8 migration is applied. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ stop: row as TransportStop });
}

/**
 * GET /api/transport-stops?routeId=...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const routeId = url.searchParams.get("routeId");
  if (!routeId) return NextResponse.json({ error: "Missing routeId." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: stops, error } = await admin.from("transport_stops")
    .select("*")
    .eq("route_id", routeId)
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({
      error: "Could not load stops. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ stops: stops ?? [] });
}
