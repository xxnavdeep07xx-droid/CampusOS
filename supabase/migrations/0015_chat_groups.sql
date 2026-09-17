-- 0015_chat_groups.sql
-- Group chat support — principals and teachers can create groups
-- (e.g. "Math Department", "Grade 10 Teachers", "Parent-Teacher Committee").
-- Also adds message reactions (emoji).
--
-- NOTE: Tables are created BEFORE RLS policies (which reference them).

-- ============================================================
-- 1. Tables + indexes + Realtime (created first)
-- ============================================================

create table if not exists public.chat_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  created_by   uuid not null references public.profiles(id) on delete set null,
  school_id    uuid not null references public.schools(id) on delete cascade,
  color        text not null default 'bg-sky-400',
  class_id     uuid references public.classes(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists chat_groups_school_idx on public.chat_groups(school_id, created_at desc);

create table if not exists public.chat_group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  joined_at  timestamptz not null default now(),
  unique(group_id, user_id)
);
create index if not exists chat_group_members_group_idx on public.chat_group_members(group_id);
create index if not exists chat_group_members_user_idx on public.chat_group_members(user_id);

create table if not exists public.chat_group_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (length(body) > 0 and length(body) <= 5000),
  reply_to_id  uuid references public.chat_group_messages(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists chat_group_messages_group_idx on public.chat_group_messages(group_id, created_at desc);

create table if not exists public.chat_group_message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.chat_group_messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
create index if not exists chat_group_message_reactions_msg_idx on public.chat_group_message_reactions(message_id);

alter publication supabase_realtime add table public.chat_group_messages;
alter publication supabase_realtime add table public.chat_group_message_reactions;
alter table public.chat_group_messages replica identity full;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;
alter table public.chat_group_message_reactions enable row level security;

drop trigger if exists trg_touch_chat_groups on public.chat_groups;
create trigger trg_touch_chat_groups
  before update on public.chat_groups
  for each row execute function public.fn_touch_updated_at();

-- ============================================================
-- 2. RLS policies (tables now exist)
-- ============================================================

-- chat_groups: members + school admins can see; principals+teachers can create
drop policy if exists "chat_groups_select" on public.chat_groups;
create policy "chat_groups_select" on public.chat_groups for select using (
  exists (select 1 from public.chat_group_members m where m.group_id = chat_groups.id and m.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('principal', 'staff') and p.school_id = chat_groups.school_id)
);
drop policy if exists "chat_groups_insert" on public.chat_groups;
create policy "chat_groups_insert" on public.chat_groups for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('principal', 'teacher') and p.school_id = chat_groups.school_id)
);
drop policy if exists "chat_groups_update" on public.chat_groups;
create policy "chat_groups_update" on public.chat_groups for update using (
  created_by = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('principal', 'staff') and p.school_id = chat_groups.school_id)
);
drop policy if exists "chat_groups_delete" on public.chat_groups;
create policy "chat_groups_delete" on public.chat_groups for delete using (
  created_by = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('principal', 'staff') and p.school_id = chat_groups.school_id)
);

-- chat_group_members: members + school admins can see; group admins can add/remove
drop policy if exists "chat_group_members_select" on public.chat_group_members;
create policy "chat_group_members_select" on public.chat_group_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid())
  or exists (select 1 from public.chat_groups g join public.profiles p on p.school_id = g.school_id where g.id = chat_group_members.group_id and p.id = auth.uid() and p.role in ('principal', 'staff'))
);
drop policy if exists "chat_group_members_insert" on public.chat_group_members;
create policy "chat_group_members_insert" on public.chat_group_members for insert with check (
  exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid() and m.role = 'admin')
  or exists (select 1 from public.chat_groups g join public.profiles p on p.school_id = g.school_id where g.id = chat_group_members.group_id and p.id = auth.uid() and p.role in ('principal', 'staff'))
  or exists (select 1 from public.chat_groups g where g.id = chat_group_members.group_id and g.created_by = auth.uid())
);
drop policy if exists "chat_group_members_update" on public.chat_group_members;
create policy "chat_group_members_update" on public.chat_group_members for update using (
  exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid() and m.role = 'admin')
  or exists (select 1 from public.chat_groups g join public.profiles p on p.school_id = g.school_id where g.id = chat_group_members.group_id and p.id = auth.uid() and p.role in ('principal', 'staff'))
);
drop policy if exists "chat_group_members_delete" on public.chat_group_members;
create policy "chat_group_members_delete" on public.chat_group_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid() and m.role = 'admin')
  or exists (select 1 from public.chat_groups g join public.profiles p on p.school_id = g.school_id where g.id = chat_group_members.group_id and p.id = auth.uid() and p.role in ('principal', 'staff'))
);

-- chat_group_messages: members can see/send; senders+admins can delete
drop policy if exists "chat_group_messages_select" on public.chat_group_messages;
create policy "chat_group_messages_select" on public.chat_group_messages for select using (
  exists (select 1 from public.chat_group_members m where m.group_id = chat_group_messages.group_id and m.user_id = auth.uid())
  or exists (select 1 from public.chat_groups g join public.profiles p on p.school_id = g.school_id where g.id = chat_group_messages.group_id and p.id = auth.uid() and p.role in ('principal', 'staff'))
);
drop policy if exists "chat_group_messages_insert" on public.chat_group_messages;
create policy "chat_group_messages_insert" on public.chat_group_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.chat_group_members m where m.group_id = chat_group_messages.group_id and m.user_id = auth.uid())
);
drop policy if exists "chat_group_messages_delete" on public.chat_group_messages;
create policy "chat_group_messages_delete" on public.chat_group_messages for delete using (
  sender_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_messages.group_id and m.user_id = auth.uid() and m.role = 'admin')
);

-- chat_group_message_reactions: members can see/add; users delete own
drop policy if exists "chat_group_message_reactions_select" on public.chat_group_message_reactions;
create policy "chat_group_message_reactions_select" on public.chat_group_message_reactions for select using (
  exists (select 1 from public.chat_group_messages m join public.chat_group_members mem on mem.group_id = m.group_id where m.id = chat_group_message_reactions.message_id and mem.user_id = auth.uid())
);
drop policy if exists "chat_group_message_reactions_insert" on public.chat_group_message_reactions;
create policy "chat_group_message_reactions_insert" on public.chat_group_message_reactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.chat_group_messages m join public.chat_group_members mem on mem.group_id = m.group_id where m.id = chat_group_message_reactions.message_id and mem.user_id = auth.uid())
);
drop policy if exists "chat_group_message_reactions_delete" on public.chat_group_message_reactions;
create policy "chat_group_message_reactions_delete" on public.chat_group_message_reactions for delete using (user_id = auth.uid());
