"use client";

import { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getSectionLabel } from "@/lib/section-labels";
import { LockIcon, SparklesIcon } from "@/components/ui/Icons";
import StudioEntryEditor, { computeEntryStableId } from "./StudioEntryEditor";
import { hasPlaceholders, PLACEHOLDER_HIGHLIGHT_RE } from "@/lib/utils/placeholder-detect";
import { synthesizeEntries, createBlankEntry } from "@/lib/utils/entry-synthesizer";
import type { RewritePreview, EntryScore, RewriteEntry } from "@/lib/types";

interface StudioSectionEditorProps {
  rewrite: RewritePreview;
  userImprovement?: string;
  userOptimized: Record<string, string>;
  userRewritten?: string;
  onImprovementChange: (sectionId: string, text: string) => void;
  onOptimizedChange: (key: string, text: string) => void;
  onRegenerate: (intent: "directions" | "draft") => void;
  onReset: (sectionId: string) => void;
  onResetEntry: (sectionId: string, entryStableId: string) => void;
  onDeleteEntry?: (sectionId: string, entryStableId: string) => void;
  /** HOTFIX-4C: Update entry header fields (organization/title) */
  onUpdateEntryHeader?: (sectionId: string, entryStableId: string, field: "organization" | "title", value: string) => void;
  isRegenerating: boolean;
  locked: boolean;
  onUpgradeClick?: () => void;
  /** Optional entry scores from results (v2 entry scoring) */
  entryScores?: EntryScore[];
  /** Callback to inject synthesized/manual entries into results for export */
  onInjectEntries?: (sectionId: string, entries: RewriteEntry[]) => void;
  /** HOTFIX-7: Regeneration tracking */
  regenerationCount?: number;
  regenerationTimestamp?: number;
  lastRegenerateNoDiff?: boolean;
}

/**
 * Match an entry score to a rewrite entry using robust strategies:
 * 1. Exact normalized title match
 * 2. Partial title substring match (first 20 chars)
 * Falls back to undefined (UI renders normally without score context)
 */
function findMatchingEntryScore(
  entry: RewriteEntry,
  entryScores?: EntryScore[]
): EntryScore | undefined {
  if (!entryScores || entryScores.length === 0) return undefined;
  const normalizedTitle = entry.entryTitle.toLowerCase().trim();

  // Strategy 1: exact title match
  const byTitle = entryScores.find(
    (es) => es.entryTitle.toLowerCase().trim() === normalizedTitle
  );
  if (byTitle) return byTitle;

  // Strategy 2: partial title match (first 20 chars)
  const byPartial = entryScores.find(
    (es) =>
      normalizedTitle.includes(es.entryTitle.toLowerCase().trim().slice(0, 20)) ||
      es.entryTitle.toLowerCase().trim().includes(normalizedTitle.slice(0, 20))
  );
  if (byPartial) return byPartial;

  return undefined;
}

