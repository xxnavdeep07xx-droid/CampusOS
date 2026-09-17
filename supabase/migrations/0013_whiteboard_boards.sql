-- 0013_whiteboard_boards.sql
-- Adds persistent whiteboard boards — teachers can save their canvas state,
-- create multiple named boards per class, and reload them later.
--
-- Previously the whiteboard was ephemeral — refresh the page and everything
-- was lost. Now each board's stroke data is persisted as JSONB, and a
-- thumbnail PNG is stored in the class_materials bucket for the gallery view.

create table if not exists public.whiteboard_boards (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete set null,
  name         text not null,
  -- JSONB array of stroke objects. Each stroke has:
  --   { tool, color, width, points: [{x, y}, ...] }
  -- NULL = empty board (never saved).
  strokes_data jsonb,
  -- Storage path in class_materials for the thumbnail PNG.
  -- NULL until the first save (thumbnail generated from the canvas).
  thumbnail_path text,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.whiteboard_boards is
  'Persistent whiteboard boards. Each board belongs to a class and stores its stroke data as JSONB. Thumbnails are stored in the class_materials bucket.';

create index if not exists whiteboard_boards_class_idx
  on public.whiteboard_boards(class_id, updated_at desc);
create index if not exists whiteboard_boards_created_by_idx
  on public.whiteboard_boards(created_by);

-- Realtime so multiple viewers see board updates instantly.
alter publication supabase_realtime add table public.whiteboard_boards;
alter table public.whiteboard_boards replica identity full;

-- RLS: same pattern as other class-scoped tables.
--   - Teacher of the class: full CRUD
--   - School admin (principal/staff): read + create
--   - Enrolled student: read-only

alter table public.whiteboard_boards enable row level security;

drop policy if exists "whiteboard_boards_select" on public.whiteboard_boards;
create policy "whiteboard_boards_select" on public.whiteboard_boards
  for select using (
    exists (
      select 1 from public.classes c
      where c.id = whiteboard_boards.class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('principal', 'staff')
              and p.school_id = c.school_id
          )
          or (
            (select role from public.profiles where id = auth.uid()) = 'student'
            and (select class_id from public.profiles where id = auth.uid()) = whiteboard_boards.class_id
          )
        )
    )
  );

drop policy if exists "whiteboard_boards_insert" on public.whiteboard_boards;
create policy "whiteboard_boards_insert" on public.whiteboard_boards
  for insert with check (
    exists (
      select 1 from public.classes c
      where c.id = whiteboard_boards.class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('principal', 'staff')
              and p.school_id = c.school_id
          )
        )
    )
  );

drop policy if exists "whiteboard_boards_update" on public.whiteboard_boards;
create policy "whiteboard_boards_update" on public.whiteboard_boards
  for update using (
    exists (
      select 1 from public.classes c
      where c.id = whiteboard_boards.class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('principal', 'staff')
              and p.school_id = c.school_id
          )
        )
    )
  );

drop policy if exists "whiteboard_boards_delete" on public.whiteboard_boards;
create policy "whiteboard_boards_delete" on public.whiteboard_boards
  for delete using (
    exists (
      select 1 from public.classes c
      where c.id = whiteboard_boards.class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('principal', 'staff')
              and p.school_id = c.school_id
          )
        )
    )
  );

-- Touch trigger for updated_at.
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_whiteboard_boards on public.whiteboard_boards;
create trigger trg_touch_whiteboard_boards
  before update on public.whiteboard_boards
  for each row execute function public.fn_touch_updated_at();
