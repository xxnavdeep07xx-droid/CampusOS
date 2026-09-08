"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/**
 * registerPrincipal — server action invoked by /register/principal.
 *
 * Returns { error?, redirectUrl? } — the client component handles the
 * actual redirect via router.push(). This avoids calling redirect()
 * inside the server action, which causes "Invalid Server Actions
 * request" in Next.js 16.
 */
export async function registerPrincipal(
  _prevState: { error?: string; redirectUrl?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; redirectUrl?: string }> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const schoolName = String(formData.get("school_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName || fullName.length < 2) {
    return { error: "Please enter your full name (at least 2 characters)." };
  }
  if (!schoolName || schoolName.length < 2) {
    return { error: "Please enter your school's name (at least 2 characters)." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  try {
    const supabase = await createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      return { error: signUpError.message };
    }

    const user = signUpData.user;
    const session = signUpData.session;

    if (!user) {
      return {
        error:
          "Account created, but we could not establish a session. " +
          "If your project has email confirmation enabled, click the link " +
          "in your inbox first, then log in.",
      };
    }

    const admin = createAdminClient();

    const { data: schoolRow, error: schoolErr } = await admin
      .from("schools")
      .insert({ name: schoolName, principal_id: user.id })
      .select("id")
      .single();

    if (schoolErr || !schoolRow) {
      return {
        error:
          "We created your auth account but failed to create the school row: " +
          (schoolErr?.message ?? "unknown error"),
      };
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        role: "principal" as UserRole,
        school_id: schoolRow.id,
        full_name: fullName,
      })
      .eq("id", user.id);

    if (profileErr) {
      return {
        error:
          "School created, but we could not link your profile: " +
          profileErr.message,
      };
    }

    if (!session) {
      return {
        error:
          "Your school is set up! Please check your inbox and click the " +
          "confirmation link, then log in to access your dashboard.",
      };
    }

    // Success — return a redirect URL instead of calling redirect().
    // The client component will call router.push(redirectUrl).
    revalidatePath("/dashboard");
    return { redirectUrl: "/dashboard" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
