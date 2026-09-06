import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClassMessage } from "@/lib/types";

/**
 * POST /api/class-messages
 *
 * Body: { classId, content }
 *
 * Auth: caller must be a member of the class's school (student enrolled in
 * the class, the teacher, or a principal/staff of the school).
 */
export async function POST(request: Request) {
  let body: { classId?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const content = body.content?.trim();
  if (!classId || !content) {
    return NextResponse.json(
      { error: "classId and content are required." },
      { status: 400 }
    );
  }
  if (content.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (max 2000 characters)." },
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

  // Authorization:
  //   - Teacher of this class ✓
  //   - Principal / staff of the school ✓
  //   - Student enrolled in THIS class ✓
  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "You can only send messages to classes you're a member of." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await supabase
    .from("class_messages")
    .insert({
      class_id: classId,
      sender_id: user.id,
      content,
    })
    .select("*")
    .single();

  if (insErr) {
    // Fall back to admin client (Phase 4 migration may not yet be applied).
    const { data: adminRow, error: adminErr } = await admin
      .from("class_messages")
      .insert({
        class_id: classId,
        sender_id: user.id,
        content,
      })
      .select("*")
      .single();
    if (adminErr || !adminRow) {
      return NextResponse.json(
        {
          error:
            "Could not send message. Make sure the Phase 4 migration has been applied — see supabase/README.md. " +
            (adminErr?.message ?? insErr.message),
        },
        { status: 500 }
      );
    }
    // Return the row + the caller's profile so the chat UI doesn't need
    // a second round-trip to display the sender name + role badge.
    return NextResponse.json({
      message: {
        ...(adminRow as ClassMessage),
        sender: { id: user.id, full_name: profile.full_name, role: profile.role },
      },
    });
  }

  return NextResponse.json({
    message: {
      ...(row as ClassMessage),
      sender: { id: user.id, full_name: profile.full_name, role: profile.role },
    },
  });
}

/**
 * GET /api/class-messages?classId=...
 *
 * Returns the most recent N messages (default 100) for the class, oldest
 * first so the chat UI can append to the bottom. Joined with the sender's
 * profile so the UI can render names + teacher badges.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

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
      { error: "Not authorized to view this class's messages." },
      { status: 403 }
    );
  }

  // Fetch the most recent N messages, oldest first.
  const { data: rows, error } = await admin
    .from("class_messages")
    .select("*, sender:profiles!class_messages_sender_id_fkey(id, full_name, role)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load messages. Make sure the Phase 4 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  // Reverse so the chat UI can append newest messages to the bottom.
  const messages = (rows ?? []).slice().reverse();
  return NextResponse.json({ messages });
}
