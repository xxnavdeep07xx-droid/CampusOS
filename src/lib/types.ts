/**
 * Shared CampusOS types.
 *
 * These mirror the database tables created in `supabase/migrations/0001_init.sql`.
 * Keep them in sync if you add columns to the SQL.
 */

export type UserRole = "principal" | "teacher" | "staff" | "student";

export interface School {
  id: string;
  name: string;
  principal_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  role: UserRole;
  full_name: string;
  created_at: string;
}

export interface ClassRoom {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  school_id: string;
  class_id: string | null;
  role: UserRole;
  token: string;
  is_used: boolean;
  created_at: string;
  created_by: string | null;
}

/**
 * Build the public-facing URL that an invited user should visit.
 *
 * Routes:
 *   - principal → no token, direct register flow (not used; principals self-register)
 *   - staff / teacher → /register/teacher?token=...
 *   - student → /register/student?token=...
 *
 * Note: staff and teachers share the same registration flow because staff
 * members are effectively teachers without an assigned class.
 */
export function inviteUrl(token: string, role: UserRole): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const sub =
    role === "student" ? "student" : role === "teacher" ? "teacher" : "teacher";
  return `${site}/register/${sub}?token=${token}`;
}
