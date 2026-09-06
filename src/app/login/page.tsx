import { AuthShell } from "@/components/brutal/auth-shell";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthShell
      side={
        <div className="space-y-4 text-[#FDFBF7]">
          <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
            Welcome <span className="text-emerald-400">back.</span>
          </h2>
          <p className="max-w-md text-sm font-medium text-slate-300">
            Pick up where you left off — generate the next invite, create your
            next class, or check who has joined your school.
          </p>
        </div>
      }
    >
      <LoginForm searchParams={searchParams} />
    </AuthShell>
  );
}
