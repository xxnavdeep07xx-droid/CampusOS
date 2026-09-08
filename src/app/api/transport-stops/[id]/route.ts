import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/transport-stops/[id]
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile || (profile.role !== "principal" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Only principals/staff can delete stops." }, { status: 403 });
  }

  // Verify the stop's route belongs to the caller's school.
  const { data: stop } = await admin.from("transport_stops")
    .select("route_id, route:transport_routes!inner(school_id)")
    .eq("id", id).single();
  if (!stop) return NextResponse.json({ error: "Stop not found." }, { status: 404 });

  const route = (stop as { route: { school_id: string } | { school_id: string }[] }).route;
  const schoolId = Array.isArray(route) ? route[0]?.school_id : route?.school_id;
  if (schoolId !== profile.school_id) {
    return NextResponse.json({ error: "Not in your school." }, { status: 403 });
  }

  const { error } = await admin.from("transport_stops").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
