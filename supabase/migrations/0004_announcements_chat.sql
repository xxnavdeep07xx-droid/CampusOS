-- ============================================================
-- CampusOS — Phase 4: Interactive Digital Board (Whiteboard)
--                  & Real-Time Class Announcements
--
-- Tables: announcements, class_messages
-- Realtime: enabled on both tables via the supabase_realtime publication
-- RLS: enrolled students + the class teacher can read + post.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 1. ANNOUNCEMENTS ----------
CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  tag         text NOT NULL DEFAULT 'general'
              CHECK (tag IN ('important', 'update', 'assignment', 'general')),
  is_pinned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_class_id_idx     ON public.announcements(class_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx   ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_is_pinned_idx    ON public.announcements(is_pinned);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_touch_updated_at ON public.announcements;
CREATE TRIGGER announcements_touch_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 2. CLASS_MESSAGES (live chat) ----------
CREATE TABLE IF NOT EXISTS public.class_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_messages_class_id_idx       ON public.class_messages(class_id);
CREATE INDEX IF NOT EXISTS class_messages_created_at_idx     ON public.class_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS class_messages_class_id_created   ON public.class_messages(class_id, created_at DESC);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.announcements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "announcements_select_class_members" ON public.announcements;
DROP POLICY IF EXISTS "announcements_insert_teacher"        ON public.announcements;
DROP POLICY IF EXISTS "announcements_update_teacher"        ON public.announcements;
DROP POLICY IF EXISTS "announcements_delete_teacher"        ON public.announcements;

DROP POLICY IF EXISTS "class_messages_select_class_members" ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_insert_class_members"  ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_delete_own"            ON public.class_messages;

-- 3.1 ANNOUNCEMENTS — class members can read; only the teacher (or a
-- principal/staff of the school) can create/update/delete. Students are
-- read-only here (they cannot post announcements, only chat messages).
CREATE POLICY "announcements_select_class_members" ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_class_school_member(class_id));

CREATE POLICY "announcements_insert_teacher" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_class_teacher(class_id)
    OR (
      public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

CREATE POLICY "announcements_update_teacher" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    public.is_class_teacher(class_id)
    OR (
      public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  )
  WITH CHECK (
    public.is_class_teacher(class_id)
    OR (
      public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

CREATE POLICY "announcements_delete_teacher" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    public.is_class_teacher(class_id)
    OR (
      public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

-- 3.2 CLASS_MESSAGES — anyone in the class can read + send. Users can
-- delete their own messages (handy for "undo send" flows).
CREATE POLICY "class_messages_select_class_members" ON public.class_messages
  FOR SELECT TO authenticated
  USING (public.is_class_school_member(class_id));

CREATE POLICY "class_messages_insert_class_members" ON public.class_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_class_school_member(class_id)
  );

CREATE POLICY "class_messages_delete_own" ON public.class_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());


-- ============================================================
-- 4. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements, public.class_messages TO authenticated;


-- ============================================================
-- 5. ENABLE SUPABASE REALTIME
-- ============================================================
-- Add both tables to the supabase_realtime publication so the
-- @supabase/supabase-js client can subscribe to postgres_changes
-- events (INSERT, UPDATE, DELETE).
--
-- We use ALTER PUBLICATION ... ADD TABLE (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'class_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;
  END IF;
END $$;

-- Also make sure the publication has replica identity set so UPDATE/DELETE
-- events carry the full row (not just the primary key). This is required
-- for the Realtime client to know which row changed.
ALTER TABLE public.announcements  REPLICA IDENTITY FULL;
ALTER TABLE public.class_messages  REPLICA IDENTITY FULL;


-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('announcements', 'class_messages');
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
