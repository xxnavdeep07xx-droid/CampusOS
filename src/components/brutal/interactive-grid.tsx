"use client";

import { useEffect, useRef } from "react";

/**
 * InteractiveGrid — a subtle grid of small squares that fills the hero
 * section background. Squares near the cursor light up in the accent
 * (green) color, creating an interactive "proximity" effect.
 *
 * Implementation:
 *   - Two layers, both using the same SVG mask (a grid of 4×4px squares
 *     at 20px intervals):
 *       ::before = base layer, faint line-colored squares (8% opacity)
 *       ::after  = spotlight layer, green radial-gradient at cursor pos
 *   - Mouse position tracked via window mousemove → CSS vars (--mx, --my)
 *   - The radial-gradient does the proximity falloff natively (no per-square
 *     JS calculation needed — the mask handles which pixels are visible)
 *   - Pure CSS animation, no requestAnimationFrame loop needed
 *   - pointer-events: none so it never blocks clicks on hero content
 *   - Respects prefers-reduced-motion (spotlight disabled, static grid only)
 *
 * Performance: the mask + gradient approach means the browser handles
 * everything in its compositor — no JS per frame, no DOM nodes per square.
 * Smooth on any device.
 */
export function InteractiveGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Only track mouse if the user doesn't prefer reduced motion
    if (reduceMotion) return;

    function onMove(e: MouseEvent) {
      const rect = parent.getBoundingClientRect();
      // Only update when the hero is at least partially in view
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      el.style.setProperty("--mx", e.clientX - rect.left + "px");
      el.style.setProperty("--my", e.clientY - rect.top + "px");
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className="hero-grid-bg" aria-hidden="true">
      <style>{`
        .hero-grid-bg {
          /* SVG mask: a 4×4px white square at (8,8) in a 20×20px cell.
             When used as mask-image, only the white squares are visible;
             the transparent areas are hidden. This creates a grid of
             small filled squares with gaps between them.
             URL-encoded for use as a data: URL in CSS. */
          --grid-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect x='8' y='8' width='4' height='4' fill='white'/%3E%3C/svg%3E");

          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;

          /* Cursor position (default: off-screen so no spotlight on load) */
          --mx: -9999px;
          --my: -9999px;
        }

        /* Base layer: faint line-colored squares everywhere.
           Uses ::before so its opacity doesn't affect ::after. */
        .hero-grid-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background-color: var(--line, #15171E);
          -webkit-mask-image: var(--grid-mask);
          mask-image: var(--grid-mask);
          /* Repeat the mask pattern to fill the entire element */
          -webkit-mask-size: 20px 20px;
          mask-size: 20px 20px;
          -webkit-mask-repeat: repeat;
          mask-repeat: repeat;
          opacity: 0.08;
        }

        /* Spotlight layer: green squares near the cursor.
           The radial-gradient provides smooth proximity falloff —
           squares near the cursor are bright green, fading to
           transparent at 140px radius. The mask ensures only the
           square-shaped pixels are visible (not the full gradient). */
        .hero-grid-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle 140px at var(--mx) var(--my),
            var(--green, #17B978) 0%,
            transparent 70%
          );
          -webkit-mask-image: var(--grid-mask);
          mask-image: var(--grid-mask);
          -webkit-mask-size: 20px 20px;
          mask-size: 20px 20px;
          -webkit-mask-repeat: repeat;
          mask-repeat: repeat;
          opacity: 0.55;
          /* Smooth transition when mouse leaves (spotlight fades out) */
          transition: opacity 0.4s ease-out;
        }

        /* On touch devices / reduced motion: hide the spotlight,
           keep just the static base grid. */
        @media (prefers-reduced-motion: reduce) {
          .hero-grid-bg::after {
            opacity: 0;
          }
        }
        @media (hover: none) {
          .hero-grid-bg::after {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
