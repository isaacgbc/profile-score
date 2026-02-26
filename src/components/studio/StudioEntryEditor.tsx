"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import type { RewriteEntry } from "@/lib/types";

/** Compute a stable ID from entry title + original content (survives reorders) */
export function computeEntryStableId(title: string, original: string): string {
  const input = `${title}|${original.slice(0, 120)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

interface StudioEntryEditorProps {
  entry: RewriteEntry;
  entryIndex: number;
  sectionId: string;
  userOptimized?: string;
  onOptimizedChange: (key: string, text: string) => void;
  onResetEntry: (sectionId: string, entryStableId: string) => void;
  locked: boolean;
}

export default function StudioEntryEditor({
  entry,
  sectionId,
  userOptimized,
  onOptimizedChange,
  onResetEntry,
  locked,
}: StudioEntryEditorProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const stableId = computeEntryStableId(entry.entryTitle, entry.original);
  const stateKey = `${sectionId}:${stableId}`;
  const displayText = userOptimized ?? entry.rewritten;
  const hasEdits = userOptimized !== undefined;

  const resetEntryLabel =
    (t.rewriteStudio as Record<string, string>).resetEntry ?? "Reset this entry";
  const optimizedLabel =
    (t.rewriteStudio as Record<string, string>).optimizedDraft ?? "Optimized Draft";
  const originalLabel = t.rewriteStudio.original;

  return (
    <div className="border border-[var(--border-light)] rounded-xl overflow-hidden">
      {/* Collapsible header */}
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

      {/* Lazy-rendered content: only mounts when expanded */}
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

          {/* Optimized Draft (editable) */}
          {!locked && (
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                {optimizedLabel}
              </p>
              <textarea
                value={displayText}
                onChange={(e) => onOptimizedChange(stateKey, e.target.value)}
                className="w-full min-h-[80px] text-sm text-[var(--text-primary)] bg-white/60 border border-emerald-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300/50 leading-relaxed"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
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
