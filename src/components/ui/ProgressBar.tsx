"use client";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  color,
  className = "",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div
      className={`w-full h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          backgroundColor: color || "var(--accent)",
        }}
      />
    </div>
  );
}
