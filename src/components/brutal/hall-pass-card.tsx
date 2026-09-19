"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HallPassCard — ID card hanging from a lanyard that starts at the top
 * of the page. On load, the card falls from above the viewport with
 * real gravity physics (acceleration + bounce on settle).
 *
 * Physics: the card uses a simple gravity simulation:
 *   - velocity accumulates each frame (gravity = 0.8px/frame²)
 *   - position updates by velocity
 *   - when card reaches resting position, it bounces (velocity *= -0.4)
 *   - bounces dampen until velocity < threshold → settled
 *   - after settling, a gentle idle sway starts (pendulum)
 */
export function HallPassCard() {
  const [y, setY] = useState(-600); // start above viewport
  const [rotate, setRotate] = useState(0);
  const yRef = useRef(-600);
  const velocityRef = useRef(0);
  const settledRef = useRef(false);
  const swayTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Resting Y position (0 = card top at the lanyard bottom)
  const REST_Y = 0;
  const GRAVITY = 0.8;
  const BOUNCE = 0.35; // energy retained on bounce (0 = no bounce, 1 = perfect)
  const SETTLE_THRESHOLD = 1.5; // velocity below this = settled

  useEffect(() => {
    function animate(timestamp: number) {
      if (!settledRef.current) {
        // Gravity phase: accelerate downward
        velocityRef.current += GRAVITY;
        yRef.current += velocityRef.current;

        // Bounce when hitting resting position
        if (yRef.current >= REST_Y) {
          yRef.current = REST_Y;
          velocityRef.current *= -BOUNCE;

          // Check if settled
          if (Math.abs(velocityRef.current) < SETTLE_THRESHOLD) {
            settledRef.current = true;
            yRef.current = REST_Y;
            swayTimeRef.current = timestamp;
          }
        }

        setY(yRef.current);

        // Slight rotation during fall (tumbles a bit)
        const fallProgress = Math.min(1, (REST_Y - yRef.current) / 600);
        const tumble = (1 - fallProgress) * 8; // up to 8deg tumble
        setRotate(tumble);
      } else {
        // Sway phase: gentle pendulum after settling
        const swayElapsed = (timestamp - swayTimeRef.current) / 1000;
        const swayAngle = Math.sin(swayElapsed * 0.6) * 2; // ±2deg, slow
        setRotate(swayAngle);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="hallpass-container">
      {/* Lanyard — starts from the very top of the page */}
      <div className="lanyard-top" />

      {/* Metal clip */}
      <div className="lanyard-clip" />

      {/* The card — positioned by physics */}
      <div
        className="hallpass-card-wrap"
        style={{
          transform: `translateY(${y}px) rotate(${rotate}deg)`,
        }}
      >
        <div className="hallpass">
          {/* Hole at top where clip goes through */}
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
      </div>

      <style>{`
        /* Container — positioned in the hero grid */
        .hallpass-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: visible;
        }

        /* Lanyard — extends from the top of the page down to the clip.
           Uses position: absolute to reach the very top of the viewport. */
        .lanyard-top {
          position: absolute;
          top: -100vh; /* reach to the top of the page */
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 100vh; /* full viewport height — covers from top to here */
          background: repeating-linear-gradient(
            180deg,
            #1a1a1a 0px,
            #1a1a1a 4px,
            #0d0d0d 4px,
            #0d0d0d 8px
          );
          border-left: 2px solid var(--line, #15171E);
          border-right: 2px solid var(--line, #15171E);
          z-index: 0;
        }

        /* Metal clip — between lanyard and card */
        .lanyard-clip {
          width: 18px;
          height: 26px;
          background: linear-gradient(180deg, #d8d8d8 0%, #a8a8a8 35%, #c0c0c0 55%, #888888 100%);
          border: 2px solid var(--line, #15171E);
          border-radius: 4px;
          position: relative;
          z-index: 2;
          box-shadow: 2px 2px 0 var(--shadow, #15171E);
        }
        .lanyard-clip::before {
          content: "";
          position: absolute;
          top: 5px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
          border: 1.5px solid #444;
        }
        .lanyard-clip::after {
          content: "";
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 6px;
          background: linear-gradient(180deg, #b0b0b0, #808080);
          border: 2px solid var(--line, #15171E);
          border-radius: 0 0 4px 4px;
        }

        /* Card wrapper — animated by physics (translateY + rotate) */
        .hallpass-card-wrap {
          transform-origin: top center;
          will-change: transform;
          position: relative;
          z-index: 1;
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
          padding-top: 28px;
          position: relative;
        }

        /* Hole at the top of the card */
        .hallpass-hole {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 16px;
          border: 3px solid var(--line, #15171E);
          border-top: none;
          border-radius: 0 0 14px 14px;
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
          .hallpass-card-wrap {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
