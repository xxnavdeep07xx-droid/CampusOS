import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/chat-groups/[id]/messages/[messageId]
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; messageId: string }> }
) {
  const params = await context.params;
  const groupId = params.id;
  const messageId = params.messageId;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: msg } = await admin
    .from("chat_group_messages")
    .select("id, sender_id, group_id")
    .eq("id", messageId)
    .eq("group_id", groupId)
    .single();

  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const isSender = (msg as any).sender_id === user.id;
  if (!isSender) {
    const { data: membership } = await admin
      .from("chat_group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = (membership as any)?.role === "admin";
    if (!isAdmin) {
      const { data: groupRow } = await admin.from("chat_groups").select("school_id").eq("id", groupId).single();
      const { data: callerRow } = await admin.from("profiles").select("role, school_id").eq("id", user.id).single();
      const caller = callerRow as { role: string; school_id: string | null } | null;
      const group = groupRow as { school_id: string } | null;
      const isSchoolAdmin = (caller?.role === "principal" || caller?.role === "staff") && caller?.school_id === group?.school_id;
      if (!isSchoolAdmin) {
        return NextResponse.json({ error: "Only the sender or a group admin can delete this message." }, { status: 403 });
      }
    }
  }

  const { error: delErr } = await admin.from("chat_group_messages").delete().eq("id", messageId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}