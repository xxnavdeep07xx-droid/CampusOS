# CampusOS — Database Setup

The SQL migration for Phase 1 lives at [`migrations/0001_init.sql`](./migrations/0001_init.sql).

It creates the `schools`, `profiles`, `classes`, and `invitations` tables with Row Level Security enabled on every table, plus a `user_role` enum (`principal`, `teacher`, `staff`, `student`) and a trigger that auto-creates a `profiles` row whenever a new auth user signs up.

## Apply the migration

You have two options.

### Option A — Supabase Dashboard SQL Editor (easiest)

1. Open <https://supabase.com/dashboard/project/uprkvbkqelrovmwrzieu/sql/new>
2. Copy the entire contents of `migrations/0001_init.sql` into the editor.
3. Click **Run**. The script is idempotent — safe to re-run.

### Option B — `psql` from your local machine

```bash
psql "postgresql://postgres:SjedAkLn91r1KB93@db.uprkvbkqelrovmwrzieu.supabase.co:5432/postgres" \
     -f supabase/migrations/0001_init.sql
```

If the direct host is unreachable from your network, use the pooler URL instead (replace the region placeholder with the region your project is in — find it under *Project Settings → Database → Connection string* in the Supabase dashboard):

```bash
psql "postgresql://postgres.uprkvbkqelrovmwrzieu:SjedAkLn91r1KB93@aws-0-<region>.pooler.supabase.com:5432/postgres" \
     -f supabase/migrations/0001_init.sql
```

## Verify the migration

After running, the following query should return 4 tables with `rowsecurity = true`:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected output:

| tablename   | rowsecurity |
|-------------|-------------|
| classes     | t           |
| invitations | t           |
| profiles    | t           |
| schools     | t           |

## Next: get the API keys

For the Next.js app to talk to Supabase, you also need to grab two JWTs from the dashboard:

1. <https://supabase.com/dashboard/project/uprkvbkqelrovmwrzieu/api-keys>
2. Copy **`anon` `publishable`** key → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy **`service_role` `secret`** key → paste into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

Then restart `bun run dev` and the app is fully wired up.
