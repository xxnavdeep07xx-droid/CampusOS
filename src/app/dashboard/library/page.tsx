import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Library as LibraryIcon, Clock, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { BookCard } from "@/components/brutal/book-card";
import type { Book, BookIssue, Profile } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { daysUntilDue } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function StudentLibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const schoolId = profile.school_id!;

  // Fetch all books in the school + the student's current issues.
  const [{ data: bookRows, error: bErr }, { data: issueRows, error: iErr }] = await Promise.all([
    admin.from("books").select("*").eq("school_id", schoolId).order("title", { ascending: true }),
    admin.from("book_issues")
      .select("*, book:books!book_issues_book_id_fkey(id, title, author, cover_image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const books = (bookRows ?? []) as Book[];
  const issues = (issueRows ?? []) as Array<BookIssue & {
    book?: { id: string; title: string; author: string; cover_image_url: string | null };
  }>;
  const activeIssues = issues.filter((i) => i.status === "issued" || i.status === "overdue");
  const migrationMissing =
    (!!bErr && /Could not find the table|does not exist/i.test(bErr.message)) ||
    (!!iErr && /Could not find the table|does not exist/i.test(iErr.message));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300"><LibraryIcon className="size-3.5" /> Digital Library</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">E-Library Catalog</h1>
        <p className="text-sm font-medium text-slate-600">Browse your school&apos;s book inventory and track your issued books.</p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">Phase 7 migration not applied yet</h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">books</code> table doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ask your principal to apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0007_library_hr.sql</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* My Issued Books */}
          {activeIssues.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                <BookOpen className="size-5" strokeWidth={2.5} />
                My Issued Books ({activeIssues.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {activeIssues.map((issue) => {
                  const days = daysUntilDue(issue.due_date);
                  const isOverdue = days < 0;
                  const dueSoon = days >= 0 && days <= 3;
                  return (
                    <div key={issue.id} className={cn(
                      "overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
                      isOverdue && "border-rose-500"
                    )}>
                      <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", isOverdue ? "bg-rose-500" : dueSoon ? "bg-amber-400" : "bg-emerald-500")} />
                      <div className="flex items-center gap-3 p-3">
                        {/* Mini cover */}
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border-2 border-slate-900 bg-violet-200">
                          {issue.book?.cover_image_url ? (
                            <Image src={issue.book.cover_image_url} alt="" fill sizes="48px" className="object-cover" loading="lazy" />
                          ) : (
                            <BookOpen className="size-5 text-slate-700" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-bold text-slate-900">{issue.book?.title ?? "Unknown"}</h3>
                          <p className="truncate text-xs font-medium text-slate-500">{issue.book?.author}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <Clock className="size-3" />
                            <span className={isOverdue ? "text-rose-600" : dueSoon ? "text-amber-600" : "text-slate-600"}>
                              {isOverdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today!" : `${days} days left`}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">Due {formatDate(issue.due_date)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Catalog */}
          <section className="space-y-3">
            <h2 className="text-lg font-black uppercase tracking-tight">All Books ({books.length})</h2>
            {books.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <LibraryIcon className="mx-auto mb-3 size-10 text-slate-400" />
                <p className="text-sm font-bold text-slate-900">No books in the library yet</p>
                <p className="mt-1 text-xs font-medium text-slate-600">Your school hasn&apos;t added any books yet.</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {books.map((b) => <BookCard key={b.id} book={b} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
