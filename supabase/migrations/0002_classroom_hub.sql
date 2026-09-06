-- ============================================================
-- CampusOS — Phase 2: Classroom Hub
-- Tables: resources, assignments, submissions
-- Adds:   class_id column on profiles (fixes Phase 1 bug)
-- Storage: class_materials + student_submissions buckets with RLS
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE submission_status AS ENUM ('submitted', 'graded');
  END IF;
END $$;

-- ---------- 1. FIX PROFILES TABLE (Phase 1 left class_id off) ----------
-- Students need a primary class_id so they can read resources/assignments
-- for that class without joins. Add it as nullable, then backfill any
-- student who has already accepted an invite (via the invitations table).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'class_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_class_id_idx ON public.profiles(class_id);

-- Backfill: any student who has an accepted invite (is_used = true) with a
-- class_id should get their profile.class_id set.
UPDATE public.profiles p
SET class_id = i.class_id
FROM public.invitations i
WHERE i.is_used = true
  AND i.class_id IS NOT NULL
  AND i.role = 'student'
  AND p.id = i.created_by
  AND p.class_id IS NULL;

-- Wait — created_by on invitations is the INVITER (the teacher/principal),
-- not the invitee. The invitee becomes a new auth.users row when they
-- register. We can't easily backfill from invitations because there's no
-- direct link between an invitation and the user who consumed it. New
-- registrations (going forward) will set class_id via the
-- completeInviteOnboarding server action. For pre-existing students
-- registered via Phase 1 invites, they will need to be re-invited to a
-- specific class. (Acknowledge limitation — do not block the migration.)


-- ---------- 2. RESOURCES ----------
CREATE TABLE IF NOT EXISTS public.resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  file_path   text NOT NULL,
  file_size   bigint,
  mime_type   text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resources_class_id_idx ON public.resources(class_id);
CREATE INDEX IF NOT EXISTS resources_created_at_idx ON public.resources(created_at DESC);


-- ---------- 3. ASSIGNMENTS ----------
CREATE TABLE IF NOT EXISTS public.assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_date    timestamptz,
  file_path   text,  -- optional attachment in class_materials bucket
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_class_id_idx ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS assignments_due_date_idx ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS assignments_created_at_idx ON public.assignments(created_at DESC);


-- ---------- 4. SUBMISSIONS ----------
CREATE TABLE IF NOT EXISTS public.submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path     text NOT NULL,
  status        submission_status NOT NULL DEFAULT 'submitted',
  grade         integer,
  feedback      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One submission per student per assignment (re-submitting updates the row)
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_per_student_assignment
  ON public.submissions(assignment_id, student_id);

CREATE INDEX IF NOT EXISTS submissions_assignment_id_idx ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS submissions_student_id_idx ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON public.submissions(status);

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

DROP TRIGGER IF EXISTS submissions_touch_updated_at ON public.submissions;
CREATE TRIGGER submissions_touch_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.resources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "resources_select_class_members" ON public.resources;
DROP POLICY IF EXISTS "resources_insert_teacher"       ON public.resources;
DROP POLICY IF EXISTS "resources_update_teacher"       ON public.resources;
DROP POLICY IF EXISTS "resources_delete_teacher"       ON public.resources;

DROP POLICY IF EXISTS "assignments_select_class_members" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert_teacher"       ON public.assignments;
DROP POLICY IF EXISTS "assignments_update_teacher"       ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete_teacher"       ON public.assignments;

DROP POLICY IF EXISTS "submissions_select_own_or_teacher" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert_student"        ON public.submissions;
DROP POLICY IF EXISTS "submissions_update_teacher"         ON public.submissions;

-- 5.1 Helper: is the caller a teacher of the given class?
CREATE OR REPLACE FUNCTION public.is_class_teacher(class_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_uuid
      AND c.teacher_id = auth.uid()
  );
$$;

-- 5.2 Helper: is the caller a member of the school that owns the class?
CREATE OR REPLACE FUNCTION public.is_class_school_member(class_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.profiles p ON p.school_id = c.school_id
    WHERE c.id = class_uuid
      AND p.id = auth.uid()
  );
$$;

