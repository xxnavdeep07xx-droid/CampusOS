import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { SplashScreen } from "@/components/brutal/splash-screen";
import { cookies } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CampusOS — All-in-one School Management Platform",
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
      className={isDark ? "dark" : ""}
    >
      <head>
        <meta name="google-site-verification" content="KgDwrre-cXnz-BAH9zn9VQ3xgA0irhwZwgrGMt9x4P4" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <SplashScreen />
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
