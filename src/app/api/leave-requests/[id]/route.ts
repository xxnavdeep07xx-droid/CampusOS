import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LeaveStatus } from "@/lib/types";

/**
 * PATCH /api/leave-requests/[id]
 * Body: { status: 'approved' | 'rejected' }
 * Principal approves or rejects a leave request.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const newStatus = body.status as LeaveStatus | undefined;
  if (newStatus !== "approved" && newStatus !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Fetch the leave request + verify ownership (principal of the school).
  const { data: lr, error: lrErr } = await admin.from("leave_requests")
    .select("id, school_id").eq("id", id).single();
  if (lrErr || !lr) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile || profile.role !== "principal") {
    return NextResponse.json({ error: "Only principals can approve/reject leave requests." }, { status: 403 });
  }
  if (profile.school_id !== (lr as { school_id: string }).school_id) {
    return NextResponse.json({ error: "School mismatch." }, { status: 403 });
  }

  const { data: updated, error: updErr } = await admin.from("leave_requests").update({
    status: newStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
  }).eq("id", id).select("*").single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ leaveRequest: updated });
}
