-- 0009_behavior_incidents.sql
-- Adds:
--   1. behavior_incidents table — disciplinary issues + positive milestones
--   2. parent_contact + parent_phone + behavioral_notes columns on profiles
--   3. RLS policies so only teachers of the student's class (and admins)
--      can read/write incidents, and students/parents can read their own.

-- ============================================================
-- 1. behavior_incidents table
-- ============================================================

create table if not exists public.behavior_incidents (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete set null,
  incident_date date not null default current_date,
  -- 'positive' = good milestone (e.g. helped a peer, perfect week)
  -- 'concern'  = disciplinary issue (e.g. disruptive, late 3x)
  -- 'neutral'  = informational note
  severity    text not null check (severity in ('positive', 'concern', 'neutral')),
  category    text not null check (category in (
    'academic', 'behavioral', 'attendance', 'social', 'recognition', 'other'
  )),
  title       text not null,
  description text,
  action_taken text,
  created_at  timestamptz not null default now()
);

comment on table public.behavior_incidents is
  'Disciplinary + positive behavior log for students. Visible to the student''s teacher, school admins, and the student/parent themselves.';

create index if not exists behavior_incidents_student_id_idx
  on public.behavior_incidents(student_id, incident_date desc);
create index if not exists behavior_incidents_class_id_idx
  on public.behavior_incidents(class_id, incident_date desc);

-- Enable Realtime so teachers see new incidents immediately.
alter publication supabase_realtime add table public.behavior_incidents;
alter table public.behavior_incidents replica identity full;

-- ============================================================
-- 2. Profile extensions — parent contact + behavioral notes
-- ============================================================

alter table public.profiles
  add column if not exists parent_contact text,
  add column if not exists parent_phone  text,
  add column if not exists behavioral_notes text;

comment on column public.profiles.parent_contact is
  'Free-text parent/guardian name(s) for student profiles. Denormalized for quick access; parent_student_links is still the source of truth for parent-user linkage.';
comment on column public.profiles.parent_phone is
  'Free-text parent/guardian phone for student profiles.';
comment on column public.profiles.behavioral_notes is
  'Free-text long-term notes about the student (IEP, allergies, recurring patterns). Different from behavior_incidents which are time-stamped events.';

-- ============================================================
-- 3. RLS policies for behavior_incidents
-- ============================================================

alter table public.behavior_incidents enable row level security;

-- Teachers can see incidents for students in their own classes.
-- School admins (principal/staff) can see incidents for their school.
-- Students can see their own incidents.
-- Parents can see incidents for students linked to them via parent_student_links.

-- A helper function: is the caller the teacher of the student's class?
create or replace function public.is_student_class_teacher(student_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.profiles p on p.id = student_uuid
       and p.class_id = c.id
    where c.teacher_id = auth.uid()
  );
$$;

-- A helper: does the caller share the student's school?
create or replace function public.shares_student_school(student_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles caller, public.profiles student
    where caller.id = auth.uid()
      and student.id = student_uuid
      and caller.school_id = student.school_id
      and caller.role in ('principal', 'staff')
  );
$$;

-- A helper: is the caller a parent of the student?
create or replace function public.is_student_parent(student_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = student_uuid
  );
$$;

-- SELECT policy — caller is teacher of class, school admin, the student, or their parent.
drop policy if exists "behavior_incidents_select" on public.behavior_incidents;
create policy "behavior_incidents_select" on public.behavior_incidents
  for select using (
    public.is_student_class_teacher(student_id)
    or public.shares_student_school(student_id)
    or student_id = auth.uid()
    or public.is_student_parent(student_id)
  );

-- INSERT policy — caller must be the teacher of the student's class OR a school admin.
drop policy if exists "behavior_incidents_insert" on public.behavior_incidents;
create policy "behavior_incidents_insert" on public.behavior_incidents
  for insert with check (
    public.is_student_class_teacher(student_id)
    or public.shares_student_school(student_id)
  );

-- UPDATE policy — same group can edit.
drop policy if exists "behavior_incidents_update" on public.behavior_incidents;
create policy "behavior_incidents_update" on public.behavior_incidents
  for update using (
    public.is_student_class_teacher(student_id)
    or public.shares_student_school(student_id)
  );

-- DELETE policy — same group can delete.
drop policy if exists "behavior_incidents_delete" on public.behavior_incidents;
create policy "behavior_incidents_delete" on public.behavior_incidents
  for delete using (
    public.is_student_class_teacher(student_id)
    or public.shares_student_school(student_id)
  );

-- ============================================================
-- 4. RLS for parent_contact / parent_phone / behavioral_notes
--    columns on profiles.
--
-- The existing profiles RLS already governs SELECT. We just need to make
-- sure teachers can UPDATE the parent_contact/parent_phone/behavioral_notes
-- columns for students in their classes — without granting UPDATE on other
-- columns like role or school_id (those would be privilege-escalation).
--
-- Supabase RLS column-level UPDATE is not supported directly, so we use
-- a trigger that restricts which columns can be touched by non-admins.
-- ============================================================

create or replace function public.fn_guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_id   uuid := auth.uid();
begin
  -- Admin client bypasses RLS (no auth.uid); allow.
  if caller_id is null then
    return new;
  end if;

  select role into caller_role from public.profiles where id = caller_id;

  -- Students/parents can only update their own behavioral_notes (not parent fields).
  if caller_role in ('student', 'parent') then
    -- Students shouldn't be able to edit parent_contact / parent_phone at all.
    if new.parent_contact is distinct from old.parent_contact
       or new.parent_phone is distinct from old.parent_phone then
      raise exception 'Students/parents cannot edit parent contact fields.';
    end if;
    -- Don't allow role/school_id escalation.
    if new.role is distinct from old.role
       or new.school_id is distinct from old.school_id then
      raise exception 'Cannot modify role or school_id.';
    end if;
    return new;
  end if;

  -- Teachers + admins can update parent_contact/parent_phone/behavioral_notes
  -- for students in classes they own or in their school. They cannot change
  -- role/school_id/class_id of other users (privilege escalation).
  if new.role is distinct from old.role
     or new.school_id is distinct from old.school_id then
    raise exception 'Cannot modify role or school_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_columns on public.profiles;
create trigger trg_guard_profile_columns
  before update on public.profiles
  for each row execute function public.fn_guard_profile_columns();
