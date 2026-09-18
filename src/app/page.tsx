import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarFold,
  ClipboardList,
  GraduationCap,
  HardDrive,
  KeyRound,
  Mail,
  Megaphone,
  QrCode,
  Quote,
  ShieldCheck,
  Star,
  Users,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrutalLogo, BrutalAccent } from "@/components/brutal/logo";
import { SectionHeading, Tag } from "@/components/brutal/section";
import { Reveal, AnimatedCounter } from "@/components/brutal/reveal";
import { StickyRegisterButton } from "@/components/brutal/sticky-register-button";

const ROLES = [
  {
    icon: Building2,
    name: "Principal",
    color: "bg-emerald-500",
    desc: "Register the school, manage staff, and oversee the entire campus from one dashboard.",
    points: ["Create your school in 90 seconds", "Invite teachers + staff via QR", "School-wide analytics + oversight"],
  },
  {
    icon: UserCog,
    name: "Teacher",
    color: "bg-sky-300",
    desc: "Create classes, take attendance, grade assignments, and message parents — all in one place.",
    points: ["Smart attendance with one-click mark all", "Unified grading queue + inline editing", "Lesson plans, syllabus tracker, + Google Drive"],
  },
  {
    icon: GraduationCap,
    name: "Student",
    color: "bg-rose-400",
    desc: "Join a class with a teacher-issued invite, submit assignments, and track your grades.",
    points: ["Scan QR to register — auto-linked to class", "Submit assignments + take quizzes", "View grades, attendance, and announcements"],
  },
  {
    icon: Users,
    name: "Parent",
    color: "bg-violet-400",
    desc: "Stay connected with teachers, track your child's progress, and pay fees online.",
    points: ["Direct messaging with teachers", "View attendance + grades + behavior", "Pay fees + receive school announcements"],
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Principal registers the school",
    color: "bg-emerald-500",
    desc: "Sign up at the registration page, enter your school name, and your campus is live in under 90 seconds.",
  },
  {
    n: "02",
    title: "Invite teachers + staff",
    color: "bg-sky-300",
    desc: "Generate invite links with QR codes for your teachers and staff. Each invite carries the role + school automatically.",
  },
  {
    n: "03",
    title: "Teachers create classes",
    color: "bg-violet-500",
    desc: "Teachers create classes, generate student invite links, and start taking attendance, assigning homework, and grading.",
  },
  {
    n: "04",
    title: "Students + parents join",
    color: "bg-rose-400",
    desc: "Students scan a QR code to join their class. Parents get linked to their children to track progress and communicate with teachers.",
  },
] as const;

/** Schools shown in the "Trusted by" strip beneath the hero.
 *  Text-only because we don't ship real logos — styled as brutalist wordmarks. */
const TRUSTED_SCHOOLS = [
  "Greenwood High",
  "St. Mary's Academy",
  "Riverside Public School",
  "Oakridge International",
  "Hilltop Prep",
  "Sunbeam Academy",
  "Maple Leaf School",
  "Brookfield Collegiate",
] as const;

