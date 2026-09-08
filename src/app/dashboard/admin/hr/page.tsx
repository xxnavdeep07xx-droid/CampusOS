import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { LeaveRequestKanban } from "@/components/brutal/leave-kanban";
import type { LeaveRequest, Profile } from "@/lib/types";

export default async function HRPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");
  if (profile.role !== "principal" && profile.role !== "staff") redirect("/dashboard");

  const admin = createAdminClient();
  const schoolId = profile.school_id!;

  const { data: rows, error } = await admin.from("leave_requests")
    .select("*, staff:profiles!leave_requests_staff_id_fkey(id, full_name, role)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const migrationMissing = !!error && /Could not find the table|does not exist/i.test(error.message);
  const requests = (rows ?? []) as LeaveRequest[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-amber-300"><ClipboardList className="size-3.5" /> HR — Leave Requests</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Staff Leave Management</h1>
        <p className="text-sm font-medium text-slate-600">Approve or reject leave requests from teachers and staff.</p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">Phase 7 migration not applied yet</h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">leave_requests</code> table doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0007_library_hr.sql</code> via the Supabase SQL editor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <LeaveRequestKanban initialRequests={requests} />
      )}
    </div>
  );
}
