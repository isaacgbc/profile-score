"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "./Card";
import Badge from "./Badge";
import ScoreRing from "./ScoreRing";
import ProgressBar from "./ProgressBar";
import Button from "./Button";
import EntryScoreCard from "./EntryScoreCard";
import InlineUpgradeCTA from "./InlineUpgradeCTA";
import { getSectionLabel } from "@/lib/section-labels";
import { LockIcon } from "./Icons";
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
  const [expandedEntryScores, setExpandedEntryScores] = useState<Set<string>>(new Set());

  const fp = (t as unknown as Record<string, Record<string, string>>).freePreview ?? {};
  const totalLocked = sections.filter((s) => s.locked).length;

  function toggleExplanation(sectionId: string) {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function toggleEntryScores(sectionId: string) {
    setExpandedEntryScores((prev) => {
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
      {sections.map((section, idx) => {
        const isFreePreview = section.freePreview === true && !section.locked;
        const isLocked = section.locked;
        const isFullyUnlocked = !section.locked && !section.freePreview;

        return (
          <Card
            key={section.id}
            variant="default"
            padding="md"
            /* No longer use Card-level locked overlay — we handle content blurring ourselves */
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
                animate={!isLocked}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">
                    {getSectionLabel(section.id, sectionLabels)}
                  </h3>
                  {isFreePreview && (
                    <span className="shrink-0 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {fp.badge ?? "Free preview"}
                    </span>
                  )}
                  {isLocked && (
                    <LockIcon size={12} className="shrink-0 text-[var(--text-muted)]" />
                  )}
                </div>
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

            {/* ── LOCKED: Blurred REAL content + inline unlock CTA ── */}
            {isLocked && section.explanation && (
              <div className="mt-3 relative">
                <div
                  className="blur-[6px] select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {t.results.explanationLabel}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                    {section.explanation}
                  </p>
                  {section.improvementSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {section.improvementSuggestions.slice(0, 2).map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex px-2 py-1 text-[10px] bg-amber-50 text-amber-700 rounded-lg border border-amber-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Overlay CTA */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {onUpgradeClick && (
                    <button
                      onClick={onUpgradeClick}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[var(--accent)] rounded-lg shadow-md hover:opacity-90 transition-opacity"
                    >
                      <LockIcon size={12} />
                      {fp.unlockSection ?? "Unlock this section"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── LOCKED without content: fallback gradient bar ── */}
            {isLocked && !section.explanation && (
              <div className="mt-3 h-12 rounded-lg bg-gradient-to-r from-[var(--surface-secondary)] to-[var(--border-light)] opacity-40" />
            )}

            {/* ── UNLOCKED (paid or free preview): Full content ── */}
            {!isLocked && section.explanation && (
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

            {/* Improvement Suggestions */}
            {!isLocked && section.improvementSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                  {t.results.missingSuggestionsLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {section.improvementSuggestions.map((suggestion, i) => (
                    <span
                      key={i}
                      className="inline-flex px-3 py-1.5 text-[11px] font-medium bg-amber-50 text-amber-700 rounded-lg border border-amber-100 whitespace-normal break-words max-w-full leading-snug"
                    >
                      {suggestion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Entry-level scores (expandable) */}
            {!isLocked && section.entryScores && section.entryScores.length > 0 && (
              <div className="mt-3 border-t border-[var(--border-light)] pt-3">
                <button
                  onClick={() => toggleEntryScores(section.id)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-2"
                >
                  <span className={`transition-transform ${expandedEntryScores.has(section.id) ? "rotate-90" : ""}`}>▸</span>
                  {(t.results as Record<string, string>).entryBreakdown ?? "Entry Breakdown"} ({section.entryScores.length})
                </button>
                {expandedEntryScores.has(section.id) && (
                  <div className="space-y-2">
                    {section.entryScores.map((entry, i) => (
                      <EntryScoreCard
                        key={i}
                        entry={entry}
                        locked={section.locked}
                        onUpgradeClick={onUpgradeClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Free preview: "Like what you see?" CTA */}
            {isFreePreview && onUpgradeClick && totalLocked > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-100">
                <InlineUpgradeCTA
                  context="section"
                  totalLocked={totalLocked}
                  onUpgrade={onUpgradeClick}
                />
              </div>
            )}

            {/* Locked: bottom inline CTA (secondary, below blurred content) */}
            {isLocked && onUpgradeClick && (
              <div className="mt-2 text-center">
                <InlineUpgradeCTA
                  context="section"
                  totalLocked={totalLocked}
                  onUpgrade={onUpgradeClick}
                  className="text-[var(--text-muted)]"
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
