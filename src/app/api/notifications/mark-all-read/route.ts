import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/mark-all-read
 *
 * Marks all of the caller's unread notifications as read.
 * No body required.
 *
 * Auth: caller must be signed in. RLS enforces recipient_id = auth.uid().
 */
export async function POST(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    markedRead: data?.length ?? 0,
  });
}
