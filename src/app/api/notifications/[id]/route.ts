import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/notifications/[id]
 *
 * Body: { readAt?: string | null }
 *
 * Marks a single notification as read (or unread if readAt=null).
 *
 * Auth: caller must be the notification's recipient (RLS-enforced).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { readAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.readAt === undefined) {
    return NextResponse.json({ error: "Only readAt is patchable." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify ownership (defense in depth — RLS also enforces this).
  const { data: existing } = await admin
    .from("notifications")
    .select("id, recipient_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
  if ((existing as { recipient_id: string }).recipient_id !== user.id) {
    return NextResponse.json(
      { error: "Only the recipient can update this notification." },
      { status: 403 }
    );
  }

  const readAt = body.readAt === null ? null : body.readAt ?? new Date().toISOString();

  const { data: updated, error: updateErr } = await admin
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update notification." },
      { status: 500 }
    );
  }

  return NextResponse.json({ notification: updated });
}

/**
 * DELETE /api/notifications/[id]
 *
 * Permanently deletes a notification (recipient-only).
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
    .from("notifications")
    .select("id, recipient_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
  if ((existing as { recipient_id: string }).recipient_id !== user.id) {
    return NextResponse.json(
      { error: "Only the recipient can delete this notification." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("notifications").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
