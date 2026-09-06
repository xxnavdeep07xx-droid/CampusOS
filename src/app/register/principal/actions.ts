"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/**
 * registerPrincipal — server action invoked by /register/principal.
 *
 * Wrapped by useActionState in the form, so the signature is
 * `(prevState, formData)`. We ignore prevState because we don't need
 * progressive enhancement.
 *
 * Flow:
 *   1. Sign the user up with email + password. The handle_new_user trigger
 *      fires on auth.users INSERT and creates a profiles row (role='student').
 *   2. Use the service-role client (RLS bypassed) to:
 *        a) insert a schools row with principal_id = user.id
 *        b) update the just-created profiles row to set role='principal'
 *           and school_id = the new school's id
 *   3. Redirect to /dashboard.
 */
export async function registerPrincipal(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
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
    if (!session) {
      return {
        error:
          "Please check your inbox and click the confirmation link, then " +
          "log in to finish setting up your school.",
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
      .update({ role: "principal" as UserRole, school_id: schoolRow.id, full_name: fullName })
      .eq("id", user.id);

    if (profileErr) {
      return {
        error: "School created, but we could not link your profile: " + profileErr.message,
      };
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
  } catch (err) {
    // redirect() throws from inside Next.js — re-throw it so the redirect
    // actually happens. Any other error is surfaced as a friendly message.
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
