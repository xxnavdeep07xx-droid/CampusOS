"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  HardDrive,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fileColorFor,
  fileColorBgClass,
  fileColorLabel,
} from "@/lib/types";
import { formatFileSize, formatDate } from "@/lib/storage";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
};

type Connection = {
  google_email: string | null;
  picture_url: string | null;
  connected_at: string;
} | null;

type ClassInfo = {
  id: string;
  name: string;
} | null;

/**
 * GoogleDriveClient
 *
 * Renders the Google Drive integration panel:
 *   - If not connected: "Connect Google Drive" button (links to OAuth flow).
 *   - If connected: file browser with breadcrumb navigation, download, +
 *     "Import to class" action (opens a modal to pick which class to
 *     import the file into).
 *
 * Also shows error banners for OAuth failures (via URL query params:
 * ?google_error=..., ?google_connected=1).
 */
export function GoogleDriveClient({
  classes,
  isConfigured,
}: {
  classes: { id: string; name: string }[];
  isConfigured: boolean;
}) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [connection, setConnection] = useState<Connection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [importTarget, setImportTarget] = useState<DriveFile | null>(null);
  const [importClassId, setImportClassId] = useState<string>(classes[0]?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchFiles = useCallback(async (folder: string) => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const res = await fetch(`/api/google-drive/list?folder=${encodeURIComponent(folder)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.notConnected) {
          setNotConnected(true);
          setFiles([]);
          setConnection(null);
          return;
        }
        if (json.tokenError) {
          setNotConnected(true);
          setError(json.error);
          return;
        }
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setFiles(json.files ?? []);
      setConnection(json.connection ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Check URL for OAuth callback params on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("google_error");
    const success = params.get("google_connected");
    if (err) {
      const errorMessages: Record<string, string> = {
        access_denied: "You denied access to Google Drive. Please try again and grant consent.",
        missing_params: "Google returned an incomplete response. Please try again.",
        auth_mismatch: "Authentication mismatch. Please sign in again and retry.",
        no_refresh_token: "Google didn't return a refresh token. Please revoke access in your Google Account settings and try again.",
        storage_failed: "Failed to store the Google Drive connection. Please try again.",
      };
      setOauthError(errorMessages[err] ?? `Connection failed: ${err}`);
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (success === "1") {
      setOauthSuccess(true);
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setOauthSuccess(false), 5000);
    }
  }, []);

  // Initial fetch.
  useEffect(() => {
    if (isConfigured) {
      fetchFiles("root");
    } else {
      setLoading(false);
    }
  }, [fetchFiles, isConfigured]);

  function navigateToFolder(file: DriveFile) {
    if (!file.mimeType.includes("folder")) return;
    setCurrentFolder(file.id);
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
    fetchFiles(file.id);
  }

  function navigateToBreadcrumb(idx: number) {
    const newCrumbs = breadcrumbs.slice(0, idx + 1);
    setBreadcrumbs(newCrumbs);
    setCurrentFolder(newCrumbs[newCrumbs.length - 1].id);
    fetchFiles(newCrumbs[newCrumbs.length - 1].id);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Drive? You'll need to reconnect to browse your files.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-drive/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setNotConnected(true);
      setFiles([]);
      setConnection(null);
      setBreadcrumbs([{ id: "root", name: "My Drive" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleImport() {
    if (!importTarget || !importClassId) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: importTarget.id,
          classId: importClassId,
          title: importTarget.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setImportSuccess(`"${importTarget.name}" imported to ${classes.find((c) => c.id === importClassId)?.name}.`);
      setImportTarget(null);
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  // If Google Drive env vars aren't configured, show a setup banner.
  if (!isConfigured) {
    return (
      <Card className="overflow-hidden border-amber-500 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]">
        <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-amber-400" />
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200">
              <AlertCircle className="size-4 text-amber-700" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Google Drive integration not configured
              </div>
              <p className="text-xs font-medium text-slate-600">
                Set <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">GOOGLE_CLIENT_ID</code> +{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">GOOGLE_CLIENT_SECRET</code> env vars to enable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* OAuth success banner */}
      {oauthSuccess && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="size-4" />
          Google Drive connected successfully!
        </div>
      )}

      {/* OAuth error banner */}
      {oauthError && (
        <div className="flex items-start gap-2 rounded-lg border-2 border-rose-500 bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{oauthError}</span>
          <button
            type="button"
            onClick={() => setOauthError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Import success banner */}
      {importSuccess && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="size-4" />
          {importSuccess}
        </div>
      )}

      {/* Connection status + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-sky-300">
            <HardDrive className="size-4 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-tight text-slate-900">
              Google Drive
            </div>
            {connection ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {connection.google_email ? (
                  <>
                    {connection.picture_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={connection.picture_url}
                        alt=""
                        className="size-4 rounded-full"
                      />
                    )}
                    {connection.google_email}
                  </>
                ) : (
                  "Connected"
                )}
              </div>
            ) : (
              <div className="text-xs font-medium text-slate-500">Not connected</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notConnected ? (
            <a
              href="/api/google-drive/auth"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-sky-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(7,89,133,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(7,89,133,1)]"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Connect Google Drive
            </a>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchFiles(currentFolder)}
                disabled={loading}
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>

      {/* File browser (only when connected) */}
      {!notConnected && (
        <>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold text-slate-900">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.id} className="flex items-center gap-1 whitespace-nowrap">
                {idx > 0 && <ChevronRight className="size-3 text-slate-400" />}
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(idx)}
                  className={cn(
                    "rounded px-1.5 py-0.5 transition-all hover:bg-amber-100",
                    idx === breadcrumbs.length - 1 && "bg-amber-100"
                  )}
                >
                  {idx === 0 && <HardDrive className="mr-1 inline size-3" />}
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border-2 border-rose-500 bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* File list */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Loading Google Drive…
            </div>
          ) : files.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <HardDrive className="mx-auto mb-3 size-10 text-slate-400" />
                <p className="text-sm font-bold text-slate-900">This folder is empty</p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Upload files to your Google Drive to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {files.map((file) => {
                const isFolder = file.mimeType.includes("folder");
                const color = fileColorFor(file.name, file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 transition-all hover:border-slate-900 hover:bg-amber-50"
                  >
                    {/* Icon */}
                    <button
                      type="button"
                      onClick={() => isFolder && navigateToFolder(file)}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900",
                        isFolder ? "bg-amber-200" : fileColorBgClass(color)
                      )}
                    >
                      {isFolder ? (
                        <Folder className="size-4 text-slate-900" strokeWidth={2.5} />
                      ) : (
                        <FileIcon className="size-4 text-slate-900" strokeWidth={2.5} />
                      )}
                    </button>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => isFolder && navigateToFolder(file)}
                        className="block truncate text-left text-sm font-bold text-slate-900 hover:underline"
                      >
                        {file.name}
                      </button>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {isFolder ? (
                          <span>Folder</span>
                        ) : (
                          <>
                            <span>{fileColorLabel(color)}</span>
                            {file.size && <span>· {formatFileSize(Number(file.size))}</span>}
                          </>
                        )}
                        <span>· Modified {formatDate(file.modifiedTime)}</span>
                      </div>
                    </div>

                    {/* Actions (files only, not folders) */}
                    {!isFolder && (
                      <div className="flex items-center gap-1.5">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border-2 border-slate-900 bg-sky-300 p-1.5 transition-all hover:bg-sky-400"
                            aria-label="Open in Google Drive"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="size-3.5 text-slate-900" />
                          </a>
                        )}
                        <a
                          href={`/api/google-drive/download?fileId=${file.id}`}
                          className="rounded-lg border-2 border-slate-900 bg-emerald-300 p-1.5 transition-all hover:bg-emerald-400"
                          aria-label="Download"
                          title="Download"
                        >
                          <Download className="size-3.5 text-slate-900" />
                        </a>
                        {classes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setImportTarget(file);
                              setImportClassId(classes[0]?.id ?? "");
                              setImportError(null);
                            }}
                            className="rounded-lg border-2 border-slate-900 bg-amber-300 p-1.5 transition-all hover:bg-amber-400"
                            aria-label="Import to class"
                            title="Import to class resources"
                          >
                            <Upload className="size-3.5 text-slate-900" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Import modal */}
      <Dialog open={importTarget !== null} onOpenChange={(v) => { if (!v) setImportTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import to class resources</DialogTitle>
            <DialogDescription>
              Import &ldquo;{importTarget?.name}&rdquo; from Google Drive into one of your
              classes. Students will be able to download it from the class Resources tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Class
              </label>
              <select
                value={importClassId}
                onChange={(e) => setImportClassId(e.target.value)}
                className="h-10 w-full rounded-lg border-2 border-slate-900 bg-[#FDFBF7] px-3 text-sm font-bold text-slate-900 focus:outline-none"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {importError && (
              <div className="rounded-lg border-2 border-rose-500 bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">
                {importError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportTarget(null)} disabled={importing}>
              Cancel
            </Button>
            <Button
              variant="sky"
              onClick={handleImport}
              disabled={importing || !importClassId}
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Import to class
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
