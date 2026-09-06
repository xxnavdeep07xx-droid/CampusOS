import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { InvoiceCard } from "@/components/brutal/invoice-card";
import type { FeeInvoice, Profile } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

/**
 * Parent Financials at /dashboard/parent/fees.
 *
 * Server component. Lists pending + paid invoices for the selected child.
 * Each pending invoice has a "Pay Now" button that opens the mock checkout
 * modal in the InvoiceCard client component.
 */
export default async function ParentFeesPage({
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

  // Fetch linked children.
  const { data: links } = await admin
    .from("parent_student_links")
    .select(
      "id, student:profiles!parent_student_links_student_id_fkey(id, full_name)"
    )
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });

  const children = (links ?? [])
    .map((l) => {
      const raw = l as unknown as {
        id: string;
        student: { id: string; full_name: string } | null;
      };
      return raw.student
        ? { linkId: raw.id, id: raw.student.id, full_name: raw.student.full_name }
        : null;
    })
    .filter((c): c is { linkId: string; id: string; full_name: string } => c !== null);

  const params = await searchParams;
  const selectedChildId = params.child ?? children[0]?.id ?? "";
  const selectedChild = children.find((c) => c.id === selectedChildId);

  // Fetch invoices for the selected child.
  let invoices: FeeInvoice[] = [];
  let migrationMissing = false;

  if (selectedChild) {
    const { data: invoiceRows, error } = await admin
      .from("fee_invoices")
      .select("*")
      .eq("student_id", selectedChild.id)
      .order("created_at", { ascending: false });

    migrationMissing =
      !!error && /Could not find the table|does not exist/i.test(error.message);
    invoices = (invoiceRows ?? []) as FeeInvoice[];
  }

  const pending = invoices.filter((i) => i.status !== "paid");
  const paid = invoices.filter((i) => i.status === "paid");
  const totalPending = pending.reduce(
    (s, i) => s + parseFloat(String(i.total_amount)),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/parent"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to parent dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <Tag color="bg-emerald-300">
          <DollarSign className="size-3.5" />
          Fees &amp; Payments
        </Tag>
        {selectedChild && (
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            {selectedChild.full_name}&apos;s invoices
          </h1>
        )}
        <p className="text-sm font-medium text-slate-600">
          Pay pending invoices or view past payments. Each payment is processed
          instantly via our mock checkout.
        </p>
      </div>

      {/* Child selector (if multiple) */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => {
            const isSel = c.id === selectedChildId;
            return (
              <Link
                key={c.id}
                href={`/dashboard/parent/fees?child=${c.id}`}
                className={`inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  isSel
                    ? "bg-emerald-500 text-[#FDFBF7] shadow-[3px_3px_0px_0px_rgba(5,150,105,1)]"
                    : "bg-white text-slate-700 hover:bg-amber-100"
                }`}
              >
                {c.full_name}
              </Link>
            );
          })}
        </div>
      )}

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 6 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">fee_invoices</code> table
              doesn&apos;t exist yet.
            </p>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Receipt className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              No invoices yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              When your school issues a fee, it will appear here with a Pay Now button.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending summary */}
          {pending.length > 0 && (
            <div className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-700">
                  Pending dues
                </span>
                <span className="font-mono text-2xl font-black text-slate-900">
                  {formatCurrency(totalPending)}
                </span>
              </div>
            </div>
          )}

          {/* Pending invoices */}
          {pending.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Pending ({pending.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {pending.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    studentName={selectedChild?.full_name}
                    canPay
                  />
                ))}
              </div>
            </section>
          )}

          {/* Paid invoices */}
          {paid.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Paid ({paid.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {paid.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    studentName={selectedChild?.full_name}
                    canPay={false}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
