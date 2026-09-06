import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrutalLogo } from "@/components/brutal/logo";

/**
 * AuthShell — shared layout for every authentication page
 * (login, /register/principal, /register/teacher, /register/student).
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  Left column (decorative)  │  Right column (form)          │
 *   │  - dark slate background    │  - warm off-white background  │
 *   │  - big brand wordmark       │  - the auth form / content    │
 *   │  - tagline + features list │                                │
 *   └────────────────────────────────────────────────────────────┘
 */
export function AuthShell({
  children,
  side,
  backHref = "/",
  backLabel = "Back to home",
}: {
  children: ReactNode;
  side: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-[#FDFBF7] md:flex-row">
      {/* Decorative left side */}
      <aside className="relative flex flex-col justify-between overflow-hidden border-b-[3px] border-slate-900 bg-slate-900 p-8 text-[#FDFBF7] md:w-2/5 md:border-b-0 md:border-r-[3px]">
        {/* Hatch overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #FDFBF7 0px, #FDFBF7 1.5px, transparent 1.5px, transparent 12px)",
          }}
        />
        <div className="relative">
          <Link href="/" className="inline-flex">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl border-2 border-[#FDFBF7] bg-emerald-500 font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(253,251,247,0.6)]">
                C
              </div>
              <span className="text-2xl font-black uppercase tracking-tight">
                Campus<span className="text-emerald-400">OS</span>
              </span>
            </div>
          </Link>
        </div>

        <div className="relative mt-10">{side}</div>

        <div className="relative mt-10 text-xs font-bold uppercase tracking-wider text-slate-400">
          Phase 1 · Auth + Onboarding
        </div>
      </aside>

      {/* Form side */}
      <section className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-5 md:px-10">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
          <div className="md:hidden">
            <BrutalLogo size="sm" asLink={false} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12 md:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </main>
  );
}
