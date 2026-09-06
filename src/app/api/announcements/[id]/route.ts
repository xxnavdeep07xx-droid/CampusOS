import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/announcements/[id]
 *
 * Body: { title?, content?, tag?, isPinned? }
 *
 * Used by the teacher to:
 *   - toggle is_pinned (Pin to Top / Unpin)
 *   - edit title/content/tag
 *
 * Auth: caller must be the teacher of the class that owns the announcement.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: {
    title?: string;
    content?: string;
    tag?: string;
    isPinned?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the announcement + its class to verify ownership.
  const { data: ann, error: annErr } = await admin
    .from("announcements")
    .select("id, class_id, classes!inner(teacher_id, school_id)")
    .eq("id", id)
    .single();

  if (annErr || !ann) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray(ann.classes) ? ann.classes[0] : ann.classes
  ) as { teacher_id: string; school_id: string } | null;
  if (!cls) {
    return NextResponse.json(
      { error: "Could not verify class ownership." },
      { status: 500 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher (or a school admin) can edit announcements." },
      { status: 403 }
    );
  }

  // Build the update payload from the provided fields.
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = String(body.title).trim();
  if (body.content !== undefined) update.content = String(body.content).trim();
  if (body.tag !== undefined) {
    if (!["important", "update", "assignment", "general"].includes(body.tag)) {
      return NextResponse.json(
        { error: `Invalid tag: ${body.tag}` },
        { status: 400 }
      );
    }
    update.tag = body.tag;
  }
  if (body.isPinned !== undefined) update.is_pinned = body.isPinned === true;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await admin
    .from("announcements")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update announcement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ announcement: updated });
}

/**
 * DELETE /api/announcements/[id]
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
  const { data: ann } = await admin
    .from("announcements")
    .select("id, class_id, classes!inner(teacher_id, school_id)")
    .eq("id", id)
    .single();
  if (!ann) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray(ann.classes) ? ann.classes[0] : ann.classes
  ) as { teacher_id: string; school_id: string } | null;
  if (!cls) {
    return NextResponse.json(
      { error: "Could not verify class ownership." },
      { status: 500 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher (or a school admin) can delete announcements." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("announcements").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