export default function StudioSectionEditor({
  rewrite,
  userImprovement,
  userOptimized,
  userRewritten,
  onImprovementChange,
  onOptimizedChange,
  onRegenerate,
  onReset,
  onResetEntry,
  onDeleteEntry,
  onUpdateEntryHeader,
  isRegenerating,
  locked,
  onUpgradeClick,
  entryScores,
  onInjectEntries,
  regenerationCount = 0,
  regenerationTimestamp,
  lastRegenerateNoDiff,
}: StudioSectionEditorProps) {
  const { t } = useI18n();
  const sectionLabels = t.sectionLabels as Record<string, string>;
  const studioT = t.rewriteStudio as Record<string, string>;

  const [showOriginal, setShowOriginal] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  // Track manually added entries for any entry-based section
  const [manualEntries, setManualEntries] = useState<RewriteEntry[]>([]);
  // Track deleted entries (by stableId) — local state, propagated to parent via onDeleteEntry
  const [deletedEntryIds, setDeletedEntryIds] = useState<Set<string>>(new Set());

  // Resolution: userOptimized > userRewritten > rewrite.rewritten
  const sectionOptimized = userOptimized[rewrite.sectionId];
  const displayRewritten = sectionOptimized ?? userRewritten ?? rewrite.rewritten;
  const hasManualEdits = sectionOptimized !== undefined;
  const hasEntries = rewrite.entries && rewrite.entries.length > 0;
  // Unified: all entry-based sections (experience + education) share the same path
  const isEntryBasedSection = ["experience", "education", "work-experience", "education-section"].includes(rewrite.sectionId);

  // Synthesize entries when parser returns <=1 entry for ANY entry-based section
  const synthesizedEntries = useMemo(() => {
    if (!isEntryBasedSection) return null;
    if (hasEntries && rewrite.entries!.length > 1) return null; // parser found enough
    const synth = synthesizeEntries(rewrite.original, rewrite.rewritten);
    console.log(
      `[diag] entrySynthesizer sectionId=${rewrite.sectionId} ` +
      `parsedEntries=${rewrite.entries?.length ?? 0} synthesizedEntries=${synth.length}`
    );
    return synth;
  }, [isEntryBasedSection, hasEntries, rewrite.entries, rewrite.original, rewrite.rewritten, rewrite.sectionId]);

  // Effective entries = server entries (if >1) OR synthesized + manual, minus deleted
  const effectiveEntries = useMemo(() => {
    let entries: RewriteEntry[] | undefined;
    if (!isEntryBasedSection) {
      entries = rewrite.entries;
    } else if (hasEntries && rewrite.entries!.length > 1) {
      entries = [...rewrite.entries!, ...manualEntries];
    } else {
      const base = synthesizedEntries ?? (hasEntries ? rewrite.entries! : []);
      entries = [...base, ...manualEntries];
    }
    // Filter out deleted entries
    if (entries && deletedEntryIds.size > 0) {
      entries = entries.filter((e) => {
        const stableId = computeEntryStableId(e.entryTitle, e.original);
        return !deletedEntryIds.has(stableId);
      });
    }
    return entries;
  }, [isEntryBasedSection, hasEntries, rewrite.entries, synthesizedEntries, manualEntries, deletedEntryIds]);

  // Inject synthesized entries into parent results (for export flow)
  const injectedRef = useState<boolean>(false);
  if (isEntryBasedSection && synthesizedEntries && synthesizedEntries.length > 0 && onInjectEntries && !injectedRef[0]) {
    injectedRef[1](true);
    onInjectEntries(rewrite.sectionId, synthesizedEntries);
  }

  const effectiveHasEntries = effectiveEntries && effectiveEntries.length > 0;

  // Local delete handler: track locally + propagate to parent
  const handleDeleteEntry = useCallback(
    (sectionId: string, entryStableId: string) => {
      setDeletedEntryIds((prev) => new Set(prev).add(entryStableId));
      onDeleteEntry?.(sectionId, entryStableId);
    },
    [onDeleteEntry]
  );

  // Diagnostic log for entry-based sections
  if (isEntryBasedSection) {
    const parsedOrgCount = effectiveEntries?.filter((e) => e.organization).length ?? 0;
    const parsedTitleCount = effectiveEntries?.filter((e) => e.title).length ?? 0;
    const ambiguousCount = effectiveEntries?.filter((e) => !e.organization && !e.title).length ?? 0;
    console.log(
      `[diag] entryRenderer sectionId=${rewrite.sectionId} ` +
      `parsedEntries=${rewrite.entries?.length ?? 0} ` +
      `synthesizedEntries=${synthesizedEntries?.length ?? 0} ` +
      `manualEntries=${manualEntries.length} ` +
      `deletedEntries=${deletedEntryIds.size} ` +
      `effectiveEntries=${effectiveEntries?.length ?? 0} ` +
      `parsedOrganizationCount=${parsedOrgCount} ` +
      `parsedTitleCount=${parsedTitleCount} ` +
      `ambiguousEntryCount=${ambiguousCount} ` +
      `rendererPath=${effectiveHasEntries ? "entryCards" : "sectionTextarea"}`
    );
  }

  function handleRegenClick() {
    if (hasManualEdits) {
      setShowRegenConfirm(true);
    } else {
      onRegenerate("directions");
    }
  }

  function handleRegenConfirm(intent: "directions" | "draft") {
    setShowRegenConfirm(false);
    onRegenerate(intent);
  }

  // ── LOCKED STATE ──
  if (locked) {
    return (
      <div id={rewrite.sectionId} className="scroll-mt-24">
        <Card variant="default" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {getSectionLabel(rewrite.sectionId, sectionLabels)}
            </h3>
            <LockIcon size={14} className="text-[var(--text-muted)]" />
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 h-24" />
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 h-32" />
          </div>
          {onUpgradeClick && (
            <div className="mt-4 text-center">
              <p className="text-xs text-[var(--text-muted)] mb-2">
                {studioT.lockedDesc ?? "Upgrade your plan to access rewrites for this section."}
              </p>
              <Button variant="outline" size="sm" onClick={onUpgradeClick}>
                {studioT.upgradeCta ?? "Unlock Rewrites"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div id={rewrite.sectionId} className="scroll-mt-24">
      <Card variant="default" padding="md">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {getSectionLabel(rewrite.sectionId, sectionLabels)}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {showOriginal
                ? studioT.collapseOriginal ?? "Hide original"
                : studioT.expandOriginal ?? "Show original"}
            </button>
          </div>
        </div>

        {/* Truncation notice when section is near MAX_SECTION_CHARS limit */}
        {rewrite.original.length >= 9500 && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              {studioT.truncationNotice ?? "This section was truncated due to size limits. Some content may not appear in the rewrite."}
              <span className="ml-1 text-amber-500 font-medium">({rewrite.original.length.toLocaleString()} chars)</span>
            </p>
          </div>
        )}

        {/* Original (collapsible) */}
        {showOriginal && (
          <div className="mb-4 bg-red-50/40 border border-red-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">
              {t.rewriteStudio.original}
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {rewrite.original}
            </p>
          </div>
        )}

        {/* ── UNIFIED ENTRY-BASED RENDERING (Experience + Education share same path) ── */}
        {effectiveHasEntries ? (
          <div className="space-y-2 mb-4">
            {effectiveEntries!.map((entry, idx) => {
              const stableId = computeEntryStableId(entry.entryTitle, entry.original);
              const entryKey = `${rewrite.sectionId}:${stableId}`;
              // Robust matching: title-based -> partial -> index fallback
              let matchingScore = findMatchingEntryScore(entry, entryScores);
              if (
                !matchingScore &&
                entryScores &&
                rewrite.entries &&
                entryScores.length === rewrite.entries.length
              ) {
                matchingScore = entryScores[idx]; // index-based fallback
              }
              return (
                <StudioEntryEditor
                  key={entryKey}
                  entry={entry}
                  entryIndex={idx}
                  sectionId={rewrite.sectionId}
                  userOptimized={userOptimized[entryKey]}
                  onOptimizedChange={onOptimizedChange}
                  onResetEntry={onResetEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onUpdateHeader={onUpdateEntryHeader}
                  locked={locked}
                  entryScore={matchingScore}
                />
              );
            })}

            {/* + Add entry button for any entry-based section */}
            {isEntryBasedSection && !locked && (
              <button
                onClick={() => {
                  const newEntry = createBlankEntry(
                    (effectiveEntries?.length ?? 0) + manualEntries.length
                  );
                  setManualEntries((prev) => [...prev, newEntry]);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-emerald-600 bg-emerald-50/50 border border-dashed border-emerald-300 rounded-xl hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
              >
                <span className="text-base leading-none">+</span>
                {studioT.addEntry ?? "+ Add entry"}
              </button>
            )}
          </div>
        ) : (
          /* Section-level optimized draft with inline placeholder highlighting */
          <div className="mb-4 border-2 border-emerald-200 bg-emerald-50/30 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
              {studioT.optimizedDraft ?? "Optimized Draft"}
            </p>
            <div className="relative">
              {/* Highlight overlay — renders behind the transparent textarea */}
              {hasPlaceholders(displayRewritten) && (
                <div
                  className="absolute inset-0 p-3 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{
                    __html: displayRewritten
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(
                        PLACEHOLDER_HIGHLIGHT_RE,
                        (match) => `<mark class="bg-amber-200/70 text-amber-900 rounded px-0.5">${match}</mark>`
                      ),
                  }}
                />
              )}
              <textarea
                value={displayRewritten}
                onChange={(e) =>
                  onOptimizedChange(rewrite.sectionId, e.target.value)
                }
                className={`relative w-full min-h-[120px] text-sm border border-emerald-100 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300/50 leading-relaxed ${
                  hasPlaceholders(displayRewritten)
                    ? "text-transparent caret-[var(--text-primary)] bg-transparent"
                    : "text-[var(--text-primary)] bg-white/60"
                }`}
                style={hasPlaceholders(displayRewritten)
                  ? { fieldSizing: "content", WebkitTextFillColor: "transparent" } as React.CSSProperties
                  : { fieldSizing: "content" } as React.CSSProperties
                }
              />
            </div>
            {/* Placeholder legend */}
            {hasPlaceholders(displayRewritten) && (
              <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded bg-amber-200 border border-amber-400 text-center text-[9px] font-bold leading-[16px]">!</span>
                Items in [BRACKETS] need your input before final use
              </p>
            )}
          </div>
        )}

        {/* HOTFIX-7: Regeneration feedback */}
        {regenerationTimestamp && Date.now() - regenerationTimestamp < 30_000 && !lastRegenerateNoDiff && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded-full">
              {studioT.regenerateUpdatedJustNow ?? "Updated just now"}
            </span>
          </div>
        )}
        {lastRegenerateNoDiff && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
            {studioT.regenerateNoDiff ?? "No significant changes generated"}
          </div>
        )}

        {/* AI Instructions + Suggestions (collapsible) — HOTFIX-6A */}
        <div className="mb-4">
          <button
            onClick={() => setShowDirections(!showDirections)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors mb-2"
          >
            <span className={`transition-transform ${showDirections ? "rotate-90" : ""}`}>▸</span>
            {studioT.directionsLabel ?? "AI Instructions"}
          </button>
          {showDirections && (
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-3">
              {/* Workflow guide — 3-step compact banner */}
              <div className="flex items-center gap-3 text-[10px] font-medium text-indigo-500">
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold">1</span>
                  {studioT.workflowStep1 ?? "Replace [BRACKETS] with your info"}
                </span>
                <span className="text-indigo-300">→</span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold">2</span>
                  {studioT.workflowStep2 ?? "Add AI instructions below"}
                </span>
                <span className="text-indigo-300">→</span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold">3</span>
                  {studioT.workflowStep3 ?? "Click Regenerate"}
                </span>
              </div>

              {/* AI Suggestions (read-only) */}
              {rewrite.improvements && (
                <div>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                    {studioT.aiSuggestionsLabel ?? "AI Suggestions"}
                  </p>
                  <div className="text-xs text-indigo-700/70 bg-indigo-100/40 border border-indigo-100 rounded-lg p-2 leading-relaxed italic">
                    {rewrite.improvements}
                  </div>
                </div>
              )}

              {/* User Instructions textarea */}
              <textarea
                value={userImprovement ?? ""}
                onChange={(e) =>
                  onImprovementChange(rewrite.sectionId, e.target.value)
                }
                placeholder={studioT.directionsPlaceholder ?? "Tell the AI what to change..."}
                rows={3}
                className="w-full text-sm text-indigo-900 bg-white/50 border border-indigo-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300/50 leading-relaxed placeholder:text-indigo-300"
              />
            </div>
          )}
        </div>

        {/* Missing from Profile — HOTFIX-7: cap to 3 suggestions */}
        {rewrite.missingSuggestions.length > 0 && (
          <div className="mb-4 pt-3 border-t border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
              {studioT.missingFromProfile ?? "Missing from Profile"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rewrite.missingSuggestions.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-200 whitespace-normal break-words max-w-full leading-snug"
                >
                  <span className="mr-0.5 text-blue-400">+</span>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
          <button
            onClick={() => onReset(rewrite.sectionId)}
            className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors"
          >
            {studioT.resetSection ?? "Reset to original"}
          </button>

          <div className="relative flex items-center gap-2">
            {/* HOTFIX-7: Regeneration counter */}
            {regenerationCount < 3 && regenerationCount > 0 && (
              <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                {(studioT.regenRemaining ?? "{n}/3 regenerations remaining").replace("{n}", String(3 - regenerationCount))}
              </span>
            )}
            {regenerationCount >= 3 ? (
              <span className="text-[10px] text-amber-600 font-medium max-w-[160px] text-right">
                {studioT.regenLimitReached ?? "Regeneration limit reached. Edit manually or reset."}
              </span>
            ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRegenClick}
              disabled={isRegenerating}
              className="btn-regen-gradient"
            >
              <span className="flex items-center gap-1.5">
                <SparklesIcon size={14} className={isRegenerating ? "animate-spin" : ""} />
                {isRegenerating
                  ? studioT.regenerating ?? "Regenerating..."
                  : studioT.regenerate ?? "Regenerate"}
              </span>
            </Button>
            )}

            {/* Regenerate confirmation (inline card) */}
            {showRegenConfirm && (
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-[var(--border-light)] rounded-xl shadow-lg p-3 z-20">
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  {studioT.regenerateConfirm ?? "This will replace your current draft."}
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleRegenConfirm("directions")}
                    className="text-xs font-medium text-left px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    {studioT.regenerateFromDirections ?? "From directions"}
                  </button>
                  <button
                    onClick={() => handleRegenConfirm("draft")}
                    className="text-xs font-medium text-left px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {studioT.regenerateFromDraft ?? "Using current draft"}
                  </button>
                </div>
                <button
                  onClick={() => setShowRegenConfirm(false)}
                  className="mt-2 w-full text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
