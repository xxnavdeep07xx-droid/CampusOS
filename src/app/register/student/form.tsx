"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, GraduationCap, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { registerStudent } from "./actions";

export function StudentRegisterForm({
  token,
  schoolName,
  className,
}: {
  token: string;
  schoolName: string;
  className: string | null;
}) {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [state, formAction, pending] = useActionState<
    { error?: string; redirectUrl?: string } | undefined,
    FormData
  >(registerStudent, undefined);

  useEffect(() => {
    if (state?.redirectUrl && !redirectedRef.current) {
      redirectedRef.current = true;
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-rose-300">Student onboarding</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Join your class
        </h1>
        <p className="text-sm font-medium text-slate-600">
          You&apos;ve been invited to enroll at{" "}
          <span className="font-bold text-slate-900">{schoolName}</span>
          {className && (
            <>
              {" "}in <span className="font-bold text-slate-900">{className}</span>
            </>
          )}
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-4" />
              School: <span className="text-slate-900">{schoolName}</span>
            </span>
            {className && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4" />
                Class: <span className="text-slate-900">{className}</span>
              </span>
            )}
          </div>
          <CardTitle className="mt-2">Create your student account</CardTitle>
          <CardDescription>
            You&apos;ll be linked to your school and class with the{' '}
            <span className="font-bold text-rose-700">student</span> role.
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
                  placeholder="Sam Patel"
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
                  placeholder="sam@student.edu"
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
              variant="coral"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Creating account…" : "Enroll in class"}
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
