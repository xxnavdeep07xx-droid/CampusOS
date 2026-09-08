"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * loginAction — email + password sign-in. On success, redirect to ?next=
 * (defaults to /dashboard). On failure, return the localized error message.
 *
 * CRITICAL: redirect() must NOT be inside a try/catch block in Next.js 16.
 * We use a flag variable + call redirect() after the try/catch exits.
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

  let shouldRedirect = false;
  let error: string | undefined;

  try {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("invalid login credentials")) {
        error = "Wrong email or password. Please try again.";
      } else if (msg.includes("email not confirmed")) {
        error = "Please click the confirmation link in your inbox before logging in.";
      } else if (msg.includes("rate limit")) {
        error = "Too many attempts. Please wait a minute and try again.";
      } else {
        error = authError.message;
      }
    } else {
      shouldRedirect = true;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // redirect() MUST be outside the try/catch — Next.js 16 requires it.
  if (shouldRedirect) {
    revalidatePath(next, "page");
    redirect(next);
  }

  return { error };
}

/**
 * signOutAction — clears the session and bounces to the landing page.
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("signOut error:", err);
  }
  revalidatePath("/", "page");
  redirect("/");
}
