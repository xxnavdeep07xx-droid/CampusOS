import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { TransportAdminClient } from "@/components/brutal/transport-admin-client";
import type { Profile, TransportRoute, TransportStop } from "@/lib/types";

export default async function AdminTransportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");
  if (profile.role !== "principal" && profile.role !== "staff") redirect("/dashboard");

  const admin = createAdminClient();
  const schoolId = profile.school_id!;

  const { data: routeRows, error } = await admin.from("transport_routes")
    .select("*, stops:transport_stops(*)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const migrationMissing = !!error && /Could not find the table|does not exist/i.test(error.message);

  // Sort stops by position within each route.
  const routes = ((routeRows ?? []) as Array<TransportRoute & { stops?: TransportStop[] }>).map((r) => ({
    ...r,
    stops: (r.stops ?? []).sort((a, b) => a.position - b.position),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <Tag color="bg-sky-300"><Bus className="size-3.5" /> Transport Admin</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Transport Management</h1>
        <p className="text-sm font-medium text-slate-600">Create bus routes, add stops with timings, and manage student assignments.</p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">Phase 8 migration not applied yet</h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">transport_routes</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">transport_stops</code> tables don&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0008_transport_reports.sql</code> via the Supabase SQL editor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TransportAdminClient schoolId={schoolId} initialRoutes={routes} />
      )}
    </div>
  );
}
