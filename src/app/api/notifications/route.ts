import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

/**
 * GET /api/notifications?filter=unread&limit=50
 *
 * Returns the caller's notifications, most recent first.
 *
 * Query params:
 *   - filter=unread  (optional) — only return notifications where read_at IS NULL
 *   - limit=N        (optional, default 50, max 200)
 *
 * Auth: caller must be signed in. RLS enforces recipient_id = auth.uid().
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam ?? "50"), 1), 200);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey(id, full_name, role)
    `)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "unread") {
    query = query.is("read_at", null);
  }

  const { data: rows, error } = await query;

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute unread count separately (faster than fetching all rows).
  const { count: unreadCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return NextResponse.json({
    notifications: rows as Notification[],
    unreadCount: unreadCount ?? 0,
  });
}
