"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import { CheckIcon, XIcon } from "@/components/ui/Icons";
import { mockPlans } from "@/lib/mock/plans";
import { featureFlags } from "@/lib/feature-flags";
import type { PlanId, FeatureId } from "@/lib/types";
import { trackEvent } from "@/lib/analytics/tracker";

/**
 * Crea.la checkout URLs — real payment links per plan.
 * Append ?email= to pre-fill the customer email field when available.
 */
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

export default function PricingModal() {
  const { t } = useI18n();
  const {
    selectedPlan,
    selectPlan,
    showPricingModal,
    setShowPricingModal,
    authUser,
    userEmail,
    setUserEmail,
    auditId,
  } = useApp();

  // Pending plan selection — waiting for email capture
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);

  if (!showPricingModal) return null;

  /** Get the best available email for the current user */
  function getEmail(): string | null {
    return authUser?.email || userEmail || null;
  }

  /** Open Crea.la checkout in a new tab (user keeps their results visible) */
  function openCheckout(planId: PlanId, email: string | null) {
    // Safety net: save audit state in case user closes this tab
    if (auditId) {
      try {
        localStorage.setItem("ps_pendingAuditId", auditId);
        localStorage.setItem("ps_pendingPlanId", planId);
      } catch { /* localStorage full — fail silently */ }
    }

    const baseUrl = CREALA_CHECKOUT_URLS[planId];
    const checkoutUrl = email
      ? `${baseUrl}?email=${encodeURIComponent(email)}`
      : baseUrl;
    window.open(checkoutUrl, "_blank", "noopener");
  }

  function handleSelectPlan(planId: PlanId) {
    selectPlan(planId); // applies unlock via reapplyPlanLocking

    // ── Analytics: checkout_started ──
    const plan = mockPlans.find((p) => p.id === planId);
    trackEvent("checkout_started", {
      planId,
      metadata: {
        price: plan?.price,
        interval: plan?.interval,
      },
    });

    // ── Payment redirect when enabled ──
    if (featureFlags.paymentsEnabled) {
      const email = getEmail();
      if (!email) {
        // No email available — show email capture modal first
        setPendingPlanId(planId);
        return;
      }
      openCheckout(planId, email);
      setShowPricingModal(false);
    } else {
      // When payments disabled: plan unlocks content locally, user stays on page
      setShowPricingModal(false);
    }
  }

  /** Email captured — proceed to checkout */
  function handleEmailCaptured(email: string) {
    setUserEmail(email);
    setPendingPlanId(null);
    setShowPricingModal(false);

    if (pendingPlanId) {
      trackEvent("email_captured_before_checkout", {
        planId: pendingPlanId,
        metadata: { email },
      });
      openCheckout(pendingPlanId, email);
    }
  }

  // Show email capture modal if we need an email before checkout
  if (pendingPlanId) {
    return (
      <EmailCaptureModal
        isOpen={true}
        onClose={() => setPendingPlanId(null)}
        onSubmit={handleEmailCaptured}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPricingModal(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-slide-up">
        <button
          onClick={() => setShowPricingModal(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Close"
        >
          <XIcon size={16} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2">{t.pricing.title}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t.pricing.subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {mockPlans.map((plan) => {
            const keys = planTranslationKeys[plan.id];
            const name = (t.pricing as Record<string, string>)[keys.name];
            const desc = (t.pricing as Record<string, string>)[keys.desc];
            const isSelected = selectedPlan === plan.id;

            return (
              <Card
                key={plan.id}
                variant={isSelected ? "highlighted" : plan.highlighted ? "elevated" : "default"}
                padding="md"
                className="relative flex flex-col"
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="accent">{t.common.recommended}</Badge>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{name}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">{desc}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold text-[var(--text-primary)]">${plan.price}</span>
                    <span className="text-xs text-[var(--text-muted)]">{plan.interval === "monthly" ? t.common.perMonth : t.common.oneTime}</span>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((featureId) => {
                      const featureName = (t.features as Record<string, string>)[featureNameKeys[featureId]];
                      return (
                        <li key={featureId} className="flex items-center gap-2">
                          <CheckIcon size={12} className="text-[var(--accent)]" />
                          <span className="text-xs text-[var(--text-secondary)]">{featureName}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button
                  variant={isSelected ? "primary" : plan.highlighted ? "primary" : "outline"}
                  size="sm"
                  fullWidth
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isSelected ? t.pricing.currentPlan : t.pricing.selectPlan}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
