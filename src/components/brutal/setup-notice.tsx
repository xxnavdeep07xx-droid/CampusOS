import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

/**
 * SetupNotice — shown instead of the app UI when the Supabase environment
 * variables are missing.
 *
 * A fresh clone (or a deploy with no env vars) previously failed with a
 * generic 500. This makes the failure actionable for whoever is deploying.
 */
export function SetupNotice({ compact = false }: { compact?: boolean }) {
  const steps = [
    "Copy .env.example to .env.local",
    "Paste your Supabase project URL + anon key",
    "Add the service_role key (server-only) for invites",
    "Apply supabase/migrations/*.sql in the Supabase SQL editor",
    "Restart the dev server (or redeploy) — this page will load the app",
  ];

  return (
    <div
      className={`mx-auto w-full ${compact ? "max-w-xl" : "max-w-2xl p-6"}`}
      data-testid="setup-notice"
    >
      <div className="overflow-hidden rounded-2xl border-2 border-amber-600 bg-[#FDFBF7] shadow-[5px_5px_0px_0px_rgba(217,119,6,1)]">
        <div className="flex items-center gap-2 border-b-2 border-amber-600 bg-amber-400 px-4 py-2.5">
          <AlertTriangle className="size-4 text-slate-900" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Supabase is not connected yet
          </h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm font-medium text-slate-700">
            CampusOS stores every school, class, and user in Supabase. Add your
            project credentials and reload.
          </p>
          <ol className="space-y-1.5 text-sm font-medium text-slate-700">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-lg border-2 border-slate-900 bg-slate-900 px-3 py-2.5 font-mono text-xs text-emerald-300">
            NEXT_PUBLIC_SUPABASE_URL=https://&lt;ref&gt;.supabase.co
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=&lt;anon-key&gt;
            <br />
            SUPABASE_SERVICE_ROLE_KEY=&lt;service-role-key&gt;
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-emerald-400 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-transform hover:-translate-y-0.5"
            >
              Open Supabase <ExternalLink className="size-3.5" />
            </Link>
            <span className="font-mono text-xs font-bold text-slate-500">
              see supabase/README.md
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
