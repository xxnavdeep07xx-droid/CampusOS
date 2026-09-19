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
          /* Break out of the .wrap container (max-width: 1180px) so the
             grid spans the full viewport width. Standard CSS technique:
             position relative to the hero (which is position: relative),
             then offset left:50% and translateX(-50%) to center, with
             width: 100vw to span the full viewport.
             inset:0 vertically (top/bottom) keeps it filling the hero height. */
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100vw;
          z-index: 0;
          pointer-events: none;

          /* Cursor position (default: off-screen so no spotlight on load) */
          --mx: -9999px;
          --my: -9999px;

          /* Grid pattern: two linear-gradients (vertical + horizontal lines)
             at 20px intervals. Lines are 1px thick — classic math graph
             paper. The 1px lines at 25% opacity are clearly visible as
             distinct grid lines (not just a tint). */
          --grid-lines:
            linear-gradient(90deg, var(--line, #15171E) 1px, transparent 1px),
            linear-gradient(0deg,  var(--line, #15171E) 1px, transparent 1px);
          --grid-size: 20px 20px;
        }

        /* Base layer: graph paper lines everywhere.
           Opacity tuned to be clearly visible in BOTH light and dark
           modes. In dark mode, --line becomes #F5F3EA (light cream) on
           a #101218 (near-black) background. In light mode, --line is
           #15171E (near-black) on #FFFDF7 (cream). */
        .hero-graph-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: var(--grid-lines);
          background-size: var(--grid-size);
          opacity: 0.35;
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
