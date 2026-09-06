import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Storage helpers for Phase 2 — wraps Supabase Storage operations so the
 * rest of the app doesn't have to repeat bucket names + path conventions.
 *
 * Path convention: `<class_id>/<uuid>.<ext>` for both buckets.
 * This lets storage RLS policies extract the class_id from the path and
 * verify class membership (see migrations/0002_classroom_hub.sql).
 */

export const CLASS_MATERIALS_BUCKET = "class_materials";
export const STUDENT_SUBMISSIONS_BUCKET = "student_submissions";

/**
 * Build a storage path for a file uploaded to a class's bucket.
 *
 * Format: `<class_id>/<uuid>.<ext>`
 *
 * The UUID4 prefix on the filename prevents collisions when two teachers
 * upload "syllabus.pdf" to the same class.
 */
export function buildStoragePath(classId: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
  const uuid = cryptoRandomUuid();
  const fileName = ext ? `${uuid}.${ext}` : uuid;
  return `${classId}/${fileName}`;
}

/**
 * Generate a UUID v4 using Web Crypto. Falls back to Math.random for
 * environments where crypto.randomUUID is missing.
 */
function cryptoRandomUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += hex[(Math.random() * 4) | 0 | 8];
    else s += hex[(Math.random() * 16) | 0];
  }
  return s;
}

/**
 * Build the public URL for an object in a PUBLIC bucket (class_materials).
 *
 * Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
export function publicStorageUrl(bucket: string, path: string): string {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set");
  }
  const cleanPath = path.replace(/^\/+/, "");
  return `${projectUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Generate a signed download URL for a file in a PRIVATE bucket
 * (student_submissions). Requires the service-role client.
 *
 * `expiresIn` defaults to 60 seconds — short enough to be safe, long
 * enough for the user to click through.
 */
export async function signedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSec = 60
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(
      `Could not generate signed URL for ${bucket}/${path}: ${error?.message ?? "unknown"}`
    );
  }
  return data.signedUrl;
}

/**
 * Human-readable file size (e.g. "1.4 MB", "820 KB").
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format an ISO date string as e.g. "Sep 6, 2026".
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format an ISO date string as e.g. "Sep 6, 2026 · 4:30 PM".
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Returns true if the given ISO date is in the past.
 */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/**
 * Returns true if the given ISO date is within 48 hours of now.
 */
export function isDueSoon(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms < 48 * 60 * 60 * 1000;
}
