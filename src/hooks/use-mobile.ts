"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// Server snapshot: assume desktop — the sidebar only needs the value after
// hydration, and returning a stable value keeps the HTML deterministic.
const getServerSnapshot = () => false;

/**
 * useIsMobile — true when the viewport is narrower than 768px.
 *
 * Reads matchMedia through useSyncExternalStore so the value is always in
 * sync with the browser (no set-state-in-effect, no first-paint mismatch).
 */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    getServerSnapshot
  );
}
