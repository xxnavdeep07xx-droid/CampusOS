"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HallPassCard — ID card that drops down from above on page load,
 * hanging from a lanyard strap with a metal clip.
 *
 * Animation: card starts above the viewport (translateY: -400px), then
 * drops down with a bounce (spring physics) to its resting position.
 * The lanyard strap is visible above the card, connecting to a clip.
 *
 * The card also has a subtle idle sway animation.
 */
export function HallPassCard() {
  const [dropProgress, setDropProgress] = useState(0);
  const [sway, setSway] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Drop animation: 1.2s with bounce easing
    const DROP_DURATION = 1200;
    const SWAY_START = 1300; // start swaying after drop settles

    function animate(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      // Drop phase: 0 → 1 over DROP_DURATION
      if (elapsed < DROP_DURATION) {
        const t = elapsed / DROP_DURATION;
        // Ease out with overshoot (bounce)
        const eased = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2.5);
        setDropProgress(Math.min(eased, 1));
      } else {
        setDropProgress(1);
      }

      // Sway phase: gentle pendulum after drop settles
      if (elapsed > SWAY_START) {
        const swayTime = (elapsed - SWAY_START) / 1000;
        const swayAngle = Math.sin(swayTime * 0.8) * 2.5; // ±2.5deg
        setSway(swayAngle);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Translate from -400px (above viewport) to 0 (resting position)
  const translateY = -400 * (1 - dropProgress);
  const rotate = sway;

  return (
    <div className="hallpass-wrap">
      {/* Lanyard strap — visible above the card */}
      <div className="lanyard" />

      {/* Metal clip connecting lanyard to card */}
      <div className="lanyard-clip" />

      {/* The card itself */}
      <div
        className="hallpass"
        style={{
          transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
          transformOrigin: "top center",
        }}
      >
        {/* Hole at the top of the card (where clip attaches) */}
        <div className="hallpass-hole" />

        <div className="hallpass-head">
          <span className="hallpass-tag">Staff invite</span>
          <span className="hallpass-tag">No. 0042</span>
        </div>
        <h3>Hall Pass</h3>
        <p>Scan to join — role and school are filled in for you.</p>
        <div className="hallpass-body">
          <div className="qr">
            <div className="qr-eye tl" />
            <div className="qr-eye tr" />
            <div className="qr-eye bl" />
            <i style={{ top: "8px", left: "34px" }} />
            <i style={{ top: "16px", left: "42px" }} />
            <i style={{ top: "24px", left: "30px" }} />
            <i style={{ top: "34px", left: "46px" }} />
            <i style={{ top: "42px", left: "36px" }} />
            <i style={{ top: "44px", left: "8px" }} />
            <i style={{ top: "34px", left: "22px" }} />
            <i style={{ top: "26px", left: "44px" }} />
          </div>
          <div className="hallpass-code">
            <b>/register/teacher</b>
            ?token=7F3-91C
            <br />
            one-time use
          </div>
        </div>
        <ul className="hallpass-list">
          <li>Role auto-assigned</li>
          <li>School auto-linked</li>
          <li>Expires after first scan</li>
        </ul>
      </div>

      <style>{`
        .hallpass-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: visible;
        }

        /* Lanyard strap — a vertical strip above the card */
        .lanyard {
          width: 36px;
          height: 60px;
          background: repeating-linear-gradient(
            180deg,
            #2a2a2a 0px,
            #2a2a2a 3px,
            #1a1a1a 3px,
            #1a1a1a 6px
          );
          border-left: 2px solid var(--line, #15171E);
          border-right: 2px solid var(--line, #15171E);
          border-radius: 2px 2px 0 0;
          position: relative;
          z-index: 1;
        }

        /* Metal clip — silver rectangle between lanyard and card */
        .lanyard-clip {
          width: 16px;
          height: 22px;
          background: linear-gradient(180deg, #e0e0e0 0%, #b0b0b0 40%, #c8c8c8 60%, #909090 100%);
          border: 2px solid var(--line, #15171E);
          border-radius: 3px;
          margin-top: -2px;
          margin-bottom: -3px;
          z-index: 2;
          position: relative;
          box-shadow: 1px 1px 0 var(--shadow, #15171E);
        }
        .lanyard-clip::after {
          content: "";
          position: absolute;
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #707070;
          border: 1px solid #505050;
        }

        /* The card */
        .hallpass {
          width: 100%;
          max-width: 360px;
          background: var(--yellow, #FFC93C);
          color: var(--yellow-ink, #3D2E00);
          border: 3px solid var(--line, #15171E);
          border-radius: 18px;
          box-shadow: 9px 9px 0 var(--shadow, #15171E);
          padding: 22px;
          position: relative;
          transform-origin: top center;
          will-change: transform;
        }

        /* Hole at the top of the card where the clip goes through */
        .hallpass-hole {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 16px;
          border: 3px solid var(--line, #15171E);
          border-top: none;
          border-radius: 0 0 12px 12px;
          background: var(--bg, #FFFDF7);
        }

        .hallpass-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .hallpass-tag {
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .hallpass h3 {
          font-size: 20px;
          margin-bottom: 6px;
          font-weight: 900;
        }
        .hallpass p {
          font-size: 13.5px;
          font-weight: 600;
          opacity: 0.85;
          margin-bottom: 16px;
        }
        .hallpass-body {
          display: flex;
          gap: 16px;
          align-items: center;
          background: rgba(255, 255, 255, 0.45);
          border: 2px solid var(--line, #15171E);
          border-radius: 10px;
          padding: 14px;
        }
        .qr {
          width: 66px;
          height: 66px;
          position: relative;
          background: #fff;
          border: 2px solid var(--line, #15171E);
          border-radius: 4px;
          flex-shrink: 0;
        }
        .qr-eye {
          position: absolute;
          width: 16px;
          height: 16px;
          border: 3.5px solid var(--line, #15171E);
        }
        .qr-eye::after {
          content: "";
          position: absolute;
          inset: 3.5px;
          background: var(--line, #15171E);
        }
        .qr-eye.tl { top: 4px; left: 4px; }
        .qr-eye.tr { top: 4px; right: 4px; }
        .qr-eye.bl { bottom: 4px; left: 4px; }
        .qr i {
          position: absolute;
          width: 4px;
          height: 4px;
          background: var(--line, #15171E);
          display: block;
        }
        .hallpass-code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          line-height: 1.7;
        }
        .hallpass-code b {
          display: block;
          font-size: 13px;
        }
        .hallpass-list {
          list-style: none;
          margin: 14px 0 0;
          padding: 0;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .hallpass-list li::before {
          content: "— ";
          font-weight: 700;
        }

        @media (prefers-reduced-motion: reduce) {
          .hallpass {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
