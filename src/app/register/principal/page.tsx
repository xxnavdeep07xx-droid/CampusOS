import { AuthShell } from "@/components/brutal/auth-shell";
import { PrincipalRegisterForm } from "./form";

export default function Page() {
  return (
    <AuthShell
      side={
        <div className="space-y-4 text-[#FDFBF7]">
          <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
            You are the <span className="text-emerald-400">principal.</span>
          </h2>
          <p className="max-w-md text-sm font-medium text-slate-300">
            Create your account, register your school, and you&apos;ll be
            taken straight to a dashboard where you can generate invite links
            (with QR codes) for your teachers and staff.
          </p>
          <ul className="space-y-2 text-sm font-medium text-slate-300">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" /> School + auth + profile in one step
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-400" /> Auto-logged-in afterwards
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-400" /> Multi-tenant RLS isolation
            </li>
          </ul>
        </div>
      }
    >
      <PrincipalRegisterForm />
    </AuthShell>
  );
}
