# CampusOS — Launch Checklist

Everything below is copy-pasteable. Budget ~20 minutes for a first deploy.

---

## 0. Prerequisites

- A Supabase project (free tier is fine to start): <https://supabase.com/dashboard>
- A Vercel account connected to the GitHub repo
- Node 20+ / bun, if you want to build locally first

---

## 1. Database

Apply the migrations **in order** (they are idempotent — safe to re-run):

```bash
# Option A — Supabase SQL editor
#   Project → SQL Editor → New query → paste each file → Run
#   supabase/migrations/0001_init.sql … 0015_chat_groups.sql

# Option B — psql
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres'
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Then confirm RLS is on everywhere:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- expect: 0 rows
```

### Auth URLs

*Authentication → URL Configuration*

- **Site URL** — `https://<your-domain>`
- **Redirect URLs** — `https://<your-domain>/**` and `http://localhost:3000/**`

---

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Key | Value | Environments |
|-----|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secret**) | Production, Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | Production (use the preview URL for Preview) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | optional — Drive integration | Production |

> Rotate the service-role key any time it has been pasted into a chat, log, or
> ticket. It bypasses RLS.

`NEXT_PUBLIC_*` values are inlined at build time, so **redeploy after changing
them**. If the app boots without credentials it redirects to `/setup` and
`/api/health` reports `checks.supabase = false` — that is the signal to add the
variables and redeploy.

---

## 3. Deploy

**Vercel (recommended)**

1. `vercel.com/new` → import `xxnavdeep07xx-droid/CampusOS`
2. Framework preset: **Next.js** (auto-detected). Build `next build`, install
   `bun install` or `npm install` — either lockfile works.
3. Add the env vars from step 2, then **Deploy**.
4. Add your custom domain under *Settings → Domains* and update
   `NEXT_PUBLIC_SITE_URL` + the Supabase redirect URLs to match, then redeploy.

**Any Node host**

```bash
bun install
bun run build
NEXT_PUBLIC_SITE_URL=https://<your-domain> bun run start   # :3000
```

---

## 4. Post-deploy smoke test

```bash
BASE=https://<your-domain>

curl -s $BASE/api/health | jq          # status ok, all checks true
curl -s -o /dev/null -w '%{http_code}\n' $BASE/            # 200
curl -s -o /dev/null -w '%{http_code}\n' $BASE/login       # 200
curl -s -o /dev/null -w '%{http_code}\n' $BASE/dashboard   # 307 → /login
curl -s -o /dev/null -w '%{http_code}\n' $BASE/sitemap.xml # 200
```

Manual pass (10 minutes, one browser window):

1. `/register/principal` → create a school → land on `/dashboard`.
2. Generate a **teacher invite** → open the link in a private window →
   register → the teacher lands on their own dashboard (role-aware nav).
3. As the teacher: create a class → generate a **student invite** → register
   the student in another private window.
4. Teacher: take attendance, create an assignment, create a quiz → student
   submits + attempts → teacher grades from the **Grading Queue**.
5. Principal: invite a **parent**, link them to the student, check the parent
   sees fees/attendance but no staff tools.

---

## 5. Go-live extras

- **Monitoring** — point an uptime check at `/api/health` (expect HTTP 200).
- **Backups** — Supabase → Database → Backups (daily on paid plans; export
  manually before big migrations on free).
- **Email** — configure a custom SMTP sender in Supabase Auth so invite
  confirmations don't come from the shared address.
- **Rate limits** — Supabase Auth throttles sign-ins by default; the invite
  endpoints require an authenticated session.
- **Analytics** — add Vercel Analytics (or any snippet) in `src/app/layout.tsx`.
- **Legal** — `/privacy` and `/terms` ship as placeholders; have them reviewed
  before onboarding real schools.

---

## Rollback

Vercel keeps every deployment — *Deployments → … → Promote to Production* to
roll back instantly. Database changes are additive and idempotent, so rolling
back the app does not require reverting SQL.
