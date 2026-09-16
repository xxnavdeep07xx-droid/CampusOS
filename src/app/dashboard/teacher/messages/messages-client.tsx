"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  Mail,
  Send,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { ConversationSummary, DirectMessage, UserRole } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/storage";

/**
 * MessagesClient
 *
 * Two-pane layout:
 *   - Left: conversation list (clickable).
 *   - Right: message thread for the selected conversation.
 *
 * Realtime: subscribes to direct_messages INSERT events filtered by
 * recipient_id = caller. When a new message arrives, refetches the active
 * conversation + the inbox list.
 */
export function MessagesClient({
  currentUserId,
  currentUserRole,
  initialPeerId,
}: {
  currentUserId: string;
  currentUserRole: UserRole | null;
  initialPeerId?: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(initialPeerId ?? null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // When initialPeerId changes (deep-link from directory), update selection.
  useEffect(() => {
    if (initialPeerId && initialPeerId !== selectedPeerId) {
      setSelectedPeerId(initialPeerId);
    }
  }, [initialPeerId, selectedPeerId]);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/direct-messages", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setConversations(json.conversations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  const fetchThread = useCallback(async (peerId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/direct-messages?peer=${peerId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMessages(json.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox, refreshKey]);

  // Load thread when peer changes.
  useEffect(() => {
    if (selectedPeerId) fetchThread(selectedPeerId);
  }, [selectedPeerId, fetchThread, refreshKey]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Realtime: subscribe to inserts for the current user.
  useEffect(() => {
    let channel: any = null;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/browser");
        const supabase = createClient();
        channel = supabase
          .channel(`direct_messages:${currentUserId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `recipient_id=eq.${currentUserId}`,
            },
            (payload: any) => {
              // If the message is from the currently-selected peer, append it.
              const newMsg = payload.new as DirectMessage;
              if (newMsg.sender_id === selectedPeerId) {
                setMessages((prev) => [...prev, newMsg]);
              }
              // Always refresh the inbox list (latest message + unread count).
              setRefreshKey((k) => k + 1);
            }
          )
          .subscribe();
        unsub = () => supabase.removeChannel(channel);
      } catch (err) {
        console.warn("Realtime subscription failed:", err);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [currentUserId, selectedPeerId]);

  async function handleSend() {
    if (!selectedPeerId || !draft.trim()) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    setDraft("");
    try {
      const res = await fetch("/api/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: selectedPeerId, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      // Append the sent message to the thread.
      setMessages((prev) => [...prev, json.message as DirectMessage]);
      // Refresh the inbox (last message preview should update).
      setRefreshKey((k) => k + 1);
    } catch (err) {
      // Restore the draft so the user doesn't lose their message.
      setDraft(body);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);
  // Look up the selected peer's profile. First check the inbox list;
  // if not found there (deep-link with no prior conversation), we need to
  // fetch it separately.
  const selectedPeer = conversations.find((c) => c.peer.id === selectedPeerId)?.peer;
  const [fetchedPeer, setFetchedPeer] = useState<{ id: string; full_name: string; role: string } | null>(null);

  useEffect(() => {
    // If the selected peer is already in the inbox, no need to fetch.
    if (!selectedPeerId || conversations.some((c) => c.peer.id === selectedPeerId)) {
      setFetchedPeer(null);
      return;
    }
    // Otherwise, fetch the peer's profile via the direct-messages endpoint
    // (it returns an empty messages array + implicitly confirms the peer exists
    // via the RLS check). We can't fetch arbitrary profiles from the client
    // without an endpoint — so for now, we just show the peer ID and let the
    // first message reveal the name on inbox refresh.
    setFetchedPeer({ id: selectedPeerId, full_name: "(new conversation)", role: "" });
  }, [selectedPeerId, conversations]);

  const displayPeer = selectedPeer ?? (fetchedPeer as any);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-220px)]">
      {/* Inbox pane */}
      <div className="flex flex-col overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider">Inbox</span>
            {totalUnread > 0 && (
              <Badge variant="destructive">{totalUnread} unread</Badge>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingInbox ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Inbox className="mx-auto mb-2 size-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">No conversations yet</p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Open the Staff Directory to start a new conversation.
              </p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-slate-200">
              {conversations.map((c) => (
                <li key={c.peer.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedPeerId(c.peer.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-amber-50",
                      selectedPeerId === c.peer.id && "bg-amber-100"
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                      {(c.peer.full_name || "?").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {c.peer.full_name || "(no name)"}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {timeAgo(c.last_message.created_at)}
                        </span>
                      </div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {c.last_message.sender_id === currentUserId ? "You: " : ""}
                        {c.last_message.body}
                      </div>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-[#FDFBF7]">
                        {c.unread_count}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Conversation pane */}
      <div className="flex flex-col overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        {!selectedPeerId ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <Mail className="mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              Select a conversation to view messages
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Or start a new one from the Staff Directory.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPeerId(null)}
                  className="rounded-lg border-2 border-[#FDFBF7]/30 p-1 transition-all hover:bg-slate-800 lg:hidden"
                  aria-label="Back to inbox"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#FDFBF7] bg-amber-300 text-[10px] font-black uppercase text-slate-900">
                  {(displayPeer?.full_name || "?").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {displayPeer?.full_name ?? "Unknown"}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {displayPeer?.role || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages scroll area */}
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#FDFBF7] p-3">
              {loadingThread ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                  <p className="text-sm font-bold text-slate-700">No messages yet</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Send the first message below.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", isMine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-xl border-2 border-slate-900 px-3 py-2 text-sm shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                          isMine
                            ? "bg-emerald-500 text-[#FDFBF7]"
                            : "bg-white text-slate-900"
                        )}
                      >
                        <div className="whitespace-pre-line break-words">{m.body}</div>
                        <div
                          className={cn(
                            "mt-1 text-[10px] font-bold uppercase tracking-wider",
                            isMine ? "text-emerald-100" : "text-slate-400"
                          )}
                        >
                          {formatDateTime(m.created_at)}
                          {!isMine && m.read_at === null && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[#FDFBF7]">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t-2 border-slate-200 bg-white p-3">
              {error && (
                <div
                  role="alert"
                  className="mb-2 rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                >
                  {error}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Type a message…"
                  className="min-h-[44px] flex-1 resize-none border-2 border-slate-900 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  type="button"
                  variant="emerald"
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="h-11 w-11 shrink-0"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" strokeWidth={2.5} />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                ⌘+Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
