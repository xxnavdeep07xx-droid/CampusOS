-- ============================================================
-- CampusOS — Phase 6: Fee Management, Invoicing, & Parent Portal
--
-- Tables: parent_student_links, fee_invoices, payments, global_notices
-- Enum:   invoice_status ('pending', 'paid', 'overdue')
-- Update: user_role enum — add 'parent'
-- RLS:    parents see their linked children's data; principals/staff
--         manage invoices + notices; students see their own invoices.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ============================================================

-- ---------- 0. EXTEND user_role ENUM ----------
-- Add 'parent' to the existing user_role enum (Phase 1).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'parent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'parent';
  END IF;
END $$;

-- ---------- 0.1 invoice_status ENUM ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue');
  END IF;
END $$;


-- ---------- 1. PARENT_STUDENT_LINKS ----------
-- Links a parent profile to one or more student profiles. A parent can
-- have multiple children; a student can have multiple parents/guardians.
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS parent_student_links_unique
  ON public.parent_student_links(parent_id, student_id);
CREATE INDEX IF NOT EXISTS psl_parent_idx  ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS psl_student_idx  ON public.parent_student_links(student_id);


-- ---------- 2. FEE_INVOICES ----------
CREATE TABLE IF NOT EXISTS public.fee_invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  total_amount  decimal(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  due_date      date,
  status        invoice_status NOT NULL DEFAULT 'pending',
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fee_invoices_school_id_idx    ON public.fee_invoices(school_id);
CREATE INDEX IF NOT EXISTS fee_invoices_student_id_idx   ON public.fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS fee_invoices_status_idx       ON public.fee_invoices(status);
CREATE INDEX IF NOT EXISTS fee_invoices_due_date_idx     ON public.fee_invoices(due_date);

DROP TRIGGER IF EXISTS fee_invoices_touch_updated_at ON public.fee_invoices;
CREATE TRIGGER fee_invoices_touch_updated_at
  BEFORE UPDATE ON public.fee_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------- 3. PAYMENTS ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.fee_invoices(id) ON DELETE CASCADE,
  amount_paid     decimal(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_date    timestamptz NOT NULL DEFAULT now(),
  payment_method  text NOT NULL DEFAULT 'mock',
  receipt_url     text
);

CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_date_idx       ON public.payments(payment_date);


-- ---------- 4. GLOBAL_NOTICES ----------
-- School-wide notices that appear as a banner at the top of every
-- logged-in user's dashboard. Principals/staff publish them.
CREATE TABLE IF NOT EXISTS public.global_notices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title         text NOT NULL,
  content       text NOT NULL,
  publish_date  date NOT NULL DEFAULT CURRENT_DATE,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS global_notices_school_id_idx      ON public.global_notices(school_id);
CREATE INDEX IF NOT EXISTS global_notices_publish_date_idx   ON public.global_notices(publish_date);
CREATE INDEX IF NOT EXISTS global_notices_is_active_idx       ON public.global_notices(is_active);


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_notices       ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "psl_select_own"              ON public.parent_student_links;
DROP POLICY IF EXISTS "psl_insert_principal"        ON public.parent_student_links;
DROP POLICY IF EXISTS "psl_delete_principal"        ON public.parent_student_links;

DROP POLICY IF EXISTS "invoices_select_own_or_parent" ON public.fee_invoices;
DROP POLICY IF EXISTS "invoices_insert_admin"          ON public.fee_invoices;
DROP POLICY IF EXISTS "invoices_update_admin"          ON public.fee_invoices;
DROP POLICY IF EXISTS "invoices_delete_admin"         ON public.fee_invoices;

DROP POLICY IF EXISTS "payments_select_own_or_admin"  ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own_or_admin"  ON public.payments;

DROP POLICY IF EXISTS "notices_select_school_members" ON public.global_notices;
DROP POLICY IF EXISTS "notices_insert_admin"          ON public.global_notices;
DROP POLICY IF EXISTS "notices_delete_admin"          ON public.global_notices;

-- 5.1 PARENT_STUDENT_LINKS — parents see their own links; principals/staff
-- see all links in their school (for managing); parents can't self-create
-- links (only admins can link a parent to a student).
CREATE POLICY "psl_select_own" ON public.parent_student_links
  FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR student_id = auth.uid()
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = parent_student_links.parent_id
          AND p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "psl_insert_principal" ON public.parent_student_links
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

CREATE POLICY "psl_delete_principal" ON public.parent_student_links
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

-- 5.2 FEE_INVOICES — students see their own; parents see invoices for
-- their linked children; principals/staff see all in their school.
CREATE POLICY "invoices_select_own_or_parent" ON public.fee_invoices
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = fee_invoices.student_id
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
      AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "invoices_insert_admin" ON public.fee_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "invoices_update_admin" ON public.fee_invoices
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "invoices_delete_admin" ON public.fee_invoices
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5.3 PAYMENTS — students/parents see payments on invoices they can see;
-- principals/staff see all in their school. Anyone who can see an invoice
-- can insert a payment (the mock checkout flow).
CREATE POLICY "payments_select_own_or_admin" ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fee_invoices fi
      WHERE fi.id = payments.invoice_id
      AND (
        fi.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.parent_id = auth.uid()
            AND psl.student_id = fi.student_id
        )
        OR (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
          AND fi.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "payments_insert_own_or_admin" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fee_invoices fi
      WHERE fi.id = payments.invoice_id
      AND (
        fi.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.parent_id = auth.uid()
            AND psl.student_id = fi.student_id
        )
        OR (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
          AND fi.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        )
      )
    )
  );

-- 5.4 GLOBAL_NOTICES — all school members can read; only principals/staff
-- can create + delete.
CREATE POLICY "notices_select_school_members" ON public.global_notices
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "notices_insert_admin" ON public.global_notices
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "notices_delete_admin" ON public.global_notices
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );


-- ============================================================
-- 6. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.parent_student_links, public.fee_invoices, public.payments, public.global_notices
  TO authenticated;


-- Done.
-- Verify:
--   SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role');
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('parent_student_links','fee_invoices','payments','global_notices');
