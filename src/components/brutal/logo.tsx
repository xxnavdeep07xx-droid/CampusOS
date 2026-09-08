"use client";

import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BrutalLogo — the CampusOS wordmark.
 *
 * Uses the uploaded logo image (/logo.png) instead of a placeholder "C" box.
 */
export function BrutalLogo({
  className,
  size = "md",
  asLink = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}) {
  const sizes = {
    sm: { img: 28, text: "text-lg" },
    md: { img: 36, text: "text-xl" },
    lg: { img: 48, text: "text-3xl" },
  } as const;
  const s = sizes[size];

  const inner = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="CampusOS Logo"
        width={s.img}
        height={s.img}
        className="rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
        priority
      />
      <span
        className={cn(
          "font-black uppercase tracking-tight text-slate-900",
          s.text
        )}
      >
        Campus<span className="text-emerald-600">OS</span>
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link href="/" className="inline-flex">
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * BrutalAccent — a higher-impact variant of the shadcn Card for marketing pages.
 */
export function BrutalAccent({
  color = "bg-emerald-500",
  className,
  children,
}: {
  color?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full rounded-t-xl border-x-2 border-t-2 border-slate-900",
        color,
        className
      )}
    >
      {children}
    </div>
  );
}
