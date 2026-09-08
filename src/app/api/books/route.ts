import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Book } from "@/lib/types";

/**
 * POST /api/books
 * Body: { schoolId, title, author?, isbn?, totalCopies?, coverImageUrl? }
 * Creates a new book. available_copies defaults to total_copies.
 */
export async function POST(request: Request) {
  let body: {
    schoolId?: string;
    title?: string;
    author?: string;
    isbn?: string;
    totalCopies?: number;
    coverImageUrl?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const title = body.title?.trim();
  const author = body.author?.trim() ?? "";
  const isbn = body.isbn?.trim() || null;
  const totalCopies = body.totalCopies ?? 1;
  const coverImageUrl = body.coverImageUrl?.trim() || null;

  if (!schoolId || !title) {
    return NextResponse.json({ error: "schoolId and title are required." }, { status: 400 });
  }
  if (totalCopies < 0) {
    return NextResponse.json({ error: "totalCopies must be >= 0." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).single();
  if (!profile || (profile.role !== "principal" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Only principals/staff can add books." }, { status: 403 });
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json({ error: "School mismatch." }, { status: 403 });
  }

  const { data: row, error: insErr } = await admin.from("books").insert({
    school_id: schoolId, title, author, isbn,
    total_copies: totalCopies, available_copies: totalCopies,
    cover_image_url: coverImageUrl,
  }).select("*").single();

  if (insErr) {
    return NextResponse.json({
      error: "Could not create book. Make sure Phase 7 migration is applied. " + insErr.message,
    }, { status: 500 });
  }
  return NextResponse.json({ book: row as Book });
}

/**
 * GET /api/books?schoolId=...&search=...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const search = url.searchParams.get("search");
  if (!schoolId) return NextResponse.json({ error: "Missing schoolId." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  let query = admin.from("books").select("*").eq("school_id", schoolId).order("title", { ascending: true });
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
  }
  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({
      error: "Could not load books. Make sure Phase 7 migration is applied. " + error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ books: rows ?? [] });
}
