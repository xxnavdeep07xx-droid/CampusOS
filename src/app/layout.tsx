import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
