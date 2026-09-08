"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * loginAction — email + password sign-in.
 * Returns { error?, redirectUrl? } — the client handles the redirect.
 * This avoids calling redirect() inside the server action entirely.
 */
export async function loginAction(
  _prevState: { error?: string; redirectUrl?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; redirectUrl?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Please enter both your email and password." };
  }

  try {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("invalid login credentials")) {
        return { error: "Wrong email or password. Please try again." };
      }
      if (msg.includes("email not confirmed")) {
        return { error: "Please click the confirmation link in your inbox before logging in." };
      }
      if (msg.includes("rate limit")) {
        return { error: "Too many attempts. Please wait a minute and try again." };
      }
      return { error: authError.message };
    }

    revalidatePath(next, "page");
    return { redirectUrl: next };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * signOutAction — clears the session and bounces to the landing page.
 * This one is safe to use redirect() because it's not wrapped by useActionState.
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("signOut error:", err);
  }
  revalidatePath("/", "page");
  // Use window.location for sign-out — it's a full page reload anyway.
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
