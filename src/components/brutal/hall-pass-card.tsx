"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HallPassCard — interactive ID card that hangs from a string and swings
 * with gravity physics based on mouse position.
 *
 * The card follows the cursor with a spring-damper system, then swings
 * back to rest when the mouse leaves. A string is drawn from the top
 * of the card to a fixed anchor point above it.
 *
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
export function HallPassCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotate(-2deg)");
  const [stringHeight, setStringHeight] = useState(40);

  // Physics state
  const angleRef = useRef(-2); // current angle in degrees
  const velocityRef = useRef(0); // angular velocity
  const targetAngleRef = useRef(-2); // target angle based on mouse
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let isHovering = false;
    let mouseX = 0;

    function animate() {
      // Spring physics: pull toward target angle, with damping
      const angle = angleRef.current;
      const velocity = velocityRef.current;
      const target = targetAngleRef.current;

      // Spring force (k) + damping (d)
      const k = 0.06; // spring stiffness
      const d = 0.92; // damping factor (lower = more swing)

      const force = (target - angle) * k;
      const newVelocity = (velocity + force) * d;
      const newAngle = angle + newVelocity;

      angleRef.current = newAngle;
      velocityRef.current = newVelocity;

      setTransform(`rotate(${newAngle.toFixed(2)}deg)`);

      rafRef.current = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const deltaX = e.clientX - centerX;

      // Map mouse X to angle: -200px → -15deg, 0px → 0deg, 200px → 15deg
      // But offset by the resting angle of -2deg
      const maxAngle = 15;
      const normalizedX = Math.max(-1, Math.min(1, deltaX / 250));
      targetAngleRef.current = normalizedX * maxAngle + (isHovering ? 0 : -2);

      // Also adjust string height based on distance from top
      if (!isHovering) {
        isHovering = true;
      }
    }

    function handleMouseLeave() {
      isHovering = false;
      targetAngleRef.current = -2; // rest angle
    }

    const wrap = wrapRef.current;
    if (!wrap) return;

    wrap.addEventListener("mousemove", handleMouseMove);
    wrap.addEventListener("mouseleave", handleMouseLeave);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      wrap.removeEventListener("mousemove", handleMouseMove);
      wrap.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapRef} className="hallpass-wrap">
      {/* String / lanyard */}
      <div className="hallpass-string" style={{ height: `${stringHeight}px` }} />

      {/* Pin / hook at the top */}
      <div className="hallpass-pin" />

      {/* The card itself */}
      <div
        ref={cardRef}
        className="hallpass"
        style={{ transform, transformOrigin: "top center" }}
      >
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
          perspective: 800px;
        }

        .hallpass-string {
          width: 2px;
          background: var(--line, #15171E);
          position: relative;
          transition: height 0.3s ease;
        }
        .hallpass-string::after {
          content: "";
          position: absolute;
          bottom: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--line, #15171E);
        }

        .hallpass-pin {
          width: 14px;
          height: 14px;
          border: 3px solid var(--line, #15171E);
          border-radius: 50%;
          background: var(--green, #17B978);
          box-shadow: 2px 2px 0 var(--shadow, #15171E);
          margin-bottom: -2px;
          z-index: 2;
          position: relative;
        }

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
          transition: box-shadow 0.2s ease;
        }

        .hallpass:hover {
          box-shadow: 12px 12px 0 var(--shadow, #15171E);
        }

        .hallpass::before {
          content: "";
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 56px;
          height: 18px;
          border: 3px solid var(--line, #15171E);
          border-radius: 0 0 40px 40px;
          background: var(--bg, #FFFDF7);
          border-top: none;
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
            transform: rotate(-2deg) !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
