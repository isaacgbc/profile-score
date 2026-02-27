"use client";

import Card from "./Card";

/**
 * Pulsing skeleton placeholder card matching ScoreCard layout.
 * Used during progressive loading to show remaining sections.
 */
export default function SectionSkeleton() {
  return (
    <Card variant="default" padding="md" className="animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        {/* Score ring placeholder */}
        <div className="w-10 h-10 rounded-full bg-[var(--surface-secondary)]" />
        <div className="flex-1">
          {/* Section name placeholder */}
          <div className="h-4 w-24 bg-[var(--surface-secondary)] rounded mb-2" />
          {/* Tier badge placeholder */}
          <div className="h-3 w-16 bg-[var(--surface-secondary)] rounded" />
        </div>
      </div>
      {/* Content placeholder */}
      <div className="h-12 bg-[var(--surface-secondary)] rounded-lg" />
    </Card>
  );
}
