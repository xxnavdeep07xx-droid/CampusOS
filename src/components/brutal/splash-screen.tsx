"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * SplashScreen — branded flash screen shown on first load.
 *
 * Shows the CampusOS logo with a subtle pulse animation for 1.8 seconds,
 * then fades out. Rendered at the root layout level so it covers the
 * entire viewport before the app content appears.
 *
 * Uses sessionStorage so it only shows once per browser session (not
 * on every navigation).
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Skip if already shown this session
    if (sessionStorage.getItem("splashShown")) {
      setVisible(false);
      return;
    }

    // Start fade-out after 1.5s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    // Remove from DOM after fade completes (300ms transition)
    const removeTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("splashShown", "1");
    }, 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Subtle dot pattern background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(#FDFBF7 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Logo with pulse animation */}
      <div className="relative flex flex-col items-center gap-4">
        <div className="animate-splash-pulse">
          <Image
            src="/logo.png"
            alt="CampusOS"
            width={96}
            height={96}
            className="rounded-2xl border-2 border-[#FDFBF7]/20 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
            priority
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl font-black uppercase tracking-tight text-[#FDFBF7]">
            Campus
          </span>
          <span className="text-xl font-black uppercase tracking-tight text-emerald-400">
            OS
          </span>
        </div>
        {/* Loading dots */}
        <div className="flex gap-1.5">
          <span
            className="size-2 animate-bounce rounded-full bg-emerald-400"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="size-2 animate-bounce rounded-full bg-emerald-400"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="size-2 animate-bounce rounded-full bg-emerald-400"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>

      {/* Animation keyframes */}
      <style jsx>{`
        @keyframes splash-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
        .animate-splash-pulse {
          animation: splash-pulse 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-splash-pulse {
            animation: none;
          }
          .animate-bounce {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
