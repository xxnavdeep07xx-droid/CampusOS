"use client";

import { createClient } from "@/lib/supabase/browser";

/**
 * uploadFileToBucket — orchestrates the multi-step upload flow.
 *
 * 1. POST /api/upload to get a signed upload URL + final storage path.
 * 2. PUT the file directly to the signed URL (bypasses our own server —
 *    the file goes straight to Supabase Storage).
 * 3. Returns the final storage path so the caller can persist it to the
 *    resources / submissions table.
 *
 * Why signed URLs and not the supabase-js upload helper? Because the
 * supabase-js upload helper requires the anon key to be exposed (which it
 * is — NEXT_PUBLIC_SUPABASE_ANON_KEY), and storage RLS policies still
 * enforce authorization. But the signed-URL pattern is more flexible —
 * it works for very large files because we don't route them through
 * our own Next.js server.
 */
export async function uploadFileToBucket(args: {
  bucket: "class_materials" | "student_submissions";
  classId: string;
  file: File;
  onProgress?: (pct: number) => void;
}): Promise<string> {
  const { bucket, classId, file, onProgress } = args;

  // Step 1 — get the signed upload URL.
  onProgress?.(5);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket,
      classId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Upload failed (HTTP ${res.status})`);
  }

  const { path, signedUrl } = json as { path: string; signedUrl: string };

  onProgress?.(25);

  // Step 2 — PUT the file to the signed URL.
  //
  // Supabase's createSignedUploadUrl returns a URL that accepts a PUT
  // with the file body and `Authorization: Bearer <anon>` header. We use
  // the raw fetch API so we can hook into progress via XMLHttpRequest's
  // upload progress events.
  await putFileWithProgress(signedUrl, file, file.type, onProgress);

  onProgress?.(100);

  // Step 3 — return the final path.
  return path;
}

/**
 * PUT a file with progress events. Falls back to fetch() if XMLHttpRequest
 * is unavailable (e.g. server-side).
 */
function putFileWithProgress(
  url: string,
  file: File | Blob,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      // Server-side fallback (no progress).
      fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      })
        .then((r) => {
          if (!r.ok) {
            r.text()
              .then((t) => reject(new Error(`Upload failed (${r.status}): ${t}`)))
              .catch(() => reject(new Error(`Upload failed (${r.status})`)));
          } else resolve();
        })
        .catch(reject);
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = 25 + Math.round((e.loaded / e.total) * 70); // 25%..95%
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

/**
 * Convenience wrapper around the browser Supabase client — used to fetch
 * signed DOWNLOAD URLs for files in private buckets (e.g. student_submissions).
 *
 * For the public `class_materials` bucket, use `publicStorageUrl()` instead.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSec = 60
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not generate download URL");
  }
  return data.signedUrl;
}
