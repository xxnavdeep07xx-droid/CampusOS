-- ============================================================
-- CampusOS — Phase 5: Assessments, Quizzes, & Automated Gradebook
--
-- Tables: quizzes, quiz_questions, quiz_attempts
-- View:   class_gradebook (aggregates Phase 2 submissions + Phase 5 quiz_attempts)
-- RLS:    students see published quizzes + their own attempts;
--         teacher of the class has full CRUD.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE question_type AS ENUM ('mcq', 'short_answer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
    CREATE TYPE attempt_status AS ENUM ('in_progress', 'completed');
  END IF;
END $$;


-- ---------- 1. QUIZZES ----------
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  time_limit_minutes  integer,  -- NULL = no time limit
  due_date            timestamptz,
  is_published        boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quizzes_class_id_idx     ON public.quizzes(class_id);
CREATE INDEX IF NOT EXISTS quizzes_created_at_idx   ON public.quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_is_published_idx ON public.quizzes(is_published);

DROP TRIGGER IF EXISTS quizzes_touch_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_touch_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 2. QUIZ_QUESTIONS ----------
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  question_type   question_type NOT NULL DEFAULT 'mcq',
  -- For MCQ: an array of strings like ["Paris", "London", "Berlin", "Madrid"].
  -- For short_answer: NULL (the correct_answer field is used directly).
  options         jsonb,
  -- The correct answer (must match one of the options for MCQ, or be the
  -- expected short answer for short_answer — exact match, case-insensitive).
  correct_answer  text NOT NULL DEFAULT '',
  points          integer NOT NULL DEFAULT 1 CHECK (points >= 0),
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_idx ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_questions_position_idx ON public.quiz_questions(position);


-- ---------- 3. QUIZ_ATTEMPTS ----------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- answers is a JSON object: { "<question_id>": "<student_answer>", ... }
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  score         integer NOT NULL DEFAULT 0,
  max_score     integer NOT NULL DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  status        attempt_status NOT NULL DEFAULT 'in_progress'
);

-- One in-progress attempt per student per quiz — re-starting overwrites.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_unique_in_progress
  ON public.quiz_attempts(quiz_id, student_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx     ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_id_idx ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_status_idx     ON public.quiz_attempts(status);


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts   ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "quizzes_select_class_members" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_insert_teacher"        ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_update_teacher"        ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_delete_teacher"        ON public.quizzes;

DROP POLICY IF EXISTS "quiz_questions_select_class_members" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_insert_teacher"        ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_update_teacher"        ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_delete_teacher"        ON public.quiz_questions;

DROP POLICY IF EXISTS "quiz_attempts_select_own_or_teacher" ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_insert_student"         ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_update_own"            ON public.quiz_attempts;

-- 4.1 QUIZZES — class members can read published quizzes; teachers can
-- read all their quizzes (including drafts); teachers have full CRUD.
CREATE POLICY "quizzes_select_class_members" ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    public.is_class_school_member(class_id)
    AND (
      is_published = true
      OR public.is_class_teacher(class_id)
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
        AND public.is_class_school_member(class_id)
      )
    )
  );

CREATE POLICY "quizzes_insert_teacher" ON public.quizzes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_class_teacher(class_id)
    OR (
      public.is_class_school_member(class_id)
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

CREATE POLICY "quizzes_update_teacher" ON public.quizzes
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "quizzes_delete_teacher" ON public.quizzes
  FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id));

-- 4.2 QUIZ_QUESTIONS — same pattern.
CREATE POLICY "quiz_questions_select_class_members" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND public.is_class_school_member(q.class_id)
        AND (
          q.is_published = true
          OR public.is_class_teacher(q.class_id)
          OR (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
            AND public.is_class_school_member(q.class_id)
          )
        )
    )
  );

CREATE POLICY "quiz_questions_insert_teacher" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND public.is_class_teacher(q.class_id)
    )
  );

CREATE POLICY "quiz_questions_update_teacher" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND public.is_class_teacher(q.class_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND public.is_class_teacher(q.class_id)
    )
  );

CREATE POLICY "quiz_questions_delete_teacher" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND public.is_class_teacher(q.class_id)
    )
  );

-- 4.3 QUIZ_ATTEMPTS — student sees their own; teacher sees all for their
-- class's quizzes; principal/staff see across their school.
CREATE POLICY "quiz_attempts_select_own_or_teacher" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
        AND public.is_class_teacher(q.class_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.profiles p ON p.school_id = q.class_id  -- joined via classes
      WHERE q.id = quiz_attempts.quiz_id
        AND p.id = auth.uid()
        AND p.role IN ('principal', 'staff')
    )
  );

