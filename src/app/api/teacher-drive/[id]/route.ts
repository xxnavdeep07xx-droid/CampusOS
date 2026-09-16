import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TEACHER_FILES_BUCKET } from "@/lib/storage";

/**
 * PATCH /api/teacher-drive/[id]
 *
 * Body: { name?, description?, folder?, sharedWithClassId? }
 *
 * Lets the teacher rename/move/re-describe/share a file in their personal
 * drive. Does NOT change the underlying storage path (renames are metadata-
 * only on the DB row — the actual file in storage keeps its UUID path).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: {
    name?: string;
    description?: string | null;
    folder?: string;
    sharedWithClassId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (n.length < 1) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    patch.name = n;
  }
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.folder !== undefined) patch.folder = body.folder.trim();
  if (body.sharedWithClassId !== undefined) {
    if (body.sharedWithClassId === null) {
      patch.shared_with_class_id = null;
    } else {
      // Verify the caller is the teacher of the class they're sharing with.
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
      }
      const admin = createAdminClient();
      const { data: clsRow } = await admin
        .from("classes")
        .select("teacher_id")
        .eq("id", body.sharedWithClassId)
        .single();
      const cls = clsRow as { teacher_id: string } | null;
      if (!cls) {
        return NextResponse.json({ error: "Class not found." }, { status: 404 });
      }
      if (cls.teacher_id !== user.id) {
        return NextResponse.json(
          { error: "You can only share files with classes you teach." },
          { status: 403 }
        );
      }
      patch.shared_with_class_id = body.sharedWithClassId;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("teacher_files")
    .select("id, owner_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if ((existing as { owner_id: string }).owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can edit this file." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("teacher_files")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update file." },
      { status: 500 }
    );
  }

  return NextResponse.json({ file: updated });
}

/**
 * DELETE /api/teacher-drive/[id]
 *
 * Removes the file from storage AND the DB row.
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
    .from("teacher_files")
    .select("id, owner_id, file_path")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const ex = existing as { id: string; owner_id: string; file_path: string };
  if (ex.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete this file." },
      { status: 403 }
    );
  }

  // Delete from storage (best-effort — don't fail the API call if the
  // file is already gone).
  const { error: storageErr } = await admin
    .storage
    .from(TEACHER_FILES_BUCKET)
    .remove([ex.file_path]);
  if (storageErr) {
    console.warn("Storage delete failed:", storageErr.message);
  }

  const { error: delErr } = await admin.from("teacher_files").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
