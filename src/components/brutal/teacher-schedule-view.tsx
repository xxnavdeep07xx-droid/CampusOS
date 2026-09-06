"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeekGrid } from "@/components/brutal/week-grid";
import type { ClassRoom, Timetable } from "@/lib/types";

/**
 * TeacherScheduleView — client wrapper around WeekGrid that handles
 * refresh after a slot is added or deleted.
 *
 * The server component passes initialSlots (server-rendered) so the first
 * paint is instant. After mutations, we call router.refresh() to re-fetch
 * server-side.
 */
export function TeacherScheduleView({
  initialSlots,
  teacherClasses,
  canEdit = false,
  migrationMissing = false,
}: {
  initialSlots: Array<Timetable & { classes?: { name: string } | null }>;
  teacherClasses: Pick<ClassRoom, "id" | "name">[];
  canEdit?: boolean;
  migrationMissing?: boolean;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
          {initialSlots.length} {initialSlots.length === 1 ? "slot" : "slots"} across {teacherClasses.length}{" "}
          {teacherClasses.length === 1 ? "class" : "classes"}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing || migrationMissing}
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <WeekGrid
        slots={initialSlots}
        canEdit={canEdit}
        teacherClasses={teacherClasses}
        onSlotCreated={refresh}
        onSlotDeleted={refresh}
      />
    </div>
  );
}
