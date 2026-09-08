import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Invitation, UserRole } from "@/lib/types";

/**
 * Shared validator: look up an invitation by its token (UUID) using the
 * service-role client (so it works even if the caller has no session yet).
 *
 * Returns null if the invitation does not exist, is already used, or belongs
 * to a role that this endpoint does not serve.
 */
export async function validateInviteToken(
  token: string,
  expectedRoles: UserRole | UserRole[]
): Promise<{ invitation: Invitation; schoolName: string; className: string | null } | null> {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  // If the service-role env vars are not yet configured (e.g. during
  // development before the user has pasted their keys into .env.local),
  // treat the token as unresolvable rather than crashing the page.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: inv, error } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !inv) return null;

  const invitation = inv as Invitation;

  if (invitation.is_used) return null;

  // Accept the token if its role matches any of the allowed roles.
  // The teacher registration page accepts BOTH 'staff' and 'teacher'
  // invitations — staff members are effectively teachers without an
  // assigned class, and they share the same onboarding flow.
  const allowed = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];
  if (!allowed.includes(invitation.role as UserRole)) return null;

  const { data: schoolRow } = await admin
    .from("schools")
    .select("name")
    .eq("id", invitation.school_id)
    .single();

  let className: string | null = null;
  if (invitation.class_id) {
    const { data: classRow } = await admin
      .from("classes")
      .select("name")
      .eq("id", invitation.class_id)
      .single();
    className = classRow?.name ?? null;
  }

  return {
    invitation,
    schoolName: schoolRow?.name ?? "your school",
    className,
  };
}

/**
 * Shared onboarding step: after signUp completes, the auth.users trigger has
 * created a `profiles` row with role='student' (the trigger default). We
 * promote it to the invite's actual role and link it to the school + class.
 *
 * Also marks the invitation as used so the link can't be reused.
 */
export async function completeInviteOnboarding(args: {
  userId: string;
  invitation: Invitation;
  fullName: string;
}): Promise<{ error?: string }> {
  const { userId, invitation, fullName } = args;
  const admin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    role: invitation.role as UserRole,
    school_id: invitation.school_id,
    full_name: fullName,
  };
  if (invitation.class_id) {
    updatePayload.class_id = invitation.class_id;
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (profileErr) {
    return {
      error:
        "Account created, but we could not link your profile: " +
        profileErr.message,
    };
  }

  const { error: invErr } = await admin
    .from("invitations")
    .update({ is_used: true })
    .eq("id", invitation.id);

  if (invErr) {
    console.warn("Failed to mark invitation as used:", invErr.message);
  }

  return {};
}

/**
 * Shared entrypoint invoked by the teacher / student registration forms.
 *
 * Wrapped by useActionState, so the signature is `(prevState, formData)`.
 * The `expectedRoles` is captured via closure by the per-page wrapper.
 */
export async function registerWithInvite(args: {
  formData: FormData;
  expectedRoles: UserRole | UserRole[];
}): Promise<{ error?: string }> {
  const { formData, expectedRoles } = args;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "");

  if (!fullName || fullName.length < 2) {
    return { error: "Please enter your full name (at least 2 characters)." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  try {
    const valid = await validateInviteToken(token, expectedRoles);
    if (!valid) {
      return {
        error:
          "This invite link is no longer valid. It may have expired, been " +
          "used already, or been issued for a different role. Ask the person " +
          "who shared it with you to generate a new one.",
      };
    }

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
          "Account created, but we could not establish a session. If your " +
          "project requires email confirmation, click the link in your " +
          "inbox first, then log in.",
      };
    }

    // Always complete the onboarding wiring using the service-role client
    // (which bypasses RLS and doesn't need a session). If email confirmation
    // is enabled, the user will need to confirm + log in afterwards to
    // actually access the dashboard — but their profile + role + school
    // + class linkage is already in place.
    const wired = await completeInviteOnboarding({
      userId: user.id,
      invitation: valid.invitation,
      fullName,
    });
    if (wired.error) {
      return wired;
    }

    if (!session) {
      return {
        error:
          "You're all set! Please check your inbox and click the " +
          "confirmation link, then log in to access your dashboard.",
      };
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
  } catch (err) {
    // redirect() throws a special error in Next.js — re-throw so the
    // navigation actually happens. In Next.js 16, the error carries a
    // `digest` property starting with "NEXT_REDIRECT".
    if (err instanceof Error && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
