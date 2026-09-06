import Link from "next/link";
import { AlertTriangle, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/brutal/auth-shell";
import { Tag } from "@/components/brutal/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { validateInviteToken } from "@/lib/auth/invite";
import { TeacherRegisterForm } from "./form";

export default async function TeacherRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  // No token at all — show the "no token" empty state.
  if (!token) {
    return (
      <AuthShell
        side={
          <div className="space-y-4 text-[#FDFBF7]">
            <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
              Teacher <span className="text-emerald-400">onboarding</span>
            </h2>
            <p className="max-w-md text-sm font-medium text-slate-300">
              This page is reached via an invite link from a principal. The link
              carries a one-use token that auto-assigns the teacher role and
              links you to the right school.
            </p>
          </div>
        }
      >
        <NoTokenCard />
      </AuthShell>
    );
  }

  // Token present — validate it server-side. The teacher registration page
  // accepts both 'staff' and 'teacher' invitations — staff members go
  // through the same onboarding flow as teachers.
  const valid = await validateInviteToken(token, ["staff", "teacher"]);

  if (!valid) {
    return (
      <AuthShell
        side={
          <div className="space-y-4 text-[#FDFBF7]">
            <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
              Teacher <span className="text-emerald-400">onboarding</span>
            </h2>
            <p className="max-w-md text-sm font-medium text-slate-300">
              Token-validated. No school_id to enter, no class mix-ups.
            </p>
          </div>
        }
      >
        <InvalidTokenCard token={token} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      side={
        <div className="space-y-4 text-[#FDFBF7]">
          <Tag color="bg-violet-400">Token validated</Tag>
          <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
            You&apos;re joining <br />
            <span className="text-emerald-400">{valid.schoolName}</span>.
          </h2>
          <p className="max-w-md text-sm font-medium text-slate-300">
            Just fill in your name, email, and a password. We&apos;ll create
            your account, link you to the school with the{' '}
            <span className="font-bold text-violet-300">teacher</span> role, and
            mark this invite as used — all in one go.
          </p>
          <ul className="space-y-2 text-sm font-medium text-slate-300">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" /> One-use token — can&apos;t be reused
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-400" /> Auto-linked to your school
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-400" /> Create classes &amp; invite students next
            </li>
          </ul>
        </div>
      }
    >
      <TeacherRegisterForm token={token} schoolName={valid.schoolName} />
    </AuthShell>
  );
}

function NoTokenCard() {
  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border-2 border-slate-900 bg-amber-300 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <KeyRound className="size-7 text-slate-900" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black uppercase tracking-tight">
            No invite token
          </h2>
          <p className="text-sm font-medium text-slate-600">
            This page expects an invite token in the URL, like:
          </p>
          <code className="mt-1 block break-all rounded-lg border-2 border-slate-900 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            /register/teacher?token=…
          </code>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Ask your principal to send you a fresh invite link.
          </p>
        </div>
        <Button variant="outline" size="lg" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function InvalidTokenCard({ token }: { token: string }) {
  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border-2 border-rose-500 bg-rose-100 shadow-[3px_3px_0px_0px_rgba(244,63,94,1)]">
          <AlertTriangle className="size-7 text-rose-600" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black uppercase tracking-tight">
            This invite is invalid
          </h2>
          <p className="text-sm font-medium text-slate-600">
            The token <code className="font-mono text-xs text-slate-500">{token.slice(0, 8)}…</code> is
            either already used, expired, or was issued for a different role.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Please ask the person who shared it with you to generate a new
            invite link.
          </p>
        </div>
        <Button variant="outline" size="lg" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
