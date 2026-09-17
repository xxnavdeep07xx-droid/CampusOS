import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, getConnection } from "@/lib/google-drive-server";

/**
 * GET /api/google-drive/list?folder=PARENT_ID&pageSize=50
 *
 * Lists files in the teacher's Google Drive. Defaults to the root folder
 * ('root' is a special Google Drive alias for "My Drive").
 *
 * Returns Google Drive API file objects: { id, name, mimeType, iconLink,
 * thumbnailLink, modifiedTime, size, parents }.
 *
 * Auth: caller must be signed in + have a Google Drive connection.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") ?? "root";
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "50"), 200);
  const pageToken = url.searchParams.get("pageToken") ?? undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Verify the caller is a teacher (or principal/staff).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileRow as { role: string } | null;
  if (
    !profile ||
    (profile.role !== "teacher" && profile.role !== "principal" && profile.role !== "staff")
  ) {
    return NextResponse.json(
      { error: "Only teachers can access Google Drive integration." },
      { status: 403 }
    );
  }

  let accessToken: string;
  try {
    const token = await getValidAccessToken(user.id);
    if (!token) {
      return NextResponse.json(
        { error: "Google Drive not connected. Click 'Connect Google Drive' first.", notConnected: true },
        { status: 403 }
      );
    }
    accessToken = token;
  } catch (err) {
    console.error("Failed to get Google access token:", err);
    return NextResponse.json(
      { error: "Google Drive token expired or revoked. Please reconnect.", tokenError: true },
      { status: 403 }
    );
  }

  // Query the Google Drive API for files in the specified folder.
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    fields: "nextPageToken,files(id,name,mimeType,iconLink,thumbnailLink,modifiedTime,size,parents,webContentLink,webViewLink)",
    orderBy: "folder,modifiedTime desc",
    q: `'${folder}' in parents and trashed=false`,
    spaces: "drive",
  });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!driveRes.ok) {
    const errJson = await driveRes.json().catch(() => ({}));
    return NextResponse.json(
      {
        error: `Google Drive API error: ${errJson.error?.message ?? `HTTP ${driveRes.status}`}`,
      },
      { status: driveRes.status }
    );
  }

  const data = await driveRes.json();

  // Also return the connection info (for the UI to show the Google email).
  const connection = await getConnection(user.id);

  return NextResponse.json({
    files: data.files ?? [],
    nextPageToken: data.nextPageToken ?? null,
    connection: connection
      ? {
          google_email: connection.google_email,
          picture_url: connection.picture_url,
          connected_at: connection.connected_at,
        }
      : null,
  });
}
