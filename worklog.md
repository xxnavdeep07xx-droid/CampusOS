---
Task ID: teacher-redesign-1
Agent: main (sonnet)
Task: Build personalized teacher interface — fix Overview role-guard, add unified Grading Queue page, wire up dead submissions.feedback column, add nav item + loading skeletons.

Work Log:
- Audited existing teacher interface (/routes, components, actions, schema, realtime) via sub-agent.
- Identified critical bug: /dashboard page rendered PrincipalDashboardPage unconditionally — teachers landing on "Overview" saw principal UI (stat cards, invite generators, recent invites).
- Refactored /dashboard/page.tsx into a role-aware dispatcher: TeacherDashboard for role="teacher", PrincipalDashboard for everyone else.
- Built TeacherDashboard with: greeting, 4 stat cards (My Classes, Pending Grading, Today's Attendance, Today's Periods), Today's Schedule card (from timetables), Pending Grading card (links to /dashboard/teacher/grading), Quick Actions grid, Recent Announcements.
- Created /dashboard/teacher/grading route — server page fetches teacher's classes + assignments + ungraded submissions, passes to GradingQueueClient.
- Built GradingQueueClient with: search box (student name or assignment title), class filter dropdown, grouped-by-class rendering, inline SubmissionCard with feedback textarea.
- Wired the previously-dead submissions.feedback column through GradingQueueClient → PATCH /api/submissions/[id] (route already accepted feedback, just no UI sent it).
- Added "Grading Queue" nav item to teacher's sidebar (between My Classes and My Schedule).
- Added loading.tsx siblings for /dashboard/teacher/schedule and /dashboard/teacher/leave.
- Fixed pre-existing TS error in PrincipalDashboard's invites type cast (added `as unknown as`).
- Verified clean type-check on all new + modified files (existing pre-existing Supabase typing errors in api/* routes are unchanged and ignored by next.config.ignoreBuildErrors).

Stage Summary:
- Files created: src/app/dashboard/teacher/grading/page.tsx, grading-queue-client.tsx, loading.tsx; src/app/dashboard/teacher/schedule/loading.tsx; src/app/dashboard/teacher/leave/loading.tsx
- Files modified: src/app/dashboard/page.tsx (role dispatcher + TeacherDashboard), src/app/dashboard/layout.tsx (teacher nav includes Grading Queue)
- Behavior change: teachers now see a tailored Today-focused Overview; principal/staff UI is unchanged
- New capability: /dashboard/teacher/grading is the unified inbox for ungraded submissions across all classes; teachers can grade + leave written feedback inline
- The dead submissions.feedback column is now wired through the UI end-to-end
- DEFERRED to next iteration: Edit/Delete UI for quizzes/assignments/resources, Broadcast-to-multiple-classes in announcements modal
- Ready to push to GitHub → Vercel auto-deploys

---
Task ID: launch-readiness-1
Agent: main
Task: Make CampusOS launch ready — repo hygiene, green build/lint/types, self-hosted fonts, Next 16 conventions, docs + CI.

Work Log:
- Repo hygiene: removed tracked `.env` (pointed at a dead Prisma path) in favour of `.env.example`; untracked the `upload/`, `tool-results/` and `download/` scratch folders; deleted dead Prisma/`z-ai`/`next-auth`/`next-intl`/`zod`/`zustand`/`@tanstack/react-table`/`date-fns`/mdx deps, dead `src/lib/db.ts` + `src/lib/cached-queries.ts`, and the stale `tailwind.config.ts` (Tailwind 4 is CSS-first here) plus the scratch scripts.
- Security: redacted the plaintext Postgres password from `supabase/README.md`, added baseline security headers + `no-store` for `/api/*` in `next.config.ts`, added a small in-memory rate limiter on `POST /api/invitations`, and verified every API route authenticates with `supabase.auth.getUser()` before touching the service-role client.
- Build integrity: fixed all 52 pre-existing TypeScript errors (hall-pass refs, Supabase nested-relation casts, `IssueDesk` duplicate export, Buffer/process types via `@types/node`, `passing BodyInit`), then removed `typescript.ignoreBuildErrors` so `next build` now fails on type errors. `tsc --noEmit`, `eslint .` and `next build` are all clean.
- ESLint: cleared 45 errors + 7 warnings — real bugs fixed (three conditional `useMemo` calls in the behavior dashboard, ref writes during render in the whiteboard/quiz taker, `setState` inside `useMemo` in two modals), the rest converted to documented patterns (adjust-state-during-render, async effect boundaries, `useSyncExternalStore` for splash/theme/mobile hooks).
- Fonts: swapped `next/font/google` + the Google Fonts `<link>` for self-hosted `geist` and `@fontsource` Archivo/IBM Plex Mono — hermetic builds, no third-party request on first paint.
- Next 16: migrated `src/middleware.ts` → `src/proxy.ts` (removes the deprecation warning); dev origins extended for preview hosts.
- Launch surface: `/setup` screen + env probing (`src/lib/env.ts`) so a credential-less boot never 500s, branded `404` + route error boundary, `/api/health` probe, `robots.ts` + `sitemap.ts` + `manifest.ts`, `.env.example`.
- Docs/CI: rewrote README, updated `supabase/README.md` (migrations 0001→0015 + RLS verification), added DEPLOYMENT.md launch checklist and a GitHub Actions workflow (bun install → typecheck → lint → build).

Stage Summary:
- `bun run verify` (typecheck + lint + build) passes with zero errors/warnings; `bun install --frozen-lockfile` validated.
- Smoke-tested on the dev server: `/` 200, `/login` `/register/*` → `/setup` (no credentials), `/dashboard` 307 → `/login`, `/api/health` 200, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` and the branded 404 all render.
- Still owner-side: set the real Supabase keys + apply the 15 migrations, then run the 10-minute manual pass in DEPLOYMENT.md.
