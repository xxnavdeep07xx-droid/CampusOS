"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * ToolButton — chunky neo-brutalist toolbar button with active-state
 * highlight + tooltip.
 *
 * Used by the Whiteboard floating dock for pen / highlighter / eraser /
 * shape / text / undo / redo / clear / background / export buttons.
 */
export function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
  activeClass = "bg-emerald-500 text-[#FDFBF7] border-emerald-600",
  inactiveClass = "bg-white text-slate-900 hover:bg-amber-100",
  size = "md",
  accentColor,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  activeClass?: string;
  inactiveClass?: string;
  size?: "sm" | "md" | "lg";
  /** Optional color swatch shown above the icon (used by the color picker). */
  accentColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const sizes = {
    sm: "size-8 [&_svg]:size-3.5",
    md: "size-10 [&_svg]:size-4",
    lg: "size-12 [&_svg]:size-5",
  } as const;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all",
          "hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
          "active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
          sizes[size],
          active ? activeClass : inactiveClass
        )}
      >
        {accentColor && (
          <span
            aria-hidden
            className="absolute left-1 top-1 size-2 rounded-full border border-slate-900"
            style={{ background: accentColor }}
          />
        )}
        <Icon strokeWidth={2.5} />
      </button>

      {hovered && !disabled && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-slate-900 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
        >
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * ToolDivider — vertical separator in the floating dock.
 */
export function ToolDivider() {
  return (
    <div
      aria-hidden
      className="mx-0.5 h-8 w-0.5 self-center rounded-full bg-slate-900/30"
    />
  );
}
