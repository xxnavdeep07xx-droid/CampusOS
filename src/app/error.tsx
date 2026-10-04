"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary for the public pages. The dashboard has its own
 * (richer) boundary in src/app/dashboard/error.tsx.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FDFBF7] px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-rose-400 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <AlertTriangle className="size-6 text-slate-900" />
      </span>
      <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 md:text-3xl">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm font-medium text-slate-600">
        The page failed to load. This is usually temporary — try again, and if it
        keeps happening send the reference below to your admin.
      </p>
      {error.digest ? (
        <code className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-600">
          ref: {error.digest}
        </code>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-transform hover:-translate-y-0.5"
        >
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border-2 border-slate-900 bg-[#FDFBF7] px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-transform hover:-translate-y-0.5"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
