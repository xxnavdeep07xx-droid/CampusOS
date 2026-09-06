"use client";

import { useActionState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClass } from "./actions";

export function CreateClassForm() {
  const [state, formAction, pending] = useActionState<
    { error?: string } | undefined,
    FormData
  >(createClass, undefined);

  return (
    <Card className="overflow-hidden">
      <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-violet-400" />
      <CardHeader>
        <CardTitle>Create a new class</CardTitle>
        <CardDescription>
          Students you invite will be auto-linked to this class.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Class name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Grade 10 — Section A"
              required
              minLength={2}
            />
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
            disabled={pending}
            className="w-full"
          >
            {pending ? "Creating…" : (
              <>
                <Plus className="size-4" />
                Create class
              </>
            )}
            {!pending && <ArrowRight className="size-4 ml-auto" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
