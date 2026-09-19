"use client";

import { useEffect, useRef } from "react";

/**
 * InteractiveGrid — a subtle dot graph that covers the FULL viewport
 * (position: fixed). Dots near the cursor light up in the accent green
 * color, creating an interactive "proximity spotlight."
 *
 * This replaces the previous square grid. The dot pattern matches the
 * reference image: small circular dots in a regular grid, with a
 * localized cluster of brighter dots near the cursor.
 *
 * Implementation:
 *   - position: fixed; inset: 0; → covers the full viewport at all times
 *     (stays put during scroll, so the graph is always visible behind
 *     whatever section the user is looking at)
 *   - Two layers:
 *       ::before = base layer, faint dots everywhere
 *       ::after  = spotlight, green dots near cursor (radial gradient
 *                  masked to the dot pattern)
 *   - Mouse position tracked via window mousemove → CSS vars (--mx, --my)
 *   - pointer-events: none so it never blocks any clicks anywhere
 *   - z-index: 0 (behind all page content which is z-index ≥ 1)
 *   - Respects prefers-reduced-motion and hover: none (touch devices)
 *
 * Performance: mask + gradient approach — no JS per frame, no DOM nodes
 * per dot. The browser's compositor handles everything natively.
 */
export function InteractiveGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Only track mouse on devices that have hover (not touch)
    // and when the user doesn't prefer reduced motion
    const hasHover = window.matchMedia("(hover: hover)").matches;
    if (reduceMotion || !hasHover) return;

    function onMove(e: MouseEvent) {
      // Fixed position → viewport coordinates = mouse client coordinates
      el.style.setProperty("--mx", e.clientX + "px");
      el.style.setProperty("--my", e.clientY + "px");
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className="interactive-graph" aria-hidden="true">
      <style>{`
        .interactive-graph {
          /* Dot mask: a small solid circle at the center of each 20×20 tile.
             Used as mask-image so only the dot pixels are visible.
             Black = opaque (visible), transparent = hidden.
             Circle radius ~1.8px, centered at (10,10) in the tile. */
          --dot-mask: radial-gradient(circle 1.8px at 10px 10px, #000 100%, transparent 100%);

          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 0;
          pointer-events: none;

          /* Cursor position (default: off-screen so no spotlight on load) */
          --mx: -9999px;
          --my: -9999px;
        }

        /* Base layer: faint dots everywhere.
           Uses radial-gradient as background directly (no mask needed —
           the gradient itself creates the dot pattern with transparent
           gaps between dots). */
        .interactive-graph::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle 1.8px at 10px 10px,
            var(--line, #15171E) 100%,
            transparent 100%
          );
          background-size: 20px 20px;
          background-position: 0 0;
          opacity: 0.12;
        }

        /* Spotlight layer: green dots near the cursor.
           A radial-gradient provides smooth proximity falloff (bright at
           cursor → transparent at 160px radius). The mask ensures only
           the dot-shaped pixels are visible, so the spotlight appears as
           individual lit dots rather than a glow blob. */
        .interactive-graph::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle 160px at var(--mx) var(--my),
            var(--green, #17B978) 0%,
            transparent 70%
          );
          -webkit-mask-image: var(--dot-mask);
          mask-image: var(--dot-mask);
          -webkit-mask-size: 20px 20px;
          mask-size: 20px 20px;
          -webkit-mask-repeat: repeat;
          mask-repeat: repeat;
          opacity: 0.6;
          /* Smooth transition when mouse leaves the viewport */
          transition: opacity 0.4s ease-out;
        }

        /* Touch devices / reduced motion: hide the spotlight,
           keep just the static base dot grid. */
        @media (prefers-reduced-motion: reduce) {
          .interactive-graph::after { opacity: 0; }
        }
        @media (hover: none) {
          .interactive-graph::after { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
