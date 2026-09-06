import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnnouncementsBoard } from "@/components/brutal/announcements-board";
import { LiveClassChat } from "@/components/brutal/live-class-chat";
import type { ClassRoom, Profile } from "@/lib/types";

/**
 * Class Feed page at /dashboard/classes/[classId]/feed.
 *
 * Tabs:
 *   - Announcements — pinned-first list with tag badges, create modal,
 *     pin/unpin + delete for teachers.
 *   - Live Chat — Supabase Realtime-powered chat with sender role badges.
 *
 * Both tabs subscribe to Realtime so changes from any client appear
 * instantly without a refresh.
 */
export default async function FeedPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();
  if (!profile || profile.school_id !== cls.school_id) notFound();

  // Authorization: caller must be a class member.
  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin = profile.role === "principal" || profile.role === "staff";
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to {cls.name}
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-sky-300">
            <Megaphone className="size-3.5" />
            Class Feed
          </Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Announcements &amp; chat
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Stay in sync with your class. New announcements + chat messages appear
          instantly — no refresh needed.
        </p>
      </div>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">
            <Megaphone className="size-3.5" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageCircle className="size-3.5" />
            Live chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements">
          <AnnouncementsBoard classId={classId} profile={profile} />
        </TabsContent>

        <TabsContent value="chat">
          <LiveClassChat classId={classId} profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
