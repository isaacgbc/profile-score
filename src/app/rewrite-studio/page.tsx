"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import RewriteCard from "@/components/ui/RewriteCard";
import UnlockReveal from "@/components/ui/UnlockReveal";
import SourceToggle from "@/components/ui/SourceToggle";
import StepIndicator from "@/components/layout/StepIndicator";
import PricingModal from "@/components/pricing/PricingModal";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import { SparklesIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import type { SourceType } from "@/lib/types";

export default function RewriteStudioPage() {
  const { t } = useI18n();
  const {
    results,
    generateMockResults,
    isAdmin,
    setShowPricingModal,
    userImprovements,
    setUserImprovement,
    unlockAnimationTriggered,
    showEmailCaptureModal,
    setShowEmailCaptureModal,
    setUserEmail,
    userEmail,
  } = useApp();
  const router = useRouter();

  // ─── Source Toggle (URL-synced) ───
  const [activeSource, setActiveSource] = useState<SourceType>("linkedin");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source === "cv" || source === "linkedin") {
      setActiveSource(source);
    }
  }, []);

  useEffect(() => {
    if (!results) {
      const timer = setTimeout(() => {
        generateMockResults();
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [results, generateMockResults]);

  function handleSourceChange(source: SourceType) {
    setActiveSource(source);
    const url = new URL(window.location.href);
    url.searchParams.set("source", source);
    window.history.replaceState({}, "", url.toString());
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

  // Studio labels from rewriteStudio namespace
  const studioLabels = {
    original: t.rewriteStudio.original,
    improvements: t.rewriteStudio.thingsToChange,
    improvementsPlaceholder: t.rewriteStudio.improvementsPlaceholder,
    optimized: t.rewriteStudio.optimized,
    missingSuggestionsLabel: t.rewriteStudio.missingSuggestionsLabel,
  };

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

  const rewrites =
    activeSource === "linkedin"
      ? results.linkedinRewrites
      : results.cvRewrites;

  const contextLabel =
    activeSource === "linkedin"
      ? t.rewriteStudio.contextLinkedin
      : t.rewriteStudio.contextCv;

  const emptySourceLabel =
    activeSource === "linkedin" ? "LinkedIn" : "CV";

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="rewrite-studio" />
      <PricingModal />
      <EmailCaptureModal
        isOpen={showEmailCaptureModal}
        onClose={() => setShowEmailCaptureModal(false)}
        onSubmit={handleEmailSubmit}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* ─── Header ─── */}
        <div className="text-center mb-8">
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

        {/* ─── Source Toggle ─── */}
        <div className="flex justify-center mb-6">
          <SourceToggle
            active={activeSource}
            onChange={handleSourceChange}
          />
        </div>

        {/* ─── Context Badge ─── */}
        <div className="flex justify-center mb-8">
          <Badge variant="muted">
            {contextLabel}
          </Badge>
        </div>

        {/* ─── Rewrite Cards ─── */}
        {rewrites.length > 0 ? (
          <div className="space-y-6">
            {rewrites.map((rewrite, idx) => (
              <UnlockReveal
                key={rewrite.sectionId}
                locked={false}
                animating={unlockAnimationTriggered}
                delay={idx * 80}
              >
                <RewriteCard
                  rewrite={rewrite}
                  userImprovement={userImprovements[rewrite.sectionId]}
                  onChange={(text) =>
                    setUserImprovement(rewrite.sectionId, text)
                  }
                  locked={rewrite.locked && !isAdmin}
                  onUpgradeClick={() => setShowPricingModal(true)}
                  variant="studio"
                  labels={studioLabels}
                />
              </UnlockReveal>
            ))}
          </div>
        ) : (
          <Card variant="default" padding="lg" className="text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              {t.rewriteStudio.noRewritesAvailable.replace("{source}", emptySourceLabel)}
            </p>
            <Link href="/input">
              <Button variant="outline" size="sm">
                {t.common.back}
              </Button>
            </Link>
          </Card>
        )}

        {/* ─── Navigation ─── */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-[var(--border-light)]">
          <Link href="/results">
            <Button variant="ghost" size="sm">
              <span className="flex items-center gap-1">
                <ChevronLeftIcon size={14} />
                {t.rewriteStudio.backToResults}
              </span>
            </Button>
          </Link>
          <Button variant="primary" size="lg" onClick={handleContinueToExport}>
            <span className="flex items-center gap-2">
              {t.rewriteStudio.continueToExport}
              <ChevronRightIcon size={16} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
