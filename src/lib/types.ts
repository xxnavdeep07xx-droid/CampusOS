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

// ============================================================
// Phase 3 — Digital Attendance & Timetable Management types
// ============================================================

export type AttendanceStatus = "present" | "absent" | "late";

export interface Attendance {
  id: string;
  class_id: string;
  student_id: string;
  date: string; // ISO date (YYYY-MM-DD)
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

/** Attendance row with the student's profile denormalized — used by the teacher's attendance taker. */
export interface AttendanceWithStudent extends Attendance {
  student?: Pick<Profile, "id" | "full_name"> | null;
}

/** 1 = Monday ... 5 = Friday */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5;

export interface Timetable {
  id: string;
  class_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM:SS"
  end_time: string;   // "HH:MM:SS"
  subject_name: string;
  created_at: string;
}

/** Timetable with the class denormalized — used by the teacher's weekly schedule view. */
export interface TimetableWithClass extends Timetable {
  classes?: Pick<ClassRoom, "id" | "name"> | null;
}

// ---------- helpers ----------

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 1, label: "Monday",    short: "Mon" },
  { value: 2, label: "Tuesday",   short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday",  short: "Thu" },
  { value: 5, label: "Friday",    short: "Fri" },
];

export function dayName(d: DayOfWeek): string {
  return DAYS_OF_WEEK.find((x) => x.value === d)?.label ?? "—";
}

export function dayShort(d: DayOfWeek): string {
  return DAYS_OF_WEEK.find((x) => x.value === d)?.short ?? "—";
}

/**
 * Attendance status → brutalist bg-* class. Used for the toggle buttons
 * and the status badges in the attendance history list.
 */
export function statusBgClass(s: AttendanceStatus): string {
  switch (s) {
    case "present": return "bg-emerald-500";
    case "absent":  return "bg-rose-500";
    case "late":    return "bg-amber-400";
  }
}

/**
 * Attendance status → text-friendly label.
 */
export function statusLabel(s: AttendanceStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Attendance status → text color class for the selected-state of a toggle button.
 */
export function statusTextClass(s: AttendanceStatus): string {
  switch (s) {
    case "present": return "text-[#FDFBF7]";
    case "absent":  return "text-[#FDFBF7]";
    case "late":    return "text-slate-900";
  }
}

/**
 * Parse "HH:MM:SS" → minutes-since-midnight. Returns 0 for null/invalid.
 */
export function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Format "HH:MM:SS" → "h:mm AM/PM" (e.g. "14:30:00" → "2:30 PM").
 */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const mins = timeToMinutes(t);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Convert a Date to YYYY-MM-DD in local timezone (for the `date` column).
 */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
