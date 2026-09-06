"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * createClass — invoked by the teacher dashboard form.
 *
 * Inserts a new classes row with the current user as the teacher. RLS policy
 * `classes_insert_teacher` enforces that teacher_id must be auth.uid() AND
 * school_id must match the caller's school.
 *
 * Wrapped by useActionState, so the signature is `(prevState, formData)`.
 */
export async function createClass(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length < 2) {
    return { error: "Please enter a class name (at least 2 characters)." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in to create a class." };
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return { error: "Your profile could not be loaded." };
    }
    if (!profile.school_id) {
      return { error: "Your account is not linked to a school." };
    }
    if (profile.role !== "teacher" && profile.role !== "principal") {
      return {
        error:
          "Only teachers (and principals) can create classes. " +
          `Your role is: ${profile.role}.`,
      };
    }

    const { error: classErr } = await supabase.from("classes").insert({
      school_id: profile.school_id,
      teacher_id: profile.id,
      name,
    });

    if (classErr) {
      return { error: classErr.message };
    }

    revalidatePath("/dashboard/teacher");
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
