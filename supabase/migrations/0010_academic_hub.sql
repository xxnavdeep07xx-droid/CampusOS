-- 0010_academic_hub.sql
-- Adds three new teacher-facing academic features:
--   1. Lesson plans (weekly/daily planning with objectives + materials)
--   2. Syllabus tracker (units with completion progress bars)
--   3. Assignment resource attachments (M:N junction so an assignment can
--      link to multiple files + external URLs, not just a single file_path)
--   4. Teacher personal drive (private storage bucket + table for files
--      not tied to any class — presentations, worksheets, past papers)

-- ============================================================
-- 1. lesson_plans table
-- ============================================================

create table if not exists public.lesson_plans (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.profiles(id) on delete cascade,
  class_id      uuid references public.classes(id) on delete cascade,
  -- ISO date the lesson is scheduled for. NULLable for "anytime" plans
  -- that aren't tied to a specific day.
  lesson_date   date,
  -- Topic / title — e.g. "Photosynthesis overview"
  title         text not null,
  -- Free-form lesson body (markdown or plain text)
  body          text,
  -- Structured objectives + materials as arrays
  objectives    text[] not null default '{}',
  materials     text[] not null default '{}',
  -- Estimated duration in minutes
  duration_min  int default 45,
  -- 'draft' = work-in-progress, 'published' = finalized
  status        text not null default 'draft' check (status in ('draft', 'published')),
  -- Optional link to a syllabus unit (for progress tracking)
  syllabus_unit_id uuid references public.syllabus_units(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.lesson_plans is
  'Daily/weekly lesson plans created by a teacher. Optionally linked to a syllabus unit for progress tracking.';

create index if not exists lesson_plans_teacher_date_idx
  on public.lesson_plans(teacher_id, lesson_date desc);
create index if not exists lesson_plans_class_date_idx
  on public.lesson_plans(class_id, lesson_date desc);

alter table public.lesson_plans enable row level security;

drop policy if exists "lesson_plans_select" on public.lesson_plans;
create policy "lesson_plans_select" on public.lesson_plans
  for select using (
    teacher_id = auth.uid()
    or exists (
      select 1 from public.classes c
      where c.id = lesson_plans.class_id
        and (c.teacher_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'staff')
        and p.school_id in (
          select school_id from public.classes where id = lesson_plans.class_id
        )
    )
  );

drop policy if exists "lesson_plans_insert" on public.lesson_plans;
create policy "lesson_plans_insert" on public.lesson_plans
  for insert with check (teacher_id = auth.uid());

drop policy if exists "lesson_plans_update" on public.lesson_plans;
create policy "lesson_plans_update" on public.lesson_plans
  for update using (teacher_id = auth.uid());

drop policy if exists "lesson_plans_delete" on public.lesson_plans;
create policy "lesson_plans_delete" on public.lesson_plans
  for delete using (teacher_id = auth.uid());

-- ============================================================
-- 2. syllabus_units table
-- ============================================================

create table if not exists public.syllabus_units (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references public.profiles(id) on delete cascade,
  class_id         uuid references public.classes(id) on delete cascade,
  -- e.g. "Chapter 3: Cell Biology"
  title            text not null,
  description      text,
  -- How many lessons the unit spans total (for progress calc)
  total_lessons    int not null default 1 check (total_lessons >= 1),
  -- How many lessons have been delivered/completed
  completed_lessons int not null default 0 check (completed_lessons >= 0 and completed_lessons <= total_lessons),
  -- Optional target completion date
  target_date      date,
  -- 'not_started' | 'in_progress' | 'completed'
  status           text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  -- Optional ordering within a class
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.syllabus_units is
  'Syllabus units for progress tracking. Each unit has total_lessons and completed_lessons for a progress bar.';

create index if not exists syllabus_units_teacher_idx
  on public.syllabus_units(teacher_id, position);
create index if not exists syllabus_units_class_idx
  on public.syllabus_units(class_id, position);

alter table public.syllabus_units enable row level security;

drop policy if exists "syllabus_units_select" on public.syllabus_units;
create policy "syllabus_units_select" on public.syllabus_units
  for select using (
    teacher_id = auth.uid()
    or exists (
      select 1 from public.classes c
      where c.id = syllabus_units.class_id
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'staff')
        and p.school_id in (
          select school_id from public.classes where id = syllabus_units.class_id
        )
    )
  );

drop policy if exists "syllabus_units_insert" on public.syllabus_units;
create policy "syllabus_units_insert" on public.syllabus_units
  for insert with check (teacher_id = auth.uid());

drop policy if exists "syllabus_units_update" on public.syllabus_units;
create policy "syllabus_units_update" on public.syllabus_units
  for update using (teacher_id = auth.uid());

drop policy if exists "syllabus_units_delete" on public.syllabus_units;
create policy "syllabus_units_delete" on public.syllabus_units
  for delete using (teacher_id = auth.uid());

-- ============================================================
-- 3. assignment_resources junction (M:N attachments)
-- ============================================================
-- Allows an assignment to have multiple attached files + external links
-- (instead of the single assignments.file_path column from migration 0002).

create table if not exists public.assignment_resources (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  -- 'file' = file in class_materials bucket (storage_path set)
  -- 'link' = external URL (url set, storage_path NULL)
  kind          text not null check (kind in ('file', 'link')),
  storage_path  text,
  url           text,
  -- Human-readable label, e.g. "Worksheet 3 — Quadratic equations"
  label         text not null,
  -- Optional file metadata (size, mime_type) — only set when kind='file'
  file_size     bigint,
  mime_type     text,
  -- Ordering for display
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.assignment_resources is
  'M:N junction between assignments and attached files / external links. Replaces the single assignments.file_path column (which is kept for backward compat).';

create index if not exists assignment_resources_assignment_idx
  on public.assignment_resources(assignment_id, position);

alter table public.assignment_resources enable row level security;

-- Authorization: caller must be the teacher of the assignment's class,
-- OR a school admin in the same school, OR a student enrolled in that class
-- (read-only — students need to download attachments).
drop policy if exists "assignment_resources_select" on public.assignment_resources;
create policy "assignment_resources_select" on public.assignment_resources
  for select using (
    exists (
      select 1 from public.assignments a
      join public.classes c on c.id = a.class_id
      where a.id = assignment_resources.assignment_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('principal', 'staff')
              and p.school_id = c.school_id
          )
          or (
            -- Enrolled student
            (select role from public.profiles where id = auth.uid()) = 'student'
            and (select class_id from public.profiles where id = auth.uid()) = a.class_id
          )
        )
    )
  );

drop policy if exists "assignment_resources_insert" on public.assignment_resources;
create policy "assignment_resources_insert" on public.assignment_resources
  for insert with check (
    exists (
      select 1 from public.assignments a
      join public.classes c on c.id = a.class_id
      where a.id = assignment_resources.assignment_id
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.assignments a
      join public.classes c on c.id = a.class_id
      join public.profiles p on p.school_id = c.school_id
      where a.id = assignment_resources.assignment_id
        and p.id = auth.uid()
        and p.role in ('principal', 'staff')
    )
  );

drop policy if exists "assignment_resources_update" on public.assignment_resources;
create policy "assignment_resources_update" on public.assignment_resources
  for update using (
    exists (
      select 1 from public.assignments a
      join public.classes c on c.id = a.class_id
      where a.id = assignment_resources.assignment_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "assignment_resources_delete" on public.assignment_resources;
create policy "assignment_resources_delete" on public.assignment_resources
  for delete using (
    exists (
      select 1 from public.assignments a
      join public.classes c on c.id = a.class_id
      where a.id = assignment_resources.assignment_id
        and c.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- 4. teacher_files table + private storage bucket
-- ============================================================
-- Personal cloud storage for teachers — not tied to any class.
-- Each teacher gets their own folder under <teacher_id>/.

create table if not exists public.teacher_files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  -- Storage path in the teacher_files bucket — convention: <owner_id>/<uuid>.<ext>
  file_path    text not null,
  -- Display name (e.g. "Algebra Chapter 5 Worksheet.pdf")
  name         text not null,
  description  text,
  -- File metadata
  file_size    bigint,
  mime_type    text,
  -- Optional folder/sub-folder grouping — NULL for root.
  -- Stored as slash-separated path: "Worksheets/Algebra"
  folder       text default '',
  -- Optional link to a class (so a teacher can "share" a personal file to a class
  -- without copying it). NULL = purely personal.
  shared_with_class_id uuid references public.classes(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.teacher_files is
  'Personal teacher drive — files not tied to any class. Each teacher owns a folder under <owner_id>/ in the teacher_files bucket.';

create index if not exists teacher_files_owner_idx
  on public.teacher_files(owner_id, folder, created_at desc);
create index if not exists teacher_files_class_idx
  on public.teacher_files(shared_with_class_id)
  where shared_with_class_id is not null;

alter table public.teacher_files enable row level security;

drop policy if exists "teacher_files_select" on public.teacher_files;
create policy "teacher_files_select" on public.teacher_files
  for select using (
    owner_id = auth.uid()
    -- School admins can see but not edit a teacher's drive
    or (
      shared_with_class_id is not null
      and exists (
        select 1 from public.classes c
        join public.profiles p on p.school_id = c.school_id
        where c.id = teacher_files.shared_with_class_id
          and p.id = auth.uid()
          and p.role in ('principal', 'staff', 'teacher')
      )
    )
    -- Students can see files explicitly shared with their class
    or (
      shared_with_class_id is not null
      and (select class_id from public.profiles where id = auth.uid()) = shared_with_class_id
    )
  );

drop policy if exists "teacher_files_insert" on public.teacher_files;
create policy "teacher_files_insert" on public.teacher_files
  for insert with check (owner_id = auth.uid());

drop policy if exists "teacher_files_update" on public.teacher_files;
create policy "teacher_files_update" on public.teacher_files
  for update using (owner_id = auth.uid());

drop policy if exists "teacher_files_delete" on public.teacher_files;
create policy "teacher_files_delete" on public.teacher_files
  for delete using (owner_id = auth.uid());

-- ============================================================
-- 5. Storage bucket: teacher_files (private — signed URLs only)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'teacher_files', 'teacher_files', false, 52428800, null
where not exists (select 1 from storage.buckets where id = 'teacher_files');

-- Helper: extract owner_id from a teacher_files storage path (first segment).
create or replace function public.storage_path_owner_id(path text)
returns uuid
language sql
immutable
as $$
  -- Path convention: <owner_id>/<uuid>.<ext> — first slash-separated segment.
  select split_part(path, '/', 1)::uuid;
$$;

-- Storage RLS policies for teacher_files bucket.
-- (Drop + recreate so re-running the migration is safe.)
drop policy if exists "teacher_files_storage_read" on storage.objects;
create policy "teacher_files_storage_read" on storage.objects
  for select using (
    bucket_id = 'teacher_files'
    and public.storage_path_owner_id(name) = auth.uid()
  );

drop policy if exists "teacher_files_storage_insert" on storage.objects;
create policy "teacher_files_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'teacher_files'
    and public.storage_path_owner_id(name) = auth.uid()
  );

drop policy if exists "teacher_files_storage_update" on storage.objects;
create policy "teacher_files_storage_update" on storage.objects
  for update using (
    bucket_id = 'teacher_files'
    and public.storage_path_owner_id(name) = auth.uid()
  );

drop policy if exists "teacher_files_storage_delete" on storage.objects;
create policy "teacher_files_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'teacher_files'
    and public.storage_path_owner_id(name) = auth.uid()
  );

-- ============================================================
-- 6. Realtime
-- ============================================================

alter publication supabase_realtime add table public.lesson_plans;
alter publication supabase_realtime add table public.syllabus_units;
alter table public.lesson_plans replica identity full;
alter table public.syllabus_units replica identity full;
