"use client";

import { useState } from "react";
import { QrCode, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrutalQR } from "@/components/brutal/qr";
import { CopyButton } from "@/components/brutal/copy-button";
import type { UserRole } from "@/lib/types";

/**
 * InviteCard — the client component that:
 *   1. Triggers POST /api/invitations to create a new invite.
 *   2. Renders the resulting shareable URL + QR code in a bordered card.
 *   3. Lets the user copy the URL to clipboard.
 *
 * Used by both the principal dashboard (staff/teacher invites) and the
 * teacher dashboard (student invites for a specific class).
 */
export function InviteCard({
  role,
  classId,
  title,
  description,
  accentColor = "bg-emerald-500",
  ctaLabel = "Generate invite",
}: {
  role: UserRole;
  classId?: string;
  title: string;
  description: string;
  accentColor?: string;
  ctaLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    token: string;
    role: string;
  } | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, classId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not generate invite.");
        return;
      }
      setResult({
        url: json.url,
        token: json.token,
        role: json.role,
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Accent top bar */}
      <div className={`h-2 w-full border-x-2 border-t-2 border-slate-900 ${accentColor}`} />
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="capitalize">
            <Users className="size-3" />
            {role}
          </Badge>
          {classId && (
            <span className="font-mono text-xs text-slate-500">
              class: {classId.slice(0, 8)}…
            </span>
          )}
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="emerald"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <QrCode className="size-4" />
              {ctaLabel}
            </>
          )}
        </Button>

        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
          >
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border-2 border-slate-900 bg-[#FDFBF7] p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <BrutalQR value={result.url} size={140} />
              <div className="flex-1 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Shareable link
                </div>
                <div className="break-all rounded-lg border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  {result.url}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton value={result.url} label="Copy URL" />
                  <CopyButton value={result.token} label="Copy token" />
                </div>
                <p className="pt-2 text-xs font-medium text-slate-600">
                  Send this link to the {result.role}. The link is one-use — once
                  they register, the token is marked as used.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
