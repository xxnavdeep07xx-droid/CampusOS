import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bus, Clock, MapPin, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import type { Profile, TransportRoute, TransportStop } from "@/lib/types";
import { formatTime } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Parent/Student Transport page at /dashboard/transport.
 *
 * Shows the student's assigned bus route + driver details + a timeline UI
 * of all stops on the route with pickup/drop times. Uses circular nodes
 * connected by thick vertical lines.
 *
 * For parents: shows the first linked child's transport. If the parent
 * has multiple children, they can switch via ?child= query param.
 * For students: shows their own transport.
 */
export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");

  const admin = createAdminClient();

  // Determine which student to show transport for.
  let studentProfile: Profile | null = null;

  if (profile.role === "student") {
    studentProfile = profile;
  } else if (profile.role === "parent") {
    // Fetch linked children.
    const { data: links } = await admin.from("parent_student_links")
      .select("id, student:profiles!parent_student_links_student_id_fkey(id, full_name, role, class_id, transport_stop_id, school_id)")
      .eq("parent_id", user.id).order("created_at", { ascending: true });

    const children = (links ?? []).map((l) => {
      const raw = l as unknown as {
        id: string;
        student: Profile | null;
      };
      return raw.student;
    }).filter((s): s is Profile => s !== null);

    const params = await searchParams;
    const selectedId = params.child ?? children[0]?.id ?? "";
    studentProfile = children.find((c) => c.id === selectedId) ?? children[0] ?? null;
  } else {
    redirect("/dashboard");
  }

  if (!studentProfile) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-sky-300"><Bus className="size-3.5" /> Transport</Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Bus Route</h1>
        </div>
        <Card><CardContent className="py-10 text-center">
          <Bus className="mx-auto mb-3 size-10 text-slate-400" />
          <p className="text-sm font-bold text-slate-900">No student linked yet</p>
        </CardContent></Card>
      </div>
    );
  }

  // Fetch the student's transport_stop_id → the stop → the route → all stops on the route.
  let route: (TransportRoute & { stops?: TransportStop[] }) | null = null;
  let studentStop: TransportStop | null = null;
  let migrationMissing = false;

  if (studentProfile.transport_stop_id) {
    // Fetch the student's stop.
    const { data: stopRow, error: sErr } = await admin.from("transport_stops")
      .select("*").eq("id", studentProfile.transport_stop_id).single();
    if (sErr && /Could not find the table|does not exist/i.test(sErr.message)) {
      migrationMissing = true;
    } else if (stopRow) {
      studentStop = stopRow as TransportStop;
      // Fetch the route + all its stops.
      const { data: routeRow, error: rErr } = await admin.from("transport_routes")
        .select("*, stops:transport_stops(*)").eq("id", studentStop.route_id).single();
      if (rErr && /Could not find the table|does not exist/i.test(rErr.message)) {
        migrationMissing = true;
      } else if (routeRow) {
        route = routeRow as TransportRoute & { stops?: TransportStop[] };
        if (route?.stops) {
          route.stops.sort((a, b) => a.position - b.position);
        }
      }
    }
  }

  if (migrationMissing) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-sky-300"><Bus className="size-3.5" /> Transport</Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Bus Route</h1>
        </div>
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">Phase 8 migration not applied yet</h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">transport_routes</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">transport_stops</code> tables don&apos;t exist yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        </div>
        <div className="space-y-2">
          <Tag color="bg-sky-300"><Bus className="size-3.5" /> Transport</Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">{studentProfile.full_name}&apos;s Bus Route</h1>
        </div>
        <Card><CardContent className="py-10 text-center">
          <Bus className="mx-auto mb-3 size-10 text-slate-400" />
          <p className="text-sm font-bold text-slate-900">No bus route assigned</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Your school hasn&apos;t assigned you to a bus route yet.</p>
        </CardContent></Card>
      </div>
    );
  }

  // Timeline UI.
  const stops = route.stops ?? [];
  const studentStopIndex = stops.findIndex((s) => s.id === studentStop?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>

      <div className="space-y-2">
        <Tag color="bg-sky-300"><Bus className="size-3.5" /> Transport</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">{studentProfile.full_name}&apos;s Bus Route</h1>
        <p className="text-sm font-medium text-slate-600">Your assigned route, driver details, and stop timings.</p>
      </div>

      {/* Route info card */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-sky-300" />
        <CardContent className="space-y-4 py-4">
          <h2 className="text-lg font-black uppercase tracking-tight">{route.route_name}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <User className="size-4 text-slate-900" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Driver</div>
                <div className="text-sm font-bold text-slate-900">{route.driver_name || "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-emerald-200 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <Phone className="size-4 text-slate-900" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Phone</div>
                <div className="text-sm font-bold text-slate-900">{route.driver_phone || "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-sky-200 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <Bus className="size-4 text-slate-900" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vehicle</div>
                <div className="text-sm font-bold text-slate-900">{route.vehicle_number || "—"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline of stops */}
      <div className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">Route Timeline</h2>
        <div className="rounded-xl border-2 border-slate-900 bg-white p-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-1 bg-slate-900" />
            <div className="space-y-6">
              {stops.map((stop, i) => {
                const isMyStop = stop.id === studentStop?.id;
                return (
                  <div key={stop.id} className="relative flex items-start gap-4">
                    {/* Circular node */}
                    <div className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-[3px] border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
                      isMyStop ? "bg-emerald-500" : i === 0 ? "bg-sky-300" : i === stops.length - 1 ? "bg-rose-400" : "bg-white"
                    )}>
                      {isMyStop && (
                        <MapPin className="size-3.5 text-[#FDFBF7]" strokeWidth={3} />
                      )}
                    </div>
                    {/* Stop details */}
                    <div className={cn(
                      "flex-1 rounded-lg border-2 p-3 transition-all",
                      isMyStop ? "border-emerald-500 bg-emerald-50 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]" : "border-slate-200 bg-[#FDFBF7]"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-black uppercase tracking-tight", isMyStop ? "text-emerald-700" : "text-slate-900")}>
                          {stop.stop_name}
                        </span>
                        {isMyStop && (
                          <span className="rounded-full border-2 border-slate-900 bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#FDFBF7]">
                            Your Stop
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {stop.pickup_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" /> Pickup: {formatTime(stop.pickup_time)}
                          </span>
                        )}
                        {stop.drop_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" /> Drop: {formatTime(stop.drop_time)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
