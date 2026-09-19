"use client";

import { useEffect, useRef } from "react";

/**
 * InteractiveGrid — a math graph-paper style background for the hero
 * section. Thin vertical + horizontal lines form a grid of small
 * squares. Lines near the cursor light up in the accent green color,
 * creating an interactive "proximity spotlight."
 *
 * Visual: classic coordinate graph paper (like a math notebook) —
 * faint grid lines everywhere, with a localized cluster of brighter
 * green lines near the cursor.
 *
 * Scope: hero section ONLY (position: absolute within .hero, which
 * must be position: relative). Not fixed, not full-site.
 *
 * Implementation:
 *   - Two layers, both using dual linear-gradients (one for vertical
 *     lines, one for horizontal lines) at 20px intervals:
 *       ::before = base layer, faint line-colored grid (8% opacity)
 *       ::after  = spotlight, green grid masked by a radial-gradient
 *                  at the cursor position (so only lines near the
 *                  cursor are visible)
 *   - Mouse position tracked via window mousemove → CSS vars (--mx, --my)
 *   - pointer-events: none so it never blocks clicks on hero content
 *   - Respects prefers-reduced-motion and hover: none (touch devices)
 *
 * Performance: gradient + mask approach — no JS per frame, no DOM
 * nodes per line. The browser's compositor handles everything natively.
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
    const hasHover = window.matchMedia("(hover: hover)").matches;
    if (reduceMotion || !hasHover) return;

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
    <div ref={ref} className="hero-graph-bg" aria-hidden="true">
      <style>{`
        .hero-graph-bg {
          /* Cover the parent (.hero) completely */
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;

          /* Cursor position (default: off-screen so no spotlight on load) */
          --mx: -9999px;
          --my: -9999px;

          /* Grid pattern: two linear-gradients (vertical + horizontal lines)
             at 20px intervals, 1px line width — classic math graph paper.
             Both layers share this pattern; the spotlight layer just uses
             a different color and is masked to the cursor area. */
          --grid-lines:
            linear-gradient(90deg, var(--line, #15171E) 1px, transparent 1px),
            linear-gradient(0deg,  var(--line, #15171E) 1px, transparent 1px);
          --grid-size: 20px 20px;
        }

        /* Base layer: faint graph paper lines everywhere. */
        .hero-graph-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: var(--grid-lines);
          background-size: var(--grid-size);
          opacity: 0.08;
        }

        /* Spotlight layer: green lines near the cursor.
           The radial-gradient mask makes only the lines within a 160px
           radius of the cursor visible. Lines further away are hidden. */
        .hero-graph-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, var(--green, #17B978) 1px, transparent 1px),
            linear-gradient(0deg,  var(--green, #17B978) 1px, transparent 1px);
          background-size: var(--grid-size);
          -webkit-mask-image: radial-gradient(
            circle 160px at var(--mx) var(--my),
            #000 0%, transparent 70%
          );
          mask-image: radial-gradient(
            circle 160px at var(--mx) var(--my),
            #000 0%, transparent 70%
          );
          opacity: 0.6;
          transition: opacity 0.4s ease-out;
        }

        /* Touch devices / reduced motion: hide the spotlight,
           keep just the static base grid. */
        @media (prefers-reduced-motion: reduce) {
          .hero-graph-bg::after { opacity: 0; }
        }
        @media (hover: none) {
          .hero-graph-bg::after { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
