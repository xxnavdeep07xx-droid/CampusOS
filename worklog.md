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
