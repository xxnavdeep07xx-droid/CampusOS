"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  usePrefersReducedMotion                                                   */
/*                                                                            */
/*  Subscribes to the (prefers-reduced-motion: reduce) media query using      */
/*  useSyncExternalStore — the React-recommended way to read external state   */
/*  without triggering cascading renders.                                     */
/*                                                                            */
/*  - Server snapshot returns `false` so SSR markup matches the no-RM path.   */
/*  - Client snapshot returns the actual matchMedia result; if it differs     */
/*    from the server snapshot, React re-renders after hydration.            */
/* -------------------------------------------------------------------------- */

function subscribePrefersReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readPrefersReducedMotionServer(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    readPrefersReducedMotion,
    readPrefersReducedMotionServer,
  );
}

/* -------------------------------------------------------------------------- */
/*  Reveal                                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Reveal — wraps children and fades/slides them in when they scroll
 * into the viewport.
 *
 * Uses IntersectionObserver (no external deps).
 *
 * Respects `prefers-reduced-motion`: when the user has requested reduced
 * motion, children render immediately with no transition.
 *
 * Props:
 *   - delay: ms to wait before starting the animation (stagger effect)
 *   - y: pixels to translate from (default 24)
 *   - className: optional extra classes
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolledIntoView, setScrolledIntoView] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Derive final visibility during render so reduced-motion users see content
  // immediately, without a synchronous setState call inside the effect.
  const visible = reduced || scrolledIntoView;

  useEffect(() => {
    // Reduced motion: skip the observer entirely; `visible` is already true.
    if (reduced) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setScrolledIntoView(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        reduced && "duration-0",
        visible ? "opacity-100 translate-y-0" : "opacity-0",
        className,
      )}
      style={{
        transform: visible ? "translateY(0)" : `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AnimatedCounter                                                           */
/* -------------------------------------------------------------------------- */
/**
 * AnimatedCounter — counts up from 0 to the target value when scrolled
 * into view.
 *
 * Respects `prefers-reduced-motion`: jumps straight to `target` with no
 * animation.
 *
 * Props:
 *   - target: the final number
 *   - duration: animation duration in ms (default 2000)
 *   - suffix: optional string appended (e.g. "+", "%")
 *   - prefix: optional string prepended (e.g. "$")
 */
export function AnimatedCounter({
  target,
  duration = 2000,
  suffix = "",
  prefix = "",
}: {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [animatedCount, setAnimatedCount] = useState(0);
  const reduced = usePrefersReducedMotion();

  // When reduced motion is preferred, always show the final value.
  const count = reduced ? target : animatedCount;

  useEffect(() => {
    // Reduced motion: skip the observer; `count` is already `target`.
    if (reduced) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = Date.now();
          const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic for natural feel
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          animate();
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, reduced]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}