-- 5.3 RESOURCES
CREATE POLICY "resources_select_class_members" ON public.resources
  FOR SELECT TO authenticated
  USING (public.is_class_school_member(class_id));

CREATE POLICY "resources_insert_teacher" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "resources_update_teacher" ON public.resources
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "resources_delete_teacher" ON public.resources
  FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id));

-- 5.4 ASSIGNMENTS — same pattern as resources.
CREATE POLICY "assignments_select_class_members" ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_class_school_member(class_id));

CREATE POLICY "assignments_insert_teacher" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "assignments_update_teacher" ON public.assignments
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "assignments_delete_teacher" ON public.assignments
  FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id));

-- 5.5 SUBMISSIONS — student can see their own; teacher of the assignment's
-- class can see all submissions for that assignment.
CREATE POLICY "submissions_select_own_or_teacher" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_class_teacher(
      (SELECT class_id FROM public.assignments WHERE id = submissions.assignment_id)
    )
  );

CREATE POLICY "submissions_insert_student" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_class_school_member(
      (SELECT class_id FROM public.assignments WHERE id = submissions.assignment_id)
    )
  );

CREATE POLICY "submissions_update_teacher" ON public.submissions
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(
    (SELECT class_id FROM public.assignments WHERE id = submissions.assignment_id)
  ))
  WITH CHECK (public.is_class_teacher(
    (SELECT class_id FROM public.assignments WHERE id = submissions.assignment_id)
  ));


-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================
-- Create two buckets:
--   - class_materials    (public read for school members; teacher write)
--   - student_submissions (private — only the student + their teacher can read)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('class_materials', 'class_materials', true),
  ('student_submissions', 'student_submissions', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, public = EXCLUDED.public;

-- ---------- 6.1 Storage RLS policies: class_materials ----------
-- Pattern: paths are namespaced as `<class_id>/<uuid>.<ext>` so policies
-- can verify class membership by extracting the class_id from the path.

DROP POLICY IF EXISTS "class_materials_read_school_members" ON storage.objects;
DROP POLICY IF EXISTS "class_materials_write_teachers"       ON storage.objects;
DROP POLICY IF EXISTS "student_submissions_read_own_or_teacher" ON storage.objects;
DROP POLICY IF EXISTS "student_submissions_write_students"     ON storage.objects;

-- Helper: extract class_id from a storage path of the form <class_id>/<rest>
CREATE OR REPLACE FUNCTION public.storage_path_class_id(path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  -- First segment of the path, parsed as a UUID.
  SELECT NULLIF(split_part(path, '/', 1), '')::uuid;
$$;

-- Public read on class_materials (bucket is public=true anyway, but this
-- adds an explicit policy that any authenticated school member can read).
CREATE POLICY "class_materials_read_school_members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'class_materials'
    AND public.is_class_school_member(public.storage_path_class_id(name))
  );

-- Teachers can upload to their own class folders.
CREATE POLICY "class_materials_write_teachers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'class_materials'
    AND public.is_class_teacher(public.storage_path_class_id(name))
  );

CREATE POLICY "class_materials_update_teachers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'class_materials'
    AND public.is_class_teacher(public.storage_path_class_id(name))
  )
  WITH CHECK (
    bucket_id = 'class_materials'
    AND public.is_class_teacher(public.storage_path_class_id(name))
  );

CREATE POLICY "class_materials_delete_teachers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'class_materials'
    AND public.is_class_teacher(public.storage_path_class_id(name))
  );

-- ---------- 6.2 Storage RLS policies: student_submissions ----------
-- Only the student who owns the submission (the uploader) and the teacher
-- of the assignment's class can read.
CREATE POLICY "student_submissions_read_own_or_teacher" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student_submissions'
    AND (
      owner = auth.uid()
      OR public.is_class_teacher(public.storage_path_class_id(name))
    )
  );

-- Students can upload submissions to their own folder.
CREATE POLICY "student_submissions_write_students" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student_submissions'
    AND owner = auth.uid()
    AND public.is_class_school_member(public.storage_path_class_id(name))
  );

-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('resources','assignments','submissions');
--   SELECT id, name, public FROM storage.buckets;
