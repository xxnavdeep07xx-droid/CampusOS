# CampusOS

> All-in-one School / College Management Platform — Phase 1.

Invite-based multi-tenant platform built on Next.js 16, Tailwind CSS 4, shadcn/ui
(overridden to **neo-brutalism**), Supabase Postgres + Auth, and lucide-react.

## Phase 1 — What's inside

| Layer            | What ships in this phase                                                                 |
|------------------|------------------------------------------------------------------------------------------|
| Database         | `schools`, `profiles`, `classes`, `invitations` tables with RLS on every table + a trigger that auto-creates a `profiles` row on `auth.users` insert. |
| Auth             | Supabase email + password auth, with `@supabase/ssr` cookies synced across RSC + middleware. |
| Onboarding tree  | Principal self-registers → generates staff/teacher invites → teacher creates classes → teacher generates student invites → students enroll. Every invite carries a one-use UUID token; the registration form auto-links school + class + role. |
| Protected routes | Next.js middleware refreshes the Supabase session and bounces unauthenticated users away from `/dashboard/*`. |
| UI               | Neo-brutalist design system: thick black borders, hard offset shadows, vibrant pop-art accents on warm off-white canvas. shadcn/ui Button / Card / Input / Badge / Label / Textarea overridden to match. |

## Tech stack

- **Next.js 16** App Router + TypeScript 5
- **Tailwind CSS 4** + **shadcn/ui** (New York style)
- **Supabase** Postgres + Auth (via `@supabase/ssr` + `@supabase/supabase-js`)
- **lucide-react** icons
- **react-qr-code** for the invite QR codes

## Repo layout

```
.
├── supabase/
│   ├── migrations/0001_init.sql     # Schema + RLS + trigger (idempotent)
│   └── README.md                    # How to apply the migration + grab API keys
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page (hero + roles + CTA)
│   │   ├── layout.tsx               # Root layout (warm off-white canvas)
│   │   ├── login/                   # Login page + server action
│   │   ├── register/
│   │   │   ├── principal/           # Principal self-registration
│   │   │   ├── teacher/             # Token-validated teacher onboarding
│   │   │   └── student/             # Token-validated student onboarding
│   │   ├── dashboard/
│   │   │   ├── layout.tsx          # Sidebar shell (role-aware nav)
│   │   │   ├── page.tsx            # Principal dashboard (staff/teacher invites)
│   │   │   ├── teacher/            # Teacher dashboard (create class + student invites)
│   │   │   ├── staff/              # All members view (principal/staff only)
│   │   │   ├── classes/            # Classes grid
│   │   │   └── students/           # My students (teacher view)
│   │   └── api/invitations/route.ts # POST + GET invitations
│   ├── components/
│   │   ├── ui/                     # shadcn/ui, overridden to neo-brutalism
│   │   └── brutal/                 # Logo, AuthShell, InviteCard, BrutalQR, etc.
│   ├── lib/
│   │   ├── supabase/{browser,server,admin}.ts
│   │   ├── auth/invite.ts          # Shared validateInviteToken + registerWithInvite
│   │   └── types.ts                # School / Profile / ClassRoom / Invitation
│   └── middleware.ts               # Session refresh + route protection
└── .env.local                      # Your Supabase URL + anon + service_role keys
```

## Setup

1. **Apply the SQL migration** — see [`supabase/README.md`](./supabase/README.md) for the easiest path (paste into the Supabase SQL editor).
2. **Get your API keys** — from `https://supabase.com/dashboard/project/<your-ref>/api-keys`, copy the `anon` (publishable) and `service_role` (secret) keys.
3. **Fill in `.env.local`** (template below).
4. **Install + run**:

```bash
bun install
bun run dev
```

### `.env.local` template

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Onboarding flow at a glance

```
Principal
  │
  │ registers at /register/principal
  ▼
Dashboard (principal)
  │
  │ generates staff / teacher invite (POST /api/invitations)
  ▼
Teacher
  │
  │ opens /register/teacher?token=…
  ▼
Dashboard (teacher)
  │
  │ creates a class
  │ generates student invite for that class
  ▼
Student
  │
  │ opens /register/student?token=…
  ▼
Dashboard (student)
```

Every invite produces:
- a **shareable URL** (`/register/<role>?token=<uuid>`)
- a **QR code** rendered with `react-qr-code`
- a one-use row in the `invitations` table

## License

MIT — see `LICENSE`.
