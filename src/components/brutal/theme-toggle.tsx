"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle — switches between light and dark mode.
 *
 * Persists the preference in localStorage + a cookie (so the server can
 * read it on the next request to prevent a flash of wrong theme).
 *
 * The actual dark class is toggled on <html> by the inline script in
 * layout.tsx (which runs before hydration). This component just updates
 * localStorage + the class + the cookie.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // On mount, read the current theme from the <html> class.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Persist to localStorage (for the inline script on next load).
    localStorage.setItem("theme", next ? "dark" : "light");
    // Also set a cookie so the server can read it (SSR without flash).
    document.cookie = `theme=${next ? "dark" : "light"};path=/;max-age=31536000;same-site=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2 rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FDFBF7] transition-all hover:border-amber-400 hover:bg-slate-700"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <>
          <Sun className="size-4" strokeWidth={2.5} />
          Light
        </>
      ) : (
        <>
          <Moon className="size-4" strokeWidth={2.5} />
          Dark
        </>
      )}
    </button>
  );
}
