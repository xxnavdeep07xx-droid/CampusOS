"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { loginAction } from "./actions";

export function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = use(searchParams);
  const next = params.next ?? "/dashboard";

  const [state, formAction, pending] = useActionState<
    { error?: string; next?: string } | undefined,
    FormData
  >(loginAction, undefined);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Welcome back</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Log in to CampusOS
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Use the email and password you registered with.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Protected by Supabase Auth. Sessions refresh automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {/* Pass the `next` redirect target through as a hidden field. */}
            <input type="hidden" name="next" value={next} />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
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
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
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
              {pending ? "Signing in…" : "Log in"}
              {!pending && <ArrowRight className="size-5" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm font-medium text-slate-600">
        Need to register a school?{" "}
        <Link href="/register/principal" className="font-bold text-emerald-700 underline-offset-4 hover:underline">
          Start here
        </Link>
      </p>

      <p className="text-center text-xs font-medium text-slate-500">
        Got an invite link from your principal or teacher? Just open that link —
        you don&apos;t need to log in first.
      </p>
    </div>
  );
}
