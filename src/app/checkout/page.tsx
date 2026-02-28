"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StepIndicator from "@/components/layout/StepIndicator";
import PricingModal from "@/components/pricing/PricingModal";
import ExportModuleCard from "@/components/checkout/ExportModuleCard";
import { useExport } from "@/hooks/useExport";
import {
  ShieldIcon,
  CheckIcon,
  GlobeIcon,
  LockIcon,
  FileIcon,
  FileTextIcon,
  DownloadIcon,
  MailIcon,
  LinkIcon,
  TrendingUpIcon,
  SparklesIcon,
} from "@/components/ui/Icons";
import { mockPlans } from "@/lib/mock/plans";
import { mockExportModules } from "@/lib/mock/export-modules";
import type { PlanId, ExportModuleId, ExportFormat, FeatureId } from "@/lib/types";
import { useEffect, useMemo } from "react";
import { trackEvent, hasTrackedThisSession, markTrackedThisSession } from "@/lib/analytics/tracker";
import { countSectionPlaceholders } from "@/lib/utils/placeholder-detect";
import { computeEntryStableId } from "@/lib/utils/entry-id";

const planNameKeys: Record<PlanId, string> = {
  starter: "starterName",
  recommended: "recommendedName",
  pro: "proName",
  coach: "coachName",
};

const moduleTranslationKeys: Record<
  ExportModuleId,
  { name: string; desc: string }
> = {
  "results-summary": {
    name: "moduleResultsSummary",
    desc: "moduleResultsSummaryDesc",
  },
  "full-audit": {
    name: "moduleFullAudit",
    desc: "moduleFullAuditDesc",
  },
  "updated-cv": {
    name: "moduleUpdatedCv",
    desc: "moduleUpdatedCvDesc",
  },
  "cover-letter": {
    name: "moduleCoverLetter",
    desc: "moduleCoverLetterDesc",
  },
  "linkedin-updates": {
    name: "moduleLinkedinUpdates",
    desc: "moduleLinkedinUpdatesDesc",
  },
};

const moduleIcons: Record<ExportModuleId, React.ReactNode> = {
  "results-summary": <FileTextIcon size={22} />,
  "full-audit": <FileIcon size={22} />,
  "updated-cv": <DownloadIcon size={22} />,
  "cover-letter": <MailIcon size={22} />,
  "linkedin-updates": <LinkIcon size={22} />,
};

// Plan order for tier comparison
const planOrder: PlanId[] = ["starter", "recommended", "pro", "coach"];

