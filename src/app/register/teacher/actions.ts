"use server";

import { registerWithInvite } from "@/lib/auth/invite";
import type { UserRole } from "@/lib/types";

/**
 * registerTeacher — server action called from the teacher registration form.
 *
 * Wrapped by useActionState, so the signature is `(prevState, formData)`.
 * We forward `formData` to the shared `registerWithInvite` with the
 * allowed roles `["staff", "teacher"]` — staff members go through the
 * teacher onboarding flow because they share the same page and form.
 */
export async function registerTeacher(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  return registerWithInvite({
    formData,
    expectedRoles: ["staff", "teacher"] as UserRole[],
  });
}
