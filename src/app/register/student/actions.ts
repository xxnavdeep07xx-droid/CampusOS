"use server";

import { registerWithInvite } from "@/lib/auth/invite";
import type { UserRole } from "@/lib/types";

/**
 * registerStudent — server action called from the student registration form.
 *
 * Wrapped by useActionState, so the signature is `(prevState, formData)`.
 * We forward `formData` to the shared `registerWithInvite` with
 * `expectedRole = "student"`.
 */
export async function registerStudent(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  return registerWithInvite({
    formData,
    expectedRole: "student" as UserRole,
  });
}
