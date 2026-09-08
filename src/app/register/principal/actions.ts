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
 * `(prevState, formData)`.
 *
 * CRITICAL: redirect() must NOT be inside a try/catch block in Next.js 16.
 * We use a flag variable + call redirect() after the try/catch exits.
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

  let shouldRedirect = false;
  let error: string | undefined;

  try {
    const supabase = await createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      error = signUpError.message;
    } else {
      const user = signUpData.user;
      const session = signUpData.session;

      if (!user) {
        error =
          "Account created, but we could not establish a session. " +
          "If your project has email confirmation enabled, click the link " +
          "in your inbox first, then log in.";
      } else {
        const admin = createAdminClient();

        const { data: schoolRow, error: schoolErr } = await admin
          .from("schools")
          .insert({ name: schoolName, principal_id: user.id })
          .select("id")
          .single();

        if (schoolErr || !schoolRow) {
          error =
            "We created your auth account but failed to create the school row: " +
            (schoolErr?.message ?? "unknown error");
        } else {
          const { error: profileErr } = await admin
            .from("profiles")
            .update({
              role: "principal" as UserRole,
              school_id: schoolRow.id,
              full_name: fullName,
            })
            .eq("id", user.id);

          if (profileErr) {
            error =
              "School created, but we could not link your profile: " +
              profileErr.message;
          } else if (!session) {
            // Email confirmation is enabled — no session yet.
            error =
              "Your school is set up! Please check your inbox and click the " +
              "confirmation link, then log in to access your dashboard.";
          } else {
            // Success — signal redirect after the try/catch.
            shouldRedirect = true;
          }
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // redirect() MUST be outside the try/catch — Next.js 16 requires it.
  if (shouldRedirect) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  return { error };
}
