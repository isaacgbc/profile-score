"use client";

import type { PreprocessResult } from "@/lib/utils/input-preprocessor";

// ── Props ───────────────────────────────────────────────

interface InputPreviewProps {
  /** Preprocessing result to display */
  result: PreprocessResult | null;
  /** i18n strings under `input.preview.*` */
  i18n: Record<string, string>;
  /** Source type for contextual labels */
  sourceType: "linkedin" | "cv";
}

// ── Component ───────────────────────────────────────────

export default function InputPreview({ result, i18n, sourceType }: InputPreviewProps) {
  if (!result || result.cleanedText.trim().length === 0) return null;

  const { detectedSections, detectedLanguage, languageConfidence, warnings, stats } = result;
  const hasCleaningWork = stats.removedChars > 0;
  const removedPct = stats.originalChars > 0
    ? Math.round((stats.removedChars / stats.originalChars) * 100)
    : 0;

  return (
    <div className="mt-2 rounded-lg border border-[var(--border-light)] bg-[var(--surface-secondary)] px-3 py-2.5">
      {/* Section badges */}
      {detectedSections.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {detectedSections.map((section) => (
            <span
              key={section.name}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20"
            >
              {section.name}
            </span>
          ))}
        </div>
      )}

      {/* Stats line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
        {/* Detected sections count */}
        <span>
          {detectedSections.length} {i18n.sectionsFound ?? "sections found"}
        </span>

        {/* Cleaning stats (only if anything was removed) */}
        {hasCleaningWork && (
          <span className="text-emerald-600">
            {i18n.cleaned?.replace("{pct}", String(removedPct)) ?? `${removedPct}% noise removed`}
          </span>
        )}

        {/* Language */}
        {languageConfidence >= 0.3 && (
          <span>
            {i18n.language ?? "Language"}: {detectedLanguage.toUpperCase()}
            {languageConfidence < 0.6 && (
              <span className="text-amber-500 ml-0.5">({i18n.lowConfidence ?? "low confidence"})</span>
            )}
          </span>
        )}

        {/* Character count */}
        <span>
          {stats.cleanedChars.toLocaleString()} {i18n.chars ?? "chars"}
        </span>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {warnings.map((warningKey) => (
            <p key={warningKey} className="text-[10px] text-amber-600">
              ⚠ {i18n[warningKey] ?? warningKey}
            </p>
          ))}
        </div>
      )}

      {/* Language mismatch warning */}
      {detectedLanguage !== "en" && detectedLanguage !== "es" && languageConfidence >= 0.4 && (
        <p className="text-[10px] text-amber-600 mt-1">
          ⚠ {i18n.unsupportedLanguage ?? "Input language may not be fully supported. Best results with English or Spanish."}
        </p>
      )}
    </div>
  );
}
