"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessagesClient } from "./messages-client";
import { GroupChatClient } from "./group-chat-client";
import type { UserRole } from "@/lib/types";

/**
 * MessagesPageClient — tab switcher between Direct Messages and Group Chats.
 */
export function MessagesPageClient({
  currentUserId,
  currentUserRole,
  initialPeerId,
  initialTab,
  staffList,
}: {
  currentUserId: string;
  currentUserRole: UserRole | null;
  initialPeerId: string | null;
  initialTab: string;
  staffList: { id: string; full_name: string; role: string }[];
}) {
  const [tab, setTab] = useState<"dms" | "groups">(
    initialTab === "groups" ? "groups" : "dms"
  );

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTab("dms")}
          className={cn(
            "rounded-lg border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
            tab === "dms"
              ? "bg-slate-900 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              : "bg-white text-slate-700 hover:bg-amber-50"
          )}
        >
          Direct Messages
        </button>
        <button
          type="button"
          onClick={() => setTab("groups")}
          className={cn(
            "rounded-lg border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
            tab === "groups"
              ? "bg-slate-900 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              : "bg-white text-slate-700 hover:bg-amber-50"
          )}
        >
          Group Chats
        </button>
      </div>

      {/* Active tab content */}
      {tab === "dms" ? (
        <MessagesClient
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          initialPeerId={initialPeerId}
        />
      ) : (
        <GroupChatClient
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          staffList={staffList}
        />
      )}
    </div>
  );
}
