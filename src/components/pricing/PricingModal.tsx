"use client";

import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CheckIcon, XIcon } from "@/components/ui/Icons";
import { mockPlans } from "@/lib/mock/plans";
import type { PlanId, FeatureId } from "@/lib/types";

const planTranslationKeys: Record<PlanId, { name: string; desc: string }> = {
  starter: { name: "starterName", desc: "starterDesc" },
  recommended: { name: "recommendedName", desc: "recommendedDesc" },
  pro: { name: "proName", desc: "proDesc" },
  coach: { name: "coachName", desc: "coachDesc" },
};

const featureNameKeys: Record<FeatureId, string> = {
  "linkedin-audit": "linkedinAuditTitle",
  "cv-rewrite": "cvRewriteTitle",
  "job-optimization": "jobOptimizationTitle",
  "cover-letter": "coverLetterTitle",
};

export default function PricingModal() {
  const { t } = useI18n();
  const { selectedPlan, selectPlan, showPricingModal, setShowPricingModal } = useApp();

  if (!showPricingModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPricingModal(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-slide-up">
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
                  onClick={() => { selectPlan(plan.id); setShowPricingModal(false); }}
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
