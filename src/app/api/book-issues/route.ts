import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BookIssue } from "@/lib/types";

/**
 * POST /api/book-issues
 * Body: { bookId, userId, dueDate? }
 * Issues a book. The DB trigger auto-decrements available_copies.
 * Checks available_copies > 0 before insert (returns 409 if 0).
 */
export async function POST(request: Request) {
  let body: { bookId?: string; userId?: string; dueDate?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const bookId = body.bookId?.trim();
  const userId = body.userId?.trim();
  if (!bookId || !userId) {
    return NextResponse.json({ error: "bookId and userId are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Check the book exists + has available copies.
  const { data: book, error: bErr } = await admin.from("books").select("id, available_copies").eq("id", bookId).single();
  if (bErr || !book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }
  if ((book as { available_copies: number }).available_copies <= 0) {
    return NextResponse.json({ error: "No copies available." }, { status: 409 });
  }

  // Compute due date (default 14 days from now).
  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = body.dueDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })();

  const { data: row, error: insErr } = await admin.from("book_issues").insert({
    book_id: bookId, user_id: userId, issue_date: issueDate, due_date: dueDate, status: "issued",
  }).select("*").single();

  if (insErr) {
    return NextResponse.json({
      error: "Could not issue book. Make sure Phase 7 migration is applied. " + insErr.message,
    }, { status: 500 });
  }
  return NextResponse.json({ issue: row as BookIssue });
}

/**
 * GET /api/book-issues?schoolId=... (admin: all issues in school)
 * GET /api/book-issues?userId=... (user: their own issues)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const userId = url.searchParams.get("userId");

  if (!schoolId && !userId) {
    return NextResponse.json({ error: "Provide either schoolId or userId." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  let query = admin.from("book_issues")
    .select("*, book:books!book_issues_book_id_fkey(id, title, author, cover_image_url), user:profiles!book_issues_user_id_fkey(id, full_name, role)")
    .order("created_at", { ascending: false });

  if (userId) {
    if (userId !== user.id) {
      // Check if caller is admin.
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "principal" && p?.role !== "staff") {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }
    query = query.eq("user_id", userId);
  } else if (schoolId) {
    // Admin mode — fetch issues for all books in the school.
    const { data: bookIds } = await admin.from("books").select("id").eq("school_id", schoolId);
    const ids = (bookIds ?? []).map((b) => (b as { id: string }).id);
    if (ids.length === 0) return NextResponse.json({ issues: [] });
    query = query.in("book_id", ids);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({
      error: "Could not load issues. Make sure Phase 7 migration is applied. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ issues: rows ?? [] });
}
