import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CLASS_MATERIALS_BUCKET } from "@/lib/storage";

/**
 * DELETE /api/assignment-resources/[id]
 *
 * Removes an attachment. If it's a file, also deletes the underlying
 * storage object.
 *
 * Auth: caller must be the teacher of the assignment's class.
 */
export async function DELETE(
  _request: Request,
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

  const { data: existing } = await admin
    .from("assignment_resources")
    .select(`
      id,
      kind,
      storage_path,
      assignment:assignments!inner(
        class_id,
        classes!inner(teacher_id)
      )
    `)
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }
  const ex = existing as {
    id: string;
    kind: string;
    storage_path: string | null;
    assignment: any;
  };
  const cls = Array.isArray(ex.assignment?.classes) ? ex.assignment.classes[0] : ex.assignment?.classes;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can delete this resource." },
      { status: 403 }
    );
  }

  // If it's a file, delete from storage first.
  if (ex.kind === "file" && ex.storage_path) {
    const { error: storageErr } = await admin
      .storage
      .from(CLASS_MATERIALS_BUCKET)
      .remove([ex.storage_path]);
    if (storageErr) {
      console.warn("Storage delete failed:", storageErr.message);
    }
  }

  const { error: delErr } = await admin.from("assignment_resources").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
