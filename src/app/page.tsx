import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { HallPassCard } from "@/components/brutal/hall-pass-card";
import { InteractiveGrid } from "@/components/brutal/interactive-grid";
import { Reveal } from "@/components/brutal/reveal";

/**
 * CampusOS — landing page.
 *
 * Editorial / magazine direction: a warm paper canvas, hairline rules, a
 * 12-column reading grid with sticky section folios, one display face
 * (Archivo 900) and one mono face (IBM Plex Mono) for labels and numbers.
 * The interactive hall-pass lanyard stays as the hero centrepiece.
 *
 * Everything is server-rendered except three leaf components
 * (HallPassCard, InteractiveGrid, Reveal) so the page is fully crawlable.
 * There are no images beyond the logo — the product preview is CSS.
 */

export const metadata: Metadata = {
  title: {
    absolute: "CampusOS — the whole campus, on one page",
  },
  description:
    "Invite-based school management for principals, teachers, students and parents. Attendance, grading, quizzes, report cards, fees, library, transport and messaging — in one login.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CampusOS — the whole campus, on one page",
    description:
      "Principals register the school, invite staff by QR, and run attendance, grading, fees and parent messages from one place.",
    siteName: "CampusOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CampusOS — the whole campus, on one page",
    description:
      "One login for principals, teachers, students and parents. Invite-only onboarding, multi-tenant by design.",
  },
};

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#inside", label: "Inside" },
  { href: "#roles", label: "Roles" },
  { href: "#setup", label: "Setup" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
] as const;

const TICKER = [
  "Attendance",
  "Gradebook",
  "Quizzes",
  "Report cards",
  "Lesson plans",
  "Syllabus tracker",
  "Whiteboard",
  "Resources",
  "Announcements",
  "Class chat",
  "Direct messages",
  "Group chats",
  "Notifications",
  "Parent portal",
  "Fees & invoices",
  "Library",
  "Transport",
  "Leave requests",
  "Behaviour log",
  "Timetable",
  "Calendar",
  "Staff directory",
] as const;

const SWITCH_ROWS = [
  {
    label: "Attendance",
    before: "A register, then a spreadsheet, then a phone call home.",
    after: "One tap for the whole class; trends build themselves.",
  },
  {
    label: "Marking",
    before: "Marks in three files, averaged by hand at term end.",
    after: "Assignments and quizzes aggregate into a live percentage.",
  },
  {
    label: "Parents",
    before: "A WhatsApp group for every class, and no record of it.",
    after: "Announcements, 1:1 messages and a portal they can check.",
  },
  {
    label: "Fees",
    before: "Paper receipts, a ledger, and chasing at the gate.",
    after: "Invoices issued per student; payments logged against them.",
  },
  {
    label: "Timetable",
    before: "A printed grid that clashes the moment someone is away.",
    after: "A clash-free grid teachers can read on their phone.",
  },
] as const;

const TOUR_NOTES = [
  {
    n: "01",
    title: "Take the register in one tap",
    body: "Mark the whole class present, then tap the two who aren’t. Attendance saves per day, per class, and rolls into the school-wide rate.",
  },
  {
    n: "02",
    title: "One queue for everything ungraded",
    body: "Submissions from every class arrive in a single inbox, oldest first. Grade and leave written feedback without opening five tabs.",
  },
  {
    n: "03",
    title: "Marks that add themselves up",
    body: "The gradebook aggregates assignment and quiz scores per student, so a report card is a button rather than an evening.",
  },
  {
    n: "04",
    title: "Message the parent, not the group",
    body: "Class announcements, 1:1 messages and group chats live next to the work they’re about — and parents see only their own child.",
  },
] as const;

const ROLES = [
  {
    n: "01",
    name: "Principal",
    line: "Registers the school, invites the staff, sees the whole campus.",
    sees: "School overview, staff directory, fees, notices, transport, library",
  },
  {
    n: "02",
    name: "Teacher",
    line: "Runs the class, takes attendance, grades, plans and reports.",
    sees: "Their classes, grading queue, lesson plans, parents of their students",
  },
  {
    n: "03",
    name: "Student",
    line: "Joins by scanning an invite — no forms, no waiting.",
    sees: "Class feed, assignments, quizzes, own marks and attendance",
  },
  {
    n: "04",
    name: "Parent",
    line: "Follows their child and settles fees without a phone call.",
    sees: "Their child’s attendance, marks, invoices and school notices",
  },
] as const;

const STEPS = [
  {
    n: "STEP 01",
    title: "The principal registers the school",
    body: "Name, email, password. The campus exists and the first invite is ready in about ninety seconds.",
  },
  {
    n: "STEP 02",
    title: "Staff are invited by link or QR",
    body: "The invite carries the role and the school. No one picks a dropdown, no one types a code.",
  },
  {
    n: "STEP 03",
    title: "Teachers open their classes",
    body: "A class is created in seconds, and each one gets its own student invite and QR code.",
  },
  {
    n: "STEP 04",
    title: "Students scan in, parents link up",
    body: "Students join the class behind the token. Parents are linked to their child and see only that child.",
  },
] as const;

const FEATURE_GROUPS = [
  {
    title: "Run the class",
    items: [
      ["Classes & rosters", "Every student, one list, live."],
      ["Attendance", "One tap per class, per day."],
      ["Timetable", "A clash-free weekly grid."],
      ["Assignments", "Due dates, attachments, submissions."],
      ["Submissions", "Files in, files back out."],
      ["Gradebook", "Editable, and always totalled."],
      ["Resources", "A shared shelf per class."],
    ],
  },
  {
    title: "Teach & assess",
    items: [
      ["Quizzes", "Multiple choice and short answer, auto-marked."],
      ["Report cards", "Generated as PDFs from real marks."],
      ["Lesson plans", "Plan the week on one grid."],
      ["Syllabus tracker", "See what’s covered, unit by unit."],
      ["Whiteboard", "Boards that save, and export to PNG."],
      ["Teacher drive", "Personal storage, with Google Drive import."],
      ["Calendar", "Timetable, due dates and plans together."],
    ],
  },
  {
    title: "Run the school",
    items: [
      ["Fees & invoices", "Issue, track, and record payments."],
      ["Library", "Catalogue, issue desk, copy counts."],
      ["Transport", "Routes, stops and who rides them."],
      ["HR & leave", "Requests in, decisions out."],
      ["Behaviour log", "Incidents and notes on the record."],
      ["Staff directory", "Find the right colleague fast."],
      ["School overview", "The whole campus on one screen."],
    ],
  },
  {
    title: "Talk to everyone",
    items: [
      ["Announcements", "Broadcast to a class, pinned if it matters."],
      ["Class chat", "Live conversation, scoped to the class."],
      ["Direct messages", "1:1 with staff, students or parents."],
      ["Group chats", "Departments and committees, with reactions."],
      ["Notifications", "One inbox for everything that needs you."],
      ["Parent portal", "Attendance, marks and fees, self-serve."],
      ["Notices", "School-wide banners until the date passes."],
    ],
  },
] as const;

const MODULE_COUNT = FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0);

