import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Resource, Assignment } from "@/lib/types";

/**
 * GET /api/class-data?classId=...&kind=resources|assignments
 *
 * Lightweight read endpoint used by the TeacherClassroomView client
 * component to refresh its data after a mutation (e.g. after publishing
 * a new resource or creating a new assignment).
 *
 * Auth: caller must be a member of the school that owns the class.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const kind = url.searchParams.get("kind");

  if (!classId || !kind) {
    return NextResponse.json(
      { error: "classId and kind are required." },
      { status: 400 }
    );
  }
  if (kind !== "resources" && kind !== "assignments") {
    return NextResponse.json(
      { error: "kind must be 'resources' or 'assignments'." },
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, school_id, role, class_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id, teacher_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (cls.school_id !== profile.school_id) {
    return NextResponse.json({ error: "Not in your school." }, { status: 403 });
  }

  if (profile.role === "student" && profile.class_id !== classId) {
    return NextResponse.json(
      { error: "You can only view data for the class you're enrolled in." },
      { status: 403 }
    );
  }

  if (kind === "resources") {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: data as Resource[] });
  } else {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: data as Assignment[] });
  }
}
