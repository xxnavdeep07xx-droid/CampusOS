import { jsPDF } from "jspdf";
import type { Profile, School, GradebookRow } from "@/lib/types";

/**
 * Neo-brutalist PDF Report Card generator.
 *
 * Uses jsPDF's low-level vector drawing API (rect, line, text, setFillColor,
 * setDrawColor) to draw thick black borders + grid lines + bold headers,
 * matching the neo-brutalist design system.
 *
 * Layout (A4 portrait, 595 x 842 pt):
 *
 *   ┌─────────────────────────────────────┐
 *   │ ███ HEADER BAR (black bg, white text) │
 *   │  CampusOS  ·  Report Card 2026       │
 *   ├─────────────────────────────────────┤
 *   │  Student Info box (thick border)     │
 *   │  Name: …  Class: …  Role: Student   │
 *   ├─────────────────────────────────────┤
 *   │  Attendance Summary box              │
 *   │  Attendance Rate: 92%                │
 *   │  Present: 45  Absent: 3  Late: 1    │
 *   ├─────────────────────────────────────┤
 *   │  Grade Summary table (thick grid)    │
 *   │  Assignments | Quizzes | Total %     │
 *   │  85%         | 90%     | 87.5%      │
 *   ├─────────────────────────────────────┤
 *   │  School footer                       │
 *   └─────────────────────────────────────┘
 *
 * Returns a Uint8Array (the PDF bytes) so the API route can stream it.
 */
export function generateReportCardPDF(args: {
  student: Pick<Profile, "id" | "full_name" | "role"> & { class_id?: string | null };
  school: Pick<School, "name">;
  className?: string | null;
  attendanceRate: number | null;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  gradebook: Pick<GradebookRow, "percentage" | "assignment_earned_points" | "assignment_total_points" | "quiz_earned_points" | "quiz_total_points"> | null;
}): Uint8Array {
  const { student, school, className, attendanceRate, presentCount, absentCount, lateCount, gradebook } = args;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595;
  const H = 842;
  const M = 40; // margin
  const BW = W - 2 * M; // body width
  const BLACK: [number, number, number] = [15, 23, 42];
  const WHITE: [number, number, number] = [253, 251, 247];
  const EMERALD: [number, number, number] = [16, 185, 129];
  const AMBER: [number, number, number] = [245, 158, 11];
  const ROSE: [number, number, number] = [251, 113, 133];
  const SKY: [number, number, number] = [56, 189, 248];

  // ---------- Helper functions ----------
  const thickBorder = (x: number, y: number, w: number, h: number) => {
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(3);
    doc.rect(x, y, w, h);
  };

  const fillRect = (x: number, y: number, w: number, h: number, color: [number, number, number]) => {
    doc.setFillColor(...color);
    doc.rect(x, y, w, h, "F");
  };

  const boldText = (text: string, x: number, y: number, size: number, color: [number, number, number] = BLACK) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, y);
  };

  // ---------- Header bar (black bg, white text) ----------
  fillRect(0, 0, W, 80, BLACK);
  // Emerald accent stripe at the bottom of the header.
  fillRect(0, 77, W, 3, EMERALD);
  boldText("CampusOS", M + 4, 38, 28, WHITE);
  boldText("REPORT CARD", W - M - 110, 38, 14, EMERALD);
  boldText(new Date().getFullYear().toString(), W - M - 40, 55, 10, [200, 200, 200]);

  // ---------- Student Info box ----------
  let y = 110;
  thickBorder(M, y, BW, 100);
  boldText("STUDENT INFORMATION", M + 12, y + 22, 9, [100, 100, 100]);

  boldText(student.full_name || "Unknown", M + 12, y + 48, 16);
  const roleLabel = student.role.charAt(0).toUpperCase() + student.role.slice(1);
  boldText(`Role: ${roleLabel}`, M + 12, y + 68, 11, [80, 80, 80]);
  if (className) {
    boldText(`Class: ${className}`, M + 12, y + 85, 11, [80, 80, 80]);
  }
  boldText(`Student ID: ${student.id.slice(0, 8)}…`, M + 280, y + 48, 9, [120, 120, 120]);

  // ---------- Attendance Summary box ----------
  y = 235;
  thickBorder(M, y, BW, 120);
  // Amber accent bar on top.
  fillRect(M, y, BW, 5, AMBER);
  boldText("ATTENDANCE SUMMARY", M + 12, y + 28, 9, [100, 100, 100]);

  // Big percentage.
  const attColor = attendanceRate == null ? [150, 150, 150] : attendanceRate >= 90 ? EMERALD : attendanceRate >= 75 ? AMBER : ROSE;
  if (attendanceRate != null) {
    boldText(`${attendanceRate}%`, M + 12, y + 70, 36, attColor as [number, number, number]);
  } else {
    boldText("—", M + 12, y + 70, 36, [150, 150, 150]);
  }
  boldText("Attendance Rate", M + 12, y + 88, 9, [100, 100, 100]);

  // Breakdown stats (right side).
  const statX = M + 250;
  boldText(`Present: ${presentCount}`, statX, y + 50, 12);
  boldText(`Absent: ${absentCount}`, statX, y + 70, 12, absentCount > 0 ? ROSE : [80, 80, 80]);
  boldText(`Late: ${lateCount}`, statX, y + 90, 12, lateCount > 0 ? AMBER : [80, 80, 80]);

  // ---------- Grade Summary table ----------
  y = 390;
  const tableH = 180;
  thickBorder(M, y, BW, tableH);
  boldText("GRADE SUMMARY", M + 12, y + 22, 9, [100, 100, 100]);

  // Table header row (black bg).
  const hdrY = y + 30;
  const hdrH = 30;
  fillRect(M, hdrY, BW, hdrH, BLACK);
  const colW = BW / 4;
  boldText("Category", M + 10, hdrY + 20, 9, WHITE);
  boldText("Earned", M + colW + 10, hdrY + 20, 9, WHITE);
  boldText("Total", M + 2 * colW + 10, hdrY + 20, 9, WHITE);
  boldText("Percentage", M + 3 * colW + 10, hdrY + 20, 9, WHITE);

  // Grid lines (vertical).
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(1.5);
  for (let i = 1; i < 4; i++) {
    doc.line(M + i * colW, hdrY, M + i * colW, y + tableH);
  }

  // Row 1: Assignments.
  const r1Y = hdrY + hdrH;
  const rH = 35;
  doc.setLineWidth(1.5);
  doc.line(M, r1Y + rH, M + BW, r1Y + rH);

  const aEarned = gradebook?.assignment_earned_points ?? 0;
  const aTotal = gradebook?.assignment_total_points ?? 0;
  const aPct = aTotal > 0 ? Math.round((aEarned / aTotal) * 100) : null;
  boldText("Assignments", M + 10, r1Y + 22, 11);
  boldText(String(aEarned), M + colW + 10, r1Y + 22, 11);
  boldText(String(aTotal), M + 2 * colW + 10, r1Y + 22, 11);
  boldText(aPct == null ? "—" : `${aPct}%`, M + 3 * colW + 10, r1Y + 22, 11, (aPct ?? 0) >= 75 ? EMERALD : ROSE);

  // Row 2: Quizzes.
  const r2Y = r1Y + rH;
  doc.line(M, r2Y + rH, M + BW, r2Y + rH);
  const qEarned = gradebook?.quiz_earned_points ?? 0;
  const qTotal = gradebook?.quiz_total_points ?? 0;
  const qPct = qTotal > 0 ? Math.round((qEarned / qTotal) * 100) : null;
  boldText("Quizzes", M + 10, r2Y + 22, 11);
  boldText(String(qEarned), M + colW + 10, r2Y + 22, 11);
  boldText(String(qTotal), M + 2 * colW + 10, r2Y + 22, 11);
  boldText(qPct == null ? "—" : `${qPct}%`, M + 3 * colW + 10, r2Y + 22, 11, (qPct ?? 0) >= 75 ? EMERALD : ROSE);

  // Row 3: Overall.
  const r3Y = r2Y + rH;
  fillRect(M, r3Y, BW, rH, [253, 251, 247]);
  const oPct = gradebook?.percentage;
  boldText("OVERALL", M + 10, r3Y + 22, 12);
  boldText("", M + colW + 10, r3Y + 22, 11);
  boldText("", M + 2 * colW + 10, r3Y + 22, 11);
  const overallColor = oPct == null ? [150, 150, 150] : oPct >= 90 ? EMERALD : oPct >= 75 ? AMBER : oPct >= 50 ? SKY : ROSE;
  boldText(oPct == null ? "No grades" : `${oPct}%`, M + 3 * colW + 10, r3Y + 22, 14, overallColor as [number, number, number]);

  // ---------- Footer ----------
  y = H - 60;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(2);
  doc.line(M, y, W - M, y);
  boldText(school.name || "Your School", M, y + 20, 10, [80, 80, 80]);
  boldText(`Generated on ${new Date().toLocaleDateString()}`, W - M - 180, y + 20, 8, [120, 120, 120]);
  boldText("CampusOS · Phase 8 Report Card Engine", M, y + 36, 7, [150, 150, 150]);

  return doc.output("arraybuffer") as Uint8Array;
}
