"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import StepIndicator from "@/components/layout/StepIndicator";
import PricingModal from "@/components/pricing/PricingModal";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import StudioLeftRail from "@/components/studio/StudioLeftRail";
import StudioTopBar from "@/components/studio/StudioTopBar";
import StudioSectionEditor from "@/components/studio/StudioSectionEditor";
import { useStudioPersistence } from "@/hooks/useStudioPersistence";
import { getSectionLabel } from "@/lib/section-labels";
import { SparklesIcon } from "@/components/ui/Icons";
import type { SourceType, RewritePreview } from "@/lib/types";

// ── Canonical section display order ──
const LINKEDIN_SECTION_ORDER = [
  "headline", "summary", "experience", "education", "skills",
  "certifications", "recommendations", "featured", "projects",
  "volunteer", "honors", "publications",
];
const CV_SECTION_ORDER = [
  "contact-info", "professional-summary", "work-experience",
  "education-section", "skills-section", "certifications",
];

// Core sections shown before the "Others" divider
const CORE_LINKEDIN = new Set(["headline", "summary", "experience", "education", "skills"]);
const CORE_CV = new Set(["contact-info", "professional-summary", "work-experience", "education-section", "skills-section"]);

function sortRewrites(rewrites: RewritePreview[], order: string[]): RewritePreview[] {
  return [...rewrites].sort((a, b) => {
    const ai = order.indexOf(a.sectionId);
    const bi = order.indexOf(b.sectionId);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export default function RewriteStudioPage() {
  const { t } = useI18n();
  const {
    results,
    generateResults,
    isGenerating,
    generationMeta,
    isAdmin,
    setShowPricingModal,
    userImprovements,
    setUserImprovement,
    userRewritten,
    userOptimized,
    setUserOptimized,
    resetSection,
    resetEntry,
    regenerateSection,
    regeneratingSection,
    showEmailCaptureModal,
    setShowEmailCaptureModal,
    setUserEmail,
    userEmail,
    userInput,
    auditId,
  } = useApp();
  const router = useRouter();

  // ─── Source Toggle (URL-synced) ───
  const [activeSource, setActiveSource] = useState<SourceType>("linkedin");
  const [loading, setLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const scrollSpyEnabled = useRef(true);

  // ─── Persistence hook ───
  const persistence = useStudioPersistence(auditId, activeSource, {
    userOptimized,
    userImprovements,
  }, {
    setUserOptimized,
    setUserImprovement,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source === "cv" || source === "linkedin") {
      setActiveSource(source);
    }
  }, []);

  // Auto-select available source when only one exists
  useEffect(() => {
    if (results) {
      if (results.linkedinRewrites.length === 0 && results.cvRewrites.length > 0) {
        setActiveSource("cv");
      } else if (results.cvRewrites.length === 0 && results.linkedinRewrites.length > 0) {
        setActiveSource("linkedin");
      }
    }
  }, [results]);

  useEffect(() => {
    if (!results && !isGenerating) {
      let cancelled = false;
      async function run() {
        await generateResults();
        if (!cancelled) setLoading(false);
      }
      run();
      return () => { cancelled = true; };
    } else if (results) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // ─── Scroll-spy with IntersectionObserver ───
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (loading || !results) return;

    const rewrites =
      activeSource === "linkedin"
        ? results.linkedinRewrites
        : results.cvRewrites;

    // Cleanup previous observer
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        if (!scrollSpyEnabled.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );

    // Observe section elements
    for (const rw of rewrites) {
      const el = document.getElementById(rw.sectionId);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;

    // Set initial active section
    if (rewrites.length > 0 && !activeSectionId) {
      setActiveSectionId(rewrites[0].sectionId);
    }

    return () => observer.disconnect();
  }, [loading, results, activeSource]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSourceChange(source: SourceType) {
    setActiveSource(source);
    setActiveSectionId(null);
    const url = new URL(window.location.href);
    url.searchParams.set("source", source);
    window.history.replaceState({}, "", url.toString());
  }

  function handleSectionClick(sectionId: string) {
    // Temporarily disable scroll-spy to prevent race with smooth scroll
    scrollSpyEnabled.current = false;
    setActiveSectionId(sectionId);

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Re-enable after scroll animation settles
    setTimeout(() => {
      scrollSpyEnabled.current = true;
    }, 500);
  }

  function handleContinueToExport() {
    if (!userEmail) {
      setShowEmailCaptureModal(true);
      return;
    }
    router.push("/checkout");
  }

  function handleEmailSubmit(email: string) {
    setUserEmail(email);
    setShowEmailCaptureModal(false);
    router.push("/checkout");
  }

  // Wrapped handlers that also persist to localStorage
  const handleOptimizedChange = useCallback(
    (key: string, text: string) => {
      setUserOptimized(key, text);
      persistence.persistOptimized(key, text);
    },
    [setUserOptimized, persistence]
  );

  const handleImprovementChange = useCallback(
    (sectionId: string, text: string) => {
      setUserImprovement(sectionId, text);
      persistence.persistImprovement(sectionId, text);
    },
    [setUserImprovement, persistence]
  );

  const handleResetSection = useCallback(
    (sectionId: string) => {
      resetSection(sectionId);
      persistence.clearPersistedSection(sectionId);
    },
    [resetSection, persistence]
  );

  const handleResetEntry = useCallback(
    (sectionId: string, entryStableId: string) => {
      resetEntry(sectionId, entryStableId);
      persistence.clearPersistedEntry(sectionId, entryStableId);
    },
    [resetEntry, persistence]
  );

  const handleRegenerate = useCallback(
    (sectionId: string, intent: "directions" | "draft") => {
      // For intent "draft", send currentDraft as extra field (backward-compat: backend ignores it)
      // For now, both intents use the same regenerateSection which sends userImprovements
      regenerateSection(sectionId, activeSource);
    },
    [regenerateSection, activeSource]
  );

  // ─── Loading ───
  if (loading || !results) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="rewrite-studio" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading rewrites...</p>
        </div>
      </div>
    );
  }

  // ── Degraded-mode gate ──
  const generationHasIssues =
    generationMeta?.degraded || generationMeta?.hasFallback;

  if (generationHasIssues) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="rewrite-studio" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl text-red-600">!</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {t.results.generationFailedTitle}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            {t.results.generationFailedDesc}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/input">
              <Button variant="ghost">{t.common.back}</Button>
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setLoading(true);
                generateResults({ forceFresh: true }).finally(() => setLoading(false));
              }}
            >
              {t.results.retryFresh}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rewrites = sortRewrites(
    activeSource === "linkedin" ? results.linkedinRewrites : results.cvRewrites,
    activeSource === "linkedin" ? LINKEDIN_SECTION_ORDER : CV_SECTION_ORDER
  );

  const coreSet = activeSource === "linkedin" ? CORE_LINKEDIN : CORE_CV;
  const coreSections = rewrites.filter((r) => coreSet.has(r.sectionId));
  const otherSections = rewrites.filter((r) => !coreSet.has(r.sectionId));

  // HOTFIX-2: Compute missing sections (expected but not present in results)
  const expectedOrder = activeSource === "linkedin" ? LINKEDIN_SECTION_ORDER : CV_SECTION_ORDER;
  const presentIds = new Set(rewrites.map((r) => r.sectionId));
  const missingSectionIds = expectedOrder.filter((id) => !presentIds.has(id));

  const hasLinkedin = results.linkedinRewrites.length > 0;
  const hasCv = results.cvRewrites.length > 0;
  const sectionLabels = t.sectionLabels as Record<string, string>;

  const hasUnsavedChanges =
    Object.keys(userOptimized).length > 0 ||
    Object.keys(userRewritten).length > 0;

  const emptySourceLabel = activeSource === "linkedin" ? "LinkedIn" : "CV";

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="rewrite-studio" />
      <PricingModal />
      <EmailCaptureModal
        isOpen={showEmailCaptureModal}
        onClose={() => setShowEmailCaptureModal(false)}
        onSubmit={handleEmailSubmit}
      />

      {/* ─── Page Header ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
              <SparklesIcon size={18} className="text-[var(--accent)]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
              {t.rewriteStudio.title}
            </h1>
          </div>
          <p className="text-[var(--text-secondary)]">{t.rewriteStudio.subtitle}</p>
        </div>
      </div>

      {/* ─── Two-panel layout ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="flex gap-6">
          {/* Left Rail (desktop) */}
          <StudioLeftRail
            source={activeSource}
            onSourceChange={handleSourceChange}
            sections={rewrites}
            activeSectionId={activeSectionId}
            onSectionClick={handleSectionClick}
            hasLinkedin={hasLinkedin}
            hasCv={hasCv}
          />

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Top bar */}
            <StudioTopBar
              objectiveText={
                userInput.objectiveMode === "job"
                  ? userInput.jobDescription?.slice(0, 80)
                  : userInput.objectiveText?.slice(0, 80)
              }
              objectiveMode={userInput.objectiveMode}
              hasUnsavedChanges={hasUnsavedChanges}
              onContinueToExport={handleContinueToExport}
            />

            {/* Mobile section tabs */}
            <div className="lg:hidden mb-4">
              {/* Source toggle for mobile */}
              {hasLinkedin && hasCv && (
                <div className="flex gap-1 mb-3 p-1 bg-[var(--surface-secondary)] rounded-lg">
                  <button
                    onClick={() => handleSourceChange("linkedin")}
                    className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                      activeSource === "linkedin"
                        ? "bg-white shadow-sm text-[var(--accent)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => handleSourceChange("cv")}
                    className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                      activeSource === "cv"
                        ? "bg-white shadow-sm text-[var(--accent)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    CV
                  </button>
                </div>
              )}

              {/* Horizontal scrollable section tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                {rewrites.map((rw) => (
                  <button
                    key={rw.sectionId}
                    onClick={() => handleSectionClick(rw.sectionId)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      activeSectionId === rw.sectionId
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
                    }`}
                  >
                    {getSectionLabel(rw.sectionId, sectionLabels)}
                  </button>
                ))}
              </div>
            </div>

            {/* Section editors */}
            {rewrites.length > 0 ? (
              <div className="space-y-6">
                {coreSections.map((rewrite) => {
                  const matchingSection = [
                    ...(results?.linkedinSections ?? []),
                    ...(results?.cvSections ?? []),
                  ].find((s) => s.id === rewrite.sectionId);
                  const entryScores = matchingSection?.entryScores;

                  return (
                    <StudioSectionEditor
                      key={rewrite.sectionId}
                      rewrite={rewrite}
                      userImprovement={userImprovements[rewrite.sectionId]}
                      userOptimized={userOptimized}
                      userRewritten={userRewritten[rewrite.sectionId]}
                      onImprovementChange={handleImprovementChange}
                      onOptimizedChange={handleOptimizedChange}
                      onRegenerate={(intent) =>
                        handleRegenerate(rewrite.sectionId, intent)
                      }
                      onReset={handleResetSection}
                      onResetEntry={handleResetEntry}
                      isRegenerating={regeneratingSection === rewrite.sectionId}
                      locked={rewrite.locked && !isAdmin}
                      onUpgradeClick={() => setShowPricingModal(true)}
                      entryScores={entryScores}
                    />
                  );
                })}

                {/* Others divider */}
                {otherSections.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 pt-4 pb-1">
                      <div className="flex-1 h-px bg-[var(--border-light)]" />
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        {(t.rewriteStudio as Record<string, string>).othersLabel ?? "Others"}
                      </span>
                      <div className="flex-1 h-px bg-[var(--border-light)]" />
                    </div>
                    {otherSections.map((rewrite) => {
                      const matchingSection = [
                        ...(results?.linkedinSections ?? []),
                        ...(results?.cvSections ?? []),
                      ].find((s) => s.id === rewrite.sectionId);
                      const entryScores = matchingSection?.entryScores;

                      return (
                        <StudioSectionEditor
                          key={rewrite.sectionId}
                          rewrite={rewrite}
                          userImprovement={userImprovements[rewrite.sectionId]}
                          userOptimized={userOptimized}
                          userRewritten={userRewritten[rewrite.sectionId]}
                          onImprovementChange={handleImprovementChange}
                          onOptimizedChange={handleOptimizedChange}
                          onRegenerate={(intent) =>
                            handleRegenerate(rewrite.sectionId, intent)
                          }
                          onReset={handleResetSection}
                          onResetEntry={handleResetEntry}
                          isRegenerating={regeneratingSection === rewrite.sectionId}
                          locked={rewrite.locked && !isAdmin}
                          onUpgradeClick={() => setShowPricingModal(true)}
                          entryScores={entryScores}
                        />
                      );
                    })}
                  </>
                )}

                {/* HOTFIX-2: Missing sections notice */}
                {missingSectionIds.length > 0 && (
                  <Card variant="default" padding="md" className="mt-4 bg-amber-50/40 border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-2">
                      {(t.rewriteStudio as Record<string, string>).missingSectionsTitle ?? "Sections not found in source"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {missingSectionIds.map((id) => (
                        <span key={id} className="inline-block px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full">
                          {getSectionLabel(id, sectionLabels)}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600">
                      {(t.rewriteStudio as Record<string, string>).missingSectionsDesc ?? "These sections were not detected in your uploaded profile. Add them to your source for a complete analysis."}
                    </p>
                  </Card>
                )}
              </div>
            ) : (
              <Card variant="default" padding="lg" className="text-center">
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  {t.rewriteStudio.noRewritesAvailable.replace(
                    "{source}",
                    emptySourceLabel
                  )}
                </p>
                <Link href="/input">
                  <Button variant="outline" size="sm">
                    {t.common.back}
                  </Button>
                </Link>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
