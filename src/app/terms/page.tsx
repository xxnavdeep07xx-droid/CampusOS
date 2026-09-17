import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — CampusOS",
  description: "The terms and conditions for using CampusOS.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">Last updated: September 17, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using CampusOS (&ldquo;the Service&rdquo;), you agree
              to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
            <p>
              The Service is provided to schools, teachers, students, and parents for
              educational management purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. Description of Service</h2>
            <p>CampusOS provides:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Class management and student enrollment</li>
              <li>Assignment creation, submission, and grading</li>
              <li>Attendance tracking with bulk actions</li>
              <li>Gradebook with at-risk filtering</li>
              <li>Student 360° profiles with behavior logging</li>
              <li>Lesson planning and syllabus tracking</li>
              <li>Personal teacher drive (file storage)</li>
              <li>Google Drive integration (file browsing and import)</li>
              <li>Direct messaging and group chats</li>
              <li>Announcements with meeting link support</li>
              <li>Notifications and unified calendar</li>
              <li>Digital whiteboard with persistent boards</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. User Accounts</h2>
            <p>
              Accounts are created via invite-based registration. Your school administrator or
              teacher sends you an invite link. You must provide accurate information during
              registration.
            </p>
            <p>
              You are responsible for maintaining the security of your account and password.
              CampusOS is not liable for any damages or losses from unauthorized account access.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload viruses, malware, or malicious code</li>
              <li>Harass, abuse, or bully other users</li>
              <li>Share your account credentials with others</li>
              <li>Attempt to access data you are not authorized to view</li>
              <li>Use the Service to spam or send unsolicited messages</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Upload copyrighted material you do not have rights to</li>
            </ul>
            <p>
              Violations may result in account suspension or termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. Google Drive Integration</h2>
            <p>
              When you connect your Google Drive, CampusOS accesses your file metadata (file
              names, types, modification dates) to display them within the platform. Files you
              choose to import are downloaded and copied to CampusOS storage.
            </p>
            <p>
              CampusOS does <strong>not</strong>:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Modify or delete files in your Google Drive</li>
              <li>Upload new files to your Google Drive</li>
              <li>Share your Google Drive files with third parties</li>
              <li>Store your Google password (OAuth tokens only, which can be revoked at any time)</li>
            </ul>
            <p>
              You can disconnect your Google Drive at any time. You can also revoke CampusOS&rsquo;s
              access at <a href="https://myaccount.google.com/permissions" className="text-sky-600 underline" target="_blank" rel="noopener noreferrer">Google Account Permissions</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Intellectual Property</h2>
            <p>
              You retain ownership of all content you upload to CampusOS (files, assignments,
              messages, etc.). By uploading, you grant CampusOS a license to store, display, and
              process your content as needed to provide the Service.
            </p>
            <p>
              The CampusOS software, branding, and design are owned by their respective
              creators. You may not copy, modify, or distribute the CampusOS software without
              permission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. Data Retention and Deletion</h2>
            <p>
              Your data is retained for as long as your account is active. When your account is
              deleted (by you or your school administrator), your associated data is deleted
              within 30 days, including:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Profile information and role assignments</li>
              <li>Uploaded files in storage buckets</li>
              <li>Messages, announcements, and notifications</li>
              <li>Google Drive OAuth tokens (deleted immediately on disconnect)</li>
            </ul>
            <p>
              Some data (attendance records, grades, behavior incidents) may be retained by your
              school for institutional record-keeping purposes as required by local regulations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Disclaimer of Warranties</h2>
            <p>
              CampusOS is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, express or implied. We do not guarantee that the Service
              will be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Limitation of Liability</h2>
            <p>
              CampusOS is not liable for any indirect, incidental, special, or consequential
              damages arising from the use of the Service. Our total liability shall not exceed
              the amount paid for the Service in the 12 months preceding the claim.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">10. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. We will notify users of
              significant changes by posting a notice within the platform. Continued use after
              changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">11. Contact</h2>
            <p>
              For questions about these Terms, contact your school administrator or the platform
              operator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
