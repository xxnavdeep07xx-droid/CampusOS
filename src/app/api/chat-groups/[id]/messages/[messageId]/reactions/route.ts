import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> }
) {
  const params = await context.params;
  const groupId = params.id;
  const messageId = params.messageId;

  let body: { emoji?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const emoji = body.emoji?.trim();
  if (!emoji) return NextResponse.json({ error: "emoji is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Not a member of this group." }, { status: 403 });

  const { data: existing } = await admin
    .from("chat_group_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await admin.from("chat_group_message_reactions").delete().eq("id", (existing as { id: string }).id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "removed" });
  }

  const { error: insErr } = await admin.from("chat_group_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "added" });
}