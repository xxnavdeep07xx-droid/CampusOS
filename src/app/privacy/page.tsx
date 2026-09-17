import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — CampusOS",
  description: "How CampusOS collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500">Last updated: September 17, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Introduction</h2>
            <p>
              CampusOS (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a school
              management platform that helps teachers, students, administrators, and parents
              communicate and manage academic activities. This Privacy Policy explains how we
              collect, use, and protect your personal information when you use our platform at
              campusos-smoky.vercel.app.
            </p>
            <p>
              By creating an account or using CampusOS, you agree to the data practices described
              in this policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Account information:</strong> Your name, email address, and role
                (teacher, student, principal, staff, or parent) when you register.
              </li>
              <li>
                <strong>Profile information:</strong> Parent/guardian contact details (for
                students), behavioral notes, and other information you voluntarily provide.
              </li>
              <li>
                <strong>Academic data:</strong> Classes, assignments, attendance records,
                grades, quiz results, lesson plans, and behavior incident logs created within
                the platform.
              </li>
              <li>
                <strong>Files:</strong> Documents, presentations, and other files you upload
                to class resources, your personal drive, or submit as assignments.
              </li>
              <li>
                <strong>Google Drive data:</strong> If you connect your Google Drive, we
                access file names, types, and metadata to display your files within CampusOS.
                We do <strong>not</strong> modify or delete files in your Google Drive. We only
                read file metadata and download files you choose to import into class resources.
              </li>
              <li>
                <strong>Usage data:</strong> Log data, device information, and usage patterns
                collected automatically when you use the platform.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Provide and maintain the CampusOS platform</li>
              <li>Facilitate communication between teachers, students, and parents</li>
              <li>Store and organize academic materials, assignments, and grades</li>
              <li>Enable Google Drive integration (file browsing and import)</li>
              <li>Send notifications about submissions, messages, and announcements</li>
              <li>Improve and develop new features</li>
              <li>Ensure platform security and prevent misuse</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Data Storage and Security</h2>
            <p>
              Your data is stored in Supabase (a PostgreSQL database hosted in Mumbai, India)
              with row-level security (RLS) policies that ensure users can only access data they
              are authorized to see. File uploads are stored in Supabase Storage buckets.
            </p>
            <p>
              Google Drive OAuth tokens (access token + refresh token) are stored encrypted in
              our database and are only used to read file metadata and download files you choose
              to import. We never share these tokens with third parties.
            </p>
            <p>
              We use HTTPS encryption for all data in transit. Access to the database and storage
              is controlled via role-based permissions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. Data Sharing</h2>
            <p>
              We do <strong>not</strong> sell, rent, or trade your personal data. Your information
              is shared only:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>With other users in your school who have authorized access (e.g., your teacher can see your attendance)</li>
              <li>With Google when you connect your Google Drive (Google&rsquo;s privacy policy applies)</li>
              <li>When required by law or to protect our legal rights</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Disconnect your Google Drive at any time (tokens are deleted immediately)</li>
              <li>Export your data (assignments, grades, attendance via CSV export)</li>
            </ul>
            <p>
              To exercise these rights, contact your school administrator or email us at the
              address provided by your school.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. Google Drive Integration</h2>
            <p>
              When you connect your Google Drive, CampusOS requests the following scopes:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">drive.file</code> —
                Read access to file metadata and the ability to download files you choose to
                import. We do <strong>not</strong> create, edit, or delete files in your Drive.
              </li>
              <li>
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">userinfo.email</code> —
                Your Google email address (for display purposes).
              </li>
              <li>
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">userinfo.profile</code> —
                Your Google profile name and photo (for display purposes).
              </li>
            </ul>
            <p>
              You can disconnect your Google Drive at any time from the Drive page. Disconnecting
              immediately deletes your OAuth tokens from our database.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Children&rsquo;s Privacy</h2>
            <p>
              CampusOS is designed for use by schools and educational institutions. Student data
              is only accessible to authorized teachers, administrators, and the student&rsquo;s
              parents. We do not collect data from students under 13 without school and parental
              consent as provided through the school&rsquo;s registration process.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes by posting a notice within the platform. Continued use after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">10. Contact</h2>
            <p>
              For questions about this Privacy Policy or your data, contact your school
              administrator or the platform operator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
