import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, CLASS_MATERIALS_BUCKET } from "@/lib/storage";
import type { WhiteboardBoard, WhiteboardStroke } from "@/lib/types";

/**
 * GET /api/whiteboard-boards/[id]
 *
 * Returns a single board with its strokes_data. Used when opening a board
 * for editing/viewing.
 */
export async function GET(
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

  const { data: board, error } = await admin
    .from("whiteboard_boards")
    .select(`
      *,
      creator:profiles!whiteboard_boards_created_by_fkey(id, full_name),
      classes(id, name)
    `)
    .eq("id", id)
    .single();

  if (error || !board) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  // Verify authorization via the class.
  const b = board as any;
  const { data: cls } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", b.class_id)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id, class_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null; class_id: string | null } | null;

  const isTeacher = (cls as { teacher_id: string }).teacher_id === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === (cls as { school_id: string }).school_id;
  const isEnrolledStudent = caller?.role === "student" && caller?.class_id === b.class_id;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view this board." },
      { status: 403 }
    );
  }

  return NextResponse.json({ board: b });
}

/**
 * PATCH /api/whiteboard-boards/[id]
 *
 * Body: { name?, strokesData?, thumbnail? }
 *
 * - name: rename the board
 * - strokesData: save the canvas state (array of stroke objects)
 * - thumbnail: base64 PNG data URL — uploaded to class_materials as a thumbnail
 *
 * Auth: caller must be the teacher of the class or a school admin.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: {
    name?: string;
    strokesData?: WhiteboardStroke[];
    thumbnail?: string; // base64 data URL
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (n.length < 1 || n.length > 100) {
      return NextResponse.json(
        { error: "Name must be 1–100 characters." },
        { status: 400 }
      );
    }
    patch.name = n;
  }
  if (body.strokesData !== undefined) {
    // Validate it's an array (or null for "clear all")
    if (body.strokesData !== null && !Array.isArray(body.strokesData)) {
      return NextResponse.json(
        { error: "strokesData must be an array or null." },
        { status: 400 }
      );
    }
    patch.strokes_data = body.strokesData;
  }

  if (Object.keys(patch).length === 0 && !body.thumbnail) {
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

  // Verify ownership.
  const { data: existing } = await admin
    .from("whiteboard_boards")
    .select("id, class_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  const ex = existing as { id: string; class_id: string };

  const { data: cls } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", ex.class_id)
    .single();
  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;

  const isTeacher = (cls as { teacher_id: string })?.teacher_id === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === (cls as { school_id: string })?.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this class or a school admin can edit boards." },
      { status: 403 }
    );
  }

  // If a thumbnail was provided, upload it to class_materials.
  if (body.thumbnail) {
    const thumbPath = buildStoragePath(ex.class_id, `whiteboard-thumb-${id}.png`);
    // Decode base64 data URL → buffer
    const base64Data = body.thumbnail.split(",")[1] ?? "";
    const buffer = Buffer.from(base64Data, "base64");
    const { error: uploadErr } = await admin
      .storage
      .from(CLASS_MATERIALS_BUCKET)
      .upload(thumbPath, buffer, {
        contentType: "image/png",
        upsert: true, // overwrite the old thumbnail
      });
    if (uploadErr) {
      console.warn("Thumbnail upload failed:", uploadErr.message);
      // Don't fail the whole save — the strokes_data is more important
    } else {
      patch.thumbnail_path = thumbPath;
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from("whiteboard_boards")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update board." },
      { status: 500 }
    );
  }

  return NextResponse.json({ board: updated as WhiteboardBoard });
}

/**
 * DELETE /api/whiteboard-boards/[id]
 *
 * Permanently deletes a board. If a thumbnail exists in storage, it's
 * also removed (best-effort).
 *
 * Auth: caller must be the teacher of the class or a school admin.
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
    .from("whiteboard_boards")
    .select("id, class_id, thumbnail_path")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  const ex = existing as { id: string; class_id: string; thumbnail_path: string | null };

  const { data: cls } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", ex.class_id)
    .single();
  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;

  const isTeacher = (cls as { teacher_id: string })?.teacher_id === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === (cls as { school_id: string })?.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this class or a school admin can delete boards." },
      { status: 403 }
    );
  }

  // Delete the thumbnail from storage (best-effort).
  if (ex.thumbnail_path) {
    const { error: storageErr } = await admin
      .storage
      .from(CLASS_MATERIALS_BUCKET)
      .remove([ex.thumbnail_path]);
    if (storageErr) {
      console.warn("Thumbnail storage delete failed:", storageErr.message);
    }
  }

  const { error: delErr } = await admin.from("whiteboard_boards").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
