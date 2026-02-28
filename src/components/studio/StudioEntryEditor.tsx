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
  onDeleteEntry?: (sectionId: string, entryStableId: string) => void;
  locked: boolean;
  /** Optional entry score context from v2 entry scoring */
  entryScore?: EntryScore;
}

export default function StudioEntryEditor({
  entry,
  sectionId,
  userOptimized,
  onOptimizedChange,
  onResetEntry,
  onDeleteEntry,
  locked,
  entryScore,
}: StudioEntryEditorProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const stableId = computeEntryStableId(entry.entryTitle, entry.original);
  const stateKey = `${sectionId}:${stableId}`;
  const displayText = userOptimized ?? entry.rewritten;
  const hasEdits = userOptimized !== undefined;

  const studioT = t.rewriteStudio as Record<string, string>;
  const resetEntryLabel = studioT.resetEntry ?? "Reset this entry";
  const optimizedLabel = studioT.optimizedDraft ?? "Optimized Draft";
  const originalLabel = t.rewriteStudio.original;
  const deleteLabel = studioT.deleteEntry ?? "Delete";
  const deleteConfirmLabel = studioT.deleteEntryConfirm ?? "Delete this entry?";

  // Structured header fields (with fallback to entryTitle)
  const orgDisplay = entry.organization || null;
  const titleDisplay = entry.title || null;
  const dateDisplay = entry.dateRange || null;
  const hasSeparateFields = orgDisplay || titleDisplay;

  return (
    <div className="border border-[var(--border-light)] rounded-xl overflow-hidden">
      {/* Collapsible header — structured: Organization > Title > Date */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-[var(--surface-secondary)]/50 transition-colors gap-2"
      >
        <div className="flex-1 min-w-0">
          {hasSeparateFields ? (
            <>
              {/* Line 1: Organization (bold) */}
              {orgDisplay && (
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">
                  {orgDisplay}
                </p>
              )}
              {/* Line 2: Title/Role/Degree (regular) */}
              {titleDisplay && (
                <p className="text-xs text-[var(--text-secondary)] leading-snug mt-0.5 line-clamp-2">
                  {titleDisplay}
                </p>
              )}
              {/* Line 3: Date range (muted) */}
              {dateDisplay && (
                <p className="text-[10px] text-[var(--text-muted)] leading-snug mt-0.5">
                  {dateDisplay}
                </p>
              )}
            </>
          ) : (
            /* Fallback: single entryTitle line (backward compat for old cached results) */
            <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
              {entry.entryTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          {/* Delete button */}
          {onDeleteEntry && !locked && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="text-[10px] text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer px-1"
              title={deleteLabel}
            >
              ✕
            </span>
          )}
          <span
            className={`text-xs text-[var(--text-muted)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Delete confirmation inline */}
      {showDeleteConfirm && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between">
          <span className="text-xs text-red-700">{deleteConfirmLabel}</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                onDeleteEntry?.(sectionId, stableId);
              }}
              className="text-[10px] font-medium text-red-600 hover:text-red-800 px-2 py-1 bg-red-100 rounded transition-colors"
            >
              {deleteLabel}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content: lazy-mounted on expand */}
      {expanded && (
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

          {/* Optimized Draft (editable) with inline placeholder highlighting */}
          {!locked && (
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                {optimizedLabel}
              </p>
              <div className="relative">
                {hasPlaceholders(displayText) && (
                  <div
                    className="absolute inset-0 p-2 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
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
              {/* Placeholder legend */}
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
                {studioT.missingFromProfile ?? "Missing from Profile"}
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
