-- 0012_notifications.sql
-- Adds a unified notifications inbox for teachers (and eventually all roles).
--
-- A notification is a denormalized record of "something happened that you
-- should know about":
--   - A student submitted an assignment you teach
--   - A parent sent you a direct message
--   - A leave request you submitted was approved/denied
--   - Someone posted an announcement in your class
--   - A behavior incident was logged on your student
--
-- Notifications are created via DB triggers on the underlying tables, so
-- they fire regardless of which API route wrote the row. This keeps the
-- notification logic centralized in the database rather than scattered
-- across N API routes.
--
-- Design notes:
--   - `actor_id` is who performed the action (NULL for system-generated).
--   - `recipient_id` is who should see the notification (always auth.uid-checked).
--   - `entity_type` + `entity_id` form a polymorphic reference to the source row.
--   - `read_at` is NULL until the recipient opens it.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  school_id    uuid references public.schools(id) on delete cascade,
  -- What kind of event: 'submission', 'direct_message', 'leave_request',
  -- 'announcement', 'behavior_incident', 'quiz_submission'
  type         text not null check (type in (
    'submission', 'direct_message', 'leave_request',
    'announcement', 'behavior_incident', 'quiz_submission',
    'resource_shared', 'assignment_created', 'quiz_published'
  )),
  -- Polymorphic reference to the source entity.
  entity_type  text,
  entity_id    text,
  -- Human-readable title + body (pre-rendered so the UI doesn't need joins).
  title        text not null,
  body         text,
  -- Deep-link URL for the notification (e.g. /dashboard/teacher/grading)
  link_url     text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.notifications is
  'Unified notification inbox. Denormalized records of events the recipient should know about. Created via DB triggers on submissions, direct_messages, leave_requests, announcements, behavior_incidents.';

-- Indexes:
--   1. For "list my notifications, unread first, most recent first".
--   2. For "count my unread notifications" (sidebar badge).
create index if not exists notifications_recipient_idx
  on public.notifications(recipient_id, read_at, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;
create index if not exists notifications_school_idx
  on public.notifications(school_id, created_at desc);

-- Realtime so the UI updates live when a new notification arrives.
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;

-- ============================================================
-- RLS for notifications
-- ============================================================
-- Rules:
--   - A user can see only their own notifications.
--   - A user can mark only their own notifications as read.
--   - Inserts happen via triggers using SECURITY DEFINER functions
--     (which bypass RLS) — so we don't need an INSERT policy for end users.

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (recipient_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete using (recipient_id = auth.uid());

-- ============================================================
-- Helper: insert_notification()
-- SECURITY DEFINER so trigger functions can call it without hitting RLS.
-- ============================================================

create or replace function public.insert_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_actor_id uuid default null,
  p_school_id uuid default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_link_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (
    recipient_id, actor_id, school_id, type,
    entity_type, entity_id, title, body, link_url
  )
  values (
    p_recipient_id, p_actor_id, p_school_id, p_type,
    p_entity_type, p_entity_id, p_title, p_body, p_link_url
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- Trigger 1: new submission → notify the class teacher
-- ============================================================

create or replace function public.fn_notify_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student_name text;
  v_assignment_title text;
  v_class_id uuid;
begin
  -- Fetch the assignment's class + teacher + assignment title + student name.
  select c.teacher_id, a.title, a.class_id
  into v_teacher_id, v_assignment_title, v_class_id
  from public.assignments a
  join public.classes c on c.id = a.class_id
  where a.id = new.assignment_id;

  if v_teacher_id is null then return new; end if;

  select full_name into v_student_name
  from public.profiles where id = new.student_id;

  perform public.insert_notification(
    p_recipient_id := v_teacher_id,
    p_type := 'submission',
    p_title := coalesce(v_student_name, 'A student') || ' submitted ' || coalesce(v_assignment_title, 'an assignment'),
    p_body := 'Open the grading queue to grade this submission.',
    p_actor_id := new.student_id,
    p_entity_type := 'submission',
    p_entity_id := new.id::text,
    p_link_url := '/dashboard/teacher/grading'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_submission on public.submissions;
create trigger trg_notify_on_submission
  after insert on public.submissions
  for each row execute function public.fn_notify_on_submission();

-- ============================================================
-- Trigger 2: new direct_message → notify the recipient
-- ============================================================

create or replace function public.fn_notify_on_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
begin
  select full_name into v_sender_name
  from public.profiles where id = new.sender_id;

  perform public.insert_notification(
    p_recipient_id := new.recipient_id,
    p_type := 'direct_message',
    p_title := coalesce(v_sender_name, 'Someone') || ' sent you a message',
    p_body := left(new.body, 120),
    p_actor_id := new.sender_id,
    p_school_id := new.school_id,
    p_entity_type := 'direct_message',
    p_entity_id := new.id::text,
    p_link_url := '/dashboard/teacher/messages?peer=' || new.sender_id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_direct_message on public.direct_messages;
create trigger trg_notify_on_direct_message
  after insert on public.direct_messages
  for each row execute function public.fn_notify_on_direct_message();

-- ============================================================
-- Trigger 3: leave_request status change → notify the requester
-- ============================================================

create or replace function public.fn_notify_on_leave_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only notify when status changed AND is no longer 'pending'.
  if (new.status is distinct from old.status) and new.status in ('approved', 'rejected') then
    perform public.insert_notification(
      p_recipient_id := new.staff_id,
      p_type := 'leave_request',
      p_title := 'Your leave request was ' || new.status,
      p_body := coalesce(new.admin_notes, 'Click to view details.'),
      p_entity_type := 'leave_request',
      p_entity_id := new.id::text,
      p_link_url := '/dashboard/teacher/leave'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_leave_status on public.leave_requests;
create trigger trg_notify_on_leave_status
  after update on public.leave_requests
  for each row execute function public.fn_notify_on_leave_status();

-- ============================================================
-- Trigger 4: new announcement in a class → notify the teacher
-- (so they know if a co-teacher or admin posted to their class)
-- ============================================================

create or replace function public.fn_notify_on_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_author_name text;
  v_class_name text;
begin
  -- Fetch the class teacher + author name + class name.
  select c.teacher_id, c.name
  into v_teacher_id, v_class_name
  from public.classes c where c.id = new.class_id;

  -- Don't notify the author themselves.
  if v_teacher_id is null or v_teacher_id = new.author_id then
    return new;
  end if;

  select full_name into v_author_name
  from public.profiles where id = new.author_id;

  perform public.insert_notification(
    p_recipient_id := v_teacher_id,
    p_type := 'announcement',
    p_title := coalesce(v_author_name, 'Someone') || ' posted in ' || coalesce(v_class_name, 'your class'),
    p_body := new.title,
    p_actor_id := new.author_id,
    p_entity_type := 'announcement',
    p_entity_id := new.id::text,
    p_link_url := '/dashboard/classes/' || new.class_id || '/feed'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_announcement on public.announcements;
create trigger trg_notify_on_announcement
  after insert on public.announcements
  for each row execute function public.fn_notify_on_announcement();

-- ============================================================
-- Trigger 5: new behavior_incident on a student → notify the student's
-- class teacher (in case an admin logged it).
-- ============================================================

create or replace function public.fn_notify_on_behavior_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student_name text;
  v_recorder_name text;
begin
  -- Fetch the student's class teacher (via the student's class_id).
  select c.teacher_id
  into v_teacher_id
  from public.classes c
  join public.profiles p on p.class_id = c.id
  where p.id = new.student_id;

  -- Don't notify the recorder themselves (they just logged it).
  if v_teacher_id is null or v_teacher_id = new.recorded_by then
    return new;
  end if;

  select full_name into v_student_name
  from public.profiles where id = new.student_id;
  select full_name into v_recorder_name
  from public.profiles where id = new.recorded_by;

  perform public.insert_notification(
    p_recipient_id := v_teacher_id,
    p_type := 'behavior_incident',
    p_title := coalesce(v_recorder_name, 'Someone') || ' logged a ' || new.severity || ' incident for ' || coalesce(v_student_name, 'a student'),
    p_body := new.title,
    p_actor_id := new.recorded_by,
    p_entity_type := 'behavior_incident',
    p_entity_id := new.id::text,
    p_link_url := '/dashboard/students/' || new.student_id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_behavior_incident on public.behavior_incidents;
create trigger trg_notify_on_behavior_incident
  after insert on public.behavior_incidents
  for each row execute function public.fn_notify_on_behavior_incident();
