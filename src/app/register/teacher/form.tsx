"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { registerTeacher } from "./actions";

export function TeacherRegisterForm({
  token,
  schoolName,
}: {
  token: string;
  schoolName: string;
}) {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [state, formAction, pending] = useActionState<
    { error?: string; redirectUrl?: string } | undefined,
    FormData
  >(registerTeacher, undefined);

  useEffect(() => {
    if (state?.redirectUrl && !redirectedRef.current) {
      redirectedRef.current = true;
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-violet-300">Teacher onboarding</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Join as a teacher
        </h1>
        <p className="text-sm font-medium text-slate-600">
          You&apos;ve been invited to teach at{" "}
          <span className="font-bold text-slate-900">{schoolName}</span>. Set up
          your account below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Building2 className="size-4" />
            School: <span className="text-slate-900">{schoolName}</span>
          </div>
          <CardTitle className="mt-2">Create your teacher account</CardTitle>
          <CardDescription>
            You&apos;ll be linked to your school with the{' '}
            <span className="font-bold text-violet-700">teacher</span> role.
            Passwords must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Mr. Alex Kim"
                  required
                  minLength={2}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="alex@school.edu"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="pl-9"
                />
              </div>
            </div>

            {state?.error && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
              >
                {state.error}
              </div>
            )}

            <Button
              type="submit"
              variant="violet"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Creating account…" : "Create account & join school"}
              {!pending && <ArrowRight className="size-5" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm font-medium text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-emerald-700 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
