-- ============================================================
-- CampusOS — Phase 7: Library Management & Staff HR (Leave Requests)
--
-- Tables: books, book_issues, leave_requests
-- Enums:  issue_status ('issued', 'returned', 'overdue')
--         leave_status ('pending', 'approved', 'rejected')
-- Triggers: auto-increment/decrement available_copies on book_issues
-- RLS: school members can read books; students see their own issues;
--      staff see their own leave requests; principals manage all
--      leave requests in their school.
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- 0. ENUMS ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
    CREATE TYPE issue_status AS ENUM ('issued', 'returned', 'overdue');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
    CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;


-- ---------- 1. BOOKS ----------
CREATE TABLE IF NOT EXISTS public.books (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title            text NOT NULL,
  author           text NOT NULL DEFAULT '',
  isbn             text,
  total_copies     integer NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies integer NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  cover_image_url  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_school_id_idx  ON public.books(school_id);
CREATE INDEX IF NOT EXISTS books_title_idx       ON public.books(title);
CREATE INDEX IF NOT EXISTS books_isbn_idx        ON public.books(isbn);

-- Ensure available_copies can't exceed total_copies.
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_available_le_total;
ALTER TABLE public.books
  ADD CONSTRAINT books_available_le_total
  CHECK (available_copies <= total_copies);


-- ---------- 2. BOOK_ISSUES ----------
CREATE TABLE IF NOT EXISTS public.book_issues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id      uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_date   date NOT NULL DEFAULT CURRENT_DATE,
  due_date     date NOT NULL,
  return_date  date,
  status       issue_status NOT NULL DEFAULT 'issued',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_issues_book_id_idx  ON public.book_issues(book_id);
CREATE INDEX IF NOT EXISTS book_issues_user_id_idx  ON public.book_issues(user_id);
CREATE INDEX IF NOT EXISTS book_issues_status_idx   ON public.book_issues(status);
CREATE INDEX IF NOT EXISTS book_issues_due_date_idx ON public.book_issues(due_date);


-- ---------- 3. LEAVE_REQUESTS ----------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  reason      text NOT NULL DEFAULT '',
  status      leave_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leave_requests_school_id_idx ON public.leave_requests(school_id);
CREATE INDEX IF NOT EXISTS leave_requests_staff_id_idx  ON public.leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx    ON public.leave_requests(status);


-- ============================================================
-- 4. TRIGGERS — auto-manage available_copies on book_issues
-- ============================================================

/**
 * On INSERT of a book_issue with status='issued', decrement the book's
 * available_copies by 1 (but never below 0 — the CHECK constraint on
 * books enforces available_copies >= 0).
 *
 * On UPDATE where status changes from 'issued' → 'returned', increment
 * available_copies by 1 (but never above total_copies — the CHECK
 * constraint enforces available_copies <= total_copies).
 */
CREATE OR REPLACE FUNCTION public.adjust_book_copies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'issued' THEN
    UPDATE public.books
      SET available_copies = GREATEST(0, available_copies - 1)
      WHERE id = NEW.book_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'issued' AND NEW.status = 'returned' THEN
    UPDATE public.books
      SET available_copies = LEAST(total_copies, available_copies + 1)
      WHERE id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'issued' THEN
    -- If an issued row is deleted (shouldn't happen normally, but handle it),
    -- restore the copy.
    UPDATE public.books
      SET available_copies = LEAST(total_copies, available_copies + 1)
      WHERE id = OLD.book_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS book_issues_adjust_copies ON public.book_issues;
CREATE TRIGGER book_issues_adjust_copies
  AFTER INSERT OR UPDATE OR DELETE ON public.book_issues
  FOR EACH ROW EXECUTE FUNCTION public.adjust_book_copies();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.books          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_issues   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "books_select_school_members" ON public.books;
DROP POLICY IF EXISTS "books_insert_admin"           ON public.books;
DROP POLICY IF EXISTS "books_update_admin"           ON public.books;
DROP POLICY IF EXISTS "books_delete_admin"           ON public.books;

DROP POLICY IF EXISTS "issues_select_own_or_admin"  ON public.book_issues;
DROP POLICY IF EXISTS "issues_insert_admin"          ON public.book_issues;
DROP POLICY IF EXISTS "issues_update_admin"          ON public.book_issues;

DROP POLICY IF EXISTS "leave_select_own_or_admin"   ON public.leave_requests;
DROP POLICY IF EXISTS "leave_insert_staff"           ON public.leave_requests;
DROP POLICY IF EXISTS "leave_update_admin"           ON public.leave_requests;

-- 5.1 BOOKS — school members can read; principals/staff can write.
CREATE POLICY "books_select_school_members" ON public.books
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "books_insert_admin" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

CREATE POLICY "books_update_admin" ON public.books
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

CREATE POLICY "books_delete_admin" ON public.books
  FOR DELETE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

-- 5.2 BOOK_ISSUES — students see their own; principals/staff see all in school.
-- Principals/staff can issue (INSERT) + return (UPDATE) books.
CREATE POLICY "issues_select_own_or_admin" ON public.book_issues
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = book_issues.book_id
        AND b.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

CREATE POLICY "issues_insert_admin" ON public.book_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admins can issue books to any student in their school.
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
      AND EXISTS (
        SELECT 1 FROM public.books b
        WHERE b.id = book_issues.book_id
          AND b.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    -- Students can also self-issue (for a self-checkout flow) — but only
    -- to themselves and only books in their school.
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.books b
        WHERE b.id = book_issues.book_id
          AND b.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "issues_update_admin" ON public.book_issues
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = book_issues.book_id
        AND b.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

-- 5.3 LEAVE_REQUESTS — staff see their own; principals see all in school.
CREATE POLICY "leave_select_own_or_admin" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid()
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
      AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "leave_insert_staff" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = auth.uid()
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('teacher', 'staff', 'principal')
  );

CREATE POLICY "leave_update_admin" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'principal'
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'principal'
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );


-- ============================================================
-- 6. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.books, public.book_issues, public.leave_requests
  TO authenticated;


-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('books', 'book_issues', 'leave_requests');
