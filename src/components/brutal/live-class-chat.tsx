"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClassMessage, Profile, UserRole } from "@/lib/types";
import { formatDateTime } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * LiveClassChat — real-time chat sidebar for a class.
 *
 * Initial load: GET /api/class-messages?classId=X (returns the most recent
 * 100 messages, oldest first).
 *
 * Realtime: subscribes to Supabase Realtime `postgres_changes` on the
 * `class_messages` table filtered by class_id. New INSERT events prepend
 * a message to the list + auto-scroll to the bottom.
 *
 * Sender badges:
 *   - Teacher  → bg-amber-300 border-2 border-black font-bold
 *   - Student  → bg-sky-300
 *   - Staff / Principal → bg-violet-300
 *   - "You" (the caller) → outlined card on the right side of the row
 */
export function LiveClassChat({
  classId,
  profile,
}: {
  classId: string;
  profile: Profile;
}) {
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/class-messages?classId=${classId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMessages(json.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription.
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/browser");
        const supabase = createClient();
        const channel = supabase
          .channel(`class_messages:${classId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "class_messages",
              filter: `class_id=eq.${classId}`,
            },
            (payload) => {
              const newMsg = payload.new as ClassMessage;
              // If the sender profile wasn't joined in the Realtime payload,
              // try to look it up in the existing messages cache. If we can't
              // find it, fetch /api/class-messages to refresh.
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                // Optimistic — we already have the sender info locally for
                // messages the caller just sent (POST returns the full row
                // with the sender). For Realtime INSERTs from other users,
                // we may not have the sender name. Refetch to populate.
                return [...prev, newMsg];
              });
              // Trigger a refetch to populate the sender relation if missing.
              if (!newMsg.sender) {
                fetchMessages();
              }
            }
          )
          .on("postgres_changes", {
            event: "DELETE",
            schema: "public",
            table: "class_messages",
            filter: `class_id=eq.${classId}`,
          }, () => {
            // A message was deleted (e.g. user "undo send"). Refetch.
            fetchMessages();
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
          });
        cleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch (err) {
        console.warn("Realtime subscription failed:", err);
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [classId, fetchMessages]);

  // Auto-scroll to bottom on new messages if the user was already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distFromBottom < 80;
  };

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // Optimistic: append a placeholder message from the caller.
    const optimistic: ClassMessage = {
      id: `optimistic-${Date.now()}`,
      class_id: classId,
      sender_id: profile.id,
      content: text,
      created_at: new Date().toISOString(),
      sender: { id: profile.id, full_name: profile.full_name, role: profile.role },
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    wasAtBottomRef.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/class-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, content: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      // Replace the optimistic message with the real one.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? (json.message as ClassMessage) : m
        )
      );
    } catch (err) {
      // Remove the optimistic message + show error.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text); // restore the input
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
          <MessageCircle className="size-5" strokeWidth={2.5} />
          Live class chat
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            )}
            aria-hidden
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {connected ? "Realtime · live" : "Connecting…"}
          </span>
        </div>
      </div>

      {/* Chat box */}
      <div className="overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
          <span className="text-xs font-black uppercase tracking-wider">
            # class-chat
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-[calc(100vh-380px)] min-h-[260px] space-y-3 overflow-y-auto bg-[#FDFBF7] p-4"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Loader2 className="size-4 animate-spin" />
              Loading messages…
            </div>
          ) : error && messages.length === 0 ? (
            <div className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="size-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">
                No messages yet
              </p>
              <p className="text-xs font-medium text-slate-500">
                Send the first message — it appears instantly for everyone in the class.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <MessageRow key={m.id} msg={m} isMe={m.sender_id === profile.id} />
            ))
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t-2 border-slate-900 bg-white p-2"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" variant="emerald" disabled={sending || !input.trim()}>
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>

      {error && messages.length > 0 && (
        <div className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Single message row
// ============================================================

function MessageRow({ msg, isMe }: { msg: ClassMessage; isMe: boolean }) {
  const senderName = msg.sender?.full_name ?? "Unknown";
  const role = msg.sender?.role;
  const isTeacher = role === "teacher";
  const isStaff = role === "principal" || role === "staff";
  const optimistic = msg.id.startsWith("optimistic-");

  return (
    <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
            isTeacher && "bg-amber-300 text-slate-900",
            isStaff && !isTeacher && "bg-violet-300 text-slate-900",
            !isTeacher && !isStaff && "bg-sky-300 text-slate-900"
          )}
        >
          {isTeacher && "Teacher"}
          {isStaff && !isTeacher && role}
          {!isTeacher && !isStaff && "Student"}
          {" · "}
          {senderName}
          {isMe && " (you)"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {optimistic ? "sending…" : formatDateTime(msg.created_at)}
        </span>
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-xl border-2 border-slate-900 px-3 py-2 text-sm font-medium shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
          isMe ? "bg-emerald-100" : "bg-white",
          optimistic && "opacity-70"
        )}
      >
        <p className="whitespace-pre-line break-words text-slate-900">{msg.content}</p>
      </div>
    </div>
  );
}
