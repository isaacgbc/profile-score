"use client";

import { useI18n } from "@/context/I18nContext";
import Card from "./Card";
import Badge from "./Badge";
import ScoreRing from "./ScoreRing";
import SectionSkeleton from "./SectionSkeleton";
import StepIndicator from "@/components/layout/StepIndicator";
import { getSectionLabel } from "@/lib/section-labels";
import type { ProgressStage } from "@/lib/services/audit-orchestrator";
import type { ScoreSection, RewritePreview, ScoreTier } from "@/lib/types";

export interface SectionPairProp {
  section: ScoreSection;
  rewrite: RewritePreview;
}

interface GenerationProgressProps {
  stage: ProgressStage | null;
  percent: number;
  label: string;
  completedSections: SectionPairProp[];
  totalSections: number;
  isPaid: boolean;
  /** HOTFIX-3: Context info for loader display */
  fileName?: string;
  objective?: string;
  outputLanguage?: string;
}

function getTierBadgeVariant(tier: ScoreTier): "warning" | "accent" | "success" | "muted" {
  const map: Record<ScoreTier, "warning" | "accent" | "success" | "muted"> = {
    poor: "warning",
    fair: "warning",
    good: "accent",
    excellent: "success",
  };
  return map[tier];
}

function getTierLabel(tier: ScoreTier, t: Record<string, string>): string {
  const map: Record<ScoreTier, string> = {
    poor: t.tierPoor ?? "Needs Work",
    fair: t.tierFair ?? "Fair",
    good: t.tierGood ?? "Good",
    excellent: t.tierExcellent ?? "Excellent",
  };
  return map[tier];
}

function getStageLabel(
  stage: ProgressStage | null,
  label: string,
  progress: Record<string, string>
): string {
  if (label) return label;
  if (!stage) return "";

  const stageMap: Record<string, string> = {
    cache_check: progress.stageExtractingInput ?? "Reading your profile...",
    extracting_input: progress.stageExtractingInput ?? "Reading your profile...",
    structuring_profile: progress.stageStructuring ?? "Structuring your profile...",
    auditing_sections: progress.stageAuditing ?? "Scoring your sections...",
    generating_rewrites: progress.stageRewrites ?? "Generating optimized rewrites...",
    scoring_entries: progress.stageScoringEntries ?? "Scoring individual entries...",
    generating_extras: progress.stageExtras ?? "Generating cover letter & summary...",
    finalizing_results: progress.stageFinalizing ?? "Finalizing your results...",
  };

  return stageMap[stage] ?? "";
}

export default function GenerationProgress({
  stage,
  percent,
  label,
  completedSections,
  totalSections,
  isPaid,
  fileName,
  objective,
  outputLanguage,
}: GenerationProgressProps) {
  const { t } = useI18n();
  const sectionLabels = t.sectionLabels as Record<string, string>;
  const progressStrings = (t as Record<string, Record<string, string>>).progress ?? {};
  const resultsStrings = t.results as Record<string, string>;

  const displayLabel = getStageLabel(stage, label, progressStrings);
  const remainingCount = Math.max(0, totalSections - completedSections.length);

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="results" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            {progressStrings.analyzing ?? "Analyzing your profile"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4 min-h-[20px]">
            {displayLabel}
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-md mx-auto h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          {totalSections > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {completedSections.length} / {totalSections}{" "}
              {progressStrings.sectionsComplete ?? "sections complete"}
            </p>
          )}

          {/* HOTFIX-3: Context info bar (filename, objective, language) */}
          {(fileName || objective || outputLanguage) && (
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              {fileName && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded">
                  {fileName}
                </span>
              )}
              {objective && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded truncate max-w-[200px]">
                  {objective}
                </span>
              )}
              {outputLanguage && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded">
                  {outputLanguage === "es" ? "Espa\u00f1ol" : "English"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Section cards grid — completed + skeletons */}
        {(completedSections.length > 0 || remainingCount > 0) && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Real completed section cards */}
            {completedSections.map((pair, idx) => (
              <Card
                key={pair.section.id}
                variant="default"
                padding="md"
                className="animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <ScoreRing
                    score={pair.section.score}
                    maxScore={pair.section.maxScore}
                    tier={pair.section.tier}
                    size="sm"
                    animate
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">
                      {getSectionLabel(pair.section.id, sectionLabels)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={getTierBadgeVariant(pair.section.tier)}>
                        {getTierLabel(pair.section.tier, resultsStrings)}
                      </Badge>
                      <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        {pair.section.score}/{pair.section.maxScore}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Truncated explanation preview */}
                {pair.section.explanation && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {pair.section.explanation}
                  </p>
                )}
              </Card>
            ))}

            {/* Skeleton placeholders for remaining sections */}
            {Array.from({ length: remainingCount }).map((_, i) => (
              <SectionSkeleton key={`skel-${i}`} />
            ))}
          </div>
        )}

        {/* Spinner for initial loading (before any sections) */}
        {completedSections.length === 0 && totalSections === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-12 h-12 rounded-full border-4 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