CREATE POLICY "quiz_attempts_insert_student" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
        AND public.is_class_school_member(q.class_id)
    )
  );

CREATE POLICY "quiz_attempts_update_own" ON public.quiz_attempts
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());


-- ============================================================
-- 5. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.quizzes, public.quiz_questions, public.quiz_attempts
  TO authenticated;


-- ============================================================
-- 6. CLASS_GRADEBOOK VIEW
-- ============================================================
-- Aggregates Phase 2 submissions (graded assignments) + Phase 5
-- quiz_attempts (completed) into a single per-student summary.
--
-- Columns:
--   school_id, class_id, class_name, student_id, student_name,
--   assignment_count, assignment_total_points, assignment_earned_points,
--   quiz_count, quiz_total_points, quiz_earned_points,
--   total_earned, total_possible, percentage
--
-- The view is intentionally lenient — students with no submissions/attempts
-- still appear (via LEFT JOIN from profiles) so the gradebook shows every
-- enrolled student even before they've done any work.
CREATE OR REPLACE VIEW public.class_gradebook AS
WITH
  -- Per-student assignment aggregation.
  assignment_agg AS (
    SELECT
      c.id AS class_id,
      c.school_id AS school_id,
      s.student_id AS student_id,
      COUNT(DISTINCT s.id) AS assignment_count,
      COALESCE(SUM(s.grade), 0) AS assignment_earned_points,
      -- Each graded assignment is out of 100 (per Phase 2 SubmissionCard
      -- grade input — 0 to 100). So total possible = 100 * count.
      COUNT(DISTINCT s.id) * 100 AS assignment_total_points
    FROM public.classes c
    LEFT JOIN public.assignments a ON a.class_id = c.id
    LEFT JOIN public.submissions s ON s.assignment_id = a.id
      AND s.status = 'graded'
    GROUP BY c.id, c.school_id, s.student_id
  ),
  -- Per-student quiz aggregation (only completed attempts count).
  quiz_agg AS (
    SELECT
      q.class_id AS class_id,
      qa.student_id AS student_id,
      COUNT(DISTINCT qa.id) AS quiz_count,
      COALESCE(SUM(qa.score), 0) AS quiz_earned_points,
      COALESCE(SUM(qa.max_score), 0) AS quiz_total_points
    FROM public.quizzes q
    LEFT JOIN public.quiz_attempts qa ON qa.quiz_id = q.id
      AND qa.status = 'completed'
    GROUP BY q.class_id, qa.student_id
  )
SELECT
  c.school_id    AS school_id,
  c.id           AS class_id,
  c.name         AS class_name,
  p.id           AS student_id,
  p.full_name    AS student_name,
  COALESCE(aa.assignment_count, 0)         AS assignment_count,
  COALESCE(aa.assignment_total_points, 0)  AS assignment_total_points,
  COALESCE(aa.assignment_earned_points, 0) AS assignment_earned_points,
  COALESCE(qa.quiz_count, 0)               AS quiz_count,
  COALESCE(qa.quiz_total_points, 0)        AS quiz_total_points,
  COALESCE(qa.quiz_earned_points, 0)        AS quiz_earned_points,
  (COALESCE(aa.assignment_earned_points, 0) + COALESCE(qa.quiz_earned_points, 0))
                                             AS total_earned,
  (COALESCE(aa.assignment_total_points, 0) + COALESCE(qa.quiz_total_points, 0))
                                             AS total_possible,
  CASE
    WHEN (COALESCE(aa.assignment_total_points, 0) + COALESCE(qa.quiz_total_points, 0)) = 0
      THEN NULL  -- no graded work yet
    ELSE ROUND(
      (COALESCE(aa.assignment_earned_points, 0) + COALESCE(qa.quiz_earned_points, 0))::numeric
      / (COALESCE(aa.assignment_total_points, 0) + COALESCE(qa.quiz_total_points, 0))::numeric
      * 100, 1
    )
  END AS percentage
FROM public.classes c
JOIN public.profiles p ON p.class_id = c.id AND p.role = 'student'
LEFT JOIN assignment_agg aa ON aa.class_id = c.id AND aa.student_id = p.id
LEFT JOIN quiz_agg qa       ON qa.class_id = c.id AND qa.student_id = p.id
ORDER BY p.full_name ASC;

GRANT SELECT ON public.class_gradebook TO authenticated;


-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('quizzes','quiz_questions','quiz_attempts');
--   SELECT * FROM public.class_gradebook LIMIT 5;
