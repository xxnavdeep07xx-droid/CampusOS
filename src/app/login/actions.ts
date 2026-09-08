"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * loginAction — email + password sign-in. On success, redirect to ?next=
 * (defaults to /dashboard). On failure, return the localized error message.
 *
 * Wrapped by useActionState, so the signature is `(prevState, formData)`.
 */
export async function loginAction(
  _prevState: { error?: string; next?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; next?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Please enter both your email and password." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials")) {
        return { error: "Wrong email or password. Please try again." };
      }
      if (msg.includes("email not confirmed")) {
        return {
          error:
            "Please click the confirmation link in your inbox before logging in.",
        };
      }
      if (msg.includes("rate limit")) {
        return { error: "Too many attempts. Please wait a minute and try again." };
      }
      return { error: error.message };
    }

    revalidatePath(next, "page");
    redirect(next);
  } catch (err) {
    // redirect() throws a special error in Next.js — re-throw it so the
    // redirect actually happens. In Next.js 16, the error carries a
    // `digest` property starting with "NEXT_REDIRECT".
    if (err instanceof Error && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

/**
 * signOutAction — clears the session and bounces to the landing page.
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    // Ignore env-var errors during sign-out so the user can still leave.
    console.warn("signOut error:", err);
  }
  revalidatePath("/", "page");
  redirect("/");
}
