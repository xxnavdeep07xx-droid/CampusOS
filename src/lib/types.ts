/**
 * Shared CampusOS types.
 *
 * These mirror the database tables created in `supabase/migrations/0001_init.sql`.
 * Keep them in sync if you add columns to the SQL.
 */

export type UserRole = "principal" | "teacher" | "staff" | "student" | "parent";

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

// ============================================================
// Phase 4 — Interactive Digital Board (Whiteboard)
//           & Real-Time Class Announcements
// ============================================================

/** Announcement tag — used for color-coded badges. */
export type AnnouncementTag = "important" | "update" | "assignment" | "general";

export interface Announcement {
  id: string;
  class_id: string;
  author_id: string;
  title: string;
  content: string;
  tag: AnnouncementTag;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  /** Joined from profiles — only present when fetched with the relation. */
  author?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface ClassMessage {
  id: string;
  class_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  /** Joined from profiles — only present when fetched with the relation. */
  sender?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

// ---------- helpers ----------

export const ANNOUNCEMENT_TAGS: {
  value: AnnouncementTag;
  label: string;
  bgClass: string;
  textClass: string;
  emoji: string;
}[] = [
  { value: "important", label: "Important",        bgClass: "bg-rose-400",   textClass: "text-slate-900",  emoji: "⚠"  },
  { value: "update",    label: "Update",           bgClass: "bg-sky-300",    textClass: "text-slate-900",  emoji: "✦"  },
  { value: "assignment",label: "Assignment Alert",  bgClass: "bg-amber-400", textClass: "text-slate-900",  emoji: "✎"  },
  { value: "general",   label: "General",           bgClass: "bg-slate-300",  textClass: "text-slate-900",  emoji: "•"  },
];

export function announcementTagMeta(tag: AnnouncementTag | string) {
  return (
    ANNOUNCEMENT_TAGS.find((t) => t.value === tag) ?? ANNOUNCEMENT_TAGS[3]
  );
}

// ---------- Whiteboard tool types ----------

export type WhiteboardTool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "rectangle"
  | "circle"
  | "line"
  | "text";

export type WhiteboardBackground = "white" | "grid" | "lined" | "chalkboard";

export interface WhiteboardStroke {
  tool: WhiteboardTool;
  color: string;
  width: number;
  /** Array of [x, y] points (canvas coords). For shapes, only [start, end] are used. */
  points: Array<[number, number]>;
  /** For text tool — the text to render at points[0]. */
  text?: string;
}

// ============================================================
// Phase 5 — Assessments, Quizzes, & Automated Gradebook
// ============================================================

export type QuestionType = "mcq" | "short_answer";
export type AttemptStatus = "in_progress" | "completed";

export interface Quiz {
  id: string;
  class_id: string;
  author_id: string;
  title: string;
  description: string;
  time_limit_minutes: number | null;
  due_date: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  /** For MCQ: array of option strings. NULL for short_answer. */
  options: string[] | null;
  correct_answer: string;
  points: number;
  position: number;
  created_at: string;
}

export interface QuizWithQuestions extends Quiz {
  questions?: QuizQuestion[];
  /** Joined from classes — used by the teacher's quiz list. */
  classes?: { id: string; name: string } | null;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  /** { "<question_id>": "<student_answer>", ... } */
  answers: Record<string, string>;
  score: number;
  max_score: number;
  started_at: string;
  completed_at: string | null;
  status: AttemptStatus;
}

export interface QuizAttemptWithQuiz extends QuizAttempt {
  quiz?: Pick<Quiz, "id" | "title" | "class_id" | "time_limit_minutes" | "due_date"> & {
    classes?: { id: string; name: string } | null;
  } | null;
}

/** A row from the class_gradebook view. */
export interface GradebookRow {
  school_id: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  assignment_count: number;
  assignment_total_points: number;
  assignment_earned_points: number;
  quiz_count: number;
  quiz_total_points: number;
  quiz_earned_points: number;
  total_earned: number;
  total_possible: number;
  /** 0-100, or null if no graded work yet. */
  percentage: number | null;
}

// ---------- helpers ----------

/**
 * Compute the score for a single question given the student's answer.
 *
 * - MCQ: case-insensitive exact match against one of the options.
 * - short_answer: case-insensitive trimmed exact match against correct_answer.
 *
 * Returns the question's `points` if correct, 0 otherwise.
 */
export function gradeQuestion(
  question: Pick<QuizQuestion, "question_type" | "correct_answer" | "points">,
  studentAnswer: string | undefined
): number {
  if (!studentAnswer) return 0;
  const ans = studentAnswer.trim().toLowerCase();
  const correct = question.correct_answer.trim().toLowerCase();
  if (!ans || !correct) return 0;
  return ans === correct ? question.points : 0;
}

/**
 * Compute total score + max score for a quiz attempt.
 *
 * Returns { score, maxScore }.
 */
export function gradeAttempt(
  questions: QuizQuestion[],
  answers: Record<string, string>
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    maxScore += q.points;
    score += gradeQuestion(q, answers[q.id]);
  }
  return { score, maxScore };
}

/**
 * Map a percentage (0-100) to a brutalist bg-* accent color.
 * Used by the gradebook + my-grades pages.
 */
export function gradeColor(pct: number | null | undefined): string {
  if (pct == null) return "bg-slate-300";
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-400";
  if (pct >= 50) return "bg-sky-300";
  return "bg-rose-400";
}

/**
 * Map a percentage to a hex color (for chart fills).
 */
export function gradeHex(pct: number | null | undefined): string {
  if (pct == null) return "#cbd5e1";
  if (pct >= 90) return "#10b981";
  if (pct >= 75) return "#f59e0b";
  if (pct >= 50) return "#7dd3fc";
  return "#fb7185";
}

// ============================================================
// Phase 6 — Fee Management, Invoicing, & Parent Portal
// ============================================================

export type InvoiceStatus = "pending" | "paid" | "overdue";

export interface FeeInvoice {
  id: string;
  school_id: string;
  student_id: string;
  title: string;
  description: string;
  total_amount: number;       // decimal(10,2) — stored as a JS number
  due_date: string | null;    // ISO date (YYYY-MM-DD)
  status: InvoiceStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from profiles — present when fetched with the relation. */
  student?: Pick<Profile, "id" | "full_name"> | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_url: string | null;
}

export interface GlobalNotice {
  id: string;
  school_id: string;
  title: string;
  content: string;
  publish_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  created_at: string;
  /** Joined from profiles — the student's denormalized profile. */
  student?: Pick<Profile, "id" | "full_name" | "class_id"> | null;
}

// ---------- helpers ----------

/**
 * Map an invoice status → a brutalist bg-* accent color.
 *   - paid    → emerald (vibrant green)
 *   - overdue → rose (vibrant red)
 *   - pending → amber (yellow)
 */
export function invoiceStatusBgClass(s: InvoiceStatus): string {
  switch (s) {
    case "paid":    return "bg-emerald-500 text-[#FDFBF7]";
    case "overdue": return "bg-rose-500 text-[#FDFBF7]";
    case "pending":
    default:         return "bg-amber-400 text-slate-900";
  }
}

export function invoiceStatusLabel(s: InvoiceStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format a decimal amount as a currency string.
 * Defaults to USD with no symbol-prefix customization — adjust as needed.
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ============================================================
// Phase 7 — Library Management & Staff HR (Leave Requests)
// ============================================================

export type IssueStatus = "issued" | "returned" | "overdue";

export interface Book {
  id: string;
  school_id: string;
  title: string;
  author: string;
  isbn: string | null;
  total_copies: number;
  available_copies: number;
  cover_image_url: string | null;
  created_at: string;
}

export interface BookIssue {
  id: string;
  book_id: string;
  user_id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: IssueStatus;
  created_at: string;
  /** Joined from books — present when fetched with the relation. */
  book?: Pick<Book, "id" | "title" | "author" | "cover_image_url"> | null;
  /** Joined from profiles — the borrower. */
  user?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  staff_id: string;
  school_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Joined from profiles — the staff member who requested the leave. */
  staff?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

// ---------- helpers ----------

export function issueStatusBgClass(s: IssueStatus): string {
  switch (s) {
    case "issued":   return "bg-sky-300 text-slate-900";
    case "returned":  return "bg-emerald-500 text-[#FDFBF7]";
    case "overdue":   return "bg-rose-500 text-[#FDFBF7]";
  }
}

export function issueStatusLabel(s: IssueStatus): string {
  if (s === "issued") return "Issued";
  if (s === "returned") return "Returned";
  return "Overdue";
}

export function leaveStatusBgClass(s: LeaveStatus): string {
  switch (s) {
    case "pending":  return "bg-amber-400 text-slate-900";
    case "approved": return "bg-emerald-500 text-[#FDFBF7]";
    case "rejected": return "bg-rose-500 text-[#FDFBF7]";
  }
}

export function leaveStatusLabel(s: LeaveStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Days remaining until the due date. Negative if overdue.
 */
export function daysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
