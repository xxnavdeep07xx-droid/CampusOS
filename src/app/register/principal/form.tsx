"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { registerPrincipal } from "./actions";

export function PrincipalRegisterForm() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [state, formAction, pending] = useActionState<
    { error?: string; redirectUrl?: string } | undefined,
    FormData
  >(registerPrincipal, undefined);

  // Handle client-side redirect when the action returns redirectUrl.
  useEffect(() => {
    if (state?.redirectUrl && !redirectedRef.current) {
      redirectedRef.current = true;
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-emerald-300">Step 1 · Principal</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Register your school
        </h1>
        <p className="text-sm font-medium text-slate-600">
          You are the principal. We&apos;ll create your account, your school, and link
          them in one go.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>School + Account</CardTitle>
          <CardDescription>
            All fields are required. Your password must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Your full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  required
                  minLength={2}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_name">School name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="school_name"
                  name="school_name"
                  type="text"
                  placeholder="Greenwood High School"
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
                  placeholder="principal@school.edu"
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
              variant="emerald"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Creating school…" : "Create school & account"}
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
