import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

// Self-hosted display + mono faces (no runtime Google Fonts dependency, so
// builds are hermetic and there is no third-party request on first paint).
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/archivo/900.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { SplashScreen } from "@/components/brutal/splash-screen";
import { cookies } from "next/headers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1115" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CampusOS — All-in-one School Management Platform",
    template: "%s · CampusOS",
  },
  description:
    "Invite-based multi-tenant school/college management platform. Principals register their school, invite staff & teachers. Teachers create classes, invite students. One OS for your whole campus.",
  keywords: [
    "CampusOS",
    "school management",
    "college management",
    "LMS",
    "SIS",
    "Next.js",
    "Supabase",
    "neo-brutalism",
  ],
  authors: [{ name: "CampusOS Team" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "CampusOS",
    description: "All-in-one school management platform with invite-based onboarding.",
    siteName: "CampusOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CampusOS",
    description: "All-in-one school management platform with invite-based onboarding.",
  },
  // Rendered only when the token is provided (keeps the value out of source).
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

/**
 * Inline script that runs BEFORE hydration to set the theme class on <html>.
 * This prevents a flash of the wrong theme (FOUC) on first paint.
 *
 * Reads from (in order):
 *   1. localStorage 'theme' key (set by the ThemeToggle component)
 *   2. OS preference (prefers-color-scheme)
 *
 * The cookie is also set by ThemeToggle so the server can read it, but
 * this script is the primary mechanism — it's synchronous + runs before
 * React hydrates.
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (!stored && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the theme cookie server-side (best-effort — the inline script
  // is the authoritative source, this just helps with SSR consistency).
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const isDark = themeCookie === "dark";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${isDark ? "dark" : ""}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <SplashScreen />
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
