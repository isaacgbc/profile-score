"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "./Card";
import Button from "./Button";
import { getSectionLabel } from "@/lib/section-labels";
import type { RewritePreview } from "@/lib/types";

interface RewriteLabels {
  original: string;
  improvements: string;
  improvementsPlaceholder: string;
  optimized: string;
  missingSuggestionsLabel: string;
}

interface RewriteCardProps {
  rewrite: RewritePreview;
  userImprovement?: string;
  /** Override for the optimized text (e.g., from regeneration) */
  optimizedOverride?: string;
  onChange?: (text: string) => void;
  locked: boolean;
  onUpgradeClick?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
  variant?: "default" | "studio";
  labels?: RewriteLabels;
}

export default function RewriteCard({
  rewrite,
  userImprovement,
  optimizedOverride,
  onChange,
  locked,
  onUpgradeClick,
  onRegenerate,
  isRegenerating,
  className = "",
  variant = "default",
  labels,
}: RewriteCardProps) {
  const { t } = useI18n();
  const [expandedOriginal, setExpandedOriginal] = useState(false);
  const [expandedOptimized, setExpandedOptimized] = useState(false);

  // Use custom labels or fall back to default i18n
  const l = labels ?? {
    original: t.results.original,
    improvements: t.results.improvements,
    improvementsPlaceholder: t.results.improvementsPlaceholder,
    optimized: t.results.optimized,
    missingSuggestionsLabel: t.results.missingSuggestionsLabel,
  };

  const showMore = (t.common as Record<string, string>).showMore ?? "Show more";
  const showLess = (t.common as Record<string, string>).showLess ?? "Show less";
  const perEntryLabel =
    (t.results as Record<string, string>).perEntryBreakdown ?? "Per-entry breakdown";
  const regenerateLabel =
    (t.rewriteStudio as Record<string, string>).regenerate ?? "Regenerate";
  const regeneratingLabel =
    (t.rewriteStudio as Record<string, string>).regenerating ?? "Regenerating...";

  // Resolved optimized text: user regeneration override > original rewrite
  const displayRewritten = optimizedOverride ?? rewrite.rewritten;

  const isStudio = variant === "studio";
  const sectionLabels = t.sectionLabels as Record<string, string>;

  // ─── LOCKED STATE ───
  if (locked) {
    const lockedDesc = isStudio ? t.rewriteStudio.lockedDesc : t.results.lockedDesc;
    const upgradeCta = isStudio ? t.rewriteStudio.upgradeCta : t.results.upgradeCta;

    return (
      <Card
        variant="default"
        padding="md"
        locked
        className={className}
      >
        <h3 className={`font-semibold text-[var(--text-primary)] mb-3 ${isStudio ? "text-base" : "text-sm"}`}>
          {getSectionLabel(rewrite.sectionId, sectionLabels)}
        </h3>
        <div className={`grid gap-3 ${isStudio ? "md:grid-cols-5" : "md:grid-cols-3"}`}>
          <div className={`bg-red-50/50 border border-red-100 rounded-xl p-4 h-24 ${isStudio ? "md:col-span-1" : ""}`} />
          <div className={`bg-amber-50/50 border border-amber-200 rounded-xl p-4 ${isStudio ? "md:col-span-3 h-32 border-2" : "h-24"}`} />
          <div className={`bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 h-24 ${isStudio ? "md:col-span-1" : ""}`} />
        </div>
        {onUpgradeClick && (
          <div className="mt-4 text-center relative z-20">
            <p className="text-xs text-[var(--text-muted)] mb-2">{lockedDesc}</p>
            <Button variant="outline" size="sm" onClick={onUpgradeClick}>
              {upgradeCta}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  // ─── Missing Suggestions (blue palette — semantic: "add new content") ───
  function renderMissingSuggestions(pills: string[], compact = false) {
    if (!pills || pills.length === 0) return null;
    return (
      <div className={`${compact ? "mt-2 pt-2" : "mt-3 pt-3"} border-t border-blue-100`}>
        <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold text-blue-600 uppercase tracking-wider ${compact ? "mb-1" : "mb-2"}`}>
          {l.missingSuggestionsLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pills.map((suggestion, i) => (
            <span
              key={i}
              className={`inline-flex items-center ${
                compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
              } font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-200 whitespace-normal break-words max-w-full leading-snug`}
            >
              <span className="mr-0.5 text-blue-400">+</span>
              {suggestion}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ─── Per-entry sub-cards ───
  function renderEntries() {
    if (!rewrite.entries || rewrite.entries.length === 0) return null;
    return (
      <div className="mt-4 space-y-3">
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {perEntryLabel}
        </p>
        {rewrite.entries.map((entry, idx) => (
          <div
            key={idx}
            className="border border-[var(--border-light)] rounded-xl p-3 bg-[var(--surface-secondary)]/30"
          >
            <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">
              {entry.entryTitle}
            </p>
            <div className="grid md:grid-cols-3 gap-2">
              {/* Entry original */}
              <div className="bg-red-50/40 rounded-lg p-2">
                <p className="text-[9px] font-semibold text-red-400 uppercase mb-1">
                  {l.original}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {entry.original}
                </p>
              </div>
              {/* Entry improvements */}
              <div className="bg-amber-50/40 rounded-lg p-2">
                <p className="text-[9px] font-semibold text-amber-500 uppercase mb-1">
                  {l.improvements}
                </p>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {entry.improvements}
                </p>
                {renderMissingSuggestions(entry.missingSuggestions, true)}
              </div>
              {/* Entry optimized */}
              <div className="bg-emerald-50/40 rounded-lg p-2">
                <p className="text-[9px] font-semibold text-emerald-500 uppercase mb-1">
                  {l.optimized}
                </p>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  {entry.rewritten}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── UNLOCKED: DEFAULT VARIANT ───
  if (!isStudio) {
    return (
      <Card variant="default" padding="md" className={className}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          {getSectionLabel(rewrite.sectionId, sectionLabels)}
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {/* Original (red) */}
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">
              {l.original}
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {rewrite.original}
            </p>
          </div>

          {/* Things to Change (amber, editable) */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2">
              {l.improvements}
            </p>
            <textarea
              value={userImprovement ?? rewrite.improvements}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={l.improvementsPlaceholder}
              rows={4}
              className="w-full text-sm text-amber-900 bg-transparent resize-none focus:outline-none leading-relaxed placeholder:text-amber-300"
            />
            {renderMissingSuggestions(rewrite.missingSuggestions)}
          </div>

          {/* Optimized (green) */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">
              {l.optimized}
            </p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {displayRewritten}
            </p>
          </div>
        </div>
        {renderEntries()}
      </Card>
    );
  }

  // ─── UNLOCKED: STUDIO VARIANT (1 + 3 + 1 weighted grid) ───
  return (
    <Card variant="default" padding="md" className={className}>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
        {getSectionLabel(rewrite.sectionId, sectionLabels)}
      </h3>
      <div className="grid md:grid-cols-5 gap-3">
        {/* Original (col-span-1, expandable) */}
        <div className="md:col-span-1 bg-red-50/60 border border-red-100 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">
            {l.original}
          </p>
          <p
            className={`text-xs text-[var(--text-secondary)] leading-relaxed ${
              expandedOriginal ? "max-h-96 overflow-y-auto" : "line-clamp-6"
            }`}
          >
            {rewrite.original}
          </p>
          {rewrite.original.length > 300 && (
            <button
              onClick={() => setExpandedOriginal(!expandedOriginal)}
              className="text-[10px] font-medium text-red-500 hover:underline mt-1"
            >
              {expandedOriginal ? showLess : showMore}
            </button>
          )}
        </div>

        {/* Things to Change (col-span-3, DOMINANT, editable) */}
        <div className="md:col-span-3 bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
            {l.improvements}
          </p>
          <textarea
            value={userImprovement ?? rewrite.improvements}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={l.improvementsPlaceholder}
            rows={6}
            className="w-full min-h-[120px] text-sm text-amber-900 bg-white/50 border border-amber-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/50 leading-relaxed placeholder:text-amber-300"
          />
          {/* Missing Suggestions — blue palette (semantic: add new content) */}
          {renderMissingSuggestions(rewrite.missingSuggestions)}
        </div>

        {/* Optimized (col-span-1, expandable) */}
        <div className="md:col-span-1 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">
            {l.optimized}
          </p>
          <p
            className={`text-xs text-[var(--text-primary)] leading-relaxed ${
              expandedOptimized ? "max-h-96 overflow-y-auto" : "line-clamp-6"
            }`}
          >
            {displayRewritten}
          </p>
          {displayRewritten.length > 300 && (
            <button
              onClick={() => setExpandedOptimized(!expandedOptimized)}
              className="text-[10px] font-medium text-emerald-600 hover:underline mt-1"
            >
              {expandedOptimized ? showLess : showMore}
            </button>
          )}
          {/* Regenerate button */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="mt-2 w-full text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition-colors"
            >
              {isRegenerating ? regeneratingLabel : regenerateLabel}
            </button>
          )}
        </div>
      </div>
      {renderEntries()}
    </Card>
  );
}
