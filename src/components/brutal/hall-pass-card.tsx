"use client";

import { useEffect, useRef } from "react";

/**
 * HallPassCard — 3D lanyard card.
 *
 * Faithful React/TSX port of /upload/hall-pass-lanyard.html.
 *
 * Features (from the reference):
 *   - On load the card DROPS from above, strap snaps taut, gentle sway.
 *   - Real 2D verlet physics (rope + rigid card body) with a 3D layer on top
 *     (yaw / pitch / thickness / glare) rendered with CSS 3D transforms.
 *   - Mouse / touch: drag, fling, brush past to nudge, hover to tilt toward
 *     cursor, click/tap (no drag) to flip the card.
 *
 * Notes:
 *   - The strap above the anchor is drawn as a straight vertical line
 *     `M p[0].x, p[0].y - 120 L p[0].x, p[0].y` (matches the reference).
 *     This is intentional — the anchor is pinned, the top is fixed.
 *   - Bounds check clamps X (left/right) and bottom Y only (matches reference).
 *   - Respects prefers-reduced-motion (starts hanging, no drop).
 *   - ResizeObserver recalculates rope length / card width on resize.
 */
export function HallPassCard() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const sEdgeRef = useRef<SVGPathElement>(null);
  const sBodyRef = useRef<SVGPathElement>(null);
  const sRibRef = useRef<SVGPathElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Static content — matches the CONFIG object in the reference.
  const CFG = {
    eyebrow: "Staff invite",
    number: "0042",
    title: "Hall Pass",
    subtitle: "Scan to join — role and school are filled in for you.",
    path: "/register/teacher",
    token: "7F3-91C",
    usage: "one-time use",
    perks: ["Role auto-assigned", "School auto-linked", "Expires after first scan"],
    school: "Your school",
  };

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    const clipEl = clipRef.current;
    const sEdge = sEdgeRef.current;
    const sBody = sBodyRef.current;
    const sRib = sRibRef.current;
    const qrBox = qrRef.current;
    if (!stage || !card || !clipEl || !sEdge || !sBody || !sRib || !qrBox) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ============================================================
       QR placeholder generator (FNV-1a hash → deterministic grid)
       ============================================================ */
    function placeholderQR(seed: string): string {
      const n = 25;
      let h = 2166136261 >>> 0;
      for (const ch of String(seed)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619) >>> 0;
      }
      const rnd = () => {
        h = (h + 0x6d2b79f5) >>> 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const finder = (i: number, j: number) =>
        i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      let rects = "";
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          let on: boolean;
          const inTL = r < 8 && c < 8,
            inTR = r < 8 && c >= n - 8,
            inBL = r >= n - 8 && c < 8;
          if (inTL || inTR || inBL) {
            const i = inBL ? r - (n - 8) : r,
              j = inTR ? c - (n - 8) : c;
            on = i < 7 && j < 7 && finder(i, j);
          } else on = rnd() > 0.52;
          if (on) rects += `<rect x="${c}" y="${r}" width="1.02" height="1.02"/>`;
        }
      return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="currentColor" role="img" aria-label="QR code placeholder">${rects}</svg>`;
    }
    qrBox.innerHTML = placeholderQR(CFG.path + CFG.token);

    /* ============================================================
       Physics — verlet rope + rigid card body
       Coordinates are px, origin = top-left of the stage.
       ============================================================ */
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const DT = 1 / 120;

    interface Pt {
      x: number;
      y: number;
      px: number;
      py: number;
      im: number;
    }
    interface Con {
      a: Pt;
      b: Pt;
      rest: number;
      max: boolean;
    }
    interface Drag {
      u: number;
      v: number;
      tx: number;
      ty: number;
    }
    interface Sim {
      pts: Pt[];
      rope: Pt[];
      clip: Pt;
      TL: Pt;
      TR: Pt;
      BR: Pt;
      BL: Pt;
      W: number;
      H: number;
      drag: Drag | null;
      flipped: boolean;
      yaw: number;
      yawV: number;
      pitch: number;
      pitchV: number;
      hoverYaw: number;
      hoverPitch: number;
      gx: number;
      gy: number;
      time: number;
      step: () => void;
      _applyDrag: () => void;
      toUV: (x: number, y: number) => { u: number; v: number };
      angle: () => number;
      nudge: (vx: number, vy: number) => void;
      flip: () => void;
      settle: (seconds: number) => void;
    }

    function createSim(o: {
      ax: number;
      ay: number;
      W: number;
      H: number;
      L: number;
      gap: number;
      width: number;
      height: number;
      drop: boolean;
    }): Sim {
      const { ax, ay, W, H, L, gap, width, height, drop } = o;
      const G = 4200,
        DAMP = 0.9965,
        ITERS = 10,
        N = 9,
        seg = L / N;

      const pts: Pt[] = [];
      const mk = (x: number, y: number, im: number): Pt => {
        const p: Pt = { x, y, px: x, py: y, im };
        pts.push(p);
        return p;
      };

      /* --- initial pose --- */
      const th0 = drop ? 0.32 : 0;
      const cx0 = drop ? ax + Math.min(46, L * 0.15) : ax;
      const cy0 = drop ? ay - L * 0.92 : ay + L;
      const anchor = mk(ax, ay, 0);
      const rope: Pt[] = [anchor];
      for (let i = 1; i < N; i++) {
        const t = i / N;
        rope.push(mk(ax + (cx0 - ax) * t, ay + (cy0 - ay) * t, 2.2));
      }
      const clip = mk(cx0, cy0, 1);
      rope.push(clip);

      const cs = Math.cos(th0),
        sn = Math.sin(th0);
      const place = (lx: number, ly: number): Pt =>
        mk(cx0 + lx * cs - ly * sn, cy0 + lx * sn + ly * cs, 1);
      const TL = place(-W / 2, gap),
        TR = place(W / 2, gap),
        BR = place(W / 2, gap + H),
        BL = place(-W / 2, gap + H);
      const cardPts: Pt[] = [clip, TL, TR, BR, BL];
      const local: [number, number][] = [
        [0, 0],
        [-W / 2, gap],
        [W / 2, gap],
        [W / 2, gap + H],
        [-W / 2, gap + H],
      ];

      /* --- constraints --- */
      const cons: Con[] = [];
      for (let i = 0; i < N; i++)
        cons.push({ a: rope[i], b: rope[i + 1], rest: seg, max: true });
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 5; j++) {
          cons.push({
            a: cardPts[i],
            b: cardPts[j],
            rest: Math.hypot(local[i][0] - local[j][0], local[i][1] - local[j][1]),
            max: false,
          });
        }

      if (drop) for (const p of pts) if (p.im) p.py = p.y - 700 * DT;

      const sim: Sim = {
        pts,
        rope,
        clip,
        TL,
        TR,
        BR,
        BL,
        W,
        H,
        drag: null,
        flipped: false,
        yaw: 0,
        yawV: 0,
        pitch: 0,
        pitchV: 0,
        hoverYaw: 0,
        hoverPitch: 0,
        gx: 0.5,
        gy: 0.2,
        time: 0,
        step() {
          const g2 = G * DT * DT;
          for (const p of pts)
            if (p.im) {
              const vx = (p.x - p.px) * DAMP,
                vy = (p.y - p.py) * DAMP;
              p.px = p.x;
              p.py = p.y;
              p.x += vx;
              p.y += vy + g2;
            }
          if (this.drag) this._applyDrag();
          for (let it = 0; it < ITERS; it++)
            for (const c of cons) {
              const a = c.a,
                b = c.b;
              const dx = b.x - a.x,
                dy = b.y - a.y;
              const d = Math.hypot(dx, dy) || 1e-6;
              if (c.max && d <= c.rest) continue;
              const w = a.im + b.im;
              if (!w) continue;
              const diff = (d - c.rest) / d;
              a.x += dx * diff * (a.im / w);
              a.y += dy * diff * (a.im / w);
              b.x -= dx * diff * (b.im / w);
              b.y -= dy * diff * (b.im / w);
            }
          // Bounds — verbatim from reference: clamp X and bottom Y only.
          const pad = 4;
          for (const p of pts)
            if (p.im) {
              if (p.x < pad) p.x = pad;
              else if (p.x > width - pad) p.x = width - pad;
              if (p.y > height - pad) {
                p.y = height - pad;
                p.py = p.y + (p.py - p.y) * 0.2;
              }
            }

          /* --- 3D: yaw / pitch as damped springs driven by the card's motion --- */
          let vx = 0,
            vy = 0;
          for (const p of [TL, TR, BR, BL]) {
            vx += p.x - p.px;
            vy += p.y - p.py;
          }
          vx = vx / 4 / DT;
          vy = vy / 4 / DT;
          const base = this.flipped ? Math.PI : 0;
          const k = Math.round((this.yaw - base) / TAU);
          const yTarget = base + k * TAU + this.hoverYaw;
          const yAcc = -46 * (this.yaw - yTarget) - 6.2 * this.yawV + clamp(0.045 * vx, -40, 40);
          this.yawV = clamp(this.yawV + yAcc * DT, -32, 32);
          this.yaw += this.yawV * DT;

          const pTarget = this.hoverPitch + clamp(-vy * 0.00025, -0.35, 0.35);
          const pAcc = -60 * (this.pitch - pTarget) - 9 * this.pitchV;
          this.pitchV += pAcc * DT;
          this.pitch += this.pitchV * DT;
          this.time += DT;
        },
        _applyDrag() {
          const d = this.drag;
          const P: Pt[] = [TL, TR, BR, BL];
          const w = [
            (1 - d.u) * (1 - d.v),
            d.u * (1 - d.v),
            d.u * d.v,
            (1 - d.u) * d.v,
          ];
          let gx = 0,
            gy = 0,
            s = 0;
          for (let i = 0; i < 4; i++) {
            gx += w[i] * P[i].x;
            gy += w[i] * P[i].y;
            s += w[i] * w[i];
          }
          const k = 0.5,
            ex = (d.tx - gx) * k,
            ey = (d.ty - gy) * k;
          for (let i = 0; i < 4; i++) {
            P[i].x += (w[i] / s) * ex;
            P[i].y += (w[i] / s) * ey;
          }
        },
        toUV(x: number, y: number) {
          const ex = TR.x - TL.x,
            ey = TR.y - TL.y,
            fx = BL.x - TL.x,
            fy = BL.y - TL.y;
          const px = x - TL.x,
            py = y - TL.y;
          return {
            u: (px * ex + py * ey) / (W * W),
            v: (px * fx + py * fy) / (H * H),
          };
        },
        angle() {
          return Math.atan2(TR.y - TL.y, TR.x - TL.x);
        },
        nudge(vx: number, vy: number) {
          const f = DT * 0.02;
          for (const p of [TL, TR, BR, BL, clip]) {
            p.px -= vx * f;
            p.py -= vy * f;
          }
          this.yawV += clamp(vx * 0.0012, -6, 6);
        },
        flip() {
          this.flipped = !this.flipped;
          this.yawV += this.flipped ? 7 : -7;
        },
        settle(seconds: number) {
          for (let i = 0; i < seconds / DT; i++) this.step();
        },
      };
      return sim;
    }

    /* ============================================================
       DOM / rendering
       ============================================================ */
    let sim: Sim | null = null;
    let sw = 0,
      sh = 0,
      W = 0,
      H = 0,
      ax = 0,
      ay = 0;

    function layout(drop: boolean) {
      const r = stage.getBoundingClientRect();
      // If the stage is hidden (e.g. display: none on mobile via CSS
      // media query), getBoundingClientRect returns zeros. Skip the
      // layout entirely — the card won't be visible, so there's nothing
      // to render. This prevents the physics sim from running with
      // bogus dimensions and producing a tiny card at (0, 0).
      if (r.width === 0 || r.height === 0) return;
      sw = r.width;
      sh = r.height;
      const L = clamp(sh * 0.28, 110, 300);
      ay = -24;
      // Anchor at ~78% of the stage width — matches the center of the
      // hero-grid's right column (1.15fr 1fr grid with 56px gap → right
      // column center is at ~78% of the grid width). This keeps the card
      // clearly in the right portion, not overlapping the hero text.
      ax = sw * 0.78;
      W = clamp(Math.min(sw * 0.86, 360, (sh - L - 60) / 1.14), 200, 360);
      H = W * 1.14;
      const gap = W * 0.045;
      stage.style.setProperty("--w", W + "px");
      stage.style.setProperty("--h", H + "px");
      stage.style.setProperty("--sw", Math.round(W * 0.085) + "px");
      stage.classList.remove("hp-ready");
      sim = createSim({ ax, ay, W, H, L, gap, width: sw, height: sh, drop });
      if (!drop) sim.settle(5);
      render();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => stage.classList.add("hp-ready"))
      );
    }

    function strapPath(rope: Pt[]): string {
      const p = rope;
      // Verbatim from reference: straight vertical line above the anchor,
      // then Catmull-Rom spline through rope points.
      let d = `M${p[0].x.toFixed(1)},${(p[0].y - 120).toFixed(1)} L${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[i - 1] || p[i],
          p1 = p[i],
          p2 = p[i + 1],
          p3 = p[i + 2] || p2;
        d +=
          ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ` +
          `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ` +
          `${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    }

    function render() {
      if (!sim) return;
      const a = sim.angle(),
        tl = sim.TL;
      card.style.transform =
        `translate3d(${tl.x.toFixed(2)}px,${tl.y.toFixed(2)}px,0) rotate(${a.toFixed(4)}rad) ` +
        `translate(${W / 2}px,${H / 2}px) perspective(1100px) rotateX(${sim.pitch.toFixed(4)}rad) rotateY(${sim.yaw.toFixed(4)}rad) ` +
        `translate(${-W / 2}px,${-H / 2}px)`;
      clipEl.style.transform = `translate(${sim.clip.x.toFixed(2)}px,${sim.clip.y.toFixed(2)}px) rotate(${a.toFixed(4)}rad)`;
      const d = strapPath(sim.rope);
      sEdge.setAttribute("d", d);
      sBody.setAttribute("d", d);
      sRib.setAttribute("d", d);
      const s = 50 + Math.sin(sim.yaw) * 60 + a * 30;
      card.style.setProperty("--sheen", clamp(s, -20, 120).toFixed(1) + "%");
      card.style.setProperty("--gx", (sim.gx * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (sim.gy * 100).toFixed(1) + "%");
    }

    /* ---- fixed-timestep loop ---- */
    let last = performance.now(),
      acc = 0;
    let rafId = 0;
    function frame(t: number) {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      acc += dt;
      while (acc >= DT) {
        sim?.step();
        acc -= DT;
      }
      render();
    }

    /* ---- pointer interaction ---- */
    let down: { x: number; y: number; t: number; moved: boolean } | null = null;
    let prev: { x: number; y: number; t: number } | null = null;
    const local = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      try {
        card.setPointerCapture(e.pointerId);
      } catch (_) {
        /* noop */
      }
      if (!sim) return;
      const p = local(e),
        uv = sim.toUV(p.x, p.y);
      sim.drag = { u: clamp(uv.u, 0, 1), v: clamp(uv.v, 0, 1), tx: p.x, ty: p.y };
      sim.hoverYaw = sim.hoverPitch = 0;
      down = { x: p.x, y: p.y, t: performance.now(), moved: false };
      stage.classList.add("is-grabbed");
    }

    function onPointerMove(e: PointerEvent) {
      if (!sim) return;
      const p = local(e),
        now = performance.now();
      if (sim.drag) {
        sim.drag.tx = clamp(p.x, 0, sw);
        sim.drag.ty = clamp(p.y, 0, sh);
        if (down && Math.hypot(p.x - down.x, p.y - down.y) > 6) down.moved = true;
      } else if (e.pointerType === "mouse") {
        const uv = sim.toUV(p.x, p.y);
        const inside = uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1;
        if (inside) {
          sim.hoverYaw = (uv.u - 0.5) * 0.55;
          sim.hoverPitch = -(uv.v - 0.5) * 0.4;
          sim.gx = uv.u;
          sim.gy = uv.v;
          if (prev) {
            const dtm = Math.max(1, now - prev.t);
            const vx = clamp(((p.x - prev.x) / dtm) * 1000, -2500, 2500),
              vy = clamp(((p.y - prev.y) / dtm) * 1000, -2500, 2500);
            sim.nudge(vx, vy);
          }
        } else {
          sim.hoverYaw = sim.hoverPitch = 0;
        }
      }
      prev = { x: p.x, y: p.y, t: now };
    }

    function release() {
      if (!sim) return;
      if (!sim.drag) return;
      sim.drag = null;
      stage.classList.remove("is-grabbed");
      if (down && !down.moved && performance.now() - down.t < 350) sim.flip();
      down = null;
    }

    function onPointerUp() {
      release();
    }
    function onPointerCancel() {
      release();
    }
    function onPointerLeave() {
      if (!sim) return;
      if (!sim.drag) sim.hoverYaw = sim.hoverPitch = 0;
    }

    card.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("pointerleave", onPointerLeave);

    /* ---- boot ---- */
    layout(!reduceMotion);
    rafId = requestAnimationFrame(frame);

    /* ---- resize observer ----
       Also handles visibility changes (e.g. CSS media query toggling
       display: none on mobile). When the stage goes from hidden to
       visible (or vice versa), its dimensions change from/to zero,
       triggering a re-layout. */
    let rt: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const r = stage.getBoundingClientRect();
        if (Math.abs(r.width - sw) > 1 || Math.abs(r.height - sh) > 1) layout(false);
      }, 150);
    });
    ro.observe(stage);

    /* ---- cleanup ---- */
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(rt);
      ro.disconnect();
      card.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      stage.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div className="hp-stage" ref={stageRef} aria-label="Staff invite hall pass">
      <style>{`
        /* ---- Local CSS variables: palette is fixed (reference values) ----
           The reference uses a fixed dark navy + yellow palette that
           looks great on both light and dark page backgrounds. We do
           NOT override it with the page's --bg / --shadow vars because
           the hall pass is meant to look like a single physical object
           (the strap and plate color stay consistent regardless of the
           surrounding page theme). The only adaptation is that the stage
           background is transparent so it inherits the page surface. */
        .hp-stage{
          --hp-bg: transparent;
          --hp-card: #ffd45c;
          --hp-card-hi: #ffe388;
          --hp-card-lo: #f7b93a;
          --hp-ink: #231a05;
          --hp-plate: #050608;
          --hp-strap: #141417;
          --hp-accent: #1fd68f;
          --hp-sans: "Archivo", "Helvetica Neue", Arial, sans-serif;
          --hp-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

          /* Stage is positioned absolutely over the hero so the card can
             swing freely across the full hero box (not just the right
             grid column). The hero must be position: relative.

             Negative top/bottom offsets extend the stage to cover the
             hero's padding (64px top, 72px bottom — matches .hero CSS),
             so the stage's top edge aligns with the hero's top border
             edge (= the header's bottom edge in the document flow).

             overflow: visible lets the strap SVG extend above the
             stage top into the header area. The header is opaque and
             z-index: 40, so it hides the strap above its bottom edge.
             The visible strap emerges from the header bottom line. */
          position: absolute;
          top: -64px;
          left: 0;
          right: 0;
          bottom: -72px;
          overflow: visible;
          pointer-events: none;
          z-index: 5;
          font-family: var(--hp-sans);
          isolation: isolate;
        }
        .hp-stage * { box-sizing: border-box; }

        /* ---- strap (SVG) ---- */
        .hp-strap{
          position: absolute; inset: 0; width: 100%; height: 100%;
          pointer-events: none; overflow: visible; z-index: 1;
        }
        .hp-strap path{ fill: none; stroke-linejoin: round; stroke-linecap: butt }
        .hp-strap .s-edge{ stroke: #ece8dc; stroke-width: calc(var(--sw, 22px) + 4px) }
        .hp-strap .s-body{ stroke: var(--hp-strap); stroke-width: var(--sw, 22px) }
        .hp-strap .s-rib { stroke: #2b2b32; stroke-width: calc(var(--sw, 22px) - 3px); stroke-dasharray: 2 5 }

        /* ---- card ---- */
        .hp-card{
          position: absolute; left: 0; top: 0; z-index: 2;
          width: var(--w, 320px); height: var(--h, 365px);
          font-size: calc(var(--w, 320px) / 24);
          transform-origin: 0 0; transform-style: preserve-3d; will-change: transform;
          touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab;
          /* Stage has pointer-events: none so it doesn't block clicks on
             the hero text/CTAs underneath. The card itself re-enables
             pointer events so it can be dragged. */
          pointer-events: auto;
          opacity: 0;
        }
        .hp-ready .hp-card{ opacity: 1; transition: opacity .18s ease-out }
        .hp-stage.is-grabbed .hp-card{ cursor: grabbing }

        .hp-plate, .hp-core, .hp-face{
          position: absolute; inset: 0; border-radius: 1.15em;
        }
        .hp-plate{
          background: var(--hp-plate);
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
          transform: translate3d(.6em, .6em, -3px);
        }
        .hp-plate.back{ transform: rotateY(180deg) translate3d(-.6em, .6em, -3px) }
        .hp-core{ background: #c98a17 }
        .hp-face{
          backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden;
          display: flex; flex-direction: column; padding: 2.5em 1.7em 1.25em; color: var(--hp-ink);
          box-shadow: inset 0 0 0 .14em #fff7df;
        }
        .hp-front{
          transform: translateZ(2px);
          background:
            radial-gradient(120% 70% at 15% 0%, var(--hp-card-hi) 0%, transparent 60%),
            linear-gradient(165deg, var(--hp-card), var(--hp-card-lo));
        }
        .hp-back{
          transform: rotateY(180deg) translateZ(2px);
          background:
            repeating-linear-gradient(-32deg, rgba(255,212,92,.06) 0 .12em, transparent .12em 1.1em),
            #17171c;
          color: #ffe6a0;
        }
        .hp-notch{
          position: absolute; left: 50%; top: 0; width: 2.5em; height: 2.5em;
          margin: -1.25em 0 0 -1.25em; border-radius: 50%;
          background: var(--bg, #FFFDF7);
          box-shadow: 0 0 0 .16em #fff7df;
        }

        /* ---- front content ---- */
        .hp-row{
          display: flex; justify-content: space-between; align-items: baseline;
          font-family: var(--hp-mono); font-weight: 700; font-size: .74em;
          letter-spacing: .05em; text-transform: uppercase;
        }
        .hp-title{
          margin: .45em 0 .15em; font-size: 2.35em; line-height: 1;
          font-weight: 800; letter-spacing: -.03em;
        }
        .hp-sub{ margin: 0; font-size: .94em; line-height: 1.28; font-weight: 500; max-width: 21em }
        .hp-scan{
          display: flex; align-items: center; gap: 1em; margin-top: .95em; padding: .8em;
          border-radius: 1em;
          background: rgba(255,255,255,.42); border: .1em solid rgba(255,255,255,.75);
        }
        .hp-qr{
          flex: none; width: 6em; height: 6em; padding: .4em; border-radius: .55em;
          background: #fff; color: #111;
          display: grid; place-items: center; overflow: hidden;
        }
        .hp-qr > *{ width: 100%; height: 100%; display: block }
        .hp-meta{
          display: flex; flex-direction: column; gap: .35em;
          font-family: var(--hp-mono); min-width: 0;
        }
        .hp-path{ font-weight: 700; font-size: 1.02em; overflow-wrap: anywhere }
        .hp-token{ font-size: .84em }
        .hp-token b{
          font-weight: 700; background: rgba(35,26,5,.1);
          padding: .05em .3em; border-radius: .3em;
        }
        .hp-once{ font-size: .78em; opacity: .75; display: flex; align-items: center; gap: .5em }
        .hp-once i{
          width: .62em; height: .62em; border-radius: 50%;
          background: #12a56d; box-shadow: 0 0 0 .18em rgba(18,165,109,.25);
          animation: hp-pulse 2.2s ease-in-out infinite;
        }
        @keyframes hp-pulse{ 50%{ box-shadow: 0 0 0 .38em rgba(18,165,109,0) } }
        .hp-list{
          list-style: none; margin: .95em 0 0; padding: 0;
          display: grid; gap: .42em;
          font-family: var(--hp-mono); font-size: .82em;
        }
        .hp-list li::before{ content: "—"; font-weight: 700; margin-right: .65em }
        .hp-foot{
          margin-top: auto; padding-top: .7em;
          border-top: .13em dashed rgba(35,26,5,.45);
          display: flex; justify-content: space-between; align-items: flex-end; gap: 1em;
          font-family: var(--hp-mono); font-size: .62em; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .hp-bars{
          height: 1.9em; flex: 1; max-width: 11em;
          background: repeating-linear-gradient(90deg,
            #231a05 0 .14em, transparent .14em .32em,
            #231a05 .32em .6em, transparent .6em .74em,
            #231a05 .74em .82em, transparent .82em 1.12em);
        }
        .hp-sheen{
          position: absolute; inset: 0; pointer-events: none; mix-blend-mode: soft-light;
          background:
            radial-gradient(circle at var(--gx, 50%) var(--gy, 20%), rgba(255,255,255,.9), transparent 45%),
            linear-gradient(105deg,
              transparent calc(var(--sheen, 50%) - 18%),
              rgba(255,255,255,.75) var(--sheen, 50%),
              transparent calc(var(--sheen, 50%) + 18%));
          opacity: .55;
        }

        /* ---- back content ---- */
        .hp-stripe{ margin: .4em -1.7em 0; height: 3.1em; background: #050506 }
        .hp-back h3{
          margin: 1.3em 0 .25em; font-size: 1.55em; font-weight: 800;
          letter-spacing: -.02em; color: var(--hp-card);
        }
        .hp-back p{ margin: 0; font-size: .9em; line-height: 1.35; max-width: 20em; opacity: .85 }
        .hp-back .hp-foot{ border-top-color: rgba(255,230,160,.4); color: #ffe6a0 }
        .hp-back .hp-bars{
          background: repeating-linear-gradient(90deg,
            #ffe6a0 0 .14em, transparent .14em .32em,
            #ffe6a0 .32em .6em, transparent .6em .74em,
            #ffe6a0 .74em .82em, transparent .82em 1.12em);
        }
        .hp-sign{
          margin-top: 1.1em; height: 3.4em; border-radius: .5em;
          background: #f5efdc; color: #8a7a52;
          font-family: var(--hp-mono); font-size: .72em;
          display: flex; align-items: center; padding: 0 1em;
        }

        /* ---- metal clip ---- */
        .hp-clip{
          position: absolute; left: 0; top: 0; z-index: 3; pointer-events: none;
          transform-origin: 0 0;
          --cw: calc(var(--w, 320px) * .085);
          --ch: calc(var(--w, 320px) * .125);
        }
        .hp-clip-body{
          position: absolute;
          left: calc(var(--cw) / -2);
          top: calc(var(--ch) * -.3);
          width: var(--cw); height: var(--ch);
          border-radius: .45em .45em .8em .8em;
          border: 2px solid #fff;
          background: linear-gradient(90deg, #8d939d, #e4e7ec 45%, #a6acb6);
          box-shadow: 0 3px 6px rgba(0,0,0,.45), inset 0 -6px 8px rgba(0,0,0,.18);
        }
        .hp-clip-body::after{
          content: "";
          position: absolute; left: 50%; top: 44%;
          width: 34%; aspect-ratio: 1;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: #3a3d44;
          box-shadow: inset 0 2px 3px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.6);
        }

        /* ---- hint text removed ----
           The original reference had a "drag it · fling it · tap to flip"
           hint at the bottom of the stage. It was useful when the stage
           was a small contained area, but now the stage spans the full
           hero (with bottom: -72px), so the hint ended up overlapping
           the green marquee strip below the hero — nearly invisible
           (grey on green) and visually noisy. The drag/flip behavior
           is still discoverable via the cursor change (grab → grabbing)
           and the card's responsiveness to hover/mouse. */

        @media (prefers-reduced-motion: reduce){ .hp-once i{ animation: none } }
      `}</style>

      <svg className="hp-strap" aria-hidden="true">
        <path className="s-edge" ref={sEdgeRef} />
        <path className="s-body" ref={sBodyRef} />
        <path className="s-rib" ref={sRibRef} />
      </svg>

      <div
        className="hp-card"
        ref={cardRef}
        role="img"
        aria-label="Staff invite hall pass. Drag to move, tap to flip."
      >
        <div className="hp-plate" />
        <div className="hp-plate back" />
        <div className="hp-core" style={{ transform: "translateZ(-1.5px)" }} />
        <div className="hp-core" style={{ transform: "translateZ(0)" }} />
        <div className="hp-core" style={{ transform: "translateZ(1.5px)" }} />

        {/* FRONT */}
        <div className="hp-face hp-front">
          <i className="hp-notch" />
          <div className="hp-row">
            <span>{CFG.eyebrow}</span>
            <span>
              No. {CFG.number}
            </span>
          </div>
          <h2 className="hp-title">{CFG.title}</h2>
          <p className="hp-sub">{CFG.subtitle}</p>
          <div className="hp-scan">
            <div className="hp-qr" ref={qrRef} />
            <div className="hp-meta">
              <span className="hp-path">{CFG.path}</span>
              <span className="hp-token">
                ?token=<b>{CFG.token}</b>
              </span>
              <span className="hp-once">
                <i />
                <span>{CFG.usage}</span>
              </span>
            </div>
          </div>
          <ul className="hp-list">
            {CFG.perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
          <div className="hp-foot">
            <span>{CFG.school}</span>
            <span className="hp-bars" />
          </div>
          <div className="hp-sheen" />
        </div>

        {/* BACK */}
        <div className="hp-face hp-back">
          <i className="hp-notch" />
          <div className="hp-stripe" />
          <h3>{CFG.school}</h3>
          <p>
            This pass is issued to one person and works once. If you didn&apos;t expect it,
            don&apos;t scan it — tell the front office.
          </p>
          <div className="hp-sign">signed at first scan</div>
          <div className="hp-foot">
            <span>Non-transferable</span>
            <span className="hp-bars" />
          </div>
          <div className="hp-sheen" />
        </div>
      </div>

      <div className="hp-clip" ref={clipRef}>
        <div className="hp-clip-body" />
      </div>
    </div>
  );
}
