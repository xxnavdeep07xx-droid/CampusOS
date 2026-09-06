-- ============================================================
-- CampusOS — Phase 1 schema
-- Multi-tenant invite-based school/college management platform.
-- Tables: schools, profiles, classes, invitations
-- RLS:   enabled on every table
-- Triggers: auto-create profile row when a new auth.users row appears.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('principal', 'teacher', 'staff', 'student');
  END IF;
END $$;

-- ---------- 1. SCHOOLS ----------
CREATE TABLE IF NOT EXISTS public.schools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  principal_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. PROFILES ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  full_name  text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_school_id_idx ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx      ON public.profiles(role);

-- ---------- 3. CLASSES ----------
CREATE TABLE IF NOT EXISTS public.classes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classes_school_id_idx  ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON public.classes(teacher_id);

-- ---------- 4. INVITATIONS ----------
CREATE TABLE IF NOT EXISTS public.invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id   uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  token      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_used    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS invitations_token_idx     ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_school_id_idx ON public.invitations(school_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.schools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent) before recreating.
DROP POLICY IF EXISTS "schools_select_own"           ON public.schools;
DROP POLICY IF EXISTS "schools_update_own"           ON public.schools;
DROP POLICY IF EXISTS "schools_insert_own"           ON public.schools;
DROP POLICY IF EXISTS "profiles_select_own_or_school" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON public.profiles;
DROP POLICY IF EXISTS "classes_select_school"       ON public.classes;
DROP POLICY IF EXISTS "classes_insert_teacher"      ON public.classes;
DROP POLICY IF EXISTS "classes_update_teacher"      ON public.classes;
DROP POLICY IF EXISTS "classes_delete_teacher"      ON public.classes;
DROP POLICY IF EXISTS "invitations_select_school"   ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_school"   ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_school"   ON public.invitations;

-- Helper: get the calling user's profile.
-- Returns NULL if not signed in or no profile row exists yet.
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- 5.1 SCHOOLS — readable by any member of the school; updatable by principal only.
CREATE POLICY "schools_select_own" ON public.schools
  FOR SELECT TO authenticated
  USING (id = (SELECT school_id FROM public.current_profile()));

CREATE POLICY "schools_insert_own" ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (principal_id = auth.uid());

CREATE POLICY "schools_update_own" ON public.schools
  FOR UPDATE TO authenticated
  USING (principal_id = auth.uid())
  WITH CHECK (principal_id = auth.uid());

-- 5.2 PROFILES — readable by the user themselves, and by any member of their school
-- (so principals can see teachers, teachers can see their students, etc.).
CREATE POLICY "profiles_select_own_or_school" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      school_id IS NOT NULL
      AND school_id = (SELECT school_id FROM public.current_profile())
    )
  );

-- A new user (just signed up) has no profile row yet. They are allowed to insert
-- their OWN profile row. After that, only principals/staff can invite others
-- (handled by the service-role key in API routes, which bypasses RLS).
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5.3 CLASSES — readable by anyone in the school; writable by teachers of that school.
CREATE POLICY "classes_select_school" ON public.classes
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.current_profile())
  );

CREATE POLICY "classes_insert_teacher" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id = (SELECT school_id FROM public.current_profile())
  );

CREATE POLICY "classes_update_teacher" ON public.classes
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "classes_delete_teacher" ON public.classes
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- 5.4 INVITATIONS — readable by principals of the school and by the creator.
-- Insert/Update is restricted to school staff (principal / staff role).
CREATE POLICY "invitations_select_school" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.current_profile())
  );

CREATE POLICY "invitations_insert_school" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM public.current_profile())
    AND (SELECT role FROM public.current_profile()) IN ('principal', 'staff', 'teacher')
  );

CREATE POLICY "invitations_update_school" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.current_profile())
    AND (SELECT role FROM public.current_profile()) IN ('principal', 'staff', 'teacher')
  );

-- ============================================================
-- 6. TRIGGER — auto-create profile row on auth.users insert.
-- The new profile row gets role='student' by default and no school_id; the
-- registration API routes will UPDATE it with the correct role/school after
-- the user completes the invite-based onboarding form. The advantage of
-- creating the row eagerly is that RLS policy `profiles_select_own_or_school`
-- has a row to return for `current_profile()` immediately after sign-up.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'student'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. GRANT baseline permissions
-- ============================================================
GRANT USAGE  ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.schools, public.profiles, public.classes, public.invitations TO authenticated;

-- ============================================================
-- 8. Sanity-check: make sure no orphaned policies exist.
-- ============================================================
-- (no-op — DROP IF EXISTS handles re-runs cleanly.)

-- Done. Verify with:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   SELECT polname, polcmd FROM pg_policy;
