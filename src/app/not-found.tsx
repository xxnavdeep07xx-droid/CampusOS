import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = {
  title: "Page not found",
};

/**
 * Branded 404. Keeps people inside the app instead of dropping them on the
 * stock Next.js error screen.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FDFBF7] px-4 py-16 text-center">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-400 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <Compass className="size-6 text-slate-900" />
        </span>
        <span className="font-mono text-5xl font-black tracking-tight text-slate-900">404</span>
      </div>
      <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 md:text-3xl">
        This page isn&apos;t on the timetable
      </h1>
      <p className="max-w-md text-sm font-medium text-slate-600">
        The link may be outdated, or the invite behind it has already been used.
        Head back to the dashboard or the home page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl border-2 border-slate-900 bg-[#FDFBF7] px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-transform hover:-translate-y-0.5"
        >
          Home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border-2 border-slate-900 bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-transform hover:-translate-y-0.5"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
