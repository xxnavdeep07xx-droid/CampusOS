import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LeaveRequest } from "@/lib/types";

/**
 * POST /api/leave-requests
 * Body: { schoolId, startDate, endDate, reason? }
 * Staff submits a leave request.
 */
export async function POST(request: Request) {
  let body: {
    schoolId?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const startDate = body.startDate;
  const endDate = body.endDate;
  const reason = body.reason?.trim() ?? "";

  if (!schoolId || !startDate || !endDate) {
    return NextResponse.json({ error: "schoolId, startDate, and endDate are required." }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "Start date must be before or equal to end date." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  if (profile.role !== "teacher" && profile.role !== "staff" && profile.role !== "principal") {
    return NextResponse.json({ error: "Only staff/teachers can request leave." }, { status: 403 });
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json({ error: "School mismatch." }, { status: 403 });
  }

  const { data: row, error: insErr } = await admin.from("leave_requests").insert({
    staff_id: user.id, school_id: schoolId,
    start_date: startDate, end_date: endDate, reason,
    status: "pending",
  }).select("*").single();

  if (insErr) {
    return NextResponse.json({
      error: "Could not submit leave request. Make sure Phase 7 migration is applied. " + insErr.message,
    }, { status: 500 });
  }
  return NextResponse.json({ leaveRequest: row as LeaveRequest });
}

/**
 * GET /api/leave-requests?schoolId=... (principal: all in school)
 * GET /api/leave-requests?staffId=... (staff: their own)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const staffId = url.searchParams.get("staffId");

  if (!schoolId && !staffId) {
    return NextResponse.json({ error: "Provide either schoolId or staffId." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  let query = admin.from("leave_requests")
    .select("*, staff:profiles!leave_requests_staff_id_fkey(id, full_name, role)")
    .order("created_at", { ascending: false });

  if (staffId) {
    if (staffId !== user.id) {
      return NextResponse.json({ error: "You can only view your own leave requests." }, { status: 403 });
    }
    query = query.eq("staff_id", staffId);
  } else if (schoolId) {
    const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
    if (!profile || (profile.role !== "principal" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Only principals/staff can view all leave requests." }, { status: 403 });
    }
    if (profile.school_id !== schoolId) {
      return NextResponse.json({ error: "School mismatch." }, { status: 403 });
    }
    query = query.eq("school_id", schoolId);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({
      error: "Could not load leave requests. Make sure Phase 7 migration is applied. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ leaveRequests: rows ?? [] });
}
