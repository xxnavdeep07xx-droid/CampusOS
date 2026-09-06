import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/timetables/[id]
 *
 * Removes a single timetable slot.
 *
 * Auth: caller must be the teacher of the class that owns the slot.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the slot + its class to verify ownership.
  const { data: slot, error: slotErr } = await admin
    .from("timetables")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", id)
    .single();

  if (slotErr || !slot) {
    return NextResponse.json({ error: "Timetable slot not found." }, { status: 404 });
  }

  const cls = slot.classes as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can delete timetable slots." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("timetables").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json(
      { error: delErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
