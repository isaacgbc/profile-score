"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StepIndicator from "@/components/layout/StepIndicator";
import {
  SearchIcon,
  FileTextIcon,
  SparklesIcon,
  CheckIcon,
  GlobeIcon,
} from "@/components/ui/Icons";
import { mockPlans } from "@/lib/mock/plans";
import type { FeatureId, InputMethod, PlanId, Locale } from "@/lib/types";

// ── Audit type → features mapping ──
type AuditType = InputMethod; // "linkedin" | "cv" | "both"

function mapAuditTypeToFeatures(type: AuditType): FeatureId[] {
  switch (type) {
    case "linkedin":
      return ["linkedin-audit", "job-optimization"];
    case "cv":
      return ["cv-rewrite", "job-optimization"];
    case "both":
      return ["linkedin-audit", "cv-rewrite", "job-optimization", "cover-letter"];
  }
}

function deriveAuditTypeFromMethod(method: InputMethod | null): AuditType | null {
  if (method === "linkedin" || method === "cv" || method === "both") return method;
  return null;
}

const planNameKeys: Record<PlanId, string> = {
  starter: "starterName",
  recommended: "recommendedName",
};

// ── Plan comparison row definitions ──
interface ComparisonRow {
  labelKey: string;
  fallback: string;
  free: boolean;
  starter: boolean;
  recommended: boolean;
}

const comparisonRows: ComparisonRow[] = [
  { labelKey: "compOverallScore", fallback: "Overall Profile Score", free: true, starter: true, recommended: true },
  { labelKey: "compLinkedinAudit", fallback: "LinkedIn Audit", free: false, starter: true, recommended: true },
  { labelKey: "compCvRewrite", fallback: "CV Rewrite", free: false, starter: true, recommended: true },
  { labelKey: "compJobOptimization", fallback: "Job Optimization", free: false, starter: true, recommended: true },
  { labelKey: "compCoverLetter", fallback: "Cover Letter", free: false, starter: false, recommended: true },
  { labelKey: "compExportResults", fallback: "Export: Results Summary", free: false, starter: true, recommended: true },
  { labelKey: "compExportAudit", fallback: "Export: Full Audit", free: false, starter: true, recommended: true },
  { labelKey: "compExportCv", fallback: "Export: Updated CV", free: false, starter: true, recommended: true },
  { labelKey: "compExportLinkedin", fallback: "Export: LinkedIn Updates", free: false, starter: true, recommended: true },
  { labelKey: "compExportCoverLetter", fallback: "Export: Cover Letter", free: false, starter: false, recommended: true },
];

// ── Audit type card definitions ──
const auditOptions: {
  type: AuditType;
  iconKey: "search" | "file-text" | "sparkles";
  titleKey: string;
  descKey: string;
  titleFallback: string;
  descFallback: string;
  recommended?: boolean;
}[] = [
  {
    type: "linkedin",
    iconKey: "search",
    titleKey: "auditLinkedinTitle",
    descKey: "auditLinkedinDesc",
    titleFallback: "LinkedIn Profile",
    descFallback: "Audit and optimize your LinkedIn presence",
  },
  {
    type: "cv",
    iconKey: "file-text",
    titleKey: "auditCvTitle",
    descKey: "auditCvDesc",
    titleFallback: "CV / Resume",
    descFallback: "Rewrite and optimize your CV for ATS systems",
  },
  {
    type: "both",
    iconKey: "sparkles",
    titleKey: "auditBothTitle",
    descKey: "auditBothDesc",
    titleFallback: "Both (Recommended)",
    descFallback: "Complete analysis of LinkedIn + CV with cover letter",
    recommended: true,
  },
];

const iconMap = {
  search: SearchIcon,
  "file-text": FileTextIcon,
  sparkles: SparklesIcon,
};

export default function FeaturesPage() {
  const { t } = useI18n();
  const { setSelectedFeatures, setUserInput, userInput, exportLocale, setExportLocale } = useApp();
  const router = useRouter();
  const ft = t.features as Record<string, string>;
  const pt = t.pricing as Record<string, string>;

  const [auditType, setAuditType] = useState<AuditType | null>(
    deriveAuditTypeFromMethod(userInput.method)
  );

  const canContinue = auditType !== null;

  function handleContinue() {
    if (!auditType) return;
    const features = mapAuditTypeToFeatures(auditType);
    setSelectedFeatures(features);
    setUserInput({ method: auditType });
    router.push("/input");
  }

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="features" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            {ft.title ?? "Choose Your Audit Type"}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {ft.subtitle ?? "What would you like us to analyze?"}
          </p>
        </div>

        {/* Audit Type Cards */}
        <div className="space-y-3 mb-8">
          {auditOptions.map((opt, idx) => {
            const isSelected = auditType === opt.type;
            const Icon = iconMap[opt.iconKey];
            const title = ft[opt.titleKey] ?? opt.titleFallback;
            const desc = ft[opt.descKey] ?? opt.descFallback;

            return (
              <Card
                key={opt.type}
                variant={isSelected ? "highlighted" : "default"}
                padding="md"
                hoverable
                className="animate-slide-up cursor-pointer"
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => setAuditType(opt.type)}
              >
                <div className="flex items-center gap-4">
                  {/* Radio indicator */}
                  <div
                    className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                      transition-all duration-200
                      ${
                        isSelected
                          ? "bg-[var(--accent)] border-[var(--accent)]"
                          : "border-[var(--border)] bg-white"
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {title}
                      </h3>
                      {opt.recommended && (
                        <Badge variant="accent" className="text-[10px]">
                          {ft.recommended ?? "Recommended"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-0.5">
                      {desc}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Export Language Toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
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

        {/* ── Plan Comparison ── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] text-center mb-4">
            {ft.planComparisonTitle ?? "What's Included"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-light)]">
                  <th className="text-left py-2 pr-2 text-[var(--text-muted)] font-medium w-[40%]" />
                  <th className="text-center py-2 px-2 text-[var(--text-muted)] font-medium">
                    {ft.freePlanTitle ?? "Free"}
                  </th>
                  {mockPlans.map((plan) => (
                    <th
                      key={plan.id}
                      className={`text-center py-2 px-2 font-semibold ${
                        plan.highlighted ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      <div>{pt[planNameKeys[plan.id]] ?? plan.id}</div>
                      <div className="font-normal text-[10px] text-[var(--text-muted)]">
                        ${plan.price}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.labelKey} className="border-b border-[var(--border-light)] last:border-0">
                    <td className="py-2 pr-2 text-[var(--text-secondary)]">
                      {ft[row.labelKey] ?? row.fallback}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.free ? (
                        <CheckIcon size={14} className="inline text-emerald-500" />
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.starter ? (
                        <CheckIcon size={14} className="inline text-emerald-500" />
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.recommended ? (
                        <CheckIcon size={14} className="inline text-emerald-500" />
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error hint */}
        {!canContinue && (
          <p className="text-sm text-[var(--text-muted)] text-center mb-4">
            {ft.selectAuditType ?? "Select an option to continue"}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/">
            <Button variant="ghost">{t.common.back}</Button>
          </Link>
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t.common.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
