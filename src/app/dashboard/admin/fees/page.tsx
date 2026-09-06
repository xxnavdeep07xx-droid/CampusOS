import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import { StatCard } from "@/components/brutal/stat-card";
import { GenerateInvoiceModal } from "@/components/brutal/generate-invoice-modal";
import type { FeeInvoice, Profile, ClassRoom, InvoiceStatus } from "@/lib/types";
import { formatCurrency, invoiceStatusBgClass, invoiceStatusLabel } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Fee Management page at /dashboard/admin/fees.
 *
 * Principal/staff only. Shows:
 *   - Revenue summary cards (total collected, pending dues, overdue count)
 *   - Full invoice table for the school
 *   - Generate Invoice modal (batch by class or single student)
 */
export default async function FeeManagementPage() {
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
  if (profile.role !== "principal" && profile.role !== "staff") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const schoolId = profile.school_id!;

  // Fetch all invoices for the school + all classes + all students.
  const [
    { data: invoiceRows, error: invErr },
    { data: classRows },
    { data: studentRows },
  ] = await Promise.all([
    admin
      .from("fee_invoices")
      .select("*, student:profiles!fee_invoices_student_id_fkey(id, full_name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    admin.from("classes").select("id, name").eq("school_id", schoolId),
    admin
      .from("profiles")
      .select("id, full_name, class_id")
      .eq("school_id", schoolId)
      .eq("role", "student")
      .order("full_name", { ascending: true }),
  ]);

  const migrationMissing =
    !!invErr && /Could not find the table|does not exist/i.test(invErr.message);

  const invoices = (invoiceRows ?? []) as Array<
    FeeInvoice & {
      student?: { id: string; full_name: string } | null;
    }
  >;
  const classes = (classRows ?? []) as Pick<ClassRoom, "id" | "name">[];
  const students = (studentRows ?? []) as Pick<
    Profile,
    "id" | "full_name" | "class_id"
  >[];

  // Compute revenue stats.
  let totalCollected = 0;
  let totalPending = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  let pendingCount = 0;

  for (const inv of invoices) {
    const amount = parseFloat(String(inv.total_amount));
    if (inv.status === "paid") {
      totalCollected += amount;
    } else if (inv.status === "overdue") {
      totalOverdue += amount;
      overdueCount++;
    } else {
      totalPending += amount;
      pendingCount++;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <Tag color="bg-emerald-300">
          <DollarSign className="size-3.5" />
          Fee Management
        </Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Finance &amp; Invoicing
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Manage school fees, track payments, and generate invoices for
          students or entire classes.
        </p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 6 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">fee_invoices</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">payments</code> tables
              don&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0006_fees_parent_portal.sql</code>
              {" "}via the Supabase SQL editor. See{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Revenue summary cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              label="Total Collected"
              value={formatCurrency(totalCollected)}
              sublabel="From paid invoices"
              color="bg-emerald-400"
            />
            <StatCard
              icon={DollarSign}
              label="Pending Dues"
              value={formatCurrency(totalPending)}
              sublabel={`${pendingCount} pending invoice${pendingCount === 1 ? "" : "s"}`}
              color="bg-amber-300"
            />
            <StatCard
              icon={TrendingDown}
              label="Overdue"
              value={formatCurrency(totalOverdue)}
              sublabel={`${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`}
              color="bg-rose-400"
            />
          </div>

          {/* Generate + table */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-tight">
              All invoices ({invoices.length})
            </h2>
            <GenerateInvoiceModal
              schoolId={schoolId}
              classes={classes}
              students={students}
              onCreated={() => {
                /* server component — refresh handled by revalidate on next GET */
              }}
            />
          </div>

          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm font-bold text-slate-900">
                  No invoices yet
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Click &ldquo;Generate Invoice&rdquo; to create your first fee.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                  <TableHead className="text-center">Due Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const status = inv.status as InvoiceStatus;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                            {(inv.student?.full_name || "?").slice(0, 2)}
                          </div>
                          <span className="font-bold text-slate-900">
                            {inv.student?.full_name || "(no name)"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-slate-700">
                        {inv.title}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono font-black text-slate-900">
                          {formatCurrency(inv.total_amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">
                        {inv.due_date ? formatDate(inv.due_date) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                            invoiceStatusBgClass(status)
                          )}
                        >
                          {invoiceStatusLabel(status)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
