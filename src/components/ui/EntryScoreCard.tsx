"use client";

import type { EntryScore } from "@/lib/types";
import ScoreRing from "./ScoreRing";
import { tierFromScore } from "@/lib/schemas/llm-output";

interface EntryScoreCardProps {
  entry: EntryScore;
  locked: boolean;
  onUpgradeClick?: () => void;
}

export default function EntryScoreCard({
  entry,
  locked,
  onUpgradeClick,
}: EntryScoreCardProps) {
  const tier = tierFromScore(entry.score);

  if (locked) {
    return (
      <div className="relative bg-gray-50/60 border border-gray-100 rounded-lg p-3 overflow-hidden">
        <div className="blur-sm pointer-events-none">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="h-3 w-32 bg-gray-200 rounded" />
              <div className="h-2 w-48 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
        {onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="absolute inset-0 flex items-center justify-center bg-white/60"
          >
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Unlock
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-white/80 border border-[var(--border-light)] rounded-lg p-3">
      {/* Mini score ring */}
      <div className="flex-shrink-0">
        <ScoreRing
          score={entry.score}
          maxScore={100}
          tier={tier}
          size="xs"
          animate={false}
        />
      </div>

      {/* Entry details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
          {entry.entryTitle}
        </p>
        <p className="text-[10px] text-[var(--text-muted)] leading-snug line-clamp-2 mt-0.5">
          {entry.whyThisScore}
        </p>

        {/* Things to change */}
        {entry.thingsToChange && (
          <p className="text-[10px] text-amber-600 leading-snug mt-1 line-clamp-2">
            {entry.thingsToChange}
          </p>
        )}

        {/* Missing from entry pills */}
        {entry.missingFromThisEntry.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {entry.missingFromThisEntry.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-normal break-words max-w-full leading-snug"
              >
                <span className="mr-0.5 text-blue-400">+</span>
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
