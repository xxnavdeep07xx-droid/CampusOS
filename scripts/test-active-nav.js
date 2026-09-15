// Standalone test of the activeHref logic from responsive-sidebar.tsx
// Run: node /home/z/my-project/scripts/test-active-nav.js

const teacherNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/teacher", label: "My Classes" },
  { href: "/dashboard/teacher/schedule", label: "My Schedule" },
  { href: "/dashboard/teacher/leave", label: "Leave Requests" },
  { href: "/dashboard/students", label: "My Students" },
];

const principalNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/staff", label: "Staff & Teachers" },
  { href: "/dashboard/classes", label: "All Classes" },
  { href: "/dashboard/admin/fees", label: "Fees" },
  { href: "/dashboard/admin/notices", label: "Notices" },
  { href: "/dashboard/admin/library", label: "Library" },
  { href: "/dashboard/admin/hr", label: "HR / Leave" },
  { href: "/dashboard/admin/transport", label: "Transport" },
  { href: "/dashboard/teacher/schedule", label: "School Schedule" },
];

const studentNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/classes", label: "My Class" },
  { href: "/dashboard/library", label: "Library" },
  { href: "/dashboard/transport", label: "Transport" },
  { href: "/dashboard/attendance", label: "My Attendance" },
  { href: "/dashboard/schedule", label: "My Schedule" },
  { href: "/dashboard/grades", label: "My Grades" },
];

function calcActive(pathname, nav) {
  let best = "";
  for (const item of nav) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

function testNav(navName, nav) {
  console.log(`\n=== ${navName} ===`);
  const testPaths = [
    "/dashboard",
    ...nav.map(n => n.href).filter(h => h !== "/dashboard"),
    "/dashboard/teacher/abc-123-id",  // detail page
    "/dashboard/admin/fees/xyz",     // admin detail page
    "/dashboard/unknown-route",      // unknown
  ];

  let allPassed = true;
  for (const path of testPaths) {
    const active = calcActive(path, nav);
    const activeLabel = nav.find(n => n.href === active)?.label ?? "(none)";
    const allMatches = nav.filter(n => n.href === active);
    const pass = allMatches.length === 1;
    if (!pass) allPassed = false;
    console.log(`  ${pass ? "✓" : "✗"} ${path.padEnd(40)} → ${activeLabel} (${allMatches.length} matches)`);
  }
  return allPassed;
}

let allPassed = true;
allPassed = testNav("Teacher", teacherNav) && allPassed;
allPassed = testNav("Principal", principalNav) && allPassed;
allPassed = testNav("Student", studentNav) && allPassed;

console.log("\n" + (allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"));
process.exit(allPassed ? 0 : 1);
