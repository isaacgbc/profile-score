"use client";

import { type ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "error" | "muted" | "free";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
  accent:
    "bg-[var(--accent-light)] text-[var(--accent)]",
  success:
    "bg-emerald-50 text-emerald-700",
  warning:
    "bg-amber-50 text-amber-700",
  error:
    "bg-red-50 text-red-700",
  muted:
    "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
  free:
    "bg-emerald-50 text-emerald-600 border border-emerald-200",
};

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
