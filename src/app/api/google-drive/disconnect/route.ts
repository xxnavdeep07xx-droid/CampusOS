import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/google-drive/disconnect
 *
 * Removes the teacher's Google Drive connection (deletes the token row
 * from the DB). Does NOT revoke the tokens with Google — for that the
 * teacher would need to visit https://myaccount.google.com/permissions.
 *
 * Auth: caller must be signed in.
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

  const { error: delErr } = await admin
    .from("google_drive_connections")
    .delete()
    .eq("teacher_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