const PRINCIPLES = [
  {
    n: "01",
    title: "Invite-only by default",
    body: "There is no public sign-up. A school exists because its principal made it, and every other account arrives through a token that already knows the school, the role and the class.",
  },
  {
    n: "02",
    title: "Role-shaped, not role-labelled",
    body: "A parent account cannot reach staff tools — not because the menu hides them, but because the database refuses the query. Row-level security is on for every table.",
  },
  {
    n: "03",
    title: "One inbox, not five",
    body: "Submissions, messages, leave requests and notices all land in the same place, so the day starts in one screen instead of an inventory of tabs.",
  },
] as const;

const TRUST = [
  {
    title: "Tenants are isolated in the database",
    body: "Every table is scoped to a school and guarded by row-level security. One school’s key cannot read another school’s rows.",
  },
  {
    title: "Roles decide what a query may return",
    body: "Principals, teachers, students and parents each get their own policies — enforced server-side, not in the interface.",
  },
  {
    title: "No public sign-up surface",
    body: "Accounts are created from one-use invite tokens. There is nothing to scrape and no door to knock on.",
  },
  {
    title: "Encrypted in transit",
    body: "HTTPS everywhere, with strict transport security and no-store headers on API responses.",
  },
  {
    title: "No ad networks, no trackers",
    body: "Fonts are self-hosted and analytics are yours to add — the page ships without third-party tracking by default.",
  },
  {
    title: "Your database, your data",
    body: "CampusOS runs on your own Supabase project. Export or leave whenever you like; nothing is held hostage.",
  },
] as const;

