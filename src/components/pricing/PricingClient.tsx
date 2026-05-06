"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import { CheckIcon } from "@/components/ui/Icons";
import { mockPlans } from "@/lib/mock/plans";
import { featureFlags } from "@/lib/feature-flags";
import { trackEvent } from "@/lib/analytics/tracker";
import type { PlanId, FeatureId } from "@/lib/types";

/* ── Crea.la checkout URLs ── */
const CREALA_CHECKOUT_URLS: Record<PlanId, string> = {
  starter: "https://pay.crea.la/b/eVqdR8eurfBAeG4cDA1VN3D",
  recommended: "https://pay.crea.la/b/5kQbJ0aeb3SS9lKbzw1VN3E",
};

const planTranslationKeys: Record<PlanId, { name: string; desc: string }> = {
  starter: { name: "starterName", desc: "starterDesc" },
  recommended: { name: "recommendedName", desc: "recommendedDesc" },
};

const featureNameKeys: Record<FeatureId, string> = {
  "linkedin-audit": "linkedinAuditTitle",
  "cv-rewrite": "cvRewriteTitle",
  "job-optimization": "jobOptimizationTitle",
  "cover-letter": "coverLetterTitle",
};

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function PricingClient() {
  const { t } = useI18n();
  const pricingT = t.pricing as Record<string, string>;
  const featuresT = t.features as Record<string, string>;
  const {
    selectedPlan,
    selectPlan,
    authUser,
    userEmail,
    setUserEmail,
    auditId,
  } = useApp();

  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);

  /* ── Checkout logic (shared with PricingModal) ── */
  function getEmail(): string | null {
    return authUser?.email || userEmail || null;
  }

  function openCheckout(planId: PlanId, email: string | null) {
    if (auditId) {
      try {
        localStorage.setItem("ps_pendingAuditId", auditId);
        localStorage.setItem("ps_pendingPlanId", planId);
      } catch { /* fail silently */ }
    }
    const baseUrl = CREALA_CHECKOUT_URLS[planId];
    const checkoutUrl = email
      ? `${baseUrl}?email=${encodeURIComponent(email)}`
      : baseUrl;
    window.open(checkoutUrl, "_blank", "noopener");
  }

  function handleSelectPlan(planId: PlanId) {
    selectPlan(planId);
    const plan = mockPlans.find((p) => p.id === planId);
    trackEvent("checkout_started", {
      planId,
      metadata: { price: plan?.price, interval: plan?.interval, source: "pricing_page" },
    });

    if (featureFlags.paymentsEnabled) {
      const email = getEmail();
      if (!email) {
        setPendingPlanId(planId);
        return;
      }
      openCheckout(planId, email);
    }
  }

  function handleEmailCaptured(email: string) {
    setUserEmail(email);
    const planId = pendingPlanId;
    setPendingPlanId(null);
    if (planId) {
      trackEvent("email_captured_before_checkout", {
        planId,
        metadata: { email },
      });
      openCheckout(planId, email);
    }
  }

  /* ── FAQ subset for pricing ── */
  const pricingFaq = [
    {
      q: pricingT.faqQ1 ?? "What's the difference between the plans?",
      a: pricingT.faqA1 ?? "The Single Source plan covers one input — either your LinkedIn profile or your CV. The Complete plan covers both, plus generates a cover letter.",
    },
    {
      q: pricingT.faqQ2 ?? "Is this a subscription?",
      a: pricingT.faqA2 ?? "No. Both plans are one-time payments. You pay once and keep your results forever — no recurring charges.",
    },
    {
      q: pricingT.faqQ3 ?? "Can I upgrade later?",
      a: pricingT.faqA3 ?? "Yes. Start with Single Source and upgrade to Complete anytime. You'll only pay the difference.",
    },
  ];

  return (
    <>
      {/* Email capture modal */}
      {pendingPlanId && (
        <EmailCaptureModal
          isOpen={true}
          onClose={() => setPendingPlanId(null)}
          onSubmit={handleEmailCaptured}
        />
      )}

      <div className="min-h-screen bg-gradient-to-b from-white via-[var(--surface-secondary)]/30 to-white">
        {/* ── Header ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-3 animate-slide-up">
            {pricingT.pageTitle ?? t.pricing.title}
          </h1>
          <p className="text-base text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: "60ms" }}>
            {pricingT.pageSubtitle ?? t.pricing.subtitle}
          </p>
          {/* Free preview link */}
          <p className="text-sm text-[var(--text-muted)] mt-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            {pricingT.freePreviewLine ?? "Want to try first?"}{" "}
            <Link href="/input" className="text-[var(--accent)] hover:underline underline-offset-2 font-medium">
              {pricingT.freePreviewCta ?? "Get your free score →"}
            </Link>
          </p>
        </section>

        {/* ── Plan Cards ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 gap-5">
            {mockPlans.map((plan, idx) => {
              const keys = planTranslationKeys[plan.id];
              const name = pricingT[keys.name] ?? plan.id;
              const desc = pricingT[keys.desc] ?? "";
              const isSelected = selectedPlan === plan.id;

              return (
                <Card
                  key={plan.id}
                  variant={isSelected ? "highlighted" : plan.highlighted ? "elevated" : "default"}
                  padding="lg"
                  className="relative flex flex-col animate-slide-up"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="accent">{pricingT.bestValue ?? t.pricing.bestValue}</Badge>
                    </div>
                  )}

                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{name}</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{desc}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl font-bold text-[var(--text-primary)]">${plan.price}</span>
                      <span className="text-sm text-[var(--text-muted)]">
                        {plan.interval === "monthly" ? t.common.perMonth : t.common.oneTime}
                      </span>
                    </div>

                    {/* Includes label */}
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                      {t.pricing.includes}
                    </p>

                    {/* Feature list */}
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((featureId) => {
                        const featureName = featuresT[featureNameKeys[featureId]] ?? featureId;
                        return (
                          <li key={featureId} className="flex items-center gap-2.5">
                            <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-sm text-[var(--text-secondary)]">{featureName}</span>
                          </li>
                        );
                      })}
                      {/* Export modules */}
                      <li className="flex items-center gap-2.5">
                        <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {pricingT.exportModulesCount
                            ? pricingT.exportModulesCount.replace("{count}", String(plan.exportModules.length))
                            : `${plan.exportModules.length} export modules`}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <Button
                    variant={plan.highlighted ? "primary" : "outline"}
                    size="lg"
                    fullWidth
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isSelected ? t.pricing.currentPlan : t.pricing.selectPlan}
                    {!isSelected && <ChevronRight />}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── What's Included Breakdown ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-6">
              {pricingT.comparisonTitle ?? "What's included in each plan"}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="py-2 pr-4 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                      {pricingT.featureLabel ?? "Feature"}
                    </th>
                    <th className="py-2 px-4 text-center font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                      {t.common.free}
                    </th>
                    <th className="py-2 px-4 text-center font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                      {pricingT.starterName ?? "Single Source"}
                    </th>
                    <th className="py-2 px-4 text-center font-semibold text-[var(--accent)] text-xs uppercase tracking-wide">
                      {pricingT.recommendedName ?? "Complete"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: featuresT.compOverallScore ?? "Overall Score", free: true, starter: true, recommended: true },
                    { label: featuresT.compLinkedinAudit ?? "LinkedIn Audit", free: false, starter: true, recommended: true },
                    { label: featuresT.compCvRewrite ?? "CV Rewrite", free: false, starter: true, recommended: true },
                    { label: featuresT.compJobOptimization ?? "Job Optimization", free: false, starter: true, recommended: true },
                    { label: featuresT.compCoverLetter ?? "Cover Letter", free: false, starter: false, recommended: true },
                    { label: pricingT.compExports ?? "All export modules", free: false, starter: true, recommended: true },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[var(--border-light)] last:border-0">
                      <td className="py-3 pr-4 text-sm text-[var(--text-primary)]">{row.label}</td>
                      <td className="py-3 px-4 text-center">
                        {row.free ? (
                          <CheckIcon size={14} className="text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.starter ? (
                          <CheckIcon size={14} className="text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.recommended ? (
                          <CheckIcon size={14} className="text-emerald-500 mx-auto" />
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
        </section>

        {/* ── Pricing FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-20">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-6 text-center animate-slide-up">
            {pricingT.faqSectionTitle ?? "Pricing FAQ"}
          </h3>
          <div className="space-y-4">
            {pricingFaq.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border-light)] bg-white p-5 animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{item.q}</h4>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-10 animate-slide-up" style={{ animationDelay: "240ms" }}>
            <Link href="/input">
              <Button size="lg">
                {pricingT.bottomCta ?? "Start with a Free Score"}
                <ChevronRight />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
