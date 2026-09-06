import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  DollarSign,
  GraduationCap,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { StatCard } from "@/components/brutal/stat-card";
import { StatusBadge } from "@/components/brutal/status-toggle";
import type { Profile, AttendanceStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

/**
 * Parent Portal at /dashboard/parent.
 *
 * Server component. Fetches the caller's linked children (via the
 * parent_student_links table) and renders:
 *   - A child selector (if multiple children) — chunky toggle buttons
 *   - Academic overview: attendance % + gradebook average for the selected
 *     child (read-only widgets)
 *   - Financial summary: pending dues count + total owed
 *   - Quick links to /dashboard/parent/fees
 */
export default async function ParentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");
  if (profile.role !== "parent") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch linked children with their class info.
  const { data: links, error: linksErr } = await admin
    .from("parent_student_links")
    .select(
      "id, student:profiles!parent_student_links_student_id_fkey(id, full_name, role, class_id, classes(id, name))"
    )
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });

  const migrationMissing =
    !!linksErr && /Could not find the table|does not exist/i.test(linksErr.message);

  const children = (links ?? [])
    .map((l) => {
      const raw = l as unknown as {
        id: string;
        student:
          | (Profile & {
              classes?:
                | { id: string; name: string }
                | { id: string; name: string }[];
            })
          | null;
      };
      if (!raw.student) return null;
      const s = raw.student;
      const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      return {
        linkId: raw.id,
        id: s.id,
        full_name: s.full_name,
        class_id: s.class_id ?? null,
        class_name: cls?.name ?? null,
      };
    })
    .filter((c) => c !== null);

  const params = await searchParams;
  const selectedChildId =
    params.child ?? (children[0]?.id ?? "");

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0];

  if (migrationMissing) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-amber-200">
            <Users className="size-3.5" />
            Parent Portal
          </Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Welcome, {profile.full_name}
          </h1>
        </div>
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 6 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">parent_student_links</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">fee_invoices</code> tables
              don&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0006_fees_parent_portal.sql</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-amber-200">
            <Users className="size-3.5" />
            Parent Portal
          </Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Welcome, {profile.full_name}
          </h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              No children linked yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Ask your school administrator to link your child&apos;s profile to
              your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch the selected child's academic + financial data.
  let attendanceRate: number | null = null;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let gradebookPct: number | null = null;
  let pendingInvoices = 0;
  let totalOwed = 0;

  if (selectedChild) {
    // Attendance stats.
    const { data: attendanceRows } = await admin
      .from("attendance")
      .select("status")
      .eq("student_id", selectedChild.id);
    const att = (attendanceRows ?? []) as Array<{ status: AttendanceStatus }>;
    presentCount = att.filter((a) => a.status === "present").length;
    absentCount = att.filter((a) => a.status === "absent").length;
    lateCount = att.filter((a) => a.status === "late").length;
    const total = att.length;
    attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : null;

    // Gradebook percentage (from the class_gradebook view).
    const { data: gradebookRow } = await admin
      .from("class_gradebook")
      .select("percentage")
      .eq("student_id", selectedChild.id)
      .maybeSingle();
    gradebookPct =
      (gradebookRow as { percentage: number | null } | null)?.percentage ?? null;

    // Financial summary.
    const { data: invoiceRows } = await admin
      .from("fee_invoices")
      .select("id, total_amount, status")
      .eq("student_id", selectedChild.id)
      .neq("status", "paid");
    const pending = (invoiceRows ?? []) as Array<{
      id: string;
      total_amount: number;
      status: string;
    }>;
    pendingInvoices = pending.length;
    totalOwed = pending.reduce(
      (sum, inv) => sum + parseFloat(String(inv.total_amount)),
      0
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-amber-200">
          <Users className="size-3.5" />
          Parent Portal
        </Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Welcome, {profile.full_name}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Monitor your child&apos;s attendance, grades, and school fees.
        </p>
      </div>

      {/* Child selector — chunky toggle buttons */}
      {children.length > 1 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            Switch child
          </div>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => {
              const isSel = c.id === selectedChildId;
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/parent?child=${c.id}`}
                  className={`inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    isSel
                      ? "bg-emerald-500 text-[#FDFBF7] shadow-[3px_3px_0px_0px_rgba(5,150,105,1)]"
                      : "bg-white text-slate-700 hover:bg-amber-100"
                  }`}
                >
                  <GraduationCap className="size-4" />
                  {c.full_name}
                  {c.class_name && (
                    <span className={isSel ? "text-emerald-100" : "text-slate-500"}>
                      · {c.class_name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected child overview */}
      {selectedChild && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl border-[3px] border-slate-900 bg-amber-200 text-xl font-black uppercase text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              {selectedChild.full_name.slice(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                {selectedChild.full_name}
              </h2>
              {selectedChild.class_name && (
                <p className="text-sm font-bold text-slate-600">
                  Class: {selectedChild.class_name}
                </p>
              )}
            </div>
          </div>

          {/* Academic + financial stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              label="Attendance"
              value={attendanceRate == null ? "—" : `${attendanceRate}%`}
              sublabel={`${presentCount} present · ${absentCount} absent · ${lateCount} late`}
              color={
                attendanceRate == null
                  ? "bg-slate-300"
                  : attendanceRate >= 90
                  ? "bg-emerald-400"
                  : attendanceRate >= 75
                  ? "bg-amber-300"
                  : "bg-rose-400"
              }
            />
            <StatCard
              icon={GraduationCap}
              label="Gradebook avg"
              value={gradebookPct == null ? "—" : `${gradebookPct}%`}
              sublabel={gradebookPct == null ? "No grades yet" : "Across all assignments + quizzes"}
              color={
                gradebookPct == null
                  ? "bg-slate-300"
                  : gradebookPct >= 90
                  ? "bg-emerald-400"
                  : gradebookPct >= 75
                  ? "bg-amber-300"
                  : "bg-rose-400"
              }
            />
            <StatCard
              icon={DollarSign}
              label="Pending dues"
              value={formatCurrency(totalOwed)}
              sublabel={`${pendingInvoices} unpaid invoice${pendingInvoices === 1 ? "" : "s"}`}
              color={pendingInvoices > 0 ? "bg-amber-400" : "bg-emerald-400"}
            />
            <StatCard
              icon={Users}
              label="Children linked"
              value={children.length}
              sublabel={children.length === 1 ? "1 child" : `${children.length} children`}
              color="bg-sky-300"
            />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/parent/fees?child=${selectedChild.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[3px_3px_0px_0px_rgba(5,150,105,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(5,150,105,1)]"
            >
              <DollarSign className="size-4" strokeWidth={2.5} />
              View &amp; Pay Fees
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
