"use client";

import { useState } from "react";
import Image from "next/image";

interface BrandLogoProps {
  /** Rendered size in pixels (width = height, square logo) */
  size?: number;
  /** Additional CSS classes on the wrapper */
  className?: string;
}

/**
 * Brand logo component with graceful fallback.
 * Renders the SVG logo at the requested size.
 * If the logo fails to load, shows a styled "PS" text badge.
 */
export default function BrandLogo({ size = 32, className = "" }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    // Fallback: styled "PS" badge matching original design
    const fontSize = Math.max(10, Math.round(size * 0.38));
    const borderRadius = size >= 24 ? "rounded-lg" : "rounded-md";
    return (
      <div
        className={`${borderRadius} bg-[var(--accent)] flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-label="Profile Score"
      >
        <span className="text-white font-bold" style={{ fontSize }}>
          PS
        </span>
      </div>
    );
  }

  return (
    <Image
      src="/brand/logo.svg"
      alt="Profile Score"
      width={size}
      height={size}
      className={`flex-shrink-0 ${className}`}
      onError={() => setImgError(true)}
      priority={size >= 32}
    />
  );
}
