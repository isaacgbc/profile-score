"use client";

import { type ReactNode, type HTMLAttributes } from "react";
import { LockIcon } from "./Icons";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "highlighted";
  padding?: "sm" | "md" | "lg";
  hoverable?: boolean;
  locked?: boolean;
  lockedLabel?: string;
}

const variantClasses = {
  default: "bg-white border border-[var(--border)]",
  elevated: "bg-white shadow-md border border-[var(--border-light)]",
  outlined: "bg-transparent border-2 border-[var(--border)]",
  highlighted:
    "bg-white border-2 border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-light)]",
};

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({
  children,
  variant = "default",
  padding = "md",
  hoverable = false,
  locked = false,
  lockedLabel,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        relative rounded-2xl transition-all duration-200
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${hoverable && !locked ? "hover:shadow-lg hover:border-[var(--border-strong)] hover:-translate-y-0.5 cursor-pointer" : ""}
        ${locked ? "overflow-hidden" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
      {locked && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
          <LockIcon size={18} className="text-[var(--text-muted)]" />
          {lockedLabel && (
            <span className="text-sm font-medium text-[var(--text-muted)]">{lockedLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
