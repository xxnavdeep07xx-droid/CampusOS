import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/notices/[id]
 *
 * Deactivates a global notice (sets is_active = false). Only principals/staff
 * of the school that owns the notice can delete.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the notice + verify ownership.
  const { data: notice, error: nErr } = await admin
    .from("global_notices")
    .select("id, school_id")
    .eq("id", id)
    .single();
  if (nErr || !notice) {
    return NextResponse.json({ error: "Notice not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (
    (profile.role !== "principal" && profile.role !== "staff") ||
    profile.school_id !== notice.school_id
  ) {
    return NextResponse.json(
      { error: "Only principals/staff of this school can delete notices." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin
    .from("global_notices")
    .update({ is_active: false })
    .eq("id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
