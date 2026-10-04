"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";

/**
 * SplashScreen — branded flash screen shown on first load.
 *
 * Shows the CampusOS logo with a subtle pulse animation for 1.8 seconds,
 * then fades out. Rendered at the root layout level so it covers the
 * entire viewport before the app content appears.
 *
 * Uses sessionStorage so it only shows once per browser session (not
 * on every navigation). The "have we shown it already?" flag is read
 * through useSyncExternalStore so the value is available during render
 * (no flash of the splash on subsequent navigations).
 */
const subscribe = () => () => {};
const getAlreadyShown = () => {
  try {
    return sessionStorage.getItem("splashShown") === "1";
  } catch {
    return false;
  }
};
const getServerAlreadyShown = () => false;

export function SplashScreen() {
  const alreadyShown = useSyncExternalStore(
    subscribe,
    getAlreadyShown,
    getServerAlreadyShown
  );
  const [fadeOut, setFadeOut] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (alreadyShown) return;
    // Start fade-out after 1.5s, then unmount after the 300ms transition.
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    const removeTimer = setTimeout(() => {
      try {
        sessionStorage.setItem("splashShown", "1");
      } catch {
        /* private mode — splash simply shows again next load */
      }
      setDone(true);
    }, 1800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [alreadyShown]);

  if (alreadyShown || done) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt="CampusOS"
          width={96}
          height={96}
          priority
          className="animate-pulse rounded-2xl border-2 border-[#FDFBF7]/20"
        />
        <div className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#FDFBF7]/70">
          CampusOS
        </div>
      </div>
    </div>
  );
}
