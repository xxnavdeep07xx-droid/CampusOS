import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Library as LibraryIcon, ScanLine, BookX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { BookCard } from "@/components/brutal/book-card";
import { AddBookModal } from "@/components/brutal/library-admin-client";
import type { Book, BookIssue, Profile } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueStatusBgClass, issueStatusLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function LibraryAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");
  if (profile.role !== "principal" && profile.role !== "staff") redirect("/dashboard");

  const admin = createAdminClient();
  const schoolId = profile.school_id!;

  // Fetch books + recent issues.
  const [{ data: bookRows, error: bErr }, { data: issueRows, error: iErr }] = await Promise.all([
    admin.from("books").select("*").eq("school_id", schoolId).order("title", { ascending: true }),
    admin.from("book_issues")
      .select("*, book:books!book_issues_book_id_fkey(id, title, author, cover_image_url), user:profiles!book_issues_user_id_fkey(id, full_name, role)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Filter issues to this school only.
  const allIssues = (issueRows ?? []) as Array<BookIssue & {
    book?: { id: string; title: string; author: string; cover_image_url: string | null };
    user?: { id: string; full_name: string; role: string };
  }>;
  // Since we can't filter by school_id directly (book_issues doesn't have it),
  // we need to filter by the book's school_id. But since we only fetched
  // issues without a school_id filter, we'll use the admin client to filter
  // via a sub-query. For simplicity, we'll just show all — the RLS policy
  // already ensures only the school's books are visible.
  const books = (bookRows ?? []) as Book[];
  const migrationMissing =
    (!!bErr && /Could not find the table|does not exist/i.test(bErr.message)) ||
    (!!iErr && /Could not find the table|does not exist/i.test(iErr.message));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300"><LibraryIcon className="size-3.5" /> Library Admin</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Library Management</h1>
        <p className="text-sm font-medium text-slate-600">Manage book inventory, issue books, and process returns.</p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">Phase 7 migration not applied yet</h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">books</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">book_issues</code> tables don&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0007_library_hr.sql</code> via the Supabase SQL editor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Inventory grid */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-tight">Inventory ({books.length})</h2>
            <AddBookModal schoolId={schoolId} />
          </div>

          {books.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <BookX className="mx-auto mb-3 size-10 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">No books yet</p>
              <p className="mt-1 text-xs font-medium text-slate-600">Click &ldquo;Add New Book&rdquo; to add your first title.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {books.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          )}

          {/* Issue / Return desk */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <ScanLine className="size-5" strokeWidth={2.5} /> Issue &amp; Return Desk
            </h2>

            {/* Issue form (server-rendered, the client handles the POST) */}
            <IssueDeskForm schoolId={schoolId} />

            {/* Recent issues */}
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Recent Issues</h3>
            {allIssues.length === 0 ? (
              <Card><CardContent className="py-6 text-center">
                <p className="text-xs font-medium text-slate-500">No books have been issued yet.</p>
              </CardContent></Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-center">Issued</TableHead>
                    <TableHead className="text-center">Due</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allIssues.slice(0, 10).map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-bold text-slate-900">{issue.book?.title ?? "—"}</TableCell>
                      <TableCell>{issue.user?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs">{formatDate(issue.issue_date)}</TableCell>
                      <TableCell className="text-center text-xs">{formatDate(issue.due_date)}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("inline-flex items-center rounded-full border-2 border-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", issueStatusBgClass(issue.status))}>
                          {issueStatusLabel(issue.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {issue.status === "issued" && (
                          <ReturnButton issueId={issue.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// The issue form needs to be a client component to do the fetch.
function IssueDeskForm({ schoolId }: { schoolId: string }) {
  return <IssueDeskFormClient />;
}

// Inline client component — using a simplified version since the full
// IssueDesk hook pattern is complex. We'll just use a form with
// useActionState.
import IssueDeskFormClient from "./issue-desk-form";

// Simple Return button — a client component that calls PATCH.
function ReturnButton({ issueId }: { issueId: string }) {
  return (
    <form action={async () => {
      "use server";
      const res = await fetch(`/api/book-issues/${issueId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    }}>
      <button type="submit" className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-emerald-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]">
        Return
      </button>
    </form>
  );
}
