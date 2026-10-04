import Link from "next/link";
import { SetupNotice } from "@/components/brutal/setup-notice";

export const metadata = {
  title: "Connect Supabase",
  robots: { index: false, follow: false },
};

/**
 * /setup — reached automatically when the app is booted without Supabase
 * credentials (see src/proxy.ts). Keeps the failure mode obvious and
 * actionable instead of a stack trace.
 */
export default function SetupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FDFBF7] px-4 py-12">
      <Link href="/" className="text-lg font-black uppercase tracking-tight text-slate-900">
        Campus<span className="text-emerald-600">OS</span>
      </Link>
      <SetupNotice />
      <p className="max-w-xl text-center text-xs font-medium text-slate-500">
        Once the environment variables are set, this page redirects to your dashboard.
      </p>
    </main>
  );
}
