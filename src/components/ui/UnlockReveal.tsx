"use client";

import { type ReactNode } from "react";

interface UnlockRevealProps {
  children: ReactNode;
  locked: boolean;
  animating: boolean;
  delay?: number;
  className?: string;
}

/**
 * Wraps content in an unlock reveal animation.
 * When `locked` is false and `animating` is true, plays a staggered
 * scale + opacity + blur-removal CSS animation.
 * When `locked` is true, the children are hidden.
 */
export default function UnlockReveal({
  children,
  locked,
  animating,
  delay = 0,
  className = "",
}: UnlockRevealProps) {
  if (locked) return null;

  return (
    <div
      className={`
        ${animating ? "animate-reveal-unlock" : ""}
        ${className}
      `}
      style={animating ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
