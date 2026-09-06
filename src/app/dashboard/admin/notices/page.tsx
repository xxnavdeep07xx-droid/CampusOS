import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "@/components/brutal/section";
import { NoticeBoardClient } from "@/components/brutal/notice-board-client";
import type { GlobalNotice, Profile } from "@/lib/types";

/**
 * Notice Board page at /dashboard/admin/notices.
 *
 * Principal/staff only. Shows a publish form + a list of existing notices.
 * Published notices appear as a banner at the top of every logged-in
 * user's dashboard (via the GlobalNoticeBanner component in the layout).
 */
export default async function NoticeBoardPage() {
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

  // Fetch all notices for this school (including inactive — the admin can
  // see the full history).
  const { data: noticeRows, error } = await admin
    .from("global_notices")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const migrationMissing =
    !!error && /Could not find the table|does not exist/i.test(error.message);

  const notices = (noticeRows ?? []) as GlobalNotice[];

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
        <Tag color="bg-amber-300">
          <Megaphone className="size-3.5" />
          Notice Board
        </Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Global notices
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Publish school-wide notices that appear as a banner at the top of
          every user&apos;s dashboard — students, teachers, and parents.
        </p>
      </div>

      {migrationMissing ? (
        <div className="overflow-hidden rounded-xl border-2 border-amber-500 bg-amber-50 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <div className="space-y-2 p-4">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 6 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">global_notices</code> table
              doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0006_fees_parent_portal.sql</code>
              {" "}via the Supabase SQL editor.
            </p>
          </div>
        </div>
      ) : (
        <NoticeBoardClient schoolId={schoolId} initialNotices={notices} />
      )}
    </div>
  );
}
