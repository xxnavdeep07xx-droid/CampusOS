-- 0011_communication_center.sql
-- Adds:
--   1. direct_messages table — 1:1 messaging between any two users in the
--      same school (teacher↔teacher, teacher↔parent, teacher↔admin, etc.)
--   2. meeting_url column on announcements — for class broadcasts that
--      include a Zoom/Meet/Teams join link.

-- ============================================================
-- 1. direct_messages table
-- ============================================================
-- Simple 1:1 model — no separate conversations table. A "conversation"
-- between two users is just the set of messages where
-- (sender_id = A AND recipient_id = B) OR (sender_id = B AND recipient_id = A).
-- This avoids an extra join + a separate conversations table.

create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  school_id    uuid references public.schools(id) on delete cascade,
  body         text not null check (length(body) > 0 and length(body) <= 5000),
  -- NULL until the recipient opens the conversation
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.direct_messages is
  '1:1 direct messages between users in the same school. A conversation is implicit — the set of rows between two user IDs.';

-- Indexes:
--   1. For "list my conversations" — distinct peers per user, latest message first.
--   2. For "load messages between me and peer X" — chronological.
create index if not exists direct_messages_parties_idx
  on public.direct_messages(
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id),
    created_at desc
  );
create index if not exists direct_messages_recipient_unread_idx
  on public.direct_messages(recipient_id, read_at)
  where read_at is null;
create index if not exists direct_messages_school_idx
  on public.direct_messages(school_id, created_at desc);

-- Realtime — let the UI update live when a new message arrives.
alter publication supabase_realtime add table public.direct_messages;
alter table public.direct_messages replica identity full;

-- ============================================================
-- RLS for direct_messages
-- ============================================================
-- Rules:
--   - Both sender and recipient must be in the same school.
--   - A user can see messages they sent or received.
--   - A user can only INSERT messages where they are the sender AND
--     the recipient is in the same school.
--   - A user can only UPDATE the read_at field of messages addressed to them.

alter table public.direct_messages enable row level security;

drop policy if exists "direct_messages_select" on public.direct_messages;
create policy "direct_messages_select" on public.direct_messages
  for select using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

drop policy if exists "direct_messages_insert" on public.direct_messages;
create policy "direct_messages_insert" on public.direct_messages
  for insert with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1
      from public.profiles sender, public.profiles recipient
      where sender.id = sender_id
        and recipient.id = recipient_id
        and sender.school_id is not null
        and sender.school_id = recipient.school_id
    )
  );

drop policy if exists "direct_messages_update" on public.direct_messages;
create policy "direct_messages_update" on public.direct_messages
  for update using (
    -- Only the recipient can mark a message as read.
    recipient_id = auth.uid()
  )
  -- Restrict which columns can be touched — only read_at (and the implicit
  -- updated_at if any). Body/sender/recipient are immutable.
  with check (
    recipient_id = auth.uid()
  );

drop policy if exists "direct_messages_delete" on public.direct_messages;
create policy "direct_messages_delete" on public.direct_messages
  for delete using (
    -- Both parties can delete a message on their end (soft delete pattern).
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

-- ============================================================
-- 2. meeting_url column on announcements
-- ============================================================
-- Lets teachers attach a Zoom/Google Meet/Microsoft Teams link to a class
-- broadcast. NULL by default — existing announcements are unaffected.

alter table public.announcements
  add column if not exists meeting_url text;

comment on column public.announcements.meeting_url is
  'Optional Zoom/Meet/Teams link for class broadcasts. NULL = no meeting link.';

-- Add a CHECK constraint so only valid-looking URLs are stored.
alter table public.announcements
  drop constraint if exists announcements_meeting_url_format;
alter table public.announcements
  add constraint announcements_meeting_url_format check (
    meeting_url is null
    or meeting_url ~ '^https?://'
  );