export default function CheckoutPage() {
  const { t } = useI18n();
  const {
    selectedPlan,
    exportLocale,
    isAdmin,
    auditId,
    setShowPricingModal,
    isExportModuleUnlocked,
    userEmail,
    setShowEmailCaptureModal,
    userImprovements,
    userRewritten,
    userOptimized,
    userInput,
    selectedFeatures,
    results,
    manualSections,
  } = useApp();

  const { getModuleState, createExport, downloadExport, retryExport } = useExport();

  // HOTFIX-URGENT: Log exportLocale carryover on checkout mount
  useEffect(() => {
    const persisted = typeof window !== "undefined" ? localStorage.getItem("ps_exportLocale") : null;
    console.log(`[diag] exportLocaleCarryover step1=input step2=checkout source=${persisted ? "persisted" : "context"} value=${exportLocale} persisted=${persisted}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Analytics: checkout_opened (deduped per browser session) ──
  useEffect(() => {
    if (!hasTrackedThisSession("checkout_opened")) {
      trackEvent("checkout_opened", {
        planId: selectedPlan,
        auditId: auditId ?? undefined,
      });
      markTrackedThisSession("checkout_opened");
    }
    // Also track checkout_started with plan context when user reaches checkout
    if (selectedPlan && !hasTrackedThisSession("checkout_started_page")) {
      trackEvent("checkout_started", {
        planId: selectedPlan,
        auditId: auditId ?? undefined,
        metadata: { source: "checkout_page" },
      });
      markTrackedThisSession("checkout_started_page");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin token from session storage (typed by admin at /admin page)
  const adminToken = typeof window !== "undefined"
    ? sessionStorage.getItem("adminToken") ?? undefined
    : undefined;

  function handleGenerate(moduleId: ExportModuleId, format: ExportFormat) {
    if (!auditId) return;

    // Export traceability analytics
    const editedSectionCount = Object.keys(userOptimized).filter((k) => !k.includes(":")).length;
    const editedEntryCount = Object.keys(userOptimized).filter((k) => k.includes(":")).length;
    const usedUserOptimized = Object.keys(userOptimized).length > 0;

    trackEvent("export_clicked", {
      auditId,
      planId: selectedPlan,
      metadata: { moduleId, format, editedSectionCount, editedEntryCount, usedUserOptimized },
    });

    createExport({
      auditId,
      exportType: moduleId,
      format,
      language: exportLocale,
      planId: selectedPlan,
      adminToken,
      userEdits: {
        userImprovements: Object.keys(userImprovements).length > 0 ? userImprovements : undefined,
        userRewritten: Object.keys(userRewritten).length > 0 ? userRewritten : undefined,
        userOptimized: usedUserOptimized ? userOptimized : undefined,
      },
    });
  }

  function handleRetry(moduleId: ExportModuleId, format: ExportFormat) {
    if (!auditId) return;
    retryExport({
      auditId,
      exportType: moduleId,
      format,
      language: exportLocale,
      planId: selectedPlan,
      adminToken,
      userEdits: {
        userImprovements: Object.keys(userImprovements).length > 0 ? userImprovements : undefined,
        userRewritten: Object.keys(userRewritten).length > 0 ? userRewritten : undefined,
        userOptimized: Object.keys(userOptimized).length > 0 ? userOptimized : undefined,
      },
    });
  }

  const plan = selectedPlan
    ? mockPlans.find((p) => p.id === selectedPlan)
    : null;
  const planName = plan
    ? (t.pricing as Record<string, string>)[planNameKeys[plan.id]]
    : null;

  const unlockedModules = mockExportModules.filter((m) =>
    isExportModuleUnlocked(m.id)
  );
  const lockedModules = mockExportModules.filter(
    (m) => !isExportModuleUnlocked(m.id)
  );

  // Determine next tier for upsell
  const currentPlanIndex = selectedPlan
    ? planOrder.indexOf(selectedPlan)
    : -1;
  const nextPlan =
    currentPlanIndex >= 0 && currentPlanIndex < planOrder.length - 1
      ? mockPlans.find((p) => p.id === planOrder[currentPlanIndex + 1])
      : null;
  const nextPlanName = nextPlan
    ? (t.pricing as Record<string, string>)[planNameKeys[nextPlan.id]]
    : null;

  // Modules that the next plan would unlock that the current plan doesn't
  const nextPlanNewModules = nextPlan
    ? mockExportModules.filter(
        (m) =>
          nextPlan.exportModules.includes(m.id) &&
          !isExportModuleUnlocked(m.id)
      )
    : [];

  // Find the minimum plan that includes a locked module
  function getMinPlanForModule(moduleId: ExportModuleId): string | null {
    const mod = mockExportModules.find((m) => m.id === moduleId);
    if (!mod) return null;
    for (const pid of planOrder) {
      if (mod.includedInPlans.includes(pid)) {
        return (t.pricing as Record<string, string>)[planNameKeys[pid]] ?? pid;
      }
    }
    return null;
  }

  // ── HOTFIX-2: Feature + input-aware export filtering ──
  const FEATURE_MODULE_MAP: Record<FeatureId, ExportModuleId[]> = {
    "linkedin-audit": ["results-summary", "full-audit", "linkedin-updates"],
    "cv-rewrite": ["updated-cv"],
    "job-optimization": [],
    "cover-letter": ["cover-letter"],
  };

  const featureEnabledModules = useMemo(() => {
    const set = new Set<ExportModuleId>(["results-summary"]); // always relevant
    for (const f of selectedFeatures) {
      for (const m of FEATURE_MODULE_MAP[f] ?? []) {
        set.add(m);
      }
    }
    return set;
  }, [selectedFeatures]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputMethod = userInput.method;
  const isModuleRelevant = (id: ExportModuleId): boolean => {
    if (!featureEnabledModules.has(id)) return false;
    if (inputMethod === "linkedin" && id === "updated-cv") return false;
    if (inputMethod === "cv" && id === "linkedin-updates") return false;
    return true;
  };

  const relevantModules = mockExportModules.filter((m) => isModuleRelevant(m.id));
  const irrelevantModules = mockExportModules.filter((m) => !isModuleRelevant(m.id));

  // ── HOTFIX-2: Value summary stats ──
  const valueSummary = useMemo(() => {
    if (!results) return null;
    const allRewrites = [...results.linkedinRewrites, ...results.cvRewrites];
    const totalSections = allRewrites.filter((r) => !r.locked).length;
    const editedSections = Object.keys(userOptimized).filter((k) => !k.includes(":")).length;
    const editedEntries = Object.keys(userOptimized).filter((k) => k.includes(":")).length;

    // Placeholder counting: use unified countSectionPlaceholders with correct entry stableIds
    let sectionPlaceholderCount = 0;
    let entryPlaceholderCount = 0;
    for (const rw of allRewrites) {
      if (rw.locked) continue;
      const counts = countSectionPlaceholders(
        rw,
        userOptimized,
        userRewritten,
        computeEntryStableId
      );
      sectionPlaceholderCount += counts.sectionCount;
      entryPlaceholderCount += counts.entryCount;
    }
    const placeholderCount = sectionPlaceholderCount + entryPlaceholderCount;

    // Diagnostics
    console.log(
      `[diag] checkout placeholders: sectionPlaceholderCount=${sectionPlaceholderCount}, ` +
      `entryPlaceholderCount=${entryPlaceholderCount}, totalPlaceholderCount=${placeholderCount}`
    );

    // HOTFIX-3: Count missing critical sections
    const CRITICAL_LINKEDIN = new Set(["headline", "summary", "experience", "education"]);
    const CRITICAL_CV = new Set(["contact-info", "work-experience", "education-section", "skills-section"]);
    const presentLinkedin = new Set(results.linkedinRewrites.map((r) => r.sectionId));
    const presentCv = new Set(results.cvRewrites.map((r) => r.sectionId));
    let missingSections = 0;
    if (inputMethod === "linkedin" || inputMethod === "both") {
      for (const id of CRITICAL_LINKEDIN) {
        if (!presentLinkedin.has(id) && !manualSections[id]) missingSections++;
      }
    }
    if (inputMethod === "cv" || inputMethod === "both") {
      for (const id of CRITICAL_CV) {
        if (!presentCv.has(id) && !manualSections[id]) missingSections++;
      }
    }

    return { totalSections, editedSections, editedEntries, placeholderCount, sectionPlaceholderCount, entryPlaceholderCount, missingSections };
  }, [results, userOptimized, userRewritten, inputMethod, manualSections]);

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="checkout" />
      <PricingModal />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            {t.checkout.title}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {t.checkout.subtitle}
          </p>
        </div>

        {/* Export language + email row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <GlobeIcon size={14} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">
              {t.results.exportingIn}:{" "}
              <strong className="text-[var(--text-secondary)]">
                {exportLocale === "en" ? "English" : "Español"}
              </strong>
            </span>
          </div>
          {userEmail && (
            <>
              <span className="hidden sm:inline text-[var(--border)] text-xs">
                •
              </span>
              <div className="flex items-center gap-2">
                <MailIcon size={14} className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">
                  {t.checkout.emailTitle}{" "}
                  <strong className="text-[var(--text-secondary)]">
                    {userEmail}
                  </strong>
                </span>
                <button
                  onClick={() => setShowEmailCaptureModal(true)}
                  className="text-xs text-[var(--accent)] hover:underline ml-1"
                >
                  {t.checkout.emailChange}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ─── HOTFIX-2: Value Summary Card ─── */}
        {valueSummary && (
          <section className="mb-6">
            <Card variant="default" padding="md" className="bg-emerald-50/40 border-emerald-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-emerald-600">{valueSummary.totalSections}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {(t.checkout as Record<string, string>).sectionsImproved ?? "Sections Improved"}
                  </p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-600">{valueSummary.editedSections}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {(t.checkout as Record<string, string>).customEdits ?? "Custom Edits"}
                  </p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-600">{valueSummary.editedEntries}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {(t.checkout as Record<string, string>).entriesRewritten ?? "Entries Rewritten"}
                  </p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${valueSummary.placeholderCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                    {valueSummary.placeholderCount}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {(t.checkout as Record<string, string>).placeholdersLeft ?? "Placeholders Left"}
                  </p>
                </div>
              </div>
              {valueSummary.placeholderCount > 0 && (
                <p className="text-[10px] text-amber-600 text-center mt-3">
                  {(t.checkout as Record<string, string>).placeholderHint ?? "Fill in [BRACKET] placeholders in Rewrite Studio before exporting for best results"}
                </p>
              )}
              {valueSummary.missingSections > 0 && (
                <p className="text-[10px] text-red-600 text-center mt-2">
                  {(t.checkout as Record<string, string>).missingSectionsHint
                    ?? `${valueSummary.missingSections} critical section${valueSummary.missingSections > 1 ? "s are" : " is"} missing — add them in Rewrite Studio to unlock exports`}
                </p>
              )}
            </Card>
          </section>
        )}

        {/* ─── Export Modules ─── */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            {t.checkout.exportModulesTitle}
          </h2>
          <div className="space-y-3">
            {relevantModules.map((mod, idx) => {
              const unlocked = isExportModuleUnlocked(mod.id);
              const keys = moduleTranslationKeys[mod.id];
              const name = (t.checkout as Record<string, string>)[keys.name];
              const desc = (t.checkout as Record<string, string>)[keys.desc];
              const minPlan = !unlocked
                ? getMinPlanForModule(mod.id)
                : null;

              // HOTFIX-3: Block export while unresolved placeholders or missing critical sections exist
              const hasUnresolvedPlaceholders = (valueSummary?.placeholderCount ?? 0) > 0;
              const hasMissingSections = (valueSummary?.missingSections ?? 0) > 0;
              const isBlocked = hasUnresolvedPlaceholders || hasMissingSections;
              const blockReason = hasMissingSections
                ? `Add ${valueSummary!.missingSections} missing critical section${valueSummary!.missingSections > 1 ? "s" : ""} in Rewrite Studio`
                : hasUnresolvedPlaceholders
                  ? `Resolve ${valueSummary!.placeholderCount} placeholder${valueSummary!.placeholderCount > 1 ? "s" : ""} before export`
                  : undefined;

              return (
                <ExportModuleCard
                  key={mod.id}
                  moduleId={mod.id}
                  name={name}
                  desc={desc}
                  icon={moduleIcons[mod.id]}
                  unlocked={unlocked}
                  minPlanLabel={minPlan}
                  moduleState={getModuleState(mod.id)}
                  onGenerate={(fmt) => handleGenerate(mod.id, fmt)}
                  onDownload={downloadExport}
                  onRetry={(fmt) => handleRetry(mod.id, fmt)}
                  onUnlock={() => setShowPricingModal(true)}
                  animDelay={idx * 60}
                  disabled={isBlocked}
                  disabledReason={blockReason}
                />
              );
            })}
          </div>

          {/* HOTFIX-2: Irrelevant modules (dimmed with contextual hint) */}
          {irrelevantModules.length > 0 && (
            <div className="mt-4 opacity-50">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Not available for your current selection
              </p>
              {irrelevantModules.map((mod) => {
                const keys = moduleTranslationKeys[mod.id];
                const name = (t.checkout as Record<string, string>)[keys.name];
                const hint = !featureEnabledModules.has(mod.id)
                  ? (t.checkout as Record<string, string>).selectFeatureToUnlock ?? "Select the relevant feature in Step 2 to enable"
                  : mod.id === "updated-cv"
                    ? (t.checkout as Record<string, string>).uploadCvToUnlock ?? "Upload your CV to unlock"
                    : (t.checkout as Record<string, string>).addLinkedinToUnlock ?? "Add your LinkedIn profile to unlock";
                return (
                  <div key={mod.id} className="flex items-center gap-3 py-2 px-3 bg-[var(--surface-secondary)] rounded-lg mb-1.5">
                    <div className="text-[var(--text-muted)]">{moduleIcons[mod.id]}</div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-muted)]">{name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── What You Unlock Next (upsell) ─── */}
        {nextPlan && nextPlanNewModules.length > 0 && !isAdmin && (
          <section className="mb-8 animate-slide-up" style={{ animationDelay: "360ms" }}>
            <Card
              variant="highlighted"
              padding="lg"
              className="relative overflow-hidden"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] opacity-[0.04] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUpIcon
                    size={18}
                    className="text-[var(--accent)]"
                  />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t.checkout.unlockNextTitle}
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  {t.checkout.unlockNextDesc.replace(
                    "{plan}",
                    nextPlanName ?? ""
                  )}
                </p>

                <ul className="space-y-2.5 mb-5">
                  {nextPlanNewModules.map((mod) => {
                    const keys = moduleTranslationKeys[mod.id];
                    const modName = (t.checkout as Record<string, string>)[
                      keys.name
                    ];
                    return (
                      <li
                        key={mod.id}
                        className="flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
                          {moduleIcons[mod.id]}
                        </div>
                        <span className="text-sm text-[var(--text-primary)] font-medium">
                          {modName}
                        </span>
                        <SparklesIcon
                          size={14}
                          className="text-[var(--accent)] opacity-50 ml-auto"
                        />
                      </li>
                    );
                  })}
                </ul>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowPricingModal(true)}
                >
                  {t.common.upgradeNow}
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* ─── Order Summary ─── */}
        <section className="mb-8 animate-slide-up" style={{ animationDelay: "420ms" }}>
          <Card variant="elevated" padding="lg">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              {t.checkout.orderSummary}
            </h2>

            {plan ? (
              <>
                {/* Plan row */}
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-light)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t.checkout.plan}
                    </span>
                    <Badge variant="accent">{planName}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    ${plan.price}
                    {plan.interval === "monthly" && (
                      <span className="font-normal text-[var(--text-muted)]">
                        {t.common.perMonth}
                      </span>
                    )}
                    {plan.interval === "one-time" && (
                      <span className="font-normal text-xs text-[var(--text-muted)] ml-1">
                        {t.common.oneTime}
                      </span>
                    )}
                  </p>
                </div>

                {/* Module breakdown */}
                <div className="py-3 border-b border-[var(--border-light)]">
                  <div className="space-y-2">
                    {mockExportModules.map((mod) => {
                      const unlocked = isExportModuleUnlocked(mod.id);
                      const keys = moduleTranslationKeys[mod.id];
                      const modName = (
                        t.checkout as Record<string, string>
                      )[keys.name];
                      return (
                        <div
                          key={mod.id}
                          className="flex items-center gap-2"
                        >
                          {unlocked ? (
                            <CheckIcon
                              size={14}
                              className="text-emerald-500 shrink-0"
                            />
                          ) : (
                            <LockIcon
                              size={14}
                              className="text-[var(--text-muted)] shrink-0"
                            />
                          )}
                          <span
                            className={`text-xs ${
                              unlocked
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)] line-through"
                            }`}
                          >
                            {modName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Value framing + total */}
                <div className="pt-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t.checkout.valueFraming
                      .replace("{count}", String(unlockedModules.length))}{" "}
                    <strong className="text-[var(--text-primary)]">
                      ${plan.price}
                    </strong>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <CheckIcon
                      size={14}
                      className="text-emerald-500"
                    />
                    <span className="text-xs font-medium text-emerald-600">
                      {t.common.selected}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {t.pricing.cartEmpty}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPricingModal(true)}
                >
                  {t.pricing.selectPlan}
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* ─── Payment Section ─── */}
        <section className="mb-6 animate-slide-up" style={{ animationDelay: "480ms" }}>
          <Card variant="default" padding="lg">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              {t.checkout.paymentTitle}
            </h2>
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--accent-light)] flex items-center justify-center mb-4">
                <ShieldIcon size={22} className="text-[var(--accent)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                {t.checkout.paymentPlaceholder}
              </p>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                {t.checkout.paymentDesc}
              </p>
            </div>
          </Card>
        </section>

        {/* Trust signals */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ShieldIcon size={12} />
            <span>{t.checkout.secureNote}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {t.checkout.guarantee}
          </p>
        </div>

        {/* Back */}
        <div className="text-center">
          <Link href="/rewrite-studio">
            <Button variant="ghost" size="sm">
              {t.checkout.backToRewriteStudio}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
