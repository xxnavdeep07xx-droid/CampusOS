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
  /**
   * The primary class this user is enrolled in (students only).
   *
   * Added in Phase 2 (migrations/0002_classroom_hub.sql). May be NULL for
   * Phase 1 students who registered before the column existed — those
   * students need to be re-invited to a specific class.
   */
  class_id?: string | null;
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

// ============================================================
// Phase 2 — Classroom Hub types
// ============================================================

export interface Resource {
  id: string;
  class_id: string;
  title: string;
  description: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_date: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
}

export type SubmissionStatus = "submitted" | "graded";

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string;
  status: SubmissionStatus;
  grade: number | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Submission with the student's profile denormalized — used by the teacher's
 * "Grade Submissions" view.
 */
export interface SubmissionWithStudent extends Submission {
  student?: Pick<Profile, "id" | "full_name"> | null;
}

/**
 * Map a file extension or MIME type to a brutalist accent color class.
 *
 * Used by ResourceCard + AssignmentCard to color-code by file type.
 */
export type FileColor =
  | "sky"     // PDFs
  | "emerald" // docs / text
  | "coral"   // images
  | "violet"  // video
  | "amber"   // archives
  | "slate";  // default

export function fileColorFor(filename: string, mimeType?: string | null): FileColor {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return "coral";
  }
  if (mimeType?.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
    return "violet";
  }
  if (mimeType?.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return "violet";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return "amber";
  }
  if (["pdf"].includes(ext)) {
    return "sky";
  }
  if (["doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) {
    return "emerald";
  }
  if (["xls", "xlsx", "csv", "ppt", "pptx"].includes(ext)) {
    return "amber";
  }
  return "slate";
}

/**
 * Map a FileColor → the brutalist bg-* class used for accent bars / icons.
 */
export function fileColorBgClass(c: FileColor): string {
  switch (c) {
    case "sky":     return "bg-sky-300";
    case "emerald": return "bg-emerald-500";
    case "coral":   return "bg-rose-400";
    case "violet":  return "bg-violet-500";
    case "amber":   return "bg-amber-400";
    case "slate":
    default:        return "bg-slate-400";
  }
}

/**
 * Map a FileColor → a short uppercase label for the file type badge.
 */
export function fileColorLabel(c: FileColor): string {
  switch (c) {
    case "sky":     return "PDF";
    case "emerald": return "DOC";
    case "coral":   return "IMG";
    case "violet":  return "MEDIA";
    case "amber":   return "ARCHIVE";
    case "slate":
    default:        return "FILE";
  }
}
