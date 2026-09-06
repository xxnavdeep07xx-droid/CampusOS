import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Announcement, AnnouncementTag } from "@/lib/types";

/**
 * POST /api/announcements
 *
 * Body: { classId, title, content?, tag?, isPinned? }
 *
 * Auth: caller must be the teacher of the class OR a principal/staff of
 * the same school.
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
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

  const classId = body.classId?.trim();
  const title = body.title?.trim();
  const content = body.content?.trim() ?? "";
  const tag = (body.tag ?? "general") as AnnouncementTag;
  const isPinned = body.isPinned === true;

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
  if (!["important", "update", "assignment", "general"].includes(tag)) {
    return NextResponse.json(
      { error: `Invalid tag: ${tag}` },
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

  // Verify authorization via the class.
  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
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
      { error: "Only the teacher (or a school admin) can post announcements." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await supabase
    .from("announcements")
    .insert({
      class_id: classId,
      author_id: user.id,
      title,
      content,
      tag,
      is_pinned: isPinned,
    })
    .select("*")
    .single();

  if (insErr) {
    // Fall back to admin client (Phase 4 migration may not yet be applied).
    const { data: adminRow, error: adminErr } = await admin
      .from("announcements")
      .insert({
        class_id: classId,
        author_id: user.id,
        title,
        content,
        tag,
        is_pinned: isPinned,
      })
      .select("*")
      .single();
    if (adminErr || !adminRow) {
      return NextResponse.json(
        {
          error:
            "Could not create announcement. Make sure the Phase 4 migration has been applied — see supabase/README.md. " +
            (adminErr?.message ?? insErr.message),
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ announcement: adminRow as Announcement });
  }

  return NextResponse.json({ announcement: row as Announcement });
}

/**
 * GET /api/announcements?classId=...
 *
 * Returns the announcements for a class, ordered by is_pinned DESC then
 * created_at DESC. Includes the author's profile (id, full_name, role)
 * so the UI can render "by <name>" + a teacher badge.
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

  // Authorize: caller must be a class member.
  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, class_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view this class's announcements." },
      { status: 403 }
    );
  }

  const { data: rows, error } = await admin
    .from("announcements")
    .select("*, author:profiles!announcements_author_id_fkey(id, full_name, role)")
    .eq("class_id", classId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load announcements. Make sure the Phase 4 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ announcements: rows ?? [] });
}
