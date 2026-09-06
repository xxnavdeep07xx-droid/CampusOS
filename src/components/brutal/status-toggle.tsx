"use client";

import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

/**
 * StatusToggleGroup — a tri-state button group for marking a student's
 * attendance as Present / Absent / Late.
 *
 * - The selected button pops with its vibrant color (emerald present,
 *   coral absent, amber late).
 * - Unselected buttons are subtle white pills.
 * - Accessible: rendered as a radiogroup role with proper aria-pressed.
 *
 * Used by the AttendanceTaker component.
 */
export function StatusToggleGroup({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: AttendanceStatus | null;
  onChange: (next: AttendanceStatus) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const options: Array<{
    value: AttendanceStatus;
    label: string;
    icon: typeof Check;
    activeClass: string;
  }> = [
    {
      value: "present",
      label: "Present",
      icon: Check,
      activeClass: "bg-emerald-500 text-[#FDFBF7] border-emerald-600 shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]",
    },
    {
      value: "absent",
      label: "Absent",
      icon: X,
      activeClass: "bg-rose-500 text-[#FDFBF7] border-rose-600 shadow-[2px_2px_0px_0px_rgba(225,29,72,1)]",
    },
    {
      value: "late",
      label: "Late",
      icon: Clock,
      activeClass: "bg-amber-400 text-slate-900 border-amber-500 shadow-[2px_2px_0px_0px_rgba(217,119,6,1)]",
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Attendance status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#FDFBF7] p-1",
        size === "sm" ? "scale-90" : ""
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
              size === "sm" ? "px-2 py-1 text-[10px]" : "",
              isActive
                ? opt.activeClass
                : "border-transparent bg-transparent text-slate-600 hover:bg-amber-100 hover:text-slate-900",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Icon className="size-3.5" strokeWidth={3} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * StatusBadge — read-only status pill. Used in the attendance history list
 * and the principal's analytics widget.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const cfg: Record<AttendanceStatus, { bg: string; label: string }> = {
    present: { bg: "bg-emerald-500 text-[#FDFBF7]",   label: "Present" },
    absent:  { bg: "bg-rose-500 text-[#FDFBF7]",      label: "Absent"  },
    late:    { bg: "bg-amber-400 text-slate-900",     label: "Late"    },
  };
  const c = cfg[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
        c.bg,
        className
      )}
    >
      {c.label}
    </span>
  );
}
