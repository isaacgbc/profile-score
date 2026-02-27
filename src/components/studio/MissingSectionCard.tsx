"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getSectionLabel } from "@/lib/section-labels";
import { SparklesIcon } from "@/components/ui/Icons";

interface MissingSectionCardProps {
  sectionId: string;
  source: "linkedin" | "cv";
  onAddAndRegenerate: (sectionId: string, content: string) => void;
  isRegenerating: boolean;
}

/**
 * HOTFIX-3: Manual Section Recovery card.
 * Shown for critical sections that are missing from the parsed input.
 * Allows user to manually add content and trigger regeneration.
 */
export default function MissingSectionCard({
  sectionId,
  source,
  onAddAndRegenerate,
  isRegenerating,
}: MissingSectionCardProps) {
  const { t } = useI18n();
  const sectionLabels = t.sectionLabels as Record<string, string>;
  const studioT = t.rewriteStudio as Record<string, string>;

  const [content, setContent] = useState("");

  const label = getSectionLabel(sectionId, sectionLabels);
  const canSubmit = content.trim().length > 20;

  return (
    <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/30">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-600 text-sm font-bold">?</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">
            {label} — {studioT.missingSectionCardTitle ?? "Not found in source"}
          </h3>
          <p className="text-xs text-amber-700 mb-3">
            {studioT.missingSectionCardDesc ?? "This section was not detected in your uploaded profile. Paste your content below and click regenerate to include it in your analysis."}
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={studioT.missingSectionCardPlaceholder ?? `Paste your ${label.toLowerCase()} content here...`}
            rows={4}
            className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/50 leading-relaxed placeholder:text-amber-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-amber-500">
              {content.length > 0 ? `${content.length} chars` : ""}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddAndRegenerate(sectionId, content)}
              disabled={!canSubmit || isRegenerating}
              className="!bg-amber-600 hover:!bg-amber-700"
            >
              <span className="flex items-center gap-1.5">
                <SparklesIcon size={14} />
                {isRegenerating
                  ? (studioT.regenerating ?? "Regenerating...")
                  : (studioT.addAndRegenerate ?? "Add & Regenerate")}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
