import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * GET /api/parent-students
 *
 * Returns the caller's linked children (students) with their denormalized
 * profile + class name. Used by the Parent Portal to render the student
 * selector + academic overview.
 *
 * If the caller is not a parent, returns 403.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.role !== "parent") {
    return NextResponse.json(
      { error: "Only parents can access this endpoint." },
      { status: 403 }
    );
  }

  // Fetch linked students, joined with their profile + class name.
  const { data: links, error } = await admin
    .from("parent_student_links")
    .select(
      "id, student:profiles!parent_student_links_student_id_fkey(id, full_name, role, class_id, classes(id, name))"
    )
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load linked students. Make sure the Phase 6 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  // Normalize the nested relation (PostgREST returns arrays for !inner
  // joins sometimes, objects for single FKs — handle both).
  const students = (links ?? []).map((l) => {
    const raw = l as unknown as {
      id: string;
      student:
        | (Profile & { classes?: { id: string; name: string } | { id: string; name: string }[] })
        | null;
    };
    const s = raw.student;
    if (!s) return null;
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
    return {
      linkId: raw.id,
      id: s.id,
      full_name: s.full_name,
      class_id: s.class_id ?? null,
      class_name: cls?.name ?? null,
    };
  }).filter((s) => s !== null);

  return NextResponse.json({ students });
}
