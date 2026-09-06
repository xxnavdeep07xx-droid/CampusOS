-- ============================================================
-- CampusOS — Phase 3: Digital Attendance & Timetable Management
--
-- Tables: attendance, timetables
-- Enums:  attendance_status ('present', 'absent', 'late')
-- RLS:    strictly enforced — students see only their own records,
--         teachers have full CRUD on their classes, principals/staff
--         read across their school.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
  END IF;
END $$;


-- ---------- 1. ATTENDANCE ----------
CREATE TABLE IF NOT EXISTS public.attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        date NOT NULL,
  status      attendance_status NOT NULL DEFAULT 'present',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One record per (class, student, date) — re-saving overwrites.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_unique_per_class_student_date
  ON public.attendance(class_id, student_id, date);

CREATE INDEX IF NOT EXISTS attendance_class_id_date_idx ON public.attendance(class_id, date);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx    ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS attendance_date_idx          ON public.attendance(date);
CREATE INDEX IF NOT EXISTS attendance_status_idx        ON public.attendance(status);

-- updated_at trigger (reuses the touch_updated_at function from Phase 2;
-- defining again here is safe — CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_touch_updated_at ON public.attendance;
CREATE TRIGGER attendance_touch_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 2. TIMETABLES ----------
CREATE TABLE IF NOT EXISTS public.timetables (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),  -- 1=Mon ... 5=Fri
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  subject_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timetables_class_id_idx       ON public.timetables(class_id);
CREATE INDEX IF NOT EXISTS timetables_day_of_week_idx    ON public.timetables(day_of_week);
CREATE INDEX IF NOT EXISTS timetables_class_day_idx      ON public.timetables(class_id, day_of_week);

-- Prevent two slots in the same class from overlapping on the same day.
-- We use an EXCLUDE constraint with a time range.
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timetables_no_overlap_per_class_day'
  ) THEN
    ALTER TABLE public.timetables
      ADD CONSTRAINT timetables_no_overlap_per_class_day
      EXCLUDE USING gist (
        class_id WITH =,
        day_of_week WITH =,
        tsrange(start_time::timestamp, end_time::timestamp) WITH &&
      );
  END IF;
END $$;


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "attendance_select_class_members" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_teacher"        ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_teacher"        ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_teacher"        ON public.attendance;

DROP POLICY IF EXISTS "timetables_select_class_members" ON public.timetables;
DROP POLICY IF EXISTS "timetables_insert_teacher"        ON public.timetables;
DROP POLICY IF EXISTS "timetables_update_teacher"        ON public.timetables;
DROP POLICY IF EXISTS "timetables_delete_teacher"        ON public.timetables;


-- 3.1 ATTENDANCE — students read their own; teacher of the class has full CRUD;
-- principals/staff read across their school.
CREATE POLICY "attendance_select_class_members" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    -- Student sees their own attendance records.
    student_id = auth.uid()
    -- Teachers see attendance for any class they teach.
    OR public.is_class_teacher(class_id)
    -- Principals + staff see attendance across their whole school.
    OR (
      public.is_class_school_member(class_id)
      AND (
        SELECT role FROM public.profiles WHERE id = auth.uid()
      ) IN ('principal', 'staff')
    )
  );

CREATE POLICY "attendance_insert_teacher" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Teachers can mark attendance for their own classes.
    public.is_class_teacher(class_id)
    -- Students can also self-insert (e.g. for check-in flows) but only for
    -- their own row in their enrolled class.
    OR (
      student_id = auth.uid()
      AND public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
    )
  );

CREATE POLICY "attendance_update_teacher" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "attendance_delete_teacher" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id));


-- 3.2 TIMETABLES — same pattern: students read their class's timetable;
-- teachers have full CRUD on their classes; principals/staff read.
CREATE POLICY "timetables_select_class_members" ON public.timetables
  FOR SELECT TO authenticated
  USING (public.is_class_school_member(class_id));

CREATE POLICY "timetables_insert_teacher" ON public.timetables
  FOR INSERT TO authenticated
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "timetables_update_teacher" ON public.timetables
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "timetables_delete_teacher" ON public.timetables
  FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id));


-- ============================================================
-- 4. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance, public.timetables TO authenticated;


-- ============================================================
-- 5. (Optional) helper view for principal analytics — today's
--    attendance rate per class. Not required, but useful for the
--    dashboard widget to avoid N+1 queries.
-- ============================================================
CREATE OR REPLACE VIEW public.v_today_attendance_summary AS
SELECT
  c.school_id,
  c.id AS class_id,
  c.name AS class_name,
  a.date,
  COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_count,
  COUNT(*) FILTER (WHERE a.status = 'late')    AS late_count,
  COUNT(*)                                     AS total_marked
FROM public.classes c
LEFT JOIN public.attendance a
  ON a.class_id = c.id
  AND a.date = CURRENT_DATE
GROUP BY c.school_id, c.id, c.name, a.date;

GRANT SELECT ON public.v_today_attendance_summary TO authenticated;

-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('attendance', 'timetables');
--   SELECT * FROM public.v_today_attendance_summary LIMIT 5;
