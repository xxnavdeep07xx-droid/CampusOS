import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/book-issues/[id]
 * Body: { action: "return" }
 * Marks a book issue as returned. The DB trigger auto-increments available_copies.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { action?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "return") {
    return NextResponse.json({ error: "Only 'return' action is supported." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Fetch the issue + verify it's currently 'issued'.
  const { data: issue, error: iErr } = await admin.from("book_issues").select("id, status").eq("id", id).single();
  if (iErr || !issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }
  if ((issue as { status: string }).status !== "issued") {
    return NextResponse.json({ error: "This book has already been returned." }, { status: 400 });
  }

  // Update to 'returned' + set return_date. The DB trigger handles the
  // available_copies increment.
  const { data: updated, error: updErr } = await admin.from("book_issues").update({
    status: "returned", return_date: new Date().toISOString().slice(0, 10),
  }).eq("id", id).select("*").single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ issue: updated });
}
