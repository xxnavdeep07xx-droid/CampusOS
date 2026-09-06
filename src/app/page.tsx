import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  KeyRound,
  QrCode,
  ShieldCheck,
  Users,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrutalLogo, BrutalAccent } from "@/components/brutal/logo";
import { SectionHeading, Tag } from "@/components/brutal/section";

const ROLES = [
  {
    icon: Building2,
    name: "Principal",
    color: "bg-emerald-500",
    desc: "Register the school, then invite teachers and staff to your campus.",
    points: ["Create your school in one click", "Generate staff / teacher invites", "QR + shareable URL for every invite"],
  },
  {
    icon: UserCog,
    name: "Staff / Teacher",
    color: "bg-sky-300",
    desc: "Accept a principal's invite, then create classes for the students you teach.",
    points: ["Token-validated onboarding", "Create as many classes as you need", "Generate student invites per class"],
  },
  {
    icon: GraduationCap,
    name: "Student",
    color: "bg-rose-400",
    desc: "Join a class with a teacher-issued invite — auto-linked to the right school.",
    points: ["Scan-to-register via QR", "Role + class assigned automatically", "Dashboard shows your enrolled classes"],
  },
  {
    icon: ShieldCheck,
    name: "Multi-tenant by design",
    color: "bg-amber-400",
    desc: "Row-Level Security isolates every school's data at the database layer.",
    points: ["Supabase Postgres + RLS on every table", "Service-role key only used server-side", "Per-school data isolation, enforced in SQL"],
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Principal registers the school",
    color: "bg-emerald-500",
    desc: "A principal signs up at /register/principal — we create their auth account, the school row, and link them with role='principal'.",
  },
  {
    n: "02",
    title: "Principal invites staff & teachers",
    color: "bg-sky-300",
    desc: "On the dashboard, the principal generates invite links (with QR codes) for staff and teachers. Each link carries a unique UUID token.",
  },
  {
    n: "03",
    title: "Teachers create classes & invite students",
    color: "bg-violet-500",
    desc: "After accepting an invite, teachers create classes. For each class, they generate a student invite link — students land in the right school + class automatically.",
  },
  {
    n: "04",
    title: "Students accept & join",
    color: "bg-rose-400",
    desc: "A student scans the QR (or opens the link), registers with email + password, and is immediately linked to the school and class with role='student'.",
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

      {/* ====== Hero ====== */}
      <section className="relative overflow-hidden border-b-[3px] border-slate-900">
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
            <div className="flex flex-wrap items-center gap-2">
              <Tag color="bg-emerald-300">Phase 1 · Auth + Onboarding</Tag>
              <Tag color="bg-amber-200">Invite-based multi-tenant</Tag>
            </div>
            <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-slate-900 md:text-6xl">
              One OS <br />
              for your <span className="text-emerald-600">entire campus.</span>
            </h1>
            <p className="max-w-xl text-base font-medium text-slate-700 md:text-lg">
              CampusOS is an all-in-one school &amp; college management platform.
              Principals register the school, invite teachers and staff. Teachers create
              classes and invite students. Multi-tenant Row-Level Security keeps every
              school&apos;s data isolated at the database layer.
            </p>
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
          </div>

          {/* Hero card — invitation preview */}
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
        </div>
      </section>

      {/* ====== Roles grid ====== */}
      <section className="border-b-[3px] border-slate-900 bg-amber-100/40">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <SectionHeading accent="bg-sky-300">Who uses CampusOS</SectionHeading>
          <p className="mt-3 max-w-2xl text-base font-medium text-slate-700">
            Four roles, one platform. Each role gets a tailored onboarding flow
            driven by invite tokens — no manual school_id entry, no class mix-ups.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <Card key={role.name} className="brutal-hover overflow-hidden">
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
                  <CardContent>
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
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== How it works ====== */}
      <section className="border-b-[3px] border-slate-900 bg-[#FDFBF7]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <SectionHeading accent="bg-rose-400">The onboarding tree</SectionHeading>
          <p className="mt-3 max-w-2xl text-base font-medium text-slate-700">
            Every new user joins via a token-validated link. The token carries
            the school_id, the role, and (for students) the class_id — so the
            signup form only collects email, name, and password.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="relative rounded-2xl border-[3px] border-slate-900 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] brutal-hover"
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
            ))}
          </div>
        </div>
      </section>

      {/* ====== Tech stack ====== */}
      <section className="border-b-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                Built on a <span className="text-emerald-400">boring, reliable</span> stack.
              </h2>
              <p className="mt-4 max-w-xl text-base font-medium text-slate-300">
                Next.js 16 App Router, Tailwind CSS 4, shadcn/ui (overridden to
                neo-brutalism), Supabase Postgres + Auth, lucide-react icons.
                No proprietary lock-in. No magic.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                "Next.js 16",
                "TypeScript 5",
                "Tailwind CSS 4",
                "shadcn/ui",
                "Supabase Auth",
                "Supabase Postgres + RLS",
                "lucide-react",
                "react-qr-code",
                "Neo-brutalist UI",
              ].map((tech) => (
                <div
                  key={tech}
                  className="rounded-xl border-2 border-[#FDFBF7] bg-slate-800 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[3px_3px_0px_0px_rgba(16,185,129,0.5)]"
                >
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="bg-emerald-500">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
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
              className="bg-slate-900 text-[#FDFBF7]"
            >
              <Link href="/register/principal">
                Register your school
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer className="border-t-[3px] border-slate-900 bg-[#FDFBF7]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-center md:px-8">
          <BrutalLogo size="sm" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            CampusOS · Phase 1 · Auth &amp; Invite-Based Onboarding
          </p>
        </div>
      </footer>
    </main>
  );
}
