"use client";

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
  onChange?: (text: string) => void;
  locked: boolean;
  onUpgradeClick?: () => void;
  className?: string;
  variant?: "default" | "studio";
  labels?: RewriteLabels;
}

export default function RewriteCard({
  rewrite,
  userImprovement,
  onChange,
  locked,
  onUpgradeClick,
  className = "",
  variant = "default",
  labels,
}: RewriteCardProps) {
  const { t } = useI18n();

  // Use custom labels or fall back to default i18n
  const l = labels ?? {
    original: t.results.original,
    improvements: t.results.improvements,
    improvementsPlaceholder: t.results.improvementsPlaceholder,
    optimized: t.results.optimized,
    missingSuggestionsLabel: t.results.missingSuggestionsLabel,
  };

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

          {/* Things to Improve (amber, editable + missing suggestion chips) */}
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
            {rewrite.missingSuggestions && rewrite.missingSuggestions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-100">
                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                  {l.missingSuggestionsLabel}
                </p>
                <div className="flex flex-wrap gap-1">
                  {rewrite.missingSuggestions.map((suggestion, i) => (
                    <span
                      key={i}
                      className="inline-block px-2 py-0.5 text-[10px] font-medium bg-amber-100/80 text-amber-700 rounded-full"
                    >
                      {suggestion}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optimized (green) */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">
              {l.optimized}
            </p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {rewrite.rewritten}
            </p>
          </div>
        </div>
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
        {/* Original (col-span-1, compact read-only) */}
        <div className="md:col-span-1 bg-red-50/60 border border-red-100 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">
            {l.original}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-6">
            {rewrite.original}
          </p>
        </div>

        {/* Things to Change (col-span-3, DOMINANT) */}
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
          {/* Missing Suggestions */}
          {rewrite.missingSuggestions && rewrite.missingSuggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                {l.missingSuggestionsLabel}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rewrite.missingSuggestions.map((suggestion, i) => (
                  <span
                    key={i}
                    className="inline-block px-2.5 py-1 text-[11px] font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-200"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optimized (col-span-1, compact read-only) */}
        <div className="md:col-span-1 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">
            {l.optimized}
          </p>
          <p className="text-xs text-[var(--text-primary)] leading-relaxed line-clamp-6">
            {rewrite.rewritten}
          </p>
        </div>
      </div>
    </Card>
  );
}