const FAQ = [
  {
    q: "How long does it take to get a school running?",
    a: "Registering the school takes about ninety seconds — name, email and a password. After that you can generate a staff invite immediately, and a teacher can have a class and a student roster the same afternoon.",
  },
  {
    q: "Do teachers, students or parents install an app?",
    a: "No. CampusOS runs in the browser on a phone, tablet or laptop. Invites are links and QR codes, so a student joins by scanning and a parent follows a link from a message.",
  },
  {
    q: "Can we try it before moving the whole school?",
    a: "Yes — and that is the intended path. Register your school, invite two or three teachers, and run one real class for a week. Attendance, grading and parent messaging are the modules that usually decide it.",
  },
  {
    q: "Where does our data live, and who can see it?",
    a: "In your own Supabase project, which you control. Inside the app, access is scoped by school and by role: a parent sees their own child, a teacher sees their classes, and nobody can query across schools.",
  },
  {
    q: "We already keep resources in Google Drive. Does that still work?",
    a: "Teachers can connect a Google Drive account and import files straight into a class shelf, so existing material does not have to be re-uploaded by hand.",
  },
  {
    q: "We use WhatsApp groups for parents today. What changes?",
    a: "The class announcement stays the same, but it becomes part of the record — alongside attendance, marks and invoices the parent can check without asking anyone. Direct messages replace the phone calls.",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

/**
 * SectionHead — the editorial folio: a sticky number/label column on the
 * left, then the title and deck on the reading grid.
 */
function SectionHead({
  no,
  label,
  title,
  deck,
}: {
  no: string;
  label: string;
  title: React.ReactNode;
  deck?: React.ReactNode;
}) {
  return (
    // Note: intentionally not wrapped in <Reveal>. Reveal sets a transform on
    // its wrapper, and a transformed ancestor stops `position: sticky` from
    // working for the folio column.
    <div className="lp-sechead">
      <p className="lp-folio">
        <b>{no}</b>
        <span>{label}</span>
      </p>
      <div>
        <h2 className="lp-title">{title}</h2>
        {deck ? <p className="lp-deck">{deck}</p> : null}
      </div>
    </div>
  );
}

/** Ticker — the CSS-only contents strip under the hero. */
function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="lp-ticker" aria-hidden="true">
      <div className="lp-ticker-track">
        {items.map((label, i) => (
          <span className="lp-ticker-item" key={`${label}-${i}`}>
            {label}
            <i>✦</i>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * ProductMockup — a CSS-only preview of the teacher dashboard.
 * Deliberately built from the app's own neo-brutalist parts (ink borders,
 * hard shadows, pastel tiles) so it reads as the real product.
 */
function ProductMockup() {
  const tiles = [
    { v: "94%", l: "Attendance today", c: "t-green" },
    { v: "12", l: "Pending grading", c: "t-amber" },
    { v: "3", l: "Submissions today", c: "t-coral" },
    { v: "78%", l: "Fees collected", c: "t-sky" },
  ];
  const bars = [42, 58, 35, 72, 64, 88, 50];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const rows = [
    ["Grade 9B", "Mathematics · 32 students", "Present 30/32"],
    ["Grade 10A", "Mathematics · 28 students", "3 to grade"],
    ["Grade 8C", "Science · 34 students", "Homework due"],
  ];
  const nav = [
    "Overview",
    "My classes",
    "Attendance",
    "Grading queue",
    "Gradebook",
    "Messages",
    "Lesson plans",
  ];

  return (
    <div className="lp-mock" role="img" aria-label="Preview of the CampusOS teacher dashboard">
      <div className="lp-mock-bar">
        <span className="lp-mock-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="lp-mock-url">campusos.indevs.in/dashboard</span>
      </div>

      <div className="lp-mock-body">
        <div className="lp-mock-side">
          <div className="lp-mock-logo">
            Campus<span>OS</span>
          </div>
          {nav.map((label, i) => (
            <div className={i === 2 ? "lp-mock-nav is-active" : "lp-mock-nav"} key={label}>
              <i />
              {label}
            </div>
          ))}
        </div>

        <div className="lp-mock-main">
          <div className="lp-mock-head">
            <div>
              <p className="lp-mock-hi">Good morning, Ms. Rao</p>
              <p className="lp-mock-sub">Tuesday · Period 2 · Grade 9B</p>
            </div>
            <span className="lp-mock-cta">Take attendance</span>
          </div>

          <div className="lp-mock-tiles">
            {tiles.map((t) => (
              <div className={`lp-mock-tile ${t.c}`} key={t.l}>
                <b>{t.v}</b>
                <span>{t.l}</span>
              </div>
            ))}
          </div>

          <div className="lp-mock-chart">
            <p className="lp-mock-chart-label">Attendance this week</p>
            <div className="lp-mock-bars">
              {bars.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="lp-mock-days">
              {days.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
          </div>

          <div className="lp-mock-rows">
            {rows.map(([name, meta, badge]) => (
              <div className="lp-mock-row" key={name}>
                <span className="lp-mock-avatar">{name.slice(-2)}</span>
                <span className="lp-mock-rowtext">
                  <b>{name}</b>
                  <em>{meta}</em>
                </span>
                <span className="lp-mock-badge">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "CampusOS",
        url: "https://campusos.indevs.in",
        description:
          "Invite-based, multi-tenant school management platform for principals, teachers, students and parents.",
      },
      {
        "@type": "SoftwareApplication",
        name: "CampusOS",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "School management platform: attendance, grading, quizzes, report cards, fees, library, transport and messaging behind one invite-based login.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <div className="lp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a className="lp-skip" href="#main">
        Skip to content
      </a>

      {/* ============================ Masthead ============================ */}
      <div className="lp-topline" aria-hidden="true" />

      <header className="lp-head">
        <div className="lp-wrap lp-head-inner">
          <Link href="/" className="lp-brand" aria-label="CampusOS home">
            <Image src="/logo.png" alt="" width={30} height={30} priority className="lp-brand-mark" />
            Campus<span>OS</span>
          </Link>

          <nav className="lp-nav" aria-label="Sections">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="lp-head-actions">
            <Link href="/login" className="lp-login">
              Log in
            </Link>
            <Link href="/register/principal" className="lp-btn lp-btn--sm">
              Register your school
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ============================== Hero ============================== */}
        <section className="lp-hero">
          <InteractiveGrid />

          <div className="lp-wrap">
            <div className="lp-hero-grid">
              <div className="lp-hero-copy">
                <p className="lp-kicker">
                  <span className="lp-kicker-mark" aria-hidden="true" />
                  Invite-only school management
                </p>

                <h1 className="lp-hero-title">
                  The whole campus,{" "}
                  <br />
                  on <em>one page</em>.
                </h1>

                <p className="lp-hero-deck">
                  Principals register the school and invite staff by QR. Teachers take attendance,
                  grade, plan and message parents from a single screen. Students scan in and start
                  working — no forms, no installs, no five apps pretending not to know each other.
                </p>

                <div className="lp-cta-row">
                  <Link href="/register/principal" className="lp-btn">
                    Register your school <i aria-hidden="true">→</i>
                  </Link>
                  <a href="#inside" className="lp-btn lp-btn--ghost">
                    See what’s inside
                  </a>
                </div>

                <p className="lp-micro">
                  90-second setup · No card required · <span>Your data stays in your own database</span>
                </p>
              </div>
            </div>

            <p className="lp-caption">
              <b>fig. 01</b> Every invite is a QR-coded hall pass — drag it, or tap to flip.
            </p>

            {/* Stats ribbon */}
            <ul className="lp-stats">
              <li className="lp-stat">
                <b>4</b>
                <span>roles, one login</span>
              </li>
              <li className="lp-stat">
                <b>{MODULE_COUNT}</b>
                <span>modules in the box</span>
              </li>
              <li className="lp-stat">
                <b>90s</b>
                <span>to register a school</span>
              </li>
              <li className="lp-stat">
                <b>0</b>
                <span>apps to install</span>
              </li>
            </ul>
          </div>

          {/* The lanyard card positions itself across the whole hero. */}
          <HallPassCard />
        </section>

        <Ticker />

        {/* ============================ 01 · Problem ============================ */}
        <section className="lp-sec" id="problem">
          <div className="lp-wrap">
            <SectionHead
              no="01"
              label="The problem"
              title="Your school already runs on nine apps. None of them talk."
              deck="Attendance in a register. Marks in a spreadsheet. Notices in WhatsApp. Fees in a ledger. Every handoff between them loses a name, a number or a day."
            />

            <div className="lp-split" style={{ marginTop: "clamp(32px,5vw,64px)" }}>
              <div>
                <p className="lp-body lp-drop">
                  A school day is not complicated. It is a sequence of small, repeated acts: who is
                  here, what was taught, what was marked, who needs telling, what is owed. Each one is
                  easy. Doing all of them across five tools is what burns the staff room out — and
                  the cost is invisible, because nobody counts the minutes spent copying a register
                  into a spreadsheet.
                </p>
                <p className="lp-body" style={{ marginTop: "1.1em" }}>
                  CampusOS is one record of that day. The register feeds the attendance rate, the
                  marks feed the gradebook, the gradebook feeds the report card, the report card is
                  something a parent can open. Nothing is entered twice.
                </p>
                <blockquote className="lp-quote">
                  The admin work was never the teaching. It was the chasing.
                </blockquote>
              </div>

              <div className="lp-table" role="table" aria-label="What changes when a school moves to CampusOS">
                <div className="lp-table-row lp-table-head" role="row">
                  <span role="columnheader">Everyday job</span>
                  <span role="columnheader">Before</span>
                  <span role="columnheader">With CampusOS</span>
                </div>
                {SWITCH_ROWS.map((row) => (
                  <div className="lp-table-row" role="row" key={row.label}>
                    <span className="lp-table-label" role="cell">
                      {row.label}
                    </span>
                    <span className="lp-table-before" role="cell">
                      {row.before}
                    </span>
                    <span className="lp-table-after" role="cell">
                      {row.after}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================ 02 · Inside ============================ */}
        <section className="lp-sec lp-band" id="inside">
          <div className="lp-wrap">
            <div className="lp-sechead">
              <p className="lp-folio">
                <b>02</b>
                <span>Inside CampusOS</span>
              </p>
              <div>
                <h2 className="lp-title">Inside a teacher’s day.</h2>
                <p className="lp-deck">
                  One screen, in the order the day actually happens — from the register to the parent
                  who needs to know.
                </p>
              </div>
            </div>

            <div className="lp-tour">
              <ol className="lp-tour-notes">
                {TOUR_NOTES.map((note) => (
                  <li key={note.n}>
                    <span className="lp-tour-n">{note.n}</span>
                    <div>
                      <h3>{note.title}</h3>
                      <p>{note.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <Reveal className="lp-tour-figure" y={18}>
                <ProductMockup />
                <p className="lp-caption lp-caption--dark">
                  <b>fig. 02</b> An illustrative preview of the teacher dashboard.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ============================ 03 · Roles ============================ */}
        <section className="lp-sec" id="roles">
          <div className="lp-wrap">
            <SectionHead
              no="03"
              label="Roles"
              title="Four roles. Four dashboards. One school."
              deck="Every account sees exactly what its role allows — enforced in the database, not just in the menu."
            />

            <div className="lp-roles">
              {ROLES.map((role) => (
                <article className="lp-role" key={role.n}>
                  <p className="lp-role-n">{role.n}</p>
                  <h3>{role.name}</h3>
                  <p className="lp-role-line">{role.line}</p>
                  <p className="lp-role-sees">
                    <span>Sees</span>
                    {role.sees}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ 04 · Setup ============================ */}
        <section className="lp-sec" id="setup">
          <div className="lp-wrap">
            <SectionHead
              no="04"
              label="Setup"
              title="From sign-up to first class in four steps."
              deck="No IT project, no data migration, no training week. The first invite exists before the coffee is finished."
            />

            <ol className="lp-steps">
              {STEPS.map((step) => (
                <li className="lp-step" key={step.n}>
                  <p className="lp-step-n">{step.n}</p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================ 05 · Feature index ============================ */}
        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <SectionHead
              no="05"
              label="Feature index"
              title="Everything in the box."
              deck={
                <>
                  {MODULE_COUNT} modules across four jobs — running the class, teaching and
                  assessing, running the school, and talking to everyone. No add-ons, no
                  per-feature switches.
                </>
              }
            />

            <div className="lp-index">
              {FEATURE_GROUPS.map((group) => (
                <Reveal className="lp-index-group" key={group.title} y={16}>
                  <h3 className="lp-index-head">{group.title}</h3>
                  <ul className="lp-index-list">
                    {group.items.map(([name, desc]: readonly [string, string], i: number) => (
                      <li key={name}>
                        <span className="lp-index-n">{String(i + 1).padStart(2, "0")}</span>
                        <span className="lp-index-text">
                          <b>{name}</b>
                          <em>{desc}</em>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ 06 · Why ============================ */}
        <section className="lp-sec" id="why">
          <div className="lp-wrap">
            <SectionHead no="06" label="Why it works" title="Three decisions that shape everything else." />

            <Reveal>
              <p className="lp-pull">
                “Schools don’t need another dashboard. They need the twelve things they do every day
                to stop living in twelve places.”
              </p>
            </Reveal>

            <div className="lp-principles">
              {PRINCIPLES.map((p) => (
                <Reveal className="lp-principle" key={p.n} y={16}>
                  <p className="lp-principle-n">{p.n}</p>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ 07 · Trust ============================ */}
        <section className="lp-sec" id="trust">
          <div className="lp-wrap">
            <SectionHead
              no="07"
              label="Trust"
              title="Built so a school can trust it with a school’s data."
              deck="Student records are not marketing data. CampusOS is built invite-first and tenant-isolated from the first migration."
            />

            <ul className="lp-checks">
              {TRUST.map((item) => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============================ 08 · FAQ ============================ */}
        <section className="lp-sec" id="faq">
          <div className="lp-wrap">
            <SectionHead
              no="08"
              label="Questions"
              title="What principals ask first."
              deck="If yours isn’t here, the answer is usually ‘yes, in the dashboard’ — register the school and look."
            />

            <div className="lp-faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p className="lp-faq-a">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ Closing CTA ============================ */}
        <section className="lp-sec lp-cta">
          <div className="lp-wrap lp-cta-inner">
            <div>
              <p className="lp-folio lp-folio--onink">
                <b>09</b>
                <span>Start here</span>
              </p>
              <h2 className="lp-cta-title">
                Bring your campus
                <br />
                online this week.
              </h2>
              <p className="lp-cta-deck">
                Register the school, invite two teachers, run one real class. That is usually all it
                takes to decide.
              </p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/register/principal" className="lp-btn lp-btn--onink">
                Register your school <i aria-hidden="true">→</i>
              </Link>
              <Link href="/login" className="lp-btn lp-btn--onink-ghost">
                I already have an account
              </Link>
              <p className="lp-micro lp-micro--onink">
                Invite-only · Multi-tenant · No card required
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ============================== Footer ============================== */}
      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div>
              <Link href="/" className="lp-brand" aria-label="CampusOS home">
                <Image src="/logo.png" alt="" width={28} height={28} className="lp-brand-mark" />
                Campus<span>OS</span>
              </Link>
              <p className="lp-foot-tag">
                The school operating system. One login for principals, teachers, students and
                parents.
              </p>
            </div>

            <nav aria-label="Sections">
              <h3 className="lp-foot-head">Sections</h3>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
            </nav>

            <nav aria-label="Get started">
              <h3 className="lp-foot-head">Get started</h3>
              <Link href="/register/principal">Register your school</Link>
              <Link href="/login">Log in</Link>
              <Link href="/dashboard">Dashboard</Link>
            </nav>

            <nav aria-label="Legal">
              <h3 className="lp-foot-head">Legal</h3>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms of service</Link>
            </nav>
          </div>

          <div className="lp-colophon">
            <span>© 2026 CampusOS</span>
            <span>Set in Archivo &amp; IBM Plex Mono</span>
            <span>Built on Next.js &amp; Supabase</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles — scoped to .lp so nothing leaks into the app               */
/* ------------------------------------------------------------------ */

const PAGE_CSS = `
  /* ============================ Tokens ============================ */
  .lp{
    --lp-paper:#F6F1E7;
    --lp-paper-2:#EDE6D7;
    --lp-ink:#15130F;
    --lp-ink-2:#5C564B;
    --lp-rule:rgba(21,19,15,.16);
    --lp-rule-2:rgba(21,19,15,.42);
    --lp-accent:#C9340F;
    --lp-accent-ink:#FFF4EE;
    --lp-green:#12564A;
    --lp-band-bg:#15130F;
    --lp-band-ink:#F6F1E7;
    --lp-band-soft:rgba(246,241,231,.62);
    --lp-band-rule:rgba(246,241,231,.24);
    /* lighter accent for small text on the ink band — the paper accent only
       reaches 3.5:1 against #15130F. */
    --lp-band-accent:#FF6A3D;
    --lp-sans:"Archivo",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
    --lp-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    --lp-max:1280px;
    background:var(--lp-paper);
    color:var(--lp-ink);
    font-family:var(--lp-sans);
    font-size:17px;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
    text-wrap:pretty;
    /* overflow-x:clip rather than hidden — hidden would create a scroll
       container and break the sticky section folios. */
    overflow-x:clip;
  }
  .dark .lp{
    --lp-paper:#111110;
    --lp-paper-2:#191815;
    --lp-ink:#F4EFE4;
    --lp-ink-2:#A69E90;
    --lp-rule:rgba(244,239,228,.16);
    --lp-rule-2:rgba(244,239,228,.40);
    --lp-accent:#FF6A3D;
    --lp-accent-ink:#20110A;
    --lp-green:#5FD3AD;
    --lp-band-bg:#1B1A17;
    --lp-band-ink:#F4EFE4;
    --lp-band-soft:rgba(244,239,228,.62);
    --lp-band-rule:rgba(244,239,228,.24);
    --lp-band-accent:#FF8A5C;
  }

  .lp *{box-sizing:border-box;}
  .lp img{max-width:100%;}
  .lp ::selection{background:var(--lp-accent); color:var(--lp-accent-ink);}
  .lp a{color:inherit;}
  .lp :focus-visible{outline:3px solid var(--lp-accent); outline-offset:3px;}

  html{scroll-behavior:smooth;}
  @media (prefers-reduced-motion: reduce){ html{scroll-behavior:auto;} }
  section[id]{scroll-margin-top:96px;}

  .lp-wrap{max-width:var(--lp-max); margin:0 auto; padding:0 clamp(20px,4vw,44px);}
  .lp-skip{
    position:absolute; left:-9999px; top:0; z-index:99;
    background:var(--lp-ink); color:var(--lp-paper); padding:10px 16px;
    font-family:var(--lp-mono); font-size:12px; text-decoration:none;
  }
  .lp-skip:focus{left:12px; top:12px;}

  /* ============================ Masthead ============================ */
  .lp-topline{height:4px; background:var(--lp-accent);}
  .lp-head{
    position:sticky; top:0; z-index:40;
    background:var(--lp-paper);
    border-bottom:1px solid var(--lp-rule-2);
  }
  .lp-head-inner{display:flex; align-items:center; justify-content:space-between; gap:20px; padding:13px 0;}
  .lp-brand{
    display:inline-flex; align-items:center; gap:10px;
    font-family:var(--lp-sans); font-weight:900; font-size:1.16rem;
    letter-spacing:-.03em; text-decoration:none; color:var(--lp-ink); white-space:nowrap;
  }
  .lp-brand span{color:var(--lp-accent);}
  .lp-brand-mark{border-radius:7px; border:1.5px solid var(--lp-rule-2);}
  .lp-nav{display:none; gap:24px;}
  @media (min-width:1000px){ .lp-nav{display:flex;} }
  .lp-nav a{
    font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.14em; text-transform:uppercase;
    text-decoration:none; color:var(--lp-ink-2); padding:6px 0; border-bottom:2px solid transparent;
    transition:color .16s ease, border-color .16s ease;
  }
  .lp-nav a:hover{color:var(--lp-ink); border-bottom-color:var(--lp-accent);}
  .lp-head-actions{display:flex; align-items:center; gap:14px;}
  .lp-login{
    font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.14em; text-transform:uppercase;
    text-decoration:none; color:var(--lp-ink-2);
  }
  .lp-login:hover{color:var(--lp-accent);}

  /* ============================ Buttons ============================ */
  .lp-btn{
    display:inline-flex; align-items:center; gap:10px;
    font-family:var(--lp-sans); font-weight:800; font-size:15px; line-height:1;
    padding:15px 24px; border:2px solid var(--lp-ink); border-radius:0;
    background:var(--lp-ink); color:var(--lp-paper);
    text-decoration:none; cursor:pointer;
    transition:background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease;
  }
  .lp-btn i{font-style:normal; transition:transform .18s ease;}
  .lp-btn:hover{background:var(--lp-accent); border-color:var(--lp-accent); color:var(--lp-accent-ink); transform:translateY(-2px);}
  .lp-btn:hover i{transform:translateX(4px);}
  .lp-btn--ghost{background:transparent; color:var(--lp-ink);}
  .lp-btn--ghost:hover{background:var(--lp-ink); color:var(--lp-paper); border-color:var(--lp-ink);}
  .lp-btn--sm{padding:11px 16px; font-size:13.5px; border-width:1.5px;}
  .lp-btn--onink{background:var(--lp-band-ink); color:var(--lp-band-bg); border-color:var(--lp-band-ink);}
  .lp-btn--onink:hover{background:var(--lp-accent); border-color:var(--lp-accent); color:#FFF6F1;}
  .lp-btn--onink-ghost{background:transparent; color:var(--lp-band-ink); border-color:var(--lp-band-rule);}
  .lp-btn--onink-ghost:hover{background:var(--lp-band-ink); color:var(--lp-band-bg); border-color:var(--lp-band-ink);}
  @media (max-width:560px){
    .lp-head .lp-btn{padding:10px 12px; font-size:12.5px;}
  }

  /* ============================== Hero ============================== */
  .lp-hero{
    position:relative; overflow:visible;
    padding:clamp(40px,6vw,84px) 0 0;
    --line:var(--lp-rule-2);
    --green:var(--lp-accent);
    --grid-size:26px;
  }
  /* Keep the lanyard stage inside the hero box (the component defaults to
     offsets tuned for the previous hero padding). */
  .lp-hero .hp-stage{top:0; bottom:0;}
  .lp-hero-grid{display:grid; gap:clamp(24px,4vw,48px); min-height:clamp(420px,52vw,560px);}
  @media (min-width:1000px){
    .lp-hero-grid{grid-template-columns:1.12fr .88fr; align-items:start;}
  }
  .lp-hero-copy{position:relative; z-index:6; max-width:46rem;}
  .lp-kicker{
    display:inline-flex; align-items:center; gap:10px;
    font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.18em; text-transform:uppercase;
    color:var(--lp-ink-2); margin:0 0 clamp(18px,2.4vw,26px);
  }
  .lp-kicker-mark{width:10px; height:10px; background:var(--lp-accent); display:inline-block;}
  .lp-hero-title{
    font-family:var(--lp-sans); font-weight:900;
    /* Capped so "The whole campus," holds one line in its column at every
       desktop width. */
    font-size:clamp(2.4rem,5.2vw,4.4rem); line-height:.96; letter-spacing:-.035em;
    margin:0;
  }
  .lp-hero-title em{
    font-style:normal;
    border-bottom:.075em solid var(--lp-accent);
    padding-bottom:.03em;
  }
  .lp-hero-deck{
    margin:clamp(20px,2.6vw,30px) 0 0; max-width:34rem;
    font-size:clamp(1rem,1.15vw,1.09rem); color:var(--lp-ink-2);
  }
  .lp-cta-row{display:flex; flex-wrap:wrap; gap:12px; margin-top:clamp(24px,3vw,36px);}
  .lp-micro{
    margin-top:18px; font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--lp-ink-2);
  }
  .lp-micro span{color:var(--lp-ink);}
  .lp-micro--onink{color:var(--lp-band-soft); margin-top:14px;}
  .lp-caption{
    margin:clamp(18px,2.4vw,28px) 0 0; max-width:46rem;
    font-family:var(--lp-mono); font-size:11px; letter-spacing:.08em; line-height:1.7;
    text-transform:uppercase; color:var(--lp-ink-2);
    border-top:1px solid var(--lp-rule-2); padding-top:10px;
    display:flex; gap:12px;
  }
  .lp-caption b{color:var(--lp-accent);}
  .lp-caption--dark{color:var(--lp-band-soft); border-top-color:var(--lp-band-rule); max-width:none; text-transform:none; letter-spacing:.04em;}
  .lp-caption--dark b{color:var(--lp-band-accent);}

  /* Stats ribbon */
  .lp-stats{
    list-style:none; padding:0;
    display:grid; grid-template-columns:repeat(2,1fr);
    margin:clamp(36px,5vw,64px) 0 0;
    border-top:1px solid var(--lp-rule-2);
  }
  @media (min-width:700px){ .lp-stats{grid-template-columns:repeat(4,1fr);} }
  .lp-stat{padding:22px 0 26px; border-right:1px solid var(--lp-rule); padding-right:16px;}
  .lp-stats .lp-stat:nth-child(2n){border-right:none;}
  @media (min-width:700px){
    .lp-stats .lp-stat:nth-child(2n){border-right:1px solid var(--lp-rule);}
    .lp-stats .lp-stat:last-child{border-right:none;}
    .lp-stat:not(:first-child){padding-left:22px;}
  }
  .lp-stat b{
    display:block; font-family:var(--lp-sans); font-weight:900;
    font-size:clamp(1.9rem,3.4vw,2.9rem); letter-spacing:-.04em; line-height:1;
  }
  .lp-stat span{
    display:block; margin-top:8px; font-family:var(--lp-mono); font-size:11px;
    letter-spacing:.14em; text-transform:uppercase; color:var(--lp-ink-2);
  }

  /* ============================= Ticker ============================= */
  .lp-ticker{
    background:var(--lp-band-bg); color:var(--lp-band-ink);
    border-top:1px solid var(--lp-band-rule); border-bottom:1px solid var(--lp-band-rule);
    overflow:hidden; padding:11px 0; margin-top:clamp(36px,5vw,64px);
  }
  .lp-ticker-track{display:flex; width:max-content; animation:lp-marquee 52s linear infinite;}
  .lp-ticker-item{
    display:inline-flex; align-items:center; gap:18px; padding-right:18px;
    font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--lp-band-soft); white-space:nowrap;
  }
  .lp-ticker-item i{color:var(--lp-band-accent); font-style:normal;}
  @keyframes lp-marquee{from{transform:translateX(0);} to{transform:translateX(-50%);}}
  @media (prefers-reduced-motion: reduce){ .lp-ticker-track{animation:none;} }

  /* ============================ Sections ============================ */
  .lp-sec{padding:clamp(58px,7.5vw,116px) 0; border-top:1px solid var(--lp-rule);}
  .lp-sechead{display:grid; gap:clamp(16px,2.4vw,40px);}
  @media (min-width:1000px){ .lp-sechead{grid-template-columns:minmax(170px,3fr) 9fr;} }
  .lp-folio{
    display:flex; gap:12px; align-items:baseline; margin:0;
    font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.18em; text-transform:uppercase;
    color:var(--lp-ink-2);
  }
  .lp-folio b{color:var(--lp-accent); font-weight:700;}
  .lp-band .lp-folio{color:var(--lp-band-soft);}
  .lp-band .lp-folio b,
  .lp-folio--onink b{color:var(--lp-band-accent);}
  .lp-folio--onink{color:var(--lp-band-soft);}
  @media (min-width:1000px){
    .lp-folio{position:sticky; top:104px; align-self:start;}
  }
  .lp-title{
    font-family:var(--lp-sans); font-weight:900; letter-spacing:-.032em; line-height:1.02;
    text-wrap:balance;
    font-size:clamp(1.85rem,4vw,3.1rem); margin:0; max-width:26ch;
  }
  .lp-deck{margin:clamp(14px,1.8vw,20px) 0 0; max-width:62ch; color:var(--lp-ink-2); font-size:1.05rem;}

  .lp-body{max-width:60ch;}
  .lp-body + .lp-body{margin-top:1.1em;}
  .lp-drop::first-letter{
    float:left; font-family:var(--lp-sans); font-weight:900;
    font-size:3.1em; line-height:.8; padding:.06em .1em 0 0;
  }
  .lp-quote{
    margin:clamp(28px,4vw,44px) 0 0; padding-left:20px;
    border-left:3px solid var(--lp-accent);
    font-family:var(--lp-sans); font-weight:800; letter-spacing:-.02em; line-height:1.22;
    font-size:clamp(1.15rem,1.8vw,1.5rem);
  }

  .lp-split{display:grid; gap:clamp(32px,5vw,64px);}
  @media (min-width:1000px){ .lp-split{grid-template-columns:1.02fr .98fr;} }

  /* Before / after table */
  .lp-table{border-top:1px solid var(--lp-rule-2); margin-top:8px;}
  .lp-table-row{
    display:grid; grid-template-columns:1fr; gap:8px;
    padding:16px 0; border-bottom:1px solid var(--lp-rule);
  }
  @media (min-width:700px){
    .lp-table-row{grid-template-columns:minmax(96px,.62fr) 1fr 1fr; gap:20px; align-items:baseline;}
  }
  .lp-table-head{display:none;}
  @media (min-width:700px){
    .lp-table-head{display:grid; padding:0 0 10px;}
    .lp-table-head span{
      font-family:var(--lp-mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase;
      color:var(--lp-ink-2);
    }
  }
  .lp-table-label{font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.12em; text-transform:uppercase;}
  .lp-table-before{color:var(--lp-ink-2); font-size:.94rem;}
  .lp-table-before::before{content:"— "; color:var(--lp-accent);}
  .lp-table-after{font-weight:600; font-size:.94rem;}
  .lp-table-after::before{content:"→ "; color:var(--lp-accent);}

  /* ============================== Band ============================== */
  .lp-band{
    background:var(--lp-band-bg); color:var(--lp-band-ink);
    border-top:1px solid var(--lp-band-rule); border-bottom:1px solid var(--lp-band-rule);
  }
  .lp-band .lp-deck{color:var(--lp-band-soft);}
  .lp-band .lp-title{color:var(--lp-band-ink);}

  .lp-tour{display:grid; gap:clamp(32px,4.5vw,64px); margin-top:clamp(34px,5vw,64px);}
  @media (min-width:1000px){ .lp-tour{grid-template-columns:.86fr 1.14fr; align-items:start; gap:clamp(40px,4vw,72px);} }
  .lp-tour-notes{list-style:none; margin:0; padding:0; border-top:1px solid var(--lp-band-rule);}
  .lp-tour-notes li{
    display:grid; grid-template-columns:38px 1fr; gap:16px;
    padding:20px 0 22px; border-bottom:1px solid var(--lp-band-rule);
  }
  .lp-tour-n{font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.14em; color:var(--lp-band-accent);}
  .lp-tour-notes h3{
    margin:0 0 6px; font-family:var(--lp-sans); font-weight:800; font-size:1.1rem; letter-spacing:-.015em;
  }
  .lp-tour-notes p{margin:0; color:var(--lp-band-soft); font-size:.95rem;}
  .lp-tour-figure{display:flex; flex-direction:column; gap:14px;}

  /* ======================== Product mockup (CSS) ======================== */
  .lp-mock{
    font-size:clamp(9.5px,1.02vw,13px);
    background:#FFFFFF; color:#15130F;
    border:2px solid #15130F; border-radius:10px; overflow:hidden;
    box-shadow:12px 12px 0 rgba(0,0,0,.55);
  }
  .lp-mock-bar{
    display:flex; align-items:center; gap:1em;
    padding:.7em 1em; background:#F1EDE3; border-bottom:2px solid #15130F;
  }
  .lp-mock-dots{display:flex; gap:.45em;}
  .lp-mock-dots i{width:.8em; height:.8em; border-radius:50%; background:#15130F; opacity:.25;}
  .lp-mock-dots i:first-child{opacity:.55;}
  .lp-mock-url{
    font-family:var(--lp-mono); font-size:.85em; letter-spacing:.04em; color:#5C564B;
    background:#fff; border:1.5px solid rgba(21,19,15,.2); border-radius:99px; padding:.25em 1em;
  }
  .lp-mock-body{display:grid; grid-template-columns:11em 1fr;}
  .lp-mock-side{background:#15130F; color:#F6F1E7; padding:1.1em .9em; display:flex; flex-direction:column; gap:.5em;}
  .lp-mock-logo{font-weight:900; font-size:1.1em; letter-spacing:-.03em; margin-bottom:.6em;}
  .lp-mock-logo span{color:#1FD68F;}
  .lp-mock-nav{
    display:flex; align-items:center; gap:.55em;
    font-size:.92em; font-weight:600; padding:.5em .6em; border-radius:.45em; opacity:.68;
  }
  .lp-mock-nav i{width:.55em; height:.55em; background:currentColor; opacity:.6; display:block;}
  .lp-mock-nav.is-active{background:#F6F1E7; color:#15130F; opacity:1; font-weight:800;}
  .lp-mock-main{padding:1.2em 1.3em 1.4em; display:flex; flex-direction:column; gap:1em; background:#FDFBF7;}
  .lp-mock-head{display:flex; align-items:center; justify-content:space-between; gap:1em;}
  .lp-mock-hi{font-weight:900; font-size:1.25em; letter-spacing:-.02em; margin:0;}
  .lp-mock-sub{font-family:var(--lp-mono); font-size:.82em; color:#5C564B; margin:.25em 0 0;}
  .lp-mock-cta{
    font-size:.8em; font-weight:800; text-transform:uppercase; letter-spacing:.06em;
    background:#1FD68F; border:1.5px solid #15130F; box-shadow:2px 2px 0 #15130F; padding:.5em .8em; white-space:nowrap;
  }
  .lp-mock-tiles{display:grid; grid-template-columns:repeat(4,1fr); gap:.7em;}
  .lp-mock-tile{
    border:1.5px solid #15130F; box-shadow:2.5px 2.5px 0 #15130F;
    padding:.7em .75em; display:flex; flex-direction:column; gap:.2em;
  }
  .lp-mock-tile b{font-size:1.35em; font-weight:900; letter-spacing:-.03em; line-height:1;}
  .lp-mock-tile span{font-family:var(--lp-mono); font-size:.65em; letter-spacing:.06em; text-transform:uppercase; color:#3f3a33;}
  .t-green{background:#A7F3D0;} .t-amber{background:#FDE68A;}
  .t-coral{background:#FECDD3;} .t-sky{background:#BAE6FD;}
  .lp-mock-chart{
    border:1.5px solid #15130F; padding:.9em 1em 1em; background:#fff;
    display:flex; flex-direction:column; gap:.6em;
  }
  .lp-mock-chart-label{font-family:var(--lp-mono); font-size:.72em; letter-spacing:.12em; text-transform:uppercase; color:#5C564B; margin:0;}
  .lp-mock-bars{display:flex; align-items:flex-end; gap:.55em; height:6.4em;}
  .lp-mock-bars span{
    flex:1; background:#15130F; border:1.5px solid #15130F; border-radius:2px 2px 0 0; min-height:8%;
  }
  .lp-mock-bars span:nth-child(6){background:#1FD68F;}
  .lp-mock-days{display:flex; gap:.55em;}
  .lp-mock-days span{
    flex:1; text-align:center; font-family:var(--lp-mono); font-size:.68em; color:#5C564B;
  }
  .lp-mock-rows{display:flex; flex-direction:column; gap:.5em;}
  .lp-mock-row{
    display:flex; align-items:center; gap:.7em;
    border:1.5px solid #15130F; background:#fff; padding:.55em .7em;
  }
  .lp-mock-avatar{
    width:2em; height:2em; flex:none; display:grid; place-items:center;
    background:#15130F; color:#F6F1E7; font-family:var(--lp-mono); font-size:.7em; font-weight:700;
  }
  .lp-mock-rowtext{display:flex; flex-direction:column; min-width:0;}
  .lp-mock-rowtext b{font-size:.95em; letter-spacing:-.01em;}
  .lp-mock-rowtext em{font-style:normal; font-family:var(--lp-mono); font-size:.7em; color:#5C564B;}
  .lp-mock-badge{
    margin-left:auto; font-size:.68em; font-weight:800; text-transform:uppercase; letter-spacing:.04em;
    background:#FDE68A; border:1.5px solid #15130F; padding:.25em .5em; white-space:nowrap;
  }
  @media (max-width:560px){
    .lp-mock-tiles{grid-template-columns:repeat(2,1fr);}
    .lp-mock-body{grid-template-columns:1fr;}
    .lp-mock-side{flex-direction:row; flex-wrap:wrap; align-items:center; gap:.4em; padding:.8em;}
    .lp-mock-logo{margin:0 .6em 0 0;}
    .lp-mock-nav{font-size:.8em; padding:.35em .5em;}
    .lp-mock-nav:nth-child(n+5){display:none;}
  }

  /* ============================== Roles ============================== */
  .lp-roles{display:grid; margin-top:clamp(34px,5vw,60px); border-top:1px solid var(--lp-rule-2);}
  @media (min-width:860px){ .lp-roles{grid-template-columns:repeat(4,1fr);} }
  .lp-role{
    position:relative; padding:30px 0 34px; border-bottom:1px solid var(--lp-rule);
  }
  @media (min-width:860px){
    .lp-role{border-right:1px solid var(--lp-rule); padding-right:26px;}
    .lp-role:last-child{border-right:none;}
    .lp-role:not(:first-child){padding-left:26px;}
  }
  .lp-role::before{
    content:""; position:absolute; top:-1px; left:0; width:46px; height:5px;
    background:var(--lp-ink); transition:width .3s cubic-bezier(.4,0,.2,1);
  }
  .lp-role:nth-child(1)::before{background:#10B981;}
  .lp-role:nth-child(2)::before{background:#38BDF8;}
  .lp-role:nth-child(3)::before{background:#FB7185;}
  .lp-role:nth-child(4)::before{background:#FBBF24;}
  .lp-role:hover::before{width:100%;}
  @media (prefers-reduced-motion: reduce){ .lp-role::before{transition:none;} }
  .lp-role-n{font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.16em; color:var(--lp-ink-2); margin:0 0 14px;}
  .lp-role h3{font-family:var(--lp-sans); font-weight:900; font-size:1.45rem; letter-spacing:-.03em; margin:0 0 10px;}
  .lp-role-line{margin:0; color:var(--lp-ink-2); font-size:.97rem;}
  .lp-role-sees{
    margin:20px 0 0; padding-top:14px; border-top:1px solid var(--lp-rule);
    font-size:.87rem; color:var(--lp-ink-2);
  }
  .lp-role-sees span{
    display:block; font-family:var(--lp-mono); font-size:10.5px; letter-spacing:.16em;
    text-transform:uppercase; color:var(--lp-ink); margin-bottom:6px;
  }

  /* ============================== Steps ============================== */
  .lp-steps{list-style:none; margin:clamp(34px,5vw,60px) 0 0; padding:0; display:grid; border-top:1px solid var(--lp-rule-2);}
  @media (min-width:860px){ .lp-steps{grid-template-columns:repeat(4,1fr);} }
  .lp-step{position:relative; padding:30px 0 34px; border-bottom:1px solid var(--lp-rule);}
  @media (min-width:860px){
    .lp-step{border-right:1px solid var(--lp-rule); padding-right:26px;}
    .lp-step:last-child{border-right:none;}
    .lp-step:not(:first-child){padding-left:26px;}
  }
  .lp-step::before{
    content:""; position:absolute; top:-6px; left:0; width:11px; height:11px;
    background:var(--lp-accent); border-radius:50%;
  }
  .lp-step-n{font-family:var(--lp-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--lp-ink-2); margin:0 0 14px;}
  .lp-step h3{font-family:var(--lp-sans); font-weight:800; font-size:1.08rem; letter-spacing:-.015em; margin:0 0 8px;}
  .lp-step p{margin:0; color:var(--lp-ink-2); font-size:.94rem;}

  /* ========================== Feature index ========================== */
  .lp-index{display:grid; gap:clamp(30px,4vw,52px); margin-top:clamp(34px,5vw,60px);}
  @media (min-width:860px){ .lp-index{grid-template-columns:1fr 1fr; column-gap:clamp(40px,5vw,80px);} }
  .lp-index-group{min-width:0;}
  .lp-index-head{
    margin:0; padding-bottom:12px; border-bottom:1px solid var(--lp-rule-2);
    font-family:var(--lp-mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--lp-ink);
  }
  .lp-index-list{list-style:none; margin:0; padding:0;}
  .lp-index-list li{
    display:grid; grid-template-columns:26px 1fr; gap:12px; align-items:baseline;
    padding:11px 0 11px 10px; margin-left:-10px;
    border-bottom:1px solid var(--lp-rule); border-left:2px solid transparent;
    transition:border-color .16s ease, background .16s ease;
  }
  .lp-index-list li:hover{border-left-color:var(--lp-accent); background:var(--lp-paper-2);}
  .lp-index-n{font-family:var(--lp-mono); font-size:11px; color:var(--lp-ink-2);}
  .lp-index-text{display:flex; flex-wrap:wrap; gap:0 10px; align-items:baseline;}
  .lp-index-text b{font-weight:700;}
  .lp-index-text em{font-style:normal; color:var(--lp-ink-2); font-size:.92rem;}

  /* =============================== Why =============================== */
  .lp-pull{
    margin:clamp(30px,4.5vw,54px) 0 0; max-width:34ch;
    font-family:var(--lp-sans); font-weight:900; letter-spacing:-.035em; line-height:1.06;
    font-size:clamp(1.6rem,3.4vw,2.7rem);
  }
  .lp-principles{display:grid; gap:clamp(28px,4vw,48px); margin-top:clamp(34px,5vw,64px);}
  @media (min-width:860px){ .lp-principles{grid-template-columns:repeat(3,1fr);} }
  .lp-principle{border-top:1px solid var(--lp-rule-2); padding-top:20px;}
  .lp-principle-n{font-family:var(--lp-mono); font-size:11.5px; letter-spacing:.16em; color:var(--lp-accent); margin:0 0 12px;}
  .lp-principle h3{font-family:var(--lp-sans); font-weight:800; font-size:1.16rem; letter-spacing:-.02em; margin:0 0 10px;}
  .lp-principle p{margin:0; color:var(--lp-ink-2); font-size:.96rem;}

  /* ============================== Trust ============================== */
  .lp-checks{list-style:none; margin:clamp(34px,5vw,60px) 0 0; padding:0;
    display:grid; border-top:1px solid var(--lp-rule-2);}
  @media (min-width:860px){ .lp-checks{grid-template-columns:1fr 1fr; column-gap:clamp(40px,5vw,80px);} }
  .lp-checks li{position:relative; padding:18px 0 18px 32px; border-bottom:1px solid var(--lp-rule);}
  .lp-checks li::before{
    content:""; position:absolute; left:0; top:24px; width:13px; height:13px;
    border:2px solid var(--lp-ink); background:var(--lp-green);
  }
  .lp-checks b{display:block; font-weight:700; margin-bottom:4px;}
  .lp-checks span{color:var(--lp-ink-2); font-size:.94rem;}

  /* =============================== FAQ =============================== */
  .lp-faq{margin-top:clamp(34px,5vw,60px); border-top:1px solid var(--lp-rule-2);}
  .lp-faq details{border-bottom:1px solid var(--lp-rule);}
  .lp-faq summary{
    display:flex; align-items:baseline; justify-content:space-between; gap:24px;
    padding:22px 0; cursor:pointer; list-style:none;
    font-family:var(--lp-sans); font-weight:800; letter-spacing:-.02em;
    font-size:clamp(1.05rem,1.7vw,1.32rem);
    transition:color .16s ease;
  }
  .lp-faq summary::-webkit-details-marker{display:none;}
  .lp-faq summary::after{content:"+"; font-family:var(--lp-mono); font-size:1.35rem; color:var(--lp-accent); line-height:1;}
  .lp-faq details[open] summary::after{content:"–";}
  .lp-faq summary:hover{color:var(--lp-accent);}
  .lp-faq-a{margin:0; padding:0 clamp(28px,4vw,90px) 24px 0; max-width:74ch; color:var(--lp-ink-2);}

  /* ============================= Closing CTA ============================= */
  .lp-cta{
    background:var(--lp-band-bg); color:var(--lp-band-ink);
    border-top:1px solid var(--lp-band-rule);
  }
  .lp-cta-inner{display:grid; gap:clamp(28px,4vw,48px);}
  @media (min-width:1000px){ .lp-cta-inner{grid-template-columns:1.35fr .65fr; align-items:end;} }
  .lp-cta-title{
    font-family:var(--lp-sans); font-weight:900; letter-spacing:-.04em; line-height:.98;
    font-size:clamp(2.1rem,5.4vw,4.2rem); margin:18px 0 0;
  }
  .lp-cta-deck{margin:20px 0 0; max-width:46ch; color:var(--lp-band-soft);}
  .lp-cta-actions{display:flex; flex-direction:column; align-items:flex-start; gap:12px;}

  /* ============================== Footer ============================== */
  .lp-foot{border-top:1px solid var(--lp-rule-2); padding:clamp(40px,6vw,72px) 0 28px;}
  .lp-foot-grid{display:grid; gap:clamp(28px,4vw,40px);}
  @media (min-width:860px){ .lp-foot-grid{grid-template-columns:2.2fr 1fr 1fr 1fr;} }
  .lp-foot-tag{margin:16px 0 0; max-width:30ch; color:var(--lp-ink-2); font-size:.94rem;}
  .lp-foot-head{
    margin:0 0 14px; font-family:var(--lp-mono); font-size:10.5px; letter-spacing:.18em;
    text-transform:uppercase; color:var(--lp-ink-2); font-weight:700;
  }
  .lp-foot nav a{
    display:block; padding:5px 0; text-decoration:none; font-weight:600; font-size:.95rem;
    color:var(--lp-ink);
  }
  .lp-foot nav a:hover{color:var(--lp-accent);}
  .lp-colophon{
    display:flex; flex-wrap:wrap; gap:10px 26px; justify-content:space-between;
    margin-top:clamp(32px,5vw,56px); padding-top:18px; border-top:1px solid var(--lp-rule);
    font-family:var(--lp-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase;
    color:var(--lp-ink-2);
  }

  /* ======================= Small-screen tidy-up ======================= */
  /* ------------------------------------------------------------------
     Breakpoints: 560 (phone) · 700 (large phone / small tablet)
     · 860 (tablet / 2-up grids) · 1000 (desktop / 12-col reading grid)
     · 999 max-width (the counterpart of 1000)
     ------------------------------------------------------------------ */
  @media (max-width:999px){
    /* The lanyard is absolutely positioned over the hero's right column,
       which no longer exists once the hero grid stacks. */
    .lp-hero .hp-stage{display:none !important;}
    .lp-hero-grid{min-height:0;}
  }
`;
