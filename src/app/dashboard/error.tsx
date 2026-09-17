"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * error.tsx — catches unhandled errors thrown by any route segment below
 * the /dashboard/* tree. Rendered automatically by Next.js when a server
 * component or client component throws.
 *
 * Provides a "Try again" button that calls `reset()` (re-renders the
 * error boundary) and a "Back to dashboard" link as a fallback.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging — in production you'd send to Sentry/etc.
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md overflow-hidden border-rose-500 shadow-[4px_4px_0px_0px_rgba(244,63,94,1)]">
        <div className="h-2 w-full border-x-2 border-t-2 border-rose-500 bg-rose-400" />
        <CardContent className="space-y-3 py-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-rose-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <AlertTriangle className="size-6 text-rose-700" strokeWidth={2.5} />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
            Something went wrong
          </h2>
          <p className="text-xs font-medium text-slate-600">
            An unexpected error occurred while loading this page. The error
            has been logged — try again, or navigate back to the dashboard.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
              <RotateCw className="size-3.5" />
              Try again
            </Button>
            <Button type="button" variant="coral" size="sm" asChild>
              <a href="/dashboard">Back to dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
