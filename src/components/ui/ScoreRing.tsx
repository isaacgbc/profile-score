"use client";

import { useEffect, useState } from "react";
import type { ScoreTier } from "@/lib/types";

interface ScoreRingProps {
  score: number;
  maxScore: number;
  tier: ScoreTier;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  animate?: boolean;
}

const tierColors: Record<ScoreTier, string> = {
  poor: "#ef4444",
  fair: "#f59e0b",
  good: "#3b82f6",
  excellent: "#10b981",
};

const sizes = {
  xs: { ring: 32, stroke: 3, fontSize: "text-[9px]", labelSize: "text-[7px]" },
  sm: { ring: 64, stroke: 5, fontSize: "text-lg", labelSize: "text-[10px]" },
  md: { ring: 100, stroke: 6, fontSize: "text-3xl", labelSize: "text-xs" },
  lg: { ring: 160, stroke: 8, fontSize: "text-5xl", labelSize: "text-sm" },
};

export default function ScoreRing({
  score,
  maxScore,
  tier,
  size = "md",
  showLabel = false,
  label,
  animate = true,
}: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const config = sizes[size];
  const radius = (config.ring - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = displayScore / maxScore;
  const dashOffset = circumference * (1 - progress);
  const color = tierColors[tier];

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    setDisplayScore(0);
    const duration = 800;
    let start: number | null = null;
    let raf: number;
    const frame = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: config.ring, height: config.ring }}
      role="img"
      aria-label={`Score: ${score} out of ${maxScore}`}
    >
      <svg
        width={config.ring}
        height={config.ring}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={config.ring / 2}
          cy={config.ring / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={config.stroke}
        />
        {/* Progress */}
        <circle
          cx={config.ring / 2}
          cy={config.ring / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: animate ? "none" : "stroke-dashoffset 0.3s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${config.fontSize} font-semibold tabular-nums`}
          style={{ color }}
        >
          {displayScore}
        </span>
        {showLabel && label && (
          <span
            className={`${config.labelSize} text-[var(--text-muted)] font-medium mt-0.5`}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
