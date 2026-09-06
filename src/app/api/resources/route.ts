import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Resource } from "@/lib/types";

/**
 * POST /api/resources
 *
 * Body: { classId, title, description, filePath, fileSize?, mimeType? }
 *
 * Auth: caller must be the teacher of the class (RLS will enforce server-side
 * too, but we check eagerly for a friendlier error).
 *
 * Returns the inserted Resource row.
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
    title?: string;
    description?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim() ?? "";
  const filePath = body.filePath?.trim();
  const fileSize = body.fileSize ?? null;
  const mimeType = body.mimeType ?? null;

  if (!classId || !title || !filePath) {
    return NextResponse.json(
      { error: "classId, title, and filePath are required." },
      { status: 400 }
    );
  }
  if (title.length < 2) {
    return NextResponse.json(
      { error: "Title must be at least 2 characters." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  // Confirm the caller is the teacher of this class. Use the service-role
  // client to bypass any RLS check — we want to verify ownership, not the
  // RLS policy (which already enforces it but returns 0 rows on denial).
  const admin = createAdminClient();
  const { data: cls, error: clsErr } = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .single();

  if (clsErr || !cls) {
    return NextResponse.json(
      { error: "Class not found." },
      { status: 404 }
    );
  }
  if (cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can add resources." },
      { status: 403 }
    );
  }

  // Insert via the user's session client (RLS will pass since they're the
  // teacher). Fall back to admin if RLS is missing (e.g. migration not yet
  // applied).
  const { data: row, error: insErr } = await supabase
    .from("resources")
    .insert({
      class_id: classId,
      title,
      description,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insErr) {
    // Retry via admin client in case the table doesn't exist or RLS isn't
    // set up (Phase 2 migration not yet applied).
    const { data: adminRow, error: adminErr } = await admin
      .from("resources")
      .insert({
        class_id: classId,
        title,
        description,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (adminErr || !adminRow) {
      return NextResponse.json(
        {
          error:
            "Could not insert resource. Make sure the Phase 2 migration has been applied — see supabase/README.md. " +
            (adminErr?.message ?? insErr.message),
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ resource: adminRow as Resource });
  }

  return NextResponse.json({ resource: row as Resource });
}

/**
 * DELETE /api/resources?id=...
 *
 * Removes the resource row + the underlying storage object.
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id query param." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the row + class.teacher_id to verify ownership.
  const { data: row, error: rowErr } = await admin
    .from("resources")
    .select("id, file_path, classes(teacher_id)")
    .eq("id", id)
    .single();

  if (rowErr || !row) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const cls = row.classes as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can delete resources." },
      { status: 403 }
    );
  }

  // Delete the storage object (best-effort — don't fail the API call if the
  // file is already gone).
  const { error: storageErr } = await admin.storage
    .from("class_materials")
    .remove([row.file_path]);
  if (storageErr) {
    console.warn("Storage delete failed:", storageErr.message);
  }

  // Delete the database row.
  const { error: delErr } = await admin.from("resources").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
