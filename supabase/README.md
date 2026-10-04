# CampusOS — Database Setup

Every table, policy, trigger, view and storage bucket lives in
[`migrations/`](./migrations). All scripts are **idempotent** (`IF NOT EXISTS`
/ `DROP POLICY IF EXISTS`), so re-running them is safe.

| # | Migration | Adds |
|---|-----------|------|
| 0001 | `0001_init.sql` | `schools`, `profiles`, `classes`, `invitations` + RLS + `auth.users` → `profiles` trigger |
| 0002 | `0002_classroom_hub.sql` | `resources`, `assignments`, `submissions`, `class_id` on `profiles`, `class_materials` + `student_submissions` storage buckets |
| 0003 | `0003_attendance_timetable.sql` | `attendance` (+ status enum), `timetables` (overlap-safe), `v_today_attendance_summary` view |
| 0004 | `0004_announcements_chat.sql` | `announcements`, `class_messages` + Realtime publication |
| 0005 | `0005_quizzes_gradebook.sql` | `quizzes`, `quiz_questions`, `quiz_attempts`, `class_gradebook` view |
| 0006 | `0006_fees_parent_portal.sql` | `parent_student_links`, `fee_invoices`, `payments`, `global_notices`, `parent` role |
| 0007 | `0007_library_hr.sql` | `books`, `book_issues` (+ copy-count trigger), `leave_requests` |
| 0008 | `0008_transport_reports.sql` | `transport_routes`, `transport_stops`, `profiles.transport_stop_id` |
| 0009 | `0009_behavior_incidents.sql` | `behavior_incidents` + `parent_contact`, `parent_phone`, `behavioral_notes` on `profiles` |
| 0010 | `0010_academic_hub.sql` | `syllabus_units`, `lesson_plans`, `teacher_files` bucket |
| 0011 | `0011_communication_center.sql` | `direct_messages` (1:1 messaging) |
| 0012 | `0012_notifications.sql` | `notifications` inbox |
| 0013 | `0013_whiteboard_boards.sql` | `whiteboard_boards` (persistent canvases) |
| 0014 | `0014_google_drive_connections.sql` | `google_drive_connections` (OAuth tokens) |
| 0015 | `0015_chat_groups.sql` | `chat_groups`, `chat_group_members`, `chat_group_messages`, `message_reactions` |

## Apply the migrations

### Option A — Supabase SQL Editor (easiest, no tools required)

1. Open <https://supabase.com/dashboard/project/_/sql/new>
2. Paste `migrations/0001_init.sql` → **Run**
3. Repeat for `0002` → `0015` (one tab each, in order)
4. Verify with the queries in [Verify](#verify) below

> Prefer the Supabase CLI (`supabase link && supabase db push`) if you already
> have it configured — it tracks applied migrations for you.

### Option B — `psql`

Set the connection string in your shell (never commit it — the
`SUPABASE_DB_URL` is under *Project Settings → Database → Connection string*):

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'

for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

If the direct host is unreachable from your network, use the pooler URL
(*Project Settings → Database → Connection pooling*):

```bash
export SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

## Verify

```sql
-- Every CampusOS table should have rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Storage buckets created by migration 0002 / 0010
SELECT id, name, public FROM storage.buckets;

-- Realtime-enabled tables (announcements, class_messages, chat groups)
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Expected buckets:

| Bucket ID | Public | Purpose |
|-----------|--------|---------|
| `class_materials` | yes | Teacher-uploaded resources + assignment attachments |
| `student_submissions` | **no** | Student homework (student + teacher only) |
| `teacher_files` | no | Teacher personal drive (Google Drive import staging) |

## API keys

1. <https://supabase.com/dashboard/project/_/settings/api>
2. **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. **anon / publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)

Copy [`.env.example`](../.env.example) to `.env.local`, fill in the values, and
restart `npm run dev`.

## Auth settings checklist

In **Authentication → URL Configuration**:

- **Site URL** — your production URL (`https://your-domain.com`)
- **Redirect URLs** — add `http://localhost:3000/**` and `https://your-domain.com/**`

In **Authentication → Providers → Email**, keep "Confirm email" on for
production so invitees verify their address before signing in.

## Notes

- **Phase 1 students without a class**: `profiles.class_id` arrived in migration
  0002. Students who registered before it need to be re-invited so the class
  linkage is persisted.
- **Multi-tenancy**: every table is scoped by `school_id` and guarded by RLS;
  cross-school reads are impossible with the anon key. Server-side admin
  operations use the service-role client (`src/lib/supabase/admin.ts`) and
  always re-check ownership before writing.
