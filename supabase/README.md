# CampusOS — Database Setup

Phase 1 migration: [`migrations/0001_init.sql`](./migrations/0001_init.sql) — schools, profiles, classes, invitations + RLS.

Phase 2 migration: [`migrations/0002_classroom_hub.sql`](./migrations/0002_classroom_hub.sql) — adds `class_id` to `profiles`, creates `resources`, `assignments`, `submissions` tables + two Supabase Storage buckets (`class_materials`, `student_submissions`) with their own RLS policies.

Phase 3 migration: [`migrations/0003_attendance_timetable.sql`](./migrations/0003_attendance_timetable.sql) — creates `attendance` (with `attendance_status` enum + unique constraint per class/student/date) and `timetables` (with a GiST EXCLUDE constraint preventing overlapping slots per class+day) tables. Includes the `v_today_attendance_summary` view that powers the principal's "Today's Attendance Rate" widget.

Phase 4 migration: [`migrations/0004_announcements_chat.sql`](./migrations/0004_announcements_chat.sql) — creates `announcements` (with `tag` enum-like CHECK constraint) and `class_messages` tables, enables Supabase Realtime publication on both, and sets `REPLICA IDENTITY FULL` so UPDATE/DELETE events carry the full row. Powers the real-time class feed + live chat.

Phase 5 migration: [`migrations/0005_quizzes_gradebook.sql`](./migrations/0005_quizzes_gradebook.sql) — creates `quizzes`, `quiz_questions`, `quiz_attempts` tables + the `class_gradebook` view that aggregates Phase 2 submissions + Phase 5 quiz_attempts into a per-student percentage. Includes `question_type` enum (mcq/short_answer), `attempt_status` enum (in_progress/completed), and a unique partial index so each student has at most one in-progress attempt per quiz.

## Apply the migrations

### Option A — Supabase Dashboard SQL Editor (easiest)

1. Open <https://supabase.com/dashboard/project/uprkvbkqelrovmwrzieu/sql/new>
2. Copy the contents of `migrations/0001_init.sql` into the editor and click **Run**.
3. Open a fresh SQL editor tab, paste `migrations/0002_classroom_hub.sql`, and click **Run**.
4. Open another fresh SQL editor tab, paste `migrations/0003_attendance_timetable.sql`, and click **Run**.
5. Open another fresh SQL editor tab, paste `migrations/0004_announcements_chat.sql`, and click **Run**.
6. Open another fresh SQL editor tab, paste `migrations/0005_quizzes_gradebook.sql`, and click **Run**.

All five scripts are idempotent — safe to re-run.

### Option B — `psql` from your local machine

```bash
psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0001_init.sql

psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0002_classroom_hub.sql

psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0003_attendance_timetable.sql

psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0004_announcements_chat.sql

psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0005_quizzes_gradebook.sql
```

If the direct host is unreachable from your network, use the pooler URL instead (find the region under *Project Settings → Database → Connection string*):

```bash
psql "postgresql://postgres.uprkvbkqelrovmwrzieu:SjedAkLn91r1KB93@aws-0-<region>.pooler.supabase.com:5432/postgres" \
     -f supabase/migrations/0005_quizzes_gradebook.sql
```

## Storage buckets (Phase 2)

The Phase 2 migration creates two buckets via SQL:

| Bucket ID             | Public | Purpose                                                |
|-----------------------|--------|--------------------------------------------------------|
| `class_materials`     | true   | Teacher-uploaded resources + assignment attachments    |
| `student_submissions` | false  | Student-uploaded homework files (private — student + teacher only) |

These buckets were also created programmatically via the Storage API during Phase 2 setup, so even if you skip the migration, the buckets exist. But the storage RLS policies inside `0002_classroom_hub.sql` are required for proper access control — please run the migration.

## Verify the Phase 2 migration

```sql
-- All 7 tables (Phase 1 + Phase 2)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Both buckets
SELECT id, name, public FROM storage.buckets;
```

Expected tables (Phase 2 rows in bold):

| tablename    | rowsecurity |
|--------------|-------------|
| assignments  | t           |
| **classes**      | t           |
| invitations  | t           |
| profiles     | t           |
| resources    | t           |
| schools      | t           |
| submissions  | t           |

Expected buckets:

| id                  | public |
|---------------------|--------|
| class_materials     | t      |
| student_submissions | f      |

## Get the API keys (if you haven't already)

1. <https://supabase.com/dashboard/project/uprkvbkqelrovmwrzieu/api-keys>
2. Copy **`anon` `publishable`** key → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy **`service_role` `secret`** key → paste into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

Restart `bun run dev` after editing `.env.local`.

## A note on pre-existing Phase 1 students

Phase 1's `profiles` table didn't have a `class_id` column. Phase 2's migration adds it (nullable). Students who registered through Phase 1 invites **will not** have `class_id` set automatically — the invite token stored the class_id, but the linkage wasn't persisted to the profile row.

If you have Phase 1 students without a class assignment, the cleanest fix is to re-invite them through a teacher. New students (going forward) will get `class_id` set automatically via the `completeInviteOnboarding` server action.
