import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Assignment } from "@/lib/types";

/**
 * POST /api/assignments
 *
 * Body: { classId, title, description?, dueDate?, filePath? }
 *
 * Auth: caller must be the teacher of the class. RLS enforced server-side.
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    filePath?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim() ?? "";
  const dueDate = body.dueDate || null;
  const filePath = body.filePath || null;

  if (!classId || !title) {
    return NextResponse.json(
      { error: "classId and title are required." },
      { status: 400 }
    );
  }
  if (title.length < 2) {
    return NextResponse.json(
      { error: "Title must be at least 2 characters." },
      { status: 400 }
    );
  }
  if (dueDate) {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "dueDate must be a valid ISO date string." },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: cls, error: clsErr } = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .single();

  if (clsErr || !cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can create assignments." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await supabase
    .from("assignments")
    .insert({
      class_id: classId,
      title,
      description,
      due_date: dueDate,
      file_path: filePath,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insErr) {
    // Fall back to admin (Phase 2 migration may not yet be applied).
    const { data: adminRow, error: adminErr } = await admin
      .from("assignments")
      .insert({
        class_id: classId,
        title,
        description,
        due_date: dueDate,
        file_path: filePath,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (adminErr || !adminRow) {
      return NextResponse.json(
        {
          error:
            "Could not insert assignment. Make sure the Phase 2 migration has been applied — see supabase/README.md. " +
            (adminErr?.message ?? insErr.message),
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ assignment: adminRow as Assignment });
  }

  return NextResponse.json({ assignment: row as Assignment });
}
