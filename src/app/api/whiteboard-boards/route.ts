import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WhiteboardBoard } from "@/lib/types";

/**
 * GET /api/whiteboard-boards?classId=...
 *
 * Returns all non-archived boards for a class, most recently updated first.
 *
 * Auth: caller must be the teacher of the class, a school admin, or an
 * enrolled student (read-only).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json(
      { error: "Missing classId query param." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify authorization via the class.
  const { data: cls } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", classId)
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
  const isEnrolledStudent = caller?.role === "student" && caller?.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view boards for this class." },
      { status: 403 }
    );
  }

  const { data: boards, error } = await admin
    .from("whiteboard_boards")
    .select(`
      *,
      creator:profiles!whiteboard_boards_created_by_fkey(id, full_name)
    `)
    .eq("class_id", classId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ boards: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ boards: boards as WhiteboardBoard[] });
}

/**
 * POST /api/whiteboard-boards
 *
 * Body: { classId, name }
 *
 * Creates a new empty board. Auth: caller must be the teacher of the class
 * or a school admin.
 */
export async function POST(request: Request) {
  let body: { classId?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const name = body.name?.trim();
  if (!classId || !name) {
    return NextResponse.json(
      { error: "classId and name are required." },
      { status: 400 }
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: "Name must be 100 characters or fewer." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify the caller is the teacher of the class or a school admin.
  const { data: cls } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;

  const isTeacher = (cls as { teacher_id: string }).teacher_id === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === (cls as { school_id: string }).school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this class or a school admin can create boards." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await admin
    .from("whiteboard_boards")
    .insert({
      class_id: classId,
      created_by: user.id,
      name,
      strokes_data: null,
      thumbnail_path: null,
    })
    .select("*")
    .single();

  if (insErr) {
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The whiteboard_boards table doesn't exist yet. Apply supabase/migrations/0013_whiteboard_boards.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ board: row as WhiteboardBoard });
}
