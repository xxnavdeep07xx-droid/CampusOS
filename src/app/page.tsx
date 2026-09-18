import Link from "next/link";
import Image from "next/image";


/**
 * CampusOS — Neo-brutalist landing page.
 *
 * Direct port of /upload/campusos-redesign.html.
 * Server component — the theme toggle is wired up via inline scripts so
 * no client React state is needed.
 */

const ROLES = [
  {
    n: "01",
    emoji: "🏛️",
    title: "Principal",
    desc: "Register the school, invite staff, and see campus-wide activity from one screen.",
    points: ["Create the school in 90 seconds", "Invite staff by QR or link", "School-wide analytics"],
    bg: "var(--green)",
    color: "#0B3626",
    badgeBg: "var(--bg)",
  },
  {
    n: "02",
    emoji: "📋",
    title: "Teacher",
    desc: "Run classes, take attendance, and grade — without leaving one tab.",
    points: ["Mark full class present in one tap", "One queue for all grading", "Lesson plans + syllabus tracker"],
    bg: "var(--blue)",
    color: "#0B1B4D",
    badgeBg: "var(--bg)",
  },
  {
    n: "03",
    emoji: "🎒",
    title: "Student",
    desc: "Join a class by scanning an invite — no forms to fill in.",
    points: ["Scan QR to join a class", "Submit work + take quizzes", "See grades and attendance"],
    bg: "var(--coral)",
    color: "#3D0C0E",
    badgeBg: "var(--bg)",
  },
  {
    n: "04",
    emoji: "👪",
    title: "Parent",
    desc: "Message teachers directly and follow your child's progress.",
    points: ["Message teachers directly", "Track attendance and grades", "Pay fees online"],
    bg: "var(--yellow)",
    color: "#3D2E00",
    badgeBg: "var(--bg)",
  },
] as const;

const STEPS = [
  {
    n: "STEP 01",
    title: "Principal registers",
    desc: "Enter the school name, email, and password. The campus is live immediately.",
  },
  {
    n: "STEP 02",
    title: "Staff are invited",
    desc: "Share a QR code or link — role and school are attached automatically.",
  },
  {
    n: "STEP 03",
    title: "Classes are created",
    desc: "Teachers set up classes and start taking attendance and assigning work.",
  },
  {
    n: "STEP 04",
    title: "Students + parents join",
    desc: "Students scan in; parents get linked to their child automatically.",
  },
] as const;

const WHYS = [
  {
    n: "— 01",
    title: "One login, not five",
    desc: "Attendance, grading, messaging, and fees usually mean separate logins for separate tools. Here they're one dashboard per role.",
  },
  {
    n: "— 02",
    title: "Nothing sits in a spreadsheet",
    desc: "Grades and attendance update live instead of waiting for someone to export and re-share a file.",
  },
  {
    n: "— 03",
    title: "Every school is walled off",
    desc: "Multi-tenant by design — one school's records are never visible to another, even on the same instance.",
  },
] as const;

const FEATURES = [
  { icon: "🎓", title: "Class management", desc: "Create classes and invite students by QR code." },
  { icon: "📅", title: "Smart attendance", desc: "Mark a class present in one tap, spot trends over time." },
  { icon: "📥", title: "Grading queue", desc: "One inbox for every ungraded submission across classes." },
  { icon: "📖", title: "Lesson planning", desc: "A weekly grid for objectives, materials, and syllabus tracking." },
  { icon: "☁️", title: "Teacher drive", desc: "Personal storage with Google Drive integration." },
  { icon: "📣", title: "Announcements", desc: "Broadcast to a class with a Zoom or Meet link attached." },
  { icon: "💬", title: "Direct messaging", desc: "Secure 1:1 and group chats with staff and parents." },
  { icon: "🔔", title: "Notifications", desc: "One live inbox for submissions, messages, and leave requests." },
  { icon: "🗓️", title: "Unified calendar", desc: "Timetables, due dates, and lesson plans in a single view." },
] as const;

/** Inline script that runs BEFORE hydration to set data-theme on <html>.
 *  Uses a separate localStorage key ('campusos-theme') so it does not
 *  collide with the layout's .dark-class toggle. */
