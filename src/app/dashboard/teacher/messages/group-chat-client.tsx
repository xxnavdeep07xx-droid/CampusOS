"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CornerUpLeft,
  GroupIcon,
  Loader2,
  Plus,
  Reply,
  Send,
  Settings,
  Smile,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatGroupSummary, ChatGroupMessage, ChatGroupMember, UserRole } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/storage";

const GROUP_COLORS = [
  { name: "Sky", value: "bg-sky-400" },
  { name: "Emerald", value: "bg-emerald-400" },
  { name: "Violet", value: "bg-violet-400" },
  { name: "Amber", value: "bg-amber-400" },
  { name: "Rose", value: "bg-rose-400" },
];

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "👀", "🙌"];

type TypingUser = { userId: string; name: string; at: number };

/**
 * GroupChatClient
 *
 * Features:
 *   - Group list with last message preview + member count
 *   - Create group modal (principals + teachers)
 *   - Realtime group chat thread
 *   - Emoji reactions on messages (toggle)
 *   - Typing indicators (broadcast via Supabase Realtime presence)
 *   - Reply to messages (threaded)
 *   - Delete own messages
 *   - Member management (add/remove/leave)
 */
export function GroupChatClient({
  currentUserId,
  currentUserRole,
  staffList,
}: {
  currentUserId: string;
  currentUserRole: UserRole | null;
  staffList: { id: string; full_name: string; role: string }[];
}) {
  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatGroupMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [members, setMembers] = useState<ChatGroupMember[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatGroupMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<any>(null);

  const canCreateGroups = currentUserRole === "principal" || currentUserRole === "teacher";

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-groups", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setGroups(json.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThread = useCallback(async (groupId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/chat-groups/${groupId}/messages?limit=200`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMessages(json.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/chat-groups/${groupId}/members`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMembers(json.members ?? []);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups, refreshKey]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchThread(selectedGroupId);
      fetchMembers(selectedGroupId);
      setReplyingTo(null);
    }
  }, [selectedGroupId, fetchThread, fetchMembers, refreshKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Realtime: subscribe to new group messages + reactions.
  useEffect(() => {
    if (!selectedGroupId) return;
    let channel: any = null;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/browser");
        const supabase = createClient();
        channel = supabase
          .channel(`group_messages:${selectedGroupId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_group_messages",
              filter: `group_id=eq.${selectedGroupId}`,
            },
            (payload: any) => {
              const newMsg = payload.new as ChatGroupMessage;
              if (newMsg.sender_id !== currentUserId) {
                // Fetch the full message with sender join
                fetch(`/api/chat-groups/${selectedGroupId}/messages?limit=200`)
                  .then((r) => r.json())
                  .then((json) => {
                    if (json.messages) {
                      // Just append the new message (avoid full refetch)
                      setMessages((prev) => {
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, { ...newMsg, sender: undefined, reactions: [] }];
                      });
                    }
                  });
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "chat_group_message_reactions",
            },
            () => {
              // Refetch thread to get updated reactions
              fetchThread(selectedGroupId);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "chat_group_messages",
              filter: `group_id=eq.${selectedGroupId}`,
            },
            (payload: any) => {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setMessages((prev) => prev.filter((m) => m.id !== deletedId));
              }
            }
          )
          // Typing indicator via broadcast
          .on("broadcast", { event: "typing" }, (payload: any) => {
            const { userId, name } = payload.payload;
            if (userId !== currentUserId) {
              setTypingUsers((prev) => {
                const filtered = prev.filter((u) => u.userId !== userId);
                return [...filtered, { userId, name, at: Date.now() }];
              });
            }
          })
          .on("broadcast", { event: "stop_typing" }, (payload: any) => {
            const { userId } = payload.payload;
            if (userId !== currentUserId) {
              setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
            }
          })
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED" && typingChannelRef.current !== channel) {
              typingChannelRef.current = channel;
            }
          });
        unsub = () => supabase.removeChannel(channel);
      } catch (err) {
        console.warn("Realtime subscription failed:", err);
      }
    })();
    return () => {
      if (unsub) unsub();
      typingChannelRef.current = null;
      setTypingUsers([]);
    };
  }, [selectedGroupId, currentUserId, fetchThread]);

  // Clear stale typing indicators (older than 3 seconds).
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => prev.filter((u) => Date.now() - u.at < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleSend() {
    if (!selectedGroupId || !draft.trim()) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    setReplyingTo(null);

    // Stop typing broadcast
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "stop_typing",
        payload: { userId: currentUserId },
      });
    }

    try {
      const res = await fetch(`/api/chat-groups/${selectedGroupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          replyToId: replyingTo?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMessages((prev) => [...prev, json.message as ChatGroupMessage]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDraft(body);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    setShowReactionsFor(null);
    try {
      const res = await fetch(
        `/api/chat-groups/${selectedGroupId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle reaction");
      // The realtime subscription will refetch the thread.
    } catch (err) {
      console.error("Reaction toggle failed:", err);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;
    if (!selectedGroupId) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      const res = await fetch(
        `/api/chat-groups/${selectedGroupId}/messages/${messageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      // Revert
      fetchThread(selectedGroupId);
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function handleTyping() {
    if (!typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUserId,
        name: "Someone", // The UI will show the name from the broadcast
      },
    });
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const isAdmin = selectedGroup?.my_role === "admin" || currentUserRole === "principal" || currentUserRole === "staff";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <GroupIcon className="size-4" />
            Group Chats
          </h2>
          <p className="text-xs font-medium text-slate-600">
            {groups.length} {groups.length === 1 ? "group" : "groups"}
          </p>
        </div>
        {canCreateGroups && (
          <Button variant="sky" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4" />
            New group
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Loading groups…
        </div>
      ) : groups.length === 0 && !selectedGroupId ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white py-10 text-center">
          <Users className="mx-auto mb-3 size-10 text-slate-400" />
          <p className="text-sm font-bold text-slate-900">No groups yet</p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {canCreateGroups
              ? "Create a group to start chatting with multiple people."
              : "You haven't been added to any groups yet."}
          </p>
        </div>
      ) : !selectedGroupId ? (
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-900 hover:bg-amber-50"
            >
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 text-xs font-black uppercase text-slate-900", g.color)}>
                {g.name.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">{g.name}</span>
                  {g.last_message && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {timeAgo(g.last_message.created_at)}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs font-medium text-slate-500">
                  {g.last_message?.body ?? `${g.member_count} ${g.member_count === 1 ? "member" : "members"}`}
                </div>
              </div>
              {g.my_role === "admin" && (
                <Badge variant="emerald" className="shrink-0 text-[9px]">Admin</Badge>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedGroupId(null)}
                className="rounded-lg border-2 border-[#FDFBF7]/30 p-1 transition-all hover:bg-slate-800"
                aria-label="Back to groups"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className={cn("flex size-8 items-center justify-center rounded-lg border-2 border-[#FDFBF7] text-[10px] font-black uppercase", selectedGroup?.color)}>
                {selectedGroup?.name.slice(0, 2) ?? "??"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{selectedGroup?.name}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedGroup?.member_count ?? members.length} {((selectedGroup?.member_count ?? members.length) === 1) ? "member" : "members"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMembers(true)}
              className="rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-slate-700"
            >
              <Settings className="inline size-3" /> Members
            </button>
          </div>

          {/* Messages */}
          <div className="max-h-[400px] min-h-[300px] space-y-2 overflow-y-auto bg-[#FDFBF7] p-3">
            {loadingThread ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                <p className="text-sm font-bold text-slate-700">No messages yet</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Send the first message below.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === currentUserId;
                const senderName = m.sender?.full_name ?? "Unknown";
                // Find the message being replied to
                const repliedTo = m.reply_to_id
                  ? messages.find((x) => x.id === m.reply_to_id)
                  : null;
                return (
                  <div key={m.id} className={cn("group relative flex flex-col", isMine ? "items-end" : "items-start")}>
                    {/* Reply preview */}
                    {repliedTo && (
                      <div className={cn("mb-1 max-w-[70%] truncate rounded-lg border-l-4 border-slate-400 bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600", isMine ? "mr-1" : "ml-1")}>
                        <span className="font-bold">{repliedTo.sender?.full_name ?? "Unknown"}:</span> {repliedTo.body}
                      </div>
                    )}
                    <div className="flex items-end gap-1">
                      <div
                        className={cn(
                          "max-w-[80%] rounded-xl border-2 border-slate-900 px-3 py-2 text-sm shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                          isMine ? "bg-emerald-500 text-[#FDFBF7]" : "bg-white text-slate-900"
                        )}
                      >
                        {!isMine && (
                          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-600">
                            {senderName}
                          </div>
                        )}
                        <div className="whitespace-pre-line break-words">{m.body}</div>
                        <div className={cn("mt-1 flex items-center gap-1", isMine ? "text-emerald-100" : "text-slate-400")}>
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {formatDateTime(m.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setReplyingTo(m)}
                          className="rounded border border-slate-300 bg-white p-1 text-slate-500 hover:bg-sky-100 hover:text-sky-700"
                          aria-label="Reply"
                          title="Reply"
                        >
                          <Reply className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReactionsFor(showReactionsFor === m.id ? null : m.id)}
                          className="rounded border border-slate-300 bg-white p-1 text-slate-500 hover:bg-amber-100 hover:text-amber-700"
                          aria-label="React"
                          title="Add reaction"
                        >
                          <Smile className="size-3" />
                        </button>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            className="rounded border border-slate-300 bg-white p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reactions */}
                    {m.reactions && m.reactions.length > 0 && (
                      <div className={cn("mt-1 flex flex-wrap gap-1", isMine ? "justify-end" : "justify-start")}>
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, r.emoji)}
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold transition-all",
                              r.reactedByMe
                                ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction picker popover */}
                    {showReactionsFor === m.id && (
                      <div className={cn("absolute z-10 mt-1 flex gap-1 rounded-lg border-2 border-slate-900 bg-white p-1.5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]", isMine ? "right-0" : "left-0")}>
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className="flex size-7 items-center justify-center rounded text-base transition-all hover:bg-amber-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="flex gap-0.5">
                  <span className="size-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <span className="size-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <span className="size-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </span>
                {typingUsers.length === 1
                  ? `${typingUsers[0].name} is typing…`
                  : `${typingUsers.length} people are typing…`}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply preview bar */}
          {replyingTo && (
            <div className="flex items-center gap-2 border-t-2 border-slate-200 bg-amber-50 px-3 py-1.5">
              <CornerUpLeft className="size-3.5 text-slate-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Replying to {replyingTo.sender?.full_name ?? "Unknown"}
                </div>
                <div className="truncate text-xs text-slate-700">{replyingTo.body}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Cancel reply"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t-2 border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  handleTyping();
                }}
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
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" strokeWidth={2.5} />}
              </Button>
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ⌘+Enter to send
            </p>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        staffList={staffList}
        currentUserId={currentUserId}
        onCreated={(groupId) => {
          setShowCreateModal(false);
          setRefreshKey((k) => k + 1);
          setSelectedGroupId(groupId);
        }}
      />

      {/* Members Modal */}
      <MembersModal
        open={showMembers}
        onOpenChange={setShowMembers}
        groupId={selectedGroupId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        staffList={staffList}
        onMembersChanged={() => {
          if (selectedGroupId) fetchMembers(selectedGroupId);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function CreateGroupModal({
  open,
  onOpenChange,
  staffList,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staffList: { id: string; full_name: string; role: string }[];
  currentUserId: string;
  onCreated: (groupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("bg-sky-400");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setColor("bg-sky-400");
    setSelectedMembers(new Set());
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chat-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          memberIds: Array.from(selectedMembers),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      reset();
      onCreated(json.group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  const availableStaff = staffList.filter((s) => s.id !== currentUserId);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Create a group for a department, grade level, or committee.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              type="text"
              placeholder="e.g. Math Department"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={creating}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-desc">Description (optional)</Label>
            <Input
              id="group-desc"
              type="text"
              placeholder="e.g. All math teachers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border-2 border-slate-900 transition-all",
                    c.value,
                    color === c.value ? "ring-2 ring-slate-900 ring-offset-2" : ""
                  )}
                  aria-label={c.name}
                >
                  {color === c.value && <span className="text-xs font-black text-slate-900">✓</span>}
                </button>
              ))}
            </div>
          </div>
          {availableStaff.length > 0 && (
            <div className="space-y-2">
              <Label>Add members (optional — you can add more later)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border-2 border-slate-200 bg-[#FDFBF7] p-2">
                {availableStaff.map((s) => {
                  const selected = selectedMembers.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedMembers((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all",
                        selected ? "bg-emerald-100" : "hover:bg-slate-100"
                      )}
                    >
                      <div className="flex size-7 items-center justify-center rounded border-2 border-slate-900 bg-amber-200 text-[10px] font-black uppercase text-slate-900">
                        {(s.full_name || "?").slice(0, 2)}
                      </div>
                      <span className="flex-1 truncate text-xs font-bold text-slate-900">{s.full_name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.role}</span>
                      {selected && <span className="text-emerald-600">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="sky" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersModal({
  open,
  onOpenChange,
  groupId,
  members,
  currentUserId,
  isAdmin,
  staffList,
  onMembersChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string | null;
  members: ChatGroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  staffList: { id: string; full_name: string; role: string }[];
  onMembersChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.user_id));
  const addableStaff = staffList.filter((s) => !memberIds.has(s.id));

  async function handleRemove(userId: string) {
    if (!groupId) return;
    setRemoving(userId);
    try {
      const res = await fetch(`/api/chat-groups/${groupId}/members?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove member");
      onMembersChanged();
    } catch (err) {
      alert("Failed to remove member");
    } finally {
      setRemoving(null);
    }
  }

  async function handleAdd(userId: string) {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/chat-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed");
      }
      onMembersChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLeave() {
    if (!groupId) return;
    if (!confirm("Leave this group?")) return;
    try {
      await fetch(`/api/chat-groups/${groupId}/members?userId=${currentUserId}`, { method: "DELETE" });
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      alert("Failed to leave group");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Group members</DialogTitle>
          <DialogDescription>
            {members.length} {members.length === 1 ? "member" : "members"} in this group.
          </DialogDescription>
        </DialogHeader>

        {isAdmin && !showAdd && addableStaff.length > 0 && (
          <Button variant="sky" size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="size-4" />
            Add member
          </Button>
        )}

        {showAdd && (
          <div className="space-y-1 rounded-lg border-2 border-slate-200 bg-[#FDFBF7] p-2">
            {addableStaff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  handleAdd(s.id);
                  setShowAdd(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-slate-100"
              >
                <div className="flex size-7 items-center justify-center rounded border-2 border-slate-900 bg-amber-200 text-[10px] font-black uppercase text-slate-900">
                  {(s.full_name || "?").slice(0, 2)}
                </div>
                <span className="flex-1 truncate text-xs font-bold text-slate-900">{s.full_name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.role}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border-2 border-slate-200 px-2 py-1.5">
              <div className="flex size-7 items-center justify-center rounded border-2 border-slate-900 bg-amber-200 text-[10px] font-black uppercase text-slate-900">
                {(m.profile?.full_name || "?").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-900">
                  {m.profile?.full_name ?? "Unknown"}
                  {m.user_id === currentUserId && <span className="ml-1 text-slate-400">(you)</span>}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.profile?.role}</div>
              </div>
              {m.role === "admin" && <Badge variant="emerald" className="text-[9px]">Admin</Badge>}
              {isAdmin && m.user_id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.user_id)}
                  disabled={removing === m.user_id}
                  className="rounded border-2 border-slate-300 bg-white p-1 text-slate-500 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                  aria-label="Remove member"
                >
                  {removing === m.user_id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                </button>
              )}
            </div>
          ))}
        </div>

        {!isAdmin && (
          <Button variant="outline" size="sm" onClick={handleLeave} className="w-full">
            <Trash2 className="size-4" />
            Leave group
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
