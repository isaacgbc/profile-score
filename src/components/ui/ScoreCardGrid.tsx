"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "./Card";
import Badge from "./Badge";
import ScoreRing from "./ScoreRing";
import ProgressBar from "./ProgressBar";
import Button from "./Button";
import { getSectionLabel } from "@/lib/section-labels";
import type { ScoreSection, ScoreTier } from "@/lib/types";

interface ScoreCardGridProps {
  sections: ScoreSection[];
  onUpgradeClick?: () => void;
  className?: string;
}

const tierColors: Record<ScoreTier, string> = {
  poor: "#ef4444",
  fair: "#f59e0b",
  good: "#3b82f6",
  excellent: "#10b981",
};

function getTierBadgeVariant(tier: ScoreTier): "warning" | "accent" | "success" | "muted" {
  const map: Record<ScoreTier, "warning" | "accent" | "success" | "muted"> = {
    poor: "warning",
    fair: "warning",
    good: "accent",
    excellent: "success",
  };
  return map[tier];
}

export default function ScoreCardGrid({ sections, onUpgradeClick, className = "" }: ScoreCardGridProps) {
  const { t } = useI18n();
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

  function toggleExplanation(sectionId: string) {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function getTierLabel(tier: ScoreTier): string {
    const map: Record<ScoreTier, string> = {
      poor: t.results.tierPoor,
      fair: t.results.tierFair,
      good: t.results.tierGood,
      excellent: t.results.tierExcellent,
    };
    return map[tier];
  }

  const sectionLabels = t.sectionLabels as Record<string, string>;
  const readMore = (t.common as Record<string, string>).readMore ?? "Read more";
  const readLess = (t.common as Record<string, string>).readLess ?? "Read less";

  return (
    <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
      {sections.map((section, idx) => (
        <Card
          key={section.id}
          variant="default"
          padding="md"
          locked={section.locked}
          lockedLabel={t.results.lockedTitle}
          className="animate-slide-up"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          {/* Header: Ring + Name + Tier */}
          <div className="flex items-start gap-3 mb-3">
            <ScoreRing
              score={section.score}
              maxScore={section.maxScore}
              tier={section.tier}
              size="sm"
              animate={!section.locked}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">
                {getSectionLabel(section.id, sectionLabels)}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant={getTierBadgeVariant(section.tier)}>
                  {getTierLabel(section.tier)}
                </Badge>
                <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  {section.score}/{section.maxScore}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar
            value={section.score}
            max={section.maxScore}
            color={tierColors[section.tier]}
          />

          {/* Explanation — expand/collapse for readability */}
          {!section.locked && section.explanation && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                {t.results.explanationLabel}
              </p>
              <p
                className={`text-xs text-[var(--text-secondary)] leading-relaxed ${
                  expandedExplanations.has(section.id) ? "" : "line-clamp-3"
                }`}
              >
                {section.explanation}
              </p>
              {section.explanation.length > 150 && (
                <button
                  onClick={() => toggleExplanation(section.id)}
                  className="text-[10px] font-medium text-[var(--accent)] hover:underline mt-1"
                >
                  {expandedExplanations.has(section.id) ? readLess : readMore}
                </button>
              )}
            </div>
          )}

          {/* Improvement Suggestions — full list, wrapping pills */}
          {!section.locked && section.improvementSuggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                {t.results.missingSuggestionsLabel}
              </p>
              <div className="flex flex-wrap gap-1">
                {section.improvementSuggestions.map((suggestion, i) => (
                  <span
                    key={i}
                    className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full border border-amber-100 whitespace-normal break-words max-w-full"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade CTA for locked cards */}
          {section.locked && onUpgradeClick && (
            <div className="mt-3 relative z-20">
              <Button variant="outline" size="sm" fullWidth onClick={onUpgradeClick}>
                {t.results.upgradeCta}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
