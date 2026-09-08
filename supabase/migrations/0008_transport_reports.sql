-- ============================================================
-- CampusOS — Phase 8: Transport Management & Automated PDF Report Cards
--
-- Tables: transport_routes, transport_stops
-- Update: profiles — add transport_stop_id
-- RLS: school members read routes/stops; principals/staff write;
--      students read their assigned route + stop.
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- 1. TRANSPORT_ROUTES ----------
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_name      text NOT NULL,
  vehicle_number  text NOT NULL DEFAULT '',
  driver_name     text NOT NULL DEFAULT '',
  driver_phone    text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transport_routes_school_id_idx ON public.transport_routes(school_id);


-- ---------- 2. TRANSPORT_STOPS ----------
CREATE TABLE IF NOT EXISTS public.transport_stops (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id     uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_name    text NOT NULL,
  pickup_time  time,
  drop_time    time,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transport_stops_route_id_idx ON public.transport_stops(route_id);
CREATE INDEX IF NOT EXISTS transport_stops_position_idx ON public.transport_stops(position);


-- ---------- 3. UPDATE PROFILES ----------
-- Add transport_stop_id column (nullable — students with no transport).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'transport_stop_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN transport_stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_transport_stop_id_idx ON public.profiles(transport_stop_id);


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_stops  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent).
DROP POLICY IF EXISTS "routes_select_school_members" ON public.transport_routes;
DROP POLICY IF EXISTS "routes_insert_admin"          ON public.transport_routes;
DROP POLICY IF EXISTS "routes_update_admin"          ON public.transport_routes;
DROP POLICY IF EXISTS "routes_delete_admin"          ON public.transport_routes;

DROP POLICY IF EXISTS "stops_select_school_members" ON public.transport_stops;
DROP POLICY IF EXISTS "stops_insert_admin"           ON public.transport_stops;
DROP POLICY IF EXISTS "stops_delete_admin"           ON public.transport_stops;

-- 4.1 TRANSPORT_ROUTES — school members can read; principals/staff can write.
CREATE POLICY "routes_select_school_members" ON public.transport_routes
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "routes_insert_admin" ON public.transport_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

CREATE POLICY "routes_update_admin" ON public.transport_routes
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

CREATE POLICY "routes_delete_admin" ON public.transport_routes
  FOR DELETE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
  );

-- 4.2 TRANSPORT_STOPS — school members can read; principals/staff can write.
CREATE POLICY "stops_select_school_members" ON public.transport_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_routes tr
      WHERE tr.id = transport_stops.route_id
        AND tr.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "stops_insert_admin" ON public.transport_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transport_routes tr
      WHERE tr.id = transport_stops.route_id
        AND tr.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );

CREATE POLICY "stops_delete_admin" ON public.transport_stops
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_routes tr
      WHERE tr.id = transport_stops.route_id
        AND tr.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('principal', 'staff')
    )
  );


-- ============================================================
-- 5. GRANT baseline permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.transport_routes, public.transport_stops
  TO authenticated;


-- Done.
-- Verify:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('transport_routes', 'transport_stops');
