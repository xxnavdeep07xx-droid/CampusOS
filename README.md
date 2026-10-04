# CampusOS

**All-in-one school & college management platform.** Invite-based multi-tenant
onboarding on Next.js 16, Supabase (Postgres + Auth + Storage + Realtime),
Tailwind CSS 4 and a neo-brutalist shadcn/ui design system.

[![CI](https://github.com/xxnavdeep07xx-droid/CampusOS/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

---

## What ships

| Area | Included |
|------|----------|
| **Onboarding** | Principal self-registers a school → invites staff/teachers by link or QR → teachers create classes → students join by invite → parents link to their child |
| **Classroom** | Class hub, resources, assignments (with attachments), submissions + grading queue, editable gradebook, quizzes (MCQ + short answer) with auto-marking, report cards (PDF) |
| **Attendance & timetable** | Per-day attendance with bulk "mark all present", trend view, clash-free timetable grid, unified teacher calendar |
| **Communication** | Class announcements (Realtime), live class chat, 1:1 direct messages, group chats with reactions, notifications inbox |
| **Operations** | Fees & invoices + payment recording, library (issue desk + catalogue + copy tracking), transport routes & stops, staff HR (leave requests) |
| **Teaching tools** | Lesson plans, syllabus tracker, behavior/incident log, whiteboard (persistent boards, export to PNG), teacher drive with Google Drive import/export |
| **Platform** | Multi-tenant RLS on every table, cookie-based sessions via `@supabase/ssr`, role-aware navigation, dark mode, branded 404, health probe, sitemap + robots, CI (lint + types + build) |

## Tech stack

- **Next.js 16** (App Router, Turbopack, React 19, TypeScript in strict-by-default mode — the build fails on type errors)
- **Tailwind CSS 4** + shadcn/ui (New York style, themed to neo-brutalism)
- **Supabase** — Postgres, Auth, Storage, Realtime (`@supabase/ssr`)
- **lucide-react** icons, **recharts** charts, **jsPDF** report cards, **react-qr-code** invites
- Fonts are **self-hosted** (`geist` + `@fontsource/*`) so builds are hermetic and there is no third-party request on first paint

## Quick start

```bash
# 1. install (bun or npm both work)
bun install            # or: npm install

# 2. configure
cp .env.example .env.local     # then fill in your Supabase keys

# 3. create the schema
#    paste supabase/migrations/0001…0015 in order into the Supabase SQL editor
#    (see supabase/README.md for the full walkthrough)

# 4. run
bun run dev            # http://localhost:3000
```

Without Supabase credentials the app boots into a **/setup** screen that
explains exactly what to add — it never 500s on a fresh clone.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon/publishable key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (server) | invite validation + admin reads (never exposed) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | absolute URL used in invite links + QR codes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | optional | Google Drive import/export |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | optional | Search Console verification meta tag |

### Scripts

| Command | Does |
|---------|------|
| `bun run dev` | Dev server on :3000 |
| `bun run build` | Production build (types are enforced) |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint (0 errors / 0 warnings on `main`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run verify` | typecheck → lint → build, i.e. exactly what CI runs |

## Deploy

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full launch checklist
(Vercel + Supabase + custom domain + post-deploy smoke test).

Short version:

1. Push this repo to GitHub.
2. Import it in Vercel — the framework and build command are auto-detected.
3. Add the environment variables above (Production + Preview).
4. Apply the migrations to your production Supabase project.
5. Verify: `curl -s https://<your-domain>/api/health` → all `checks` true.

## Project layout

```
.
├── supabase/migrations/          # 0001 → 0015, idempotent SQL (schema + RLS)
├── src/
│   ├── app/
│   │   ├── page.tsx             # Landing page (neo-brutalist hero + ID card)
│   │   ├── layout.tsx           # Root layout, theme script, fonts, metadata
│   │   ├── login/ register/     # Auth + token-validated onboarding flows
│   │   ├── setup/               # "Connect Supabase" screen (no credentials)
│   │   ├── not-found.tsx        # Branded 404
│   │   ├── sitemap.ts robots.ts manifest.ts
│   │   ├── dashboard/           # Role-aware app shell + every feature page
│   │   └── api/                 # Route handlers (invites, class data, …)
│   ├── components/
│   │   ├── brutal/              # Design-system components (cards, QR, chat …)
│   │   └── ui/                  # shadcn/ui primitives
│   ├── lib/
│   │   ├── supabase/{browser,server,admin}.ts
│   │   ├── auth/invite.ts       # Invite validation + onboarding
│   │   ├── env.ts               # Env probing helpers (/setup, /api/health)
│   │   └── types.ts             # Shared domain types
│   └── proxy.ts                 # Session refresh + route protection (Next 16 proxy)
├── DEPLOYMENT.md
└── .github/workflows/ci.yml
```

## Onboarding flow

```
Principal ──register──▶ Dashboard ──invite (QR/link)──▶ Teacher ──creates a class──▶
   ▲                                                                  │
   └──────────── School-wide visibility ◀─────────────────────────────┤
                                                                      ▼
                                                    Student invite ──▶ Student
                                                                      │
                                                    Parent link ──────▶ Parent
```

Each invite is a one-use UUID row in `invitations`; the registration form
derives school, class and role from the token — no manual data entry.

## Security posture

- RLS is enabled on **every** table; the anon key cannot read across schools.
- Service-role usage is server-only and always re-verifies ownership
  (`src/lib/supabase/admin.ts`).
- Sessions are httpOnly cookies refreshed by `src/proxy.ts`.
- Baseline security headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS) are set in `next.config.ts`; API responses are
  `no-store`.
- Secrets live in env vars only — `.env*` is git-ignored and `.env.example`
  ships placeholders.

## License

MIT
