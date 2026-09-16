import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/direct-messages/[id]
 *
 * Body: { readAt?: string | null } — set read_at to mark as read.
 * Currently only used to mark-as-read (read_at = now) when a message is
 * viewed. RLS enforces that only the recipient can update read_at.
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

  // Verify ownership — caller must be the recipient.
  const { data: existing } = await admin
    .from("direct_messages")
    .select("id, recipient_id, sender_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  const ex = existing as { id: string; recipient_id: string; sender_id: string };
  if (ex.recipient_id !== user.id) {
    return NextResponse.json(
      { error: "Only the recipient can mark a message as read." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("direct_messages")
    .update({ read_at: body.readAt === null ? null : body.readAt ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update message." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: updated });
}

/**
 * DELETE /api/direct-messages/[id]
 *
 * Soft-deletes the message on the caller's end. RLS allows either sender or
 * recipient to delete — but this is a hard delete in the current schema.
 * (Future: consider a `deleted_by_sender_at` + `deleted_by_recipient_at`
 * pattern if soft-delete is needed.)
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
    .from("direct_messages")
    .select("id, sender_id, recipient_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  const ex = existing as { id: string; sender_id: string; recipient_id: string };
  if (ex.sender_id !== user.id && ex.recipient_id !== user.id) {
    return NextResponse.json(
      { error: "Not authorized to delete this message." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("direct_messages").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