const earlyThemeScript = `
(function(){
  try {
    var t = localStorage.getItem('campusos-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

/** Theme toggle button wiring — runs after DOM is ready. */
const themeToggleScript = `
(function(){
  function init(){
    var root = document.documentElement;
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    function currentTheme(){
      var explicit = root.getAttribute('data-theme');
      if (explicit) return explicit;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function updateIcon(t){
      btn.textContent = t === 'dark' ? '\\u2600\\uFE0F' : '\\u{1F319}';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    updateIcon(currentTheme());
    btn.addEventListener('click', function(){
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('campusos-theme', next); } catch(e){}
      updateIcon(next);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

export default function LandingPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: earlyThemeScript + "\\n" + themeToggleScript }} />

      <header>
        <div className="nav wrap">
          <Link href="/" className="logo">
            <span className="logo-mark" style={{ background: "transparent", padding: 0, border: "none", boxShadow: "none" }}>
              <Image src="/logo.png" alt="Logo" width={34} height={34} priority />
            </span>
            Campus<span>OS</span>
          </Link>
          <div className="nav-actions">
            <Link href="/login" className="nav-login">
              Log in
            </Link>
            <button className="theme-toggle" id="themeToggle" aria-label="Switch to dark mode">
              🌙
            </button>
            <Link href="/register/principal" className="btn btn-primary btn-sm">
              Register your school
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ====== Hero ====== */}
        <section className="hero wrap">
          <div className="hero-grid">
            <div className="fade-up">
              <div className="stamps">
                <span className="stamp g">● Invite-only onboarding</span>
                <span className="stamp b">● Multi-tenant security</span>
              </div>
              <h1 className="headline">
                One login for
                <br />
                the whole{" "}
                <u>
                  school
                  <svg viewBox="0 0 200 12" preserveAspectRatio="none">
                    <path
                      d="M2 9 C 40 2, 160 2, 198 9"
                      stroke="var(--coral)"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </u>
                .
              </h1>
              <p className="hero-copy">
                Principals register the campus. Teachers invite their students. Attendance, grading, lesson
                plans, and parent messages all live in one place — no more juggling five separate apps.
              </p>
              <div className="hero-ctas">
                <Link href="/register/principal" className="btn btn-primary">
                  Register your school →
                </Link>
                <Link href="/login" className="btn btn-ghost">
                  I already have an account
                </Link>
              </div>
            </div>

            {/* Hall-pass hero card */}
            <div className="hallpass-wrap fade-up d1">
              <div className="hallpass">
                <div className="hallpass-head">
                  <span className="hallpass-tag">Staff invite</span>
                  <span className="hallpass-tag">No. 0042</span>
                </div>
                <h3>Hall Pass</h3>
                <p>Scan to join — role and school are filled in for you.</p>
                <div className="hallpass-body">
                  <div className="qr">
                    <div className="qr-eye tl" />
                    <div className="qr-eye tr" />
                    <div className="qr-eye bl" />
                    <i style={{ top: "8px", left: "34px" }} />
                    <i style={{ top: "16px", left: "42px" }} />
                    <i style={{ top: "24px", left: "30px" }} />
                    <i style={{ top: "34px", left: "46px" }} />
                    <i style={{ top: "42px", left: "36px" }} />
                    <i style={{ top: "44px", left: "8px" }} />
                    <i style={{ top: "34px", left: "22px" }} />
                    <i style={{ top: "26px", left: "44px" }} />
                  </div>
                  <div className="hallpass-code">
                    <b>/register/teacher</b>
                    ?token=7F3-91C<br />
                    one-time use
                  </div>
                </div>
                <ul className="hallpass-list">
                  <li>Role auto-assigned</li>
                  <li>School auto-linked</li>
                  <li>Expires after first scan</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ====== Roles ====== */}
        <section className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Roles</span>
            <h2>Everyone gets their own dashboard</h2>
            <p>Four roles, one platform — each sees only what&apos;s theirs to see.</p>
          </div>
          <div className="roles-grid">
            {ROLES.map((role) => {
              return (
                <div
                  key={role.title}
                  className="role-card brut"
                  style={{ background: role.bg, color: role.color }}
                >
                  <span className="role-tag">{role.n}</span>
                  <div className="role-badge" style={{ background: role.badgeBg }}>
                    {role.emoji}
                  </div>
                  <h3>{role.title}</h3>
                  <p>{role.desc}</p>
                  <ul className="role-list">
                    {role.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ====== How it works ====== */}
        <section className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Roll call</span>
            <h2>From sign-up to first class</h2>
            <p>Four steps, no waiting on IT.</p>
          </div>
          <div className="steps">
            {STEPS.map((step) => (
              <div className="step" key={step.n}>
                <span className="step-no">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ====== Why CampusOS ====== */}
        <section className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Why CampusOS</span>
            <h2>What switching actually changes</h2>
          </div>
          <div className="why-grid">
            {WHYS.map((w) => (
              <div className="why-card brut" key={w.n}>
                <div className="why-num">{w.n}</div>
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ====== Features corkboard ====== */}
        <section className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Inside CampusOS</span>
            <h2>Everything a campus runs on</h2>
          </div>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card brut" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ====== Final CTA ====== */}
        <section className="wrap">
          <div className="cta-band">
            <div>
              <h2>Ready to bring your campus online?</h2>
              <p>Takes about 90 seconds — your name, school name, email, and a password.</p>
            </div>
            <Link href="/register/principal" className="btn">
              Register your school →
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot-row">
          <div className="foot-logo">
            <Image src="/logo.png" alt="CampusOS Logo" width={26} height={26} />
            CampusOS
          </div>
          <div className="foot-links">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
          <div>CampusOS · 2026</div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </>
  );
}

const PAGE_CSS = `
  :root{
    --bg:#FFFDF7; --surface:#FFFFFF; --surface-2:#F3F1E6;
    --text:#15171E; --text-soft:#52565F;
    --line:#15171E; --shadow:#15171E;
    --green:#17B978; --green-ink:#0B3626;
    --yellow:#FFC93C; --yellow-ink:#3D2E00;
    --coral:#FF5A5F; --coral-ink:#3D0C0E;
    --blue:#4D7CFE; --blue-ink:#0B1B4D;
    --radius:14px;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#101218; --surface:#1B1E26; --surface-2:#20232C;
      --text:#F5F3EA; --text-soft:#A7ABB8;
      --line:#F5F3EA; --shadow:#000000;
      --green:#22D890; --yellow:#FFD65C; --coral:#FF6B70; --blue:#6E93FF;
    }
  }
  :root[data-theme="dark"]{
    --bg:#101218; --surface:#1B1E26; --surface-2:#20232C;
    --text:#F5F3EA; --text-soft:#A7ABB8;
    --line:#F5F3EA; --shadow:#000000;
    --green:#22D890; --yellow:#FFD65C; --coral:#FF6B70; --blue:#6E93FF;
  }

  *{box-sizing:border-box;}
  html{-webkit-text-size-adjust:100%;}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:'Archivo',system-ui,sans-serif; font-weight:500;
    line-height:1.5; -webkit-font-smoothing:antialiased;
  }
  img,svg{max-width:100%; display:block;}
  a{color:inherit;}
  .mono{font-family:'IBM Plex Mono',ui-monospace,'Courier New',monospace;}
  .wrap{max-width:1180px; margin:0 auto; padding:0 24px;}
  h1,h2,h3{font-family:'Archivo',system-ui,sans-serif; font-weight:900; line-height:1.05; margin:0;}
  p{margin:0;}
  :focus-visible{outline:3px solid var(--blue); outline-offset:2px;}

  /* --- hard-shadow card primitive --- */
  .brut{
    background:var(--surface);
    border:3px solid var(--line);
    box-shadow:6px 6px 0 var(--shadow);
  }

  /* --- buttons --- */
  .btn{
    display:inline-flex; align-items:center; gap:8px;
    font-family:'Archivo',sans-serif; font-weight:800; font-size:15px;
    padding:13px 22px; border:3px solid var(--line); border-radius:10px;
    background:var(--surface); color:var(--text);
    box-shadow:5px 5px 0 var(--shadow);
    cursor:pointer; text-decoration:none;
    transition:transform .08s ease, box-shadow .08s ease;
  }
  .btn:hover{transform:translate(-2px,-2px); box-shadow:7px 7px 0 var(--shadow);}
  .btn:active{transform:translate(2px,2px); box-shadow:2px 2px 0 var(--shadow);}
  .btn-primary{background:var(--green); color:var(--green-ink);}
  .btn-ghost{background:var(--surface);}
  .btn-sm{padding:9px 14px; font-size:13px; box-shadow:3px 3px 0 var(--shadow);}
  .btn-sm:hover{transform:translate(-1px,-1px); box-shadow:4px 4px 0 var(--shadow);}

  /* --- nav --- */
  header{
    position:sticky; top:0; z-index:40; background:var(--bg);
    border-bottom:3px solid var(--line);
  }
  .nav{display:flex; align-items:center; justify-content:space-between; padding:16px 24px; gap:16px;}
  .logo{display:flex; align-items:center; gap:10px; font-weight:900; font-size:19px; text-decoration:none;}
  .logo-mark{
    width:34px; height:34px; border:3px solid var(--line); border-radius:8px;
    background:var(--green); display:flex; align-items:center; justify-content:center;
    font-size:17px; box-shadow:3px 3px 0 var(--shadow); flex-shrink:0;
  }
  .logo span{color:var(--green);}
  .nav-actions{display:flex; align-items:center; gap:10px;}
  .theme-toggle{
    width:42px; height:42px; border:3px solid var(--line); border-radius:10px;
    background:var(--surface); box-shadow:3px 3px 0 var(--shadow);
    display:flex; align-items:center; justify-content:center; font-size:17px;
    cursor:pointer; padding:0;
  }
  .theme-toggle:hover{transform:translate(-1px,-1px); box-shadow:4px 4px 0 var(--shadow);}
  .nav-login{display:none; font-weight:700; text-decoration:none; padding:10px 4px;}
  @media(min-width:640px){ .nav-login{display:inline-flex;} }

  section{padding:80px 0;}
  .eyebrow{
    display:inline-block; font-family:'IBM Plex Mono',monospace; font-weight:700;
    font-size:12px; letter-spacing:.04em; text-transform:uppercase;
    padding:4px 10px; border:2px solid var(--line); border-radius:6px; background:var(--surface-2);
  }
  .kicker{font-family:'IBM Plex Mono',monospace; color:var(--text-soft); font-size:14px; margin:14px 0 0;}

  /* --- hero --- */
  .hero{padding:64px 0 72px;}
  .hero-grid{display:grid; grid-template-columns:1.15fr 1fr; gap:56px; align-items:center;}
  .stamps{display:flex; gap:10px; flex-wrap:wrap; margin-bottom:22px;}
  .stamp{
    font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:700; letter-spacing:.03em;
    text-transform:uppercase; padding:6px 11px; border:2px solid var(--line); border-radius:999px;
    display:inline-flex; align-items:center; gap:6px;
  }
  .stamp.g{background:var(--green); color:var(--green-ink);}
  .stamp.b{background:var(--blue); color:#fff;}
  h1.headline{font-size:clamp(38px,5.4vw,62px); letter-spacing:-.01em;}
  .headline u{
    text-decoration:none; position:relative; white-space:nowrap;
  }
  .headline u svg{position:absolute; left:0; bottom:-6px; width:100%; height:12px;}
  .hero-copy{max-width:52ch; color:var(--text-soft); font-size:17px; margin:20px 0 30px; font-weight:500;}
  .hero-ctas{display:flex; gap:14px; flex-wrap:wrap;}

  /* hall-pass hero card */
  .hallpass-wrap{display:flex; justify-content:center;}
  .hallpass{
    width:100%; max-width:360px; background:var(--yellow); color:var(--yellow-ink);
    border:3px solid var(--line); border-radius:18px; box-shadow:9px 9px 0 var(--shadow);
    padding:22px; transform:rotate(-2deg); position:relative;
  }
  .hallpass::before{
    content:""; position:absolute; top:-10px; left:50%; transform:translateX(-50%);
    width:56px; height:18px; border:3px solid var(--line); border-radius:0 0 40px 40px;
    background:var(--bg); border-top:none;
  }
  .hallpass-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;}
  .hallpass-tag{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.04em;}
  .hallpass h3{font-size:20px; margin-bottom:6px;}
  .hallpass p{font-size:13.5px; font-weight:600; opacity:.85; margin-bottom:16px;}
  .hallpass-body{display:flex; gap:16px; align-items:center; background:rgba(255,255,255,.45); border:2px solid var(--line); border-radius:10px; padding:14px;}
  .qr{width:66px; height:66px; position:relative; background:#fff; border:2px solid var(--line); border-radius:4px; flex-shrink:0;}
  .qr-eye{position:absolute; width:16px; height:16px; border:3.5px solid var(--line);}
  .qr-eye::after{content:""; position:absolute; inset:3.5px; background:var(--line);}
  .qr-eye.tl{top:4px; left:4px;} .qr-eye.tr{top:4px; right:4px;} .qr-eye.bl{bottom:4px; left:4px;}
  .qr i{position:absolute; width:4px; height:4px; background:var(--line); display:block;}
  .hallpass-code{font-family:'IBM Plex Mono',monospace; font-size:12px; line-height:1.7;}
  .hallpass-code b{display:block; font-size:13px;}
  .hallpass-list{list-style:none; margin:14px 0 0; padding:0; font-family:'IBM Plex Mono',monospace; font-size:12px; display:flex; flex-direction:column; gap:5px;}
  .hallpass-list li::before{content:"— "; font-weight:700;}

  /* --- section headers --- */
  .sec-head{max-width:640px; margin-bottom:56px;}
  .sec-head .eyebrow{margin-bottom:18px;}
  .sec-head h2{font-size:clamp(26px,3.4vw,38px); margin-top:0;}
  .sec-head p{color:var(--text-soft); margin-top:14px; font-size:16px;}

  /* --- role ID cards --- */
  .roles-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:22px;}
  .role-card{border-radius:16px; padding:22px; position:relative;}
  .role-card:nth-child(1){transform:rotate(-1.4deg);}
  .role-card:nth-child(2){transform:rotate(1deg);}
  .role-card:nth-child(3){transform:rotate(-.8deg);}
  .role-card:nth-child(4){transform:rotate(1.3deg);}
  .role-badge{
    width:44px; height:44px; border:3px solid var(--line); border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:14px;
  }
  .role-card h3{font-size:19px; margin-bottom:8px;}
  .role-card p{font-size:14px; color:inherit; margin-bottom:14px;}
  .role-tag{
    position:absolute; top:16px; right:16px; font-family:'IBM Plex Mono',monospace;
    font-size:10px; font-weight:700; text-transform:uppercase; padding:3px 8px;
    border:2px solid var(--line); border-radius:5px;
    /* Use the page background (var(--bg)) so the tag is readable on any card color */
    background:var(--bg); color:var(--text);
  }
  .role-list{list-style:none; margin:0; padding:0; font-size:13px; display:flex; flex-direction:column; gap:7px;}
  .role-list li{padding-left:16px; position:relative;}
  .role-list li::before{content:"\\2713"; position:absolute; left:0; font-weight:800;}

  /* --- how it works: ticket strip --- */
  .steps{display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:3px solid var(--line); border-radius:16px; overflow:hidden; box-shadow:6px 6px 0 var(--shadow);}
  .step{padding:26px 22px; background:var(--surface); position:relative; border-right:3px dashed var(--line);}
  .step:last-child{border-right:none;}
  .step-no{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:13px; color:var(--text-soft);}
  .step h3{font-size:16px; margin:12px 0 8px;}
  .step p{font-size:13.5px; color:var(--text-soft);}

  /* --- why section --- */
  .why-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:22px;}
  .why-card{border-radius:14px; padding:24px;}
  .why-num{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:13px; color:var(--text-soft); margin-bottom:10px;}
  .why-card h3{font-size:18px; margin-bottom:10px;}
  .why-card p{font-size:14px; color:var(--text-soft);}

  /* --- features corkboard --- */
  .features-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:18px;}
  .feature-card{border-radius:12px; padding:20px;}
  .feature-icon{
    width:38px; height:38px; border:2.5px solid var(--line); border-radius:9px;
    display:flex; align-items:center; justify-content:center; font-size:18px; margin-bottom:12px;
  }
  .feature-card h3{font-size:15.5px; margin-bottom:6px;}
  .feature-card p{font-size:13.5px; color:var(--text-soft);}

  /* --- final CTA --- */
  .cta-band{
    border-radius:20px; padding:52px 40px; background:var(--green); color:var(--green-ink);
    border:3px solid var(--line); box-shadow:9px 9px 0 var(--shadow);
    display:flex; justify-content:space-between; align-items:center; gap:30px; flex-wrap:wrap;
  }
  .cta-band h2{font-size:clamp(24px,3.2vw,34px); max-width:20ch;}
  .cta-band p{margin-top:10px; font-weight:600; opacity:.85; font-size:15px;}
  .cta-band .btn{background:var(--bg); color:var(--text);}

  footer{border-top:3px solid var(--line); padding:34px 0; margin-top:40px;}
  .foot-row{display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; font-size:13px; color:var(--text-soft);}
  .foot-links{display:flex; gap:18px;}
  .foot-links a{text-decoration:none; font-weight:600;}
  .foot-logo{display:flex; align-items:center; gap:8px; font-weight:800; color:var(--text);}

  @media(max-width:920px){
    .hero-grid{grid-template-columns:1fr;}
    .roles-grid{grid-template-columns:repeat(2,1fr);}
    .steps{grid-template-columns:repeat(2,1fr);}
    .step{border-right:none; border-bottom:3px dashed var(--line);}
    .step:nth-child(2){border-right:none;}
    .why-grid{grid-template-columns:1fr;}
    .features-grid{grid-template-columns:repeat(2,1fr);}
  }
  @media(max-width:560px){
    .roles-grid{grid-template-columns:1fr;}
    .steps{grid-template-columns:1fr;}
    .features-grid{grid-template-columns:1fr;}
    section{padding:56px 0;}
    .cta-band{padding:34px 24px;}
  }

  @media (prefers-reduced-motion: no-preference){
    .fade-up{animation:fadeUp .6s ease both;}
    .fade-up.d1{animation-delay:.08s;}
    .fade-up.d2{animation-delay:.16s;}
    @keyframes fadeUp{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);}}
  }
`;
