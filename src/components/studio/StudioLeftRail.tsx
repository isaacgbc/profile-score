"use client";

import { useI18n } from "@/context/I18nContext";
import { getSectionLabel } from "@/lib/section-labels";
import type { SourceType, RewritePreview } from "@/lib/types";
import { SearchIcon, FileTextIcon } from "@/components/ui/Icons";

// Core sections shown before the "Others" divider
const CORE_LINKEDIN = new Set(["headline", "summary", "experience", "education", "skills"]);
const CORE_CV = new Set(["contact-info", "professional-summary", "work-experience", "education-section", "skills-section"]);

interface StudioLeftRailProps {
  source: SourceType;
  onSourceChange: (source: SourceType) => void;
  sections: RewritePreview[];
  activeSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
  hasLinkedin: boolean;
  hasCv: boolean;
}

function SectionButton({
  s,
  activeSectionId,
  onSectionClick,
  sectionLabels,
}: {
  s: RewritePreview;
  activeSectionId: string | null;
  onSectionClick: (id: string) => void;
  sectionLabels: Record<string, string>;
}) {
  return (
    <button
      key={s.sectionId}
      onClick={() => onSectionClick(s.sectionId)}
      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        activeSectionId === s.sectionId
          ? "bg-emerald-50 text-emerald-700 font-medium"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]"
      }`}
    >
      {getSectionLabel(s.sectionId, sectionLabels)}
      {s.locked && (
        <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
          🔒
        </span>
      )}
    </button>
  );
}

export default function StudioLeftRail({
  source,
  onSourceChange,
  sections,
  activeSectionId,
  onSectionClick,
  hasLinkedin,
  hasCv,
}: StudioLeftRailProps) {
  const { t } = useI18n();
  const sectionLabels = t.sectionLabels as Record<string, string>;
  const coreSet = source === "linkedin" ? CORE_LINKEDIN : CORE_CV;
  const coreSections = sections.filter((s) => coreSet.has(s.sectionId));
  const otherSections = sections.filter((s) => !coreSet.has(s.sectionId));

  return (
    <aside className="hidden lg:block w-56 shrink-0 sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto pr-4 border-r border-[var(--border-light)]">
      {/* Source selector */}
      {hasLinkedin && hasCv && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Source
          </p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onSourceChange("linkedin")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                source === "linkedin"
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <SearchIcon size={14} />
              {t.rewriteStudio.linkedinLabel}
            </button>
            <button
              onClick={() => onSourceChange("cv")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                source === "cv"
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <FileTextIcon size={14} />
              {t.rewriteStudio.cvLabel}
            </button>
          </div>
        </div>
      )}

      {/* Section navigator */}
      <div>
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Sections
        </p>
        <nav className="flex flex-col gap-0.5">
          {coreSections.map((s) => (
            <SectionButton
              key={s.sectionId}
              s={s}
              activeSectionId={activeSectionId}
              onSectionClick={onSectionClick}
              sectionLabels={sectionLabels}
            />
          ))}
          {otherSections.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-4 mb-1 px-3">
                {(t.rewriteStudio as Record<string, string>).othersLabel ?? "Others"}
              </p>
              {otherSections.map((s) => (
                <SectionButton
                  key={s.sectionId}
                  s={s}
                  activeSectionId={activeSectionId}
                  onSectionClick={onSectionClick}
                  sectionLabels={sectionLabels}
                />
              ))}
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
