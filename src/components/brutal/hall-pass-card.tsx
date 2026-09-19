"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HallPassCard — ID card hanging from a lanyard that starts at the top
 * of the page. On load, the card falls from above the viewport with
 * real gravity physics (acceleration + bounce on settle).
 *
 * 3D treatment (this iteration):
 *   - Card body has a glossy laminate sheen (diagonal light gradient)
 *   - Beveled edges: top/left highlight, bottom/right shadow
 *   - Subtle perspective tilt (rotateX) so the card recedes slightly
 *   - Text & QR get an embossed feel (text-shadow + inset highlight)
 *   - The metal clip gets hinge, bolt, and metallic reflection details
 *   - Lanyard gets fabric weave texture and stitched edges
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
  const [tilt, setTilt] = useState(0); // rotateX perspective (3D lean)
  const yRef = useRef(-600);
  const velocityRef = useRef(0);
  const settledRef = useRef(false);
  const swayTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Resting Y position (0 = card top at the lanyard bottom)
  const REST_Y = 0;
  const GRAVITY = 0.8;
  const BOUNCE = 0.35;
  const SETTLE_THRESHOLD = 1.5;

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

          if (Math.abs(velocityRef.current) < SETTLE_THRESHOLD) {
            settledRef.current = true;
            yRef.current = REST_Y;
            swayTimeRef.current = timestamp;
          }
        }

        setY(yRef.current);

        // Tumble (rotation during fall) — eases out as card approaches rest
        const fallProgress = Math.min(1, (REST_Y - yRef.current) / 600);
        const tumble = (1 - fallProgress) * 8;
        setRotate(tumble);

        // 3D lean: while falling, the card leans back slightly (rotateX ~ -8°)
        // and flattens to ~0° as it settles — gives a sense of weight.
        const lean = (1 - fallProgress) * 8;
        setTilt(-lean);
      } else {
        // Sway phase: gentle pendulum after settling
        const swayElapsed = (timestamp - swayTimeRef.current) / 1000;
        const swayAngle = Math.sin(swayElapsed * 0.6) * 2;
        setRotate(swayAngle);
        // Tilt follows sway subtly — when swung right, top tilts back a touch
        const swayTilt = Math.sin(swayElapsed * 0.6) * 1.2;
        setTilt(swayTilt);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="hallpass-container">
      {/* Lanyard — starts from the very top of the page */}
      <div className="lanyard-top">
        {/* Fabric weave texture overlay */}
        <div className="lanyard-weave" />
        {/* Stitched edge highlights */}
        <div className="lanyard-stitch lanyard-stitch-l" />
        <div className="lanyard-stitch lanyard-stitch-r" />
        {/* Subtle drape shading (darker near top, lighter at bottom) */}
        <div className="lanyard-drape" />
      </div>

      {/* Metal clip — full 3D treatment */}
      <div className="lanyard-clip">
        {/* Top bar — visible from below, has its own gradient */}
        <div className="clip-topbar" />
        {/* Bolt — the rivet on top of the clip body */}
        <div className="clip-bolt" />
        {/* Hook / catch plate that grips the card hole */}
        <div className="clip-hook" />
        {/* Metallic reflection sweep — animated subtle highlight */}
        <div className="clip-shine" />
      </div>

      {/* The card — positioned by physics */}
      <div
        className="hallpass-card-wrap"
        style={{
          transform: `translateY(${y}px) rotate(${rotate}deg) rotateX(${tilt}deg)`,
        }}
      >
        <div className="hallpass-3d-stage">
          <div className="hallpass">
            {/* Hole at top where clip goes through — now with depth (inner shadow) */}
            <div className="hallpass-hole">
              <div className="hallpass-hole-inner" />
            </div>

            {/* Card thickness — beveled edge highlight (top/left) */}
            <div className="hallpass-bevel-tl" />
            {/* Card thickness — beveled edge shadow (bottom/right) */}
            <div className="hallpass-bevel-br" />

            {/* Glossy laminate sheen — diagonal light reflection */}
            <div className="hallpass-sheen" />
            {/* Secondary smaller highlight — top right corner */}
            <div className="hallpass-sheen-corner" />

            <div className="hallpass-head">
              <span className="hallpass-tag">Staff invite</span>
              <span className="hallpass-tag">No. 0042</span>
            </div>
            <h3>Hall Pass</h3>
            <p>Scan to join — role and school are filled in for you.</p>
            <div className="hallpass-body">
              <div className="qr">
                <div className="qr-sheen" />
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
            {/* Watermark — subtle raised seal in the bottom-right */}
            <div className="hallpass-watermark">VERIFIED</div>
          </div>
        </div>
      </div>

      <style>{`
        /* Container */
        .hallpass-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: visible;
          perspective: 1200px;
        }

        /* Lanyard — fabric strap reaching to the top of the page */
        .lanyard-top {
          position: absolute;
          top: -100vh;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 100vh;
          background: repeating-linear-gradient(
            180deg,
            #1f1f23 0px,
            #1f1f23 4px,
            #0d0d10 4px,
            #0d0d10 8px
          );
          border-left: 2px solid var(--line, #15171E);
          border-right: 2px solid var(--line, #15171E);
          z-index: 0;
          overflow: hidden;
        }
        /* Fabric weave texture — diagonal cross-hatch */
        .lanyard-weave {
          position: absolute;
          inset: 0;
          background-image:
            repeating-linear-gradient(45deg,
              rgba(255,255,255,0.04) 0px,
              rgba(255,255,255,0.04) 1px,
              transparent 1px,
              transparent 3px),
            repeating-linear-gradient(-45deg,
              rgba(255,255,255,0.04) 0px,
              rgba(255,255,255,0.04) 1px,
              transparent 1px,
              transparent 3px);
          pointer-events: none;
        }
        /* Stitched edges — dashed thread running along each side */
        .lanyard-stitch {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background-image: repeating-linear-gradient(
            180deg,
            rgba(255,255,255,0.18) 0px,
            rgba(255,255,255,0.18) 3px,
            transparent 3px,
            transparent 6px
          );
        }
        .lanyard-stitch-l { left: 3px; }
        .lanyard-stitch-r { right: 3px; }
        /* Drape shading — darker near top of the strap */
        .lanyard-drape {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            rgba(0,0,0,0.45) 0%,
            rgba(0,0,0,0.15) 30%,
            rgba(0,0,0,0) 60%,
            rgba(255,255,255,0.05) 100%);
          pointer-events: none;
        }

        /* Metal clip — full 3D treatment */
        .lanyard-clip {
          width: 22px;
          height: 30px;
          background: linear-gradient(180deg, #e6e6e6 0%, #b8b8b8 30%, #d0d0d0 55%, #909090 100%);
          border: 2px solid var(--line, #15171E);
          border-radius: 4px 4px 6px 6px;
          position: relative;
          z-index: 2;
          box-shadow:
            2px 2px 0 var(--shadow, #15171E),
            inset 1px 1px 0 rgba(255,255,255,0.6),
            inset -1px -1px 0 rgba(0,0,0,0.35);
        }
        /* Top bar — visible horizontal metal bar at the top of the clip */
        .clip-topbar {
          position: absolute;
          top: -3px;
          left: -2px;
          right: -2px;
          height: 8px;
          background: linear-gradient(180deg, #f0f0f0 0%, #c0c0c0 50%, #909090 100%);
          border: 2px solid var(--line, #15171E);
          border-radius: 3px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.7),
            inset 0 -1px 0 rgba(0,0,0,0.3);
        }
        /* Bolt — rivet detail on the front face */
        .clip-bolt {
          position: absolute;
          top: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%,
            #f5f5f5 0%, #c8c8c8 35%, #707070 80%, #404040 100%);
          border: 1.5px solid var(--line, #15171E);
          box-shadow:
            inset 0 0 1px rgba(255,255,255,0.5),
            0 1px 1px rgba(0,0,0,0.4);
        }
        /* Hook / catch plate that goes through the card hole */
        .clip-hook {
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 9px;
          background: linear-gradient(180deg, #c8c8c8 0%, #888888 60%, #606060 100%);
          border: 2px solid var(--line, #15171E);
          border-radius: 0 0 5px 5px;
          box-shadow:
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 1px 0 rgba(255,255,255,0.2);
        }
        /* Metallic reflection sweep — animated highlight across the clip */
        .clip-shine {
          position: absolute;
          top: 0;
          left: -50%;
          width: 30%;
          height: 100%;
          background: linear-gradient(110deg,
            transparent 0%,
            rgba(255,255,255,0.7) 50%,
            transparent 100%);
          transform: skewX(-20deg);
          animation: clip-shine-sweep 5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes clip-shine-sweep {
          0%, 70% { left: -50%; opacity: 0; }
          75% { opacity: 0.9; }
          85% { left: 130%; opacity: 0.9; }
          90%, 100% { left: 130%; opacity: 0; }
        }

        /* Card wrapper — animated by physics (translateY + rotate + rotateX) */
        .hallpass-card-wrap {
          transform-origin: top center;
          transform-style: preserve-3d;
          will-change: transform;
          position: relative;
          z-index: 1;
        }
        /* Inner 3D stage holds the card with preserve-3d so bevels/sheen
           can sit at slightly different translateZ positions */
        .hallpass-3d-stage {
          transform-style: preserve-3d;
          position: relative;
        }

        /* The card */
        .hallpass {
          width: 100%;
          max-width: 360px;
          background:
            /* Subtle vertical gradient — top brighter, bottom slightly warmer */
            linear-gradient(180deg,
              rgba(255,255,255,0.18) 0%,
              rgba(255,255,255,0) 25%,
              rgba(0,0,0,0.04) 100%),
            var(--yellow, #FFC93C);
          color: var(--yellow-ink, #3D2E00);
          border: 3px solid var(--line, #15171E);
          border-radius: 18px;
          box-shadow:
            9px 9px 0 var(--shadow, #15171E),
            inset 0 1px 0 rgba(255,255,255,0.6),
            inset 0 -1px 0 rgba(0,0,0,0.18),
            inset 1px 0 0 rgba(255,255,255,0.35),
            inset -1px 0 0 rgba(0,0,0,0.15);
          padding: 22px;
          padding-top: 28px;
          position: relative;
          transform: translateZ(0);
        }

        /* Bevel — top/left edge highlight (suggests card thickness catching light) */
        .hallpass-bevel-tl {
          position: absolute;
          inset: -1px;
          border-radius: 18px;
          border-top: 2px solid rgba(255,255,255,0.55);
          border-left: 2px solid rgba(255,255,255,0.35);
          border-right: 2px solid transparent;
          border-bottom: 2px solid transparent;
          pointer-events: none;
          transform: translateZ(1px);
        }
        /* Bevel — bottom/right edge shadow (card thickness in shadow) */
        .hallpass-bevel-br {
          position: absolute;
          inset: -1px;
          border-radius: 18px;
          border-bottom: 2px solid rgba(0,0,0,0.4);
          border-right: 2px solid rgba(0,0,0,0.3);
          border-top: 2px solid transparent;
          border-left: 2px solid transparent;
          pointer-events: none;
          transform: translateZ(1px);
        }

        /* Glossy laminate sheen — diagonal light reflection across the card */
        .hallpass-sheen {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background: linear-gradient(135deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.32) 35%,
            rgba(255,255,255,0.05) 50%,
            rgba(255,255,255,0.18) 65%,
            rgba(255,255,255,0) 100%);
          pointer-events: none;
          mix-blend-mode: overlay;
          transform: translateZ(2px);
        }
        /* Corner sheen — small bright highlight near top-right */
        .hallpass-sheen-corner {
          position: absolute;
          top: 6px;
          right: 8px;
          width: 70px;
          height: 50px;
          border-radius: 50%;
          background: radial-gradient(ellipse at 60% 40%,
            rgba(255,255,255,0.5) 0%,
            rgba(255,255,255,0.15) 40%,
            rgba(255,255,255,0) 70%);
          pointer-events: none;
          mix-blend-mode: screen;
          transform: translateZ(2px);
        }

        /* Hole at the top of the card — now with depth (inner shadow) */
        .hallpass-hole {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 18px;
          border: 3px solid var(--line, #15171E);
          border-top: none;
          border-radius: 0 0 15px 15px;
          background: var(--bg, #FFFDF7);
          box-shadow:
            inset 0 3px 4px rgba(0,0,0,0.5),
            inset 0 -1px 0 rgba(255,255,255,0.4);
          overflow: hidden;
        }
        .hallpass-hole-inner {
          position: absolute;
          top: 2px;
          left: 2px;
          right: 2px;
          bottom: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 80%);
          border-radius: 0 0 12px 12px;
        }

        .hallpass-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          position: relative;
          transform: translateZ(3px);
        }
        .hallpass-tag {
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-shadow: 0 1px 0 rgba(255,255,255,0.35);
        }
        .hallpass h3 {
          font-size: 20px;
          margin-bottom: 6px;
          font-weight: 900;
          position: relative;
          transform: translateZ(3px);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        .hallpass p {
          font-size: 13.5px;
          font-weight: 600;
          opacity: 0.85;
          margin-bottom: 16px;
          position: relative;
          transform: translateZ(3px);
          text-shadow: 0 1px 0 rgba(255,255,255,0.25);
        }
        .hallpass-body {
          display: flex;
          gap: 16px;
          align-items: center;
          background: rgba(255, 255, 255, 0.45);
          border: 2px solid var(--line, #15171E);
          border-radius: 10px;
          padding: 14px;
          position: relative;
          transform: translateZ(2px);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -1px 0 rgba(0,0,0,0.12);
        }
        .qr {
          width: 66px;
          height: 66px;
          position: relative;
          background: #fff;
          border: 2px solid var(--line, #15171E);
          border-radius: 4px;
          flex-shrink: 0;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.8),
            0 1px 0 rgba(0,0,0,0.15);
        }
        /* QR sheen — subtle gloss on the QR code itself */
        .qr-sheen {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            rgba(255,255,255,0.4) 0%,
            rgba(255,255,255,0) 40%,
            rgba(255,255,255,0.15) 60%,
            rgba(255,255,255,0) 100%);
          pointer-events: none;
          z-index: 5;
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
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
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
          position: relative;
          transform: translateZ(3px);
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        }
        .hallpass-list li::before {
          content: "— ";
          font-weight: 700;
        }

        /* Watermark — embossed seal in bottom-right corner */
        .hallpass-watermark {
          position: absolute;
          bottom: 14px;
          right: 18px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: rgba(61, 46, 0, 0.18);
          text-shadow:
            0 1px 0 rgba(255,255,255,0.4),
            0 -1px 0 rgba(0,0,0,0.05);
          pointer-events: none;
          transform: translateZ(1px) rotate(-6deg);
        }

        @media (prefers-reduced-motion: reduce) {
          .hallpass-card-wrap {
            transform: none !important;
          }
          .clip-shine {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
