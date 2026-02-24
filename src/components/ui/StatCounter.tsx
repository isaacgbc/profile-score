"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  value: string;
  label: string;
  className?: string;
}

/**
 * Animated stat counter that triggers on scroll into view.
 * Handles numeric-prefix values like "50,000+" or "3×" or "<2 min".
 * Animates the numeric part and appends any suffix.
 */
export default function StatCounter({ value, label, className = "" }: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Try to extract a numeric target from the value
    const numMatch = value.match(/^[<>]?(\d[\d,]*)/);
    if (!numMatch) {
      setDisplayValue(value);
      return;
    }

    const prefix = value.match(/^[<>]/)?.[0] || "";
    const numStr = numMatch[1].replace(/,/g, "");
    const target = parseInt(numStr, 10);
    const suffix = value.slice((prefix + numMatch[1]).length);

    if (isNaN(target) || target === 0) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const steps = 30;
    const increment = target / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);

      // Format with commas
      const formatted = current.toLocaleString("en-US");
      setDisplayValue(`${prefix}${formatted}${suffix}`);

      if (step >= steps) {
        clearInterval(interval);
        setDisplayValue(value); // Ensure exact final value
      }
    }, 30);

    return () => clearInterval(interval);
  }, [visible, value]);

  return (
    <div
      ref={ref}
      className={`text-center ${className}`}
    >
      <p
        className={`text-3xl sm:text-4xl font-bold text-[var(--accent)] tabular-nums transition-transform duration-300 ${
          visible ? "animate-count-pulse" : "opacity-0"
        }`}
      >
        {displayValue}
      </p>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{label}</p>
    </div>
  );
}
