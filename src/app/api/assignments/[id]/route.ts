import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Assignment } from "@/lib/types";

/**
 * PATCH /api/assignments/[id]
 *
 * Body: { title?, description?, dueDate? }
 *
 * Used by the teacher to edit an existing assignment's metadata.
 * Auth: caller must be the teacher of the assignment's class.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { title?: string; description?: string; dueDate?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Build the patch object — only include fields the client actually sent.
  // This allows partial updates (e.g. only changing the due date).
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (t.length < 2) {
      return NextResponse.json(
        { error: "Title must be at least 2 characters." },
        { status: 400 }
      );
    }
    patch.title = t;
  }
  if (body.description !== undefined) {
    patch.description = body.description.trim();
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null) {
      patch.due_date = null;
    } else {
      const d = new Date(body.dueDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "dueDate must be a valid ISO date string or null." },
          { status: 400 }
        );
      }
      patch.due_date = d.toISOString();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
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

  // Verify the caller is the teacher of the assignment's class.
  const { data: assignment, error: aErr } = await admin
    .from("assignments")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", id)
    .single();

  if (aErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const cls = (
    Array.isArray(assignment.classes) ? assignment.classes[0] : assignment.classes
  ) as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can edit assignments." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("assignments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update assignment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ assignment: updated as Assignment });
}

/**
 * DELETE /api/assignments/[id]
 *
 * Removes an assignment + (via CASCADE) all its submissions.
 *
 * Auth: caller must be the teacher of the assignment's class.
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

  const { data: assignment, error: aErr } = await admin
    .from("assignments")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", id)
    .single();

  if (aErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const cls = (
    Array.isArray(assignment.classes) ? assignment.classes[0] : assignment.classes
  ) as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can delete assignments." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("assignments").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
