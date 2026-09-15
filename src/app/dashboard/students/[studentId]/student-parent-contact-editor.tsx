"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * StudentParentContactEditor
 *
 * Lets the teacher edit parent_contact / parent_phone / behavioral_notes
 * for a student profile. Saves via PATCH /api/profiles/[id] — a generic
 * profile-edit route that's guarded by the SQL trigger installed in
 * migration 0009 to prevent privilege escalation (role/school_id are
 * read-only).
 *
 * Until we add a dedicated /api/profiles/[id] route, this component posts
 * to a small inline handler at /api/students/[id]/profile.
 */
export function StudentParentContactEditor({
  studentId,
  initialParentContact,
  initialParentPhone,
  initialBehavioralNotes,
}: {
  studentId: string;
  initialParentContact: string;
  initialParentPhone: string;
  initialBehavioralNotes: string;
}) {
  const [parentContact, setParentContact] = useState(initialParentContact);
  const [parentPhone, setParentPhone] = useState(initialParentPhone);
  const [behavioralNotes, setBehavioralNotes] = useState(initialBehavioralNotes);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentContact: parentContact.trim(),
          parentPhone: parentPhone.trim(),
          behavioralNotes: behavioralNotes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    parentContact !== initialParentContact ||
    parentPhone !== initialParentPhone ||
    behavioralNotes !== initialBehavioralNotes;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="parent-contact">Parent / guardian name</Label>
        <Input
          id="parent-contact"
          type="text"
          placeholder="e.g. Priya Sharma (mother)"
          value={parentContact}
          onChange={(e) => setParentContact(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent-phone">Parent / guardian phone</Label>
        <Input
          id="parent-phone"
          type="tel"
          placeholder="e.g. +91 98765 43210"
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="behavioral-notes">Long-term behavioral notes</Label>
        <Textarea
          id="behavioral-notes"
          rows={4}
          placeholder="IEP, allergies, recurring patterns, accommodations…"
          value={behavioralNotes}
          onChange={(e) => setBehavioralNotes(e.target.value)}
          disabled={saving}
        />
        <p className="text-[10px] font-medium text-slate-500">
          Different from the behavior log — these are persistent notes about
          the student.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="emerald"
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : savedFlash ? (
            <>
              <Check className="size-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save changes
            </>
          )}
        </Button>
        {dirty && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
