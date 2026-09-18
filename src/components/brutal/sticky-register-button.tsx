"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/brutal/reveal";

/**
 * StickyRegisterButton — a compact "Register your school" pill that
 * floats below the header and fades in only after the user has
 * scrolled past the hero section.
 *
 * Behaviour:
 *   - Listens to `window.scroll` (throttled via rAF) and toggles
 *     visibility based on whether the hero is still in view.
 *   - The hero is located via `[data-hero-section]` so we don't depend
 *     on a magic pixel offset.
 *   - Respects `prefers-reduced-motion`: when set, the button appears
 *     immediately with no slide-in transition.
 */
export function StickyRegisterButton() {
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Derive visibility during render. Reduced-motion users always see the
  // button — never gated behind scroll.
  const visible = reduced || scrolledPastHero;

  useEffect(() => {
    // Reduced motion: nothing to listen for; `visible` is already true.
    if (reduced) return;

    const hero =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>("[data-hero-section]")
        : null;

    let ticking = false;
    const update = () => {
      ticking = false;
      if (!hero) {
        // Fallback: show after ~600px of scroll.
        setScrolledPastHero(window.scrollY > 600);
        return;
      }
      const rect = hero.getBoundingClientRect();
      // Show once the bottom of the hero has scrolled above the
      // top of the viewport (i.e. the hero is fully off-screen).
      setScrolledPastHero(rect.bottom < 0);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <div
      className={cn(
        // Always mounted; visibility is CSS-driven to keep transitions smooth.
        "sticky-cta fixed right-4 top-4 z-50 md:right-6 md:top-6",
        visible ? "" : "sticky-cta-hidden",
      )}
      aria-hidden={!visible}
    >
      <Button variant="emerald" size="sm" asChild className="shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <Link href="/register/principal" tabIndex={visible ? 0 : -1}>
          Register
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
