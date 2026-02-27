"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import type { RewriteEntry, EntryScore } from "@/lib/types";
import { computeEntryStableId } from "@/lib/utils/entry-id";
import { hasPlaceholders } from "@/lib/utils/placeholder-detect";

// Re-export for backward compatibility
export { computeEntryStableId };

interface StudioEntryEditorProps {
  entry: RewriteEntry;
  entryIndex: number;
  sectionId: string;
  userOptimized?: string;
  onOptimizedChange: (key: string, text: string) => void;
  onResetEntry: (sectionId: string, entryStableId: string) => void;
  locked: boolean;
  /** Optional entry score context from v2 entry scoring */
  entryScore?: EntryScore;
  /** HOTFIX-4: Force always-expanded (no collapsible header). Used for education sections. */
  forceExpanded?: boolean;
}

export default function StudioEntryEditor({
  entry,
  sectionId,
  userOptimized,
  onOptimizedChange,
  onResetEntry,
  locked,
  entryScore,
  forceExpanded,
}: StudioEntryEditorProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(forceExpanded ?? false);

  const stableId = computeEntryStableId(entry.entryTitle, entry.original);
  const stateKey = `${sectionId}:${stableId}`;
  const displayText = userOptimized ?? entry.rewritten;
  const hasEdits = userOptimized !== undefined;

  const resetEntryLabel =
    (t.rewriteStudio as Record<string, string>).resetEntry ?? "Reset this entry";
  const optimizedLabel =
    (t.rewriteStudio as Record<string, string>).optimizedDraft ?? "Optimized Draft";
  const originalLabel = t.rewriteStudio.original;

  // HOTFIX-4: When forceExpanded, always show content (no toggle)
  const isOpen = forceExpanded || expanded;

  return (
    <div className={forceExpanded
      ? "border-b border-[var(--border-light)] last:border-b-0 pb-4 mb-2"
      : "border border-[var(--border-light)] rounded-xl overflow-hidden"
    }>
      {/* Header: collapsible for experience, static label for education */}
      {forceExpanded ? (
        <div className="px-1 py-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {entry.entryTitle}
          </span>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-secondary)]/50 transition-colors"
        >
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {entry.entryTitle}
          </span>
          <span
            className={`text-xs text-[var(--text-muted)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>
      )}

      {/* Content: always mounted when forceExpanded, lazy otherwise */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Original (read-only) */}
          <div className="bg-red-50/40 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">
              {originalLabel}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {entry.original}
            </p>
          </div>

          {/* Entry score context (v2) */}
          {entryScore && (
            <div className="flex items-center gap-2 px-1">
              <span className={`text-xs font-bold tabular-nums ${
                entryScore.score >= 70 ? "text-emerald-600" :
                entryScore.score >= 40 ? "text-amber-600" : "text-red-500"
              }`}>
                {entryScore.score}/100
              </span>
              <span className="text-[10px] text-[var(--text-muted)] leading-snug line-clamp-1">
                {entryScore.whyThisScore}
              </span>
            </div>
          )}

          {/* Optimized Draft (editable) with HOTFIX-3 inline placeholder highlighting */}
          {!locked && (
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                {optimizedLabel}
              </p>
              <div className="relative">
                {hasPlaceholders(displayText) && (
                  <div
                    className="absolute inset-0 p-2 text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                      __html: displayText
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(
                          /\[[A-Z][A-Z0-9_ /'-]*\]/g,
                          (match) => `<mark class="bg-amber-200/70 text-amber-900 rounded px-0.5">${match}</mark>`
                        ),
                    }}
                  />
                )}
                <textarea
                  value={displayText}
                  onChange={(e) => onOptimizedChange(stateKey, e.target.value)}
                  className={`relative w-full min-h-[80px] text-sm border border-emerald-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300/50 leading-relaxed ${
                    hasPlaceholders(displayText)
                      ? "text-transparent caret-[var(--text-primary)] bg-transparent"
                      : "text-[var(--text-primary)] bg-white/60"
                  }`}
                  style={hasPlaceholders(displayText)
                    ? { fieldSizing: "content", WebkitTextFillColor: "transparent" } as React.CSSProperties
                    : { fieldSizing: "content" } as React.CSSProperties
                  }
                />
              </div>
              {/* HOTFIX-3: Placeholder legend */}
              {hasPlaceholders(displayText) && (
                <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1.5">
                  <span className="inline-block w-4 h-4 rounded bg-amber-200 border border-amber-400 text-center text-[9px] font-bold leading-[16px]">!</span>
                  Items in [BRACKETS] need your input before final use
                </p>
              )}
              {hasEdits && (
                <button
                  onClick={() => onResetEntry(sectionId, stableId)}
                  className="mt-1 text-[10px] text-[var(--text-muted)] hover:text-red-500 transition-colors"
                >
                  {resetEntryLabel}
                </button>
              )}
            </div>
          )}

          {/* Missing suggestions */}
          {entry.missingSuggestions.length > 0 && (
            <div className="pt-2 border-t border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">
                {(t.rewriteStudio as Record<string, string>).missingFromProfile ??
                  "Missing from Profile"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entry.missingSuggestions.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-200 whitespace-normal break-words max-w-full leading-snug"
                  >
                    <span className="mr-0.5 text-blue-400">+</span>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
