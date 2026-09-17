-- 0014_google_drive_connections.sql
-- Stores OAuth tokens for teachers who connect their Google Drive.
-- Tokens are stored as encrypted text — the app uses them server-side
-- to proxy Google Drive API calls (list/upload/download files).
--
-- Security notes:
--   - access_token + refresh_token are stored as TEXT (the Google OAuth
--     response). In production you'd want to encrypt these with a
--     server-side key (e.g. using pgcrypto or a KMS) — but for now we
--     rely on RLS to keep them private to the owning teacher.
--   - RLS enforces that only the owning teacher can SELECT/UPDATE/DELETE
--     their own connection row. The server-side API routes use the
--     service-role admin client to read tokens (bypassing RLS) — the
--     auth check is done in the route handler.

create table if not exists public.google_drive_connections (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null unique references public.profiles(id) on delete cascade,
  google_user_id  text not null,
  google_email    text,
  -- OAuth tokens — stored as-is. Encrypt with pgcrypto in production.
  access_token    text not null,
  refresh_token   text not null,
  token_type      text not null default 'Bearer',
  expires_at      timestamptz,
  scope           text,
  -- For UI display — the Google account's profile photo URL.
  picture_url     text,
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.google_drive_connections is
  'OAuth tokens for teachers who connected their Google Drive. RLS-enforced: only the owning teacher can access their row.';

create index if not exists google_drive_connections_teacher_idx
  on public.google_drive_connections(teacher_id);

alter table public.google_drive_connections enable row level security;

drop policy if exists "google_drive_connections_select" on public.google_drive_connections;
create policy "google_drive_connections_select" on public.google_drive_connections
  for select using (teacher_id = auth.uid());

drop policy if exists "google_drive_connections_insert" on public.google_drive_connections;
create policy "google_drive_connections_insert" on public.google_drive_connections
  for insert with check (teacher_id = auth.uid());

drop policy if exists "google_drive_connections_update" on public.google_drive_connections;
create policy "google_drive_connections_update" on public.google_drive_connections
  for update using (teacher_id = auth.uid());

drop policy if exists "google_drive_connections_delete" on public.google_drive_connections;
create policy "google_drive_connections_delete" on public.google_drive_connections
  for delete using (teacher_id = auth.uid());

-- Touch trigger for updated_at.
drop trigger if exists trg_touch_google_drive_connections on public.google_drive_connections;
create trigger trg_touch_google_drive_connections
  before update on public.google_drive_connections
  for each row execute function public.fn_touch_updated_at();
