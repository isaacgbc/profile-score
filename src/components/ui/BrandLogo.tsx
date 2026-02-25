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
 *
 * Corner radius is baked in to match the logo SVG's rounded-rect
 * clip path (75 / 750 = 10% of the image element).
 */
export default function BrandLogo({ size = 32, className = "" }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  // Logo SVG has 75px corner radius in a 750px viewBox → 10%.
  // Fallback badge has no padding so it needs the content-area ratio:
  // 75 / 562.5 ≈ 13%.
  const imgRadius = Math.round(size * 0.1);
  const badgeRadius = Math.round(size * 0.13);

  if (imgError) {
    // Fallback: styled "PS" badge matching logo shape
    const fontSize = Math.max(10, Math.round(size * 0.38));
    return (
      <div
        className={`bg-[var(--accent)] flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: badgeRadius }}
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
      style={{ borderRadius: imgRadius }}
      onError={() => setImgError(true)}
      priority={size >= 32}
    />
  );
}
