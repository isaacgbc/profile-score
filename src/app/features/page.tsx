"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StepIndicator from "@/components/layout/StepIndicator";
import { featureIcons, CheckIcon, GlobeIcon } from "@/components/ui/Icons";
import { mockFeatures } from "@/lib/mock/features";
import type { FeatureId, PlanId, Locale } from "@/lib/types";

const featureTranslationKeys: Record<FeatureId, { title: string; desc: string }> = {
  "linkedin-audit": { title: "linkedinAuditTitle", desc: "linkedinAuditDesc" },
  "cv-rewrite": { title: "cvRewriteTitle", desc: "cvRewriteDesc" },
  "job-optimization": { title: "jobOptimizationTitle", desc: "jobOptimizationDesc" },
  "cover-letter": { title: "coverLetterTitle", desc: "coverLetterDesc" },
};

const planNameKeys: Record<PlanId, string> = {
  starter: "starterName",
  recommended: "recommendedName",
};

export default function FeaturesPage() {
  const { t } = useI18n();
  const { selectedFeatures, toggleFeature, userInput, exportLocale, setExportLocale } = useApp();
  const router = useRouter();

  // HOTFIX-3 + HOTFIX-4: Smart feature recommendation based on input method
  useEffect(() => {
    if (userInput.method === "cv") {
      // Auto-select CV Rewrite, deselect LinkedIn Audit
      if (!selectedFeatures.includes("cv-rewrite")) toggleFeature("cv-rewrite");
      if (selectedFeatures.includes("linkedin-audit")) toggleFeature("linkedin-audit");
    } else if (userInput.method === "linkedin") {
      // Auto-select LinkedIn Audit, deselect CV Rewrite
      if (!selectedFeatures.includes("linkedin-audit")) toggleFeature("linkedin-audit");
      if (selectedFeatures.includes("cv-rewrite")) toggleFeature("cv-rewrite");
    } else if (userInput.method === "both") {
      // Ensure both are selected
      if (!selectedFeatures.includes("linkedin-audit")) toggleFeature("linkedin-audit");
      if (!selectedFeatures.includes("cv-rewrite")) toggleFeature("cv-rewrite");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = selectedFeatures.length > 0;

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="features" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            {t.features.title}
          </h1>
          <p className="text-[var(--text-secondary)]">{t.features.subtitle}</p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-3 mb-8">
          {mockFeatures.map((feature, idx) => {
            const keys = featureTranslationKeys[feature.id];
            const title = (t.features as Record<string, string>)[keys.title];
            const desc = (t.features as Record<string, string>)[keys.desc];
            const isSelected = selectedFeatures.includes(feature.id);
            const Icon = featureIcons[feature.icon];

            // HOTFIX-4: Deprioritize features that don't match the input method
            const isDeprioritized =
              (userInput.method === "cv" && feature.id === "linkedin-audit") ||
              (userInput.method === "linkedin" && feature.id === "cv-rewrite");
            const deprioritizedHint = feature.id === "linkedin-audit"
              ? ((t.features as Record<string, string>).requiresLinkedin ?? "Add LinkedIn input to enable")
              : ((t.features as Record<string, string>).requiresCv ?? "Upload CV to enable");

            return (
              <Card
                key={feature.id}
                variant={isSelected ? "highlighted" : "default"}
                padding="md"
                hoverable
                className={`animate-slide-up relative ${isDeprioritized ? "opacity-50" : ""}`}
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => toggleFeature(feature.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Selection indicator */}
                  <div
                    className={`
                      w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5
                      transition-all duration-200
                      ${
                        isSelected
                          ? "bg-[var(--accent)] border-[var(--accent)]"
                          : "border-[var(--border)] bg-white"
                      }
                    `}
                  >
                    {isSelected && <CheckIcon size={14} className="text-white" />}
                  </div>

                  {/* Icon */}
                  <div
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${isSelected ? "bg-[var(--accent-light)] text-[var(--accent)]" : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"}
                    `}
                  >
                    {Icon && <Icon size={20} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      {title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
                      {desc}
                    </p>
                    {/* HOTFIX-4: Deprioritized hint */}
                    {isDeprioritized && (
                      <p className="text-xs text-amber-600 mb-1">{deprioritizedHint}</p>
                    )}
                    {/* Plan inclusion badges */}
                    <div className="flex flex-wrap gap-1">
                      {feature.includedInPlans.map((planId) => {
                        const planName = (t.pricing as Record<string, string>)[planNameKeys[planId]];
                        return (
                          <Badge key={planId} variant="muted" className="text-[10px]">
                            {planName}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="bg-[var(--surface-secondary)] rounded-xl px-5 py-4 flex items-center justify-between mb-8">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {t.features.selectedCount.replace("{count}", String(selectedFeatures.length))}
          </p>
          <div className="flex items-center gap-1">
            {selectedFeatures.map((id) => (
              <div key={id} className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            ))}
          </div>
        </div>

        {/* HOTFIX-3: Export Language Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <GlobeIcon size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">
            {t.common.exportLanguage}:
          </span>
          <select
            value={exportLocale}
            onChange={(e) => setExportLocale(e.target.value as Locale)}
            className="text-xs font-medium text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="en">{t.common.english}</option>
            <option value="es">{t.common.spanish}</option>
          </select>
        </div>

        {/* Error */}
        {!canContinue && (
          <p className="text-sm text-[var(--text-muted)] text-center mb-4">
            {t.features.noSelection}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/input">
            <Button variant="ghost">{t.common.back}</Button>
          </Link>
          <Button
            onClick={() => router.push("/results")}
            disabled={!canContinue}
          >
            {t.common.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