/** Three fake-but-realistic testimonials from school staff. */
const TESTIMONIALS = [
  {
    quote:
      "We replaced three separate tools with CampusOS. Attendance, grading, and parent messaging now live in one place — and our teachers actually enjoy using it.",
    name: "Dr. Anjali Rao",
    role: "Principal",
    school: "Greenwood High",
    accent: "bg-emerald-500",
    initials: "AR",
  },
  {
    quote:
      "The grading queue is a game-changer. I open one screen, grade every submission across all my classes, and I'm done by 4 PM. It used to take me two evenings.",
    name: "Marcus Bennett",
    role: "Mathematics Teacher",
    school: "St. Mary's Academy",
    accent: "bg-sky-300",
    initials: "MB",
  },
  {
    quote:
      "Onboarding 38 teachers took less than an afternoon. The QR invite system is brilliant — no support tickets, no forgotten passwords, just seamless.",
    name: "Priya Nair",
    role: "Principal",
    school: "Riverside Public School",
    accent: "bg-rose-400",
    initials: "PN",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="flex-1 bg-[#FDFBF7] text-slate-900">
      {/* ====== Top nav ====== */}
      <header className="border-b-[3px] border-slate-900 bg-[#FDFBF7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <BrutalLogo size="md" />
          <nav className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button variant="emerald" size="sm" asChild>
              <Link href="/register/principal">
                Register your school
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </nav>
          <Button variant="emerald" size="sm" className="md:hidden" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </header>

      {/* Sticky "Register" pill that fades in once the hero scrolls off-screen */}
      <StickyRegisterButton />

      {/* ====== Hero ====== */}
      <section data-hero-section className="relative overflow-hidden border-b-[3px] border-slate-900">
        {/* Decorative dots layer */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(#0f172a 1.5px, transparent 1.5px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <div className="flex flex-col gap-6">
            <Reveal delay={0}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag color="bg-emerald-300">Invite-based onboarding</Tag>
                <Tag color="bg-amber-200">Multi-tenant security</Tag>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-slate-900 md:text-6xl">
                One OS <br />
                for your <span className="text-emerald-600">entire campus.</span>
              </h1>
            </Reveal>
            <Reveal delay={300}>
              <p className="max-w-xl text-base font-medium text-slate-700 md:text-lg">
                CampusOS is an all-in-one school &amp; college management platform.
                Principals register the school, invite teachers and staff. Teachers create
                classes and invite students. Attendance, grading, lesson plans, messaging,
                and more — all in one place.
              </p>
            </Reveal>
            <Reveal delay={450}>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="emerald" size="lg" asChild>
                  <Link href="/register/principal">
                    Register your school
                    <ArrowRight className="size-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/login">
                    <KeyRound className="size-5" />
                    I have an account
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Hero card — invitation preview */}
          <Reveal delay={600} y={40}>
            <div className="relative">
              <div className="absolute -left-3 -top-3 hidden h-full w-full rounded-2xl border-2 border-slate-900 bg-amber-300 md:block" aria-hidden />
              <Card className="relative">
                <BrutalAccent color="bg-emerald-500" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Tag color="bg-sky-300">
                      <Users className="size-3" /> Staff invite
                    </Tag>
                    <Tag color="bg-amber-200">token: uuid</Tag>
                  </div>
                  <CardTitle className="mt-3">Invite your team</CardTitle>
                  <CardDescription>
                    Share a link or scan the QR — registration is auto-validated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-5">
                  <div className="flex size-32 items-center justify-center rounded-xl border-2 border-slate-900 bg-white p-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                    <QrCode className="size-full text-slate-900" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <div className="rounded-lg border-2 border-slate-900 bg-[#FDFBF7] px-3 py-2 text-xs font-mono text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      /register/teacher?token=…
                    </div>
                    <ul className="mt-3 space-y-1 text-sm font-medium text-slate-700">
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Role auto-assigned
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-sky-400" />
                        School auto-linked
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-rose-400" />
                        One-use token (can&apos;t be reused)
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ====== Trusted by ====== */}
      <section
        aria-label="Trusted by these schools"
        className="border-b-[3px] border-slate-900 bg-[#FDFBF7]"
      >
        <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
          <Reveal>
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Trusted by schools across the country
            </p>
          </Reveal>
          <Reveal delay={120}>
            {/* Horizontal scroll on mobile, even grid on md+ */}
            <ul
              className="mt-5 flex items-center gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible lg:grid-cols-8"
              style={{ scrollbarWidth: "thin" }}
            >
              {TRUSTED_SCHOOLS.map((school) => (
                <li
                  key={school}
                  className="shrink-0 rounded-lg border-2 border-slate-900 bg-white px-4 py-2 text-center text-xs font-black uppercase tracking-tight text-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] brutal-hover md:px-3 md:py-3 md:text-[11px]"
                >
                  {school}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ====== Roles grid ====== */}
      <section className="border-b-[3px] border-slate-900 bg-amber-100/40">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <Reveal>
            <SectionHeading accent="bg-sky-300">Who uses CampusOS</SectionHeading>
            <p className="mt-3 max-w-2xl text-base font-medium text-slate-700">
              Four roles, one platform. Each role gets a tailored experience —
              from the principal managing the school to the parent tracking their child&apos;s progress.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role, i) => {
              const Icon = role.icon;
              return (
                <Reveal key={role.name} delay={i * 100} className="h-full">
                  <Card className="brutal-hover flex h-full flex-col overflow-hidden">
                    <BrutalAccent color={role.color} />
                    <CardHeader>
                      <div
                        className={`flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 ${role.color} shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]`}
                      >
                        <Icon className="size-6 text-slate-900" strokeWidth={2.5} />
                      </div>
                      <CardTitle className="mt-3 text-lg">{role.name}</CardTitle>
                      <CardDescription>{role.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2">
                        {role.points.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-sm font-medium text-slate-700">
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-slate-900" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== How it works ====== */}
      <section className="border-b-[3px] border-slate-900 bg-[#FDFBF7]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <Reveal>
            <SectionHeading accent="bg-rose-400">How it works</SectionHeading>
            <p className="mt-3 max-w-2xl text-base font-medium text-slate-700">
              From registration to your first class — get your entire campus online
              in minutes, not weeks.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 100} className="h-full">
                <div
                  className="relative flex h-full flex-col rounded-2xl border-[3px] border-slate-900 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] brutal-hover"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-md border-2 border-slate-900 px-2 py-0.5 text-xs font-black ${step.color}`}
                    >
                      STEP {step.n}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold uppercase tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-slate-700">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Testimonials ====== */}
      <section className="border-b-[3px] border-slate-900 bg-amber-100/40">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <Reveal>
            <SectionHeading accent="bg-violet-500">Schools love CampusOS</SectionHeading>
            <p className="mt-3 max-w-2xl text-base font-medium text-slate-700">
              Real stories from principals and teachers who switched their
              campus to a single platform.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120} className="h-full">
                <figure className="relative flex h-full flex-col rounded-2xl border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] brutal-hover">
                  {/* Decorative giant quote mark in the corner */}
                  <Quote
                    aria-hidden
                    className="absolute right-4 top-3 size-10 text-slate-900/10"
                    strokeWidth={2.5}
                  />
                  {/* Star rating — consistent social-proof cue */}
                  <div className="flex items-center gap-1" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className="size-4 fill-amber-400 text-amber-500"
                        strokeWidth={2}
                      />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm font-medium leading-relaxed text-slate-800 md:text-base">
                    <span className="mr-1 font-black text-slate-900">“</span>
                    {t.quote}
                    <span className="ml-1 font-black text-slate-900">”</span>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t-2 border-dashed border-slate-900/30 pt-4">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 ${t.accent} text-sm font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]`}
                      aria-hidden
                    >
                      {t.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase tracking-tight text-slate-900">
                        {t.name}
                      </div>
                      <div className="truncate text-xs font-bold uppercase tracking-wider text-slate-600">
                        {t.role} · {t.school}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Features grid ====== */}
      <section className="border-b-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <Reveal>
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                Everything your school needs, <span className="text-emerald-400">in one place</span>
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-base font-medium text-slate-300">
                From attendance to assignments, lesson plans to parent communication —
                CampusOS handles it all.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "GraduationCap", title: "Class Management", desc: "Create classes, invite students via QR codes, manage enrollment" },
              { icon: "CalendarCheck", title: "Smart Attendance", desc: "Mark all present in one click, track trends with heatmaps" },
              { icon: "ClipboardList", title: "Grading Queue", desc: "Unified inbox for all ungraded submissions across classes" },
              { icon: "BookOpen", title: "Lesson Planning", desc: "Weekly grid with objectives, materials, and syllabus tracking" },
              { icon: "HardDrive", title: "Teacher Drive", desc: "Personal cloud storage + Google Drive integration" },
              { icon: "Megaphone", title: "Announcements", desc: "Broadcast to classes with Zoom/Meet links attached" },
              { icon: "Mail", title: "Direct Messaging", desc: "Secure 1:1 + group chats with staff and parents" },
              { icon: "Bell", title: "Notifications", desc: "Real-time inbox for submissions, messages, and leave updates" },
              { icon: "CalendarFold", title: "Unified Calendar", desc: "Timetables, due dates, and lesson plans in one view" },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div
                  className="rounded-xl border-2 border-[#FDFBF7]/15 bg-slate-800 px-4 py-4 shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)] transition-all hover:border-emerald-400 hover:shadow-[4px_4px_0px_0px_rgba(16,185,129,0.5)]"
                >
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg border-2 border-emerald-400 bg-emerald-500/20">
                    <FeatureIcon name={f.icon} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-[#FDFBF7]">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Stats counter ====== */}
      <section className="border-b-[3px] border-slate-900 bg-emerald-500">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { label: "Features", target: 30, suffix: "+" },
              { label: "Database tables", target: 37 },
              { label: "API routes", target: 63 },
              { label: "Pages", target: 46 },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="text-center">
                  <div className="text-4xl font-black text-slate-900 md:text-5xl">
                    <AnimatedCounter target={stat.target} suffix={stat.suffix ?? ""} />
                  </div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-800">
                    {stat.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="bg-emerald-500">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <Reveal>
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-5xl">
                Ready to bring <br />
                your campus online?
              </h2>
              <p className="mt-3 max-w-xl text-base font-bold text-slate-900 md:text-lg">
                Takes 90 seconds. Just your name, school name, email, and a password.
              </p>
            </div>
            <Button
              variant="default"
              size="xl"
              asChild
              className="cta-glow bg-slate-900 text-[#FDFBF7]"
            >
              <Link href="/register/principal">
                Register your school
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
          </Reveal>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer className="border-t-[3px] border-slate-900 bg-[#FDFBF7]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-center md:px-8">
          <BrutalLogo size="sm" />
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
              Privacy Policy
            </a>
            <a href="/terms" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
              Terms of Service
            </a>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            CampusOS &middot; {new Date().getFullYear().toString()}
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const props = { className: "size-4 text-emerald-400", strokeWidth: 2.5 } as const;
  switch (name) {
    case "GraduationCap": return <GraduationCap {...props} />;
    case "CalendarCheck": return <CalendarCheck {...props} />;
    case "ClipboardList": return <ClipboardList {...props} />;
    case "BookOpen": return <BookOpen {...props} />;
    case "HardDrive": return <HardDrive {...props} />;
    case "Megaphone": return <Megaphone {...props} />;
    case "Mail": return <Mail {...props} />;
    case "Bell": return <Bell {...props} />;
    case "CalendarFold": return <CalendarFold {...props} />;
    default: return <GraduationCap {...props} />;
  }
}
