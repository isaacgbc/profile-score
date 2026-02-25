"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  AppState,
  JourneyStep,
  UserInput,
  FeatureId,
  PlanId,
  ProfileResult,
  Locale,
  ExportModuleId,
  GenerationMetaClient,
} from "@/lib/types";
import { emptyUserInput } from "@/lib/mock/profile-data";
import { mockPlans } from "@/lib/mock/plans";
import { featureFlags } from "@/lib/feature-flags";
import { trackEvent } from "@/lib/analytics/tracker";
import {
  getUnlockedLinkedinIds,
  getUnlockedCvIds,
  isCoverLetterUnlockedForPlan,
} from "@/lib/services/unlock-matrix";

interface AppContextValue extends AppState {
  setStep: (step: JourneyStep) => void;
  setUserInput: (input: Partial<UserInput>) => void;
  toggleFeature: (id: FeatureId) => void;
  selectPlan: (id: PlanId) => void;
  setResults: (r: ProfileResult) => void;
  toggleAdmin: () => void;
  setExportLocale: (l: Locale) => void;
  setShowPricingModal: (show: boolean) => void;
  setShowEmailCaptureModal: (show: boolean) => void;
  setUserEmail: (email: string) => void;
  setUserImprovement: (sectionId: string, text: string) => void;
  triggerUnlockAnimation: () => void;
  isFeatureUnlocked: (featureId: FeatureId) => boolean;
  isSectionLocked: (sectionId: string) => boolean;
  isCoverLetterUnlocked: () => boolean;
  isExportModuleUnlocked: (moduleId: ExportModuleId) => boolean;
  generateResults: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<JourneyStep>("landing");
  const [userInput, setUserInputState] = useState<UserInput>(emptyUserInput);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureId[]>([
    "linkedin-audit",
  ]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [results, setResultsState] = useState<ProfileResult | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exportLocale, setExportLocale] = useState<Locale>("en");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showEmailCaptureModal, setShowEmailCaptureModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userImprovements, setUserImprovements] = useState<Record<string, string>>({});
  const [unlockAnimationTriggered, setUnlockAnimationTriggered] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] = useState<GenerationMetaClient | null>(null);

  const setStep = useCallback((step: JourneyStep) => {
    setCurrentStep(step);
  }, []);

  const setUserInput = useCallback((input: Partial<UserInput>) => {
    setUserInputState((prev) => ({ ...prev, ...input }));
  }, []);

  const toggleFeature = useCallback((id: FeatureId) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  // ── Re-apply plan locking to existing results (single source of truth) ──
  const reapplyPlanLocking = useCallback(
    (planId: PlanId, currentResults: ProfileResult): ProfileResult => {
      const adminOverride = isAdmin;
      const ulLi = getUnlockedLinkedinIds(
        currentResults.linkedinSections.map((s) => s.id),
        planId,
        adminOverride
      );
      const ulCv = getUnlockedCvIds(
        currentResults.cvSections.map((s) => s.id),
        planId,
        adminOverride
      );

      return {
        ...currentResults,
        linkedinSections: currentResults.linkedinSections.map((s) => ({
          ...s,
          locked: !ulLi.includes(s.id),
        })),
        cvSections: currentResults.cvSections.map((s) => ({
          ...s,
          locked: !ulCv.includes(s.id),
        })),
        linkedinRewrites: currentResults.linkedinRewrites.map((r) => ({
          ...r,
          locked: !ulLi.includes(r.sectionId),
        })),
        cvRewrites: currentResults.cvRewrites.map((r) => ({
          ...r,
          locked: !ulCv.includes(r.sectionId),
        })),
        coverLetter: currentResults.coverLetter
          ? {
              ...currentResults.coverLetter,
              locked: !isCoverLetterUnlockedForPlan(planId, adminOverride),
            }
          : null,
      };
    },
    [isAdmin]
  );

  const selectPlan = useCallback(
    (id: PlanId) => {
      setSelectedPlan(id);
      setUnlockAnimationTriggered(true);
      // Re-apply locking to existing results with new plan
      setResultsState((prev) => (prev ? reapplyPlanLocking(id, prev) : prev));
      // ── Analytics: plan_selected ──
      trackEvent("plan_selected", { planId: id });
    },
    [reapplyPlanLocking]
  );

  const setResults = useCallback((r: ProfileResult) => {
    setResultsState(r);
  }, []);

  const toggleAdmin = useCallback(() => {
    if (featureFlags.adminBypass) {
      setIsAdmin((prev) => !prev);
    }
  }, []);

  const triggerUnlockAnimation = useCallback(() => {
    setUnlockAnimationTriggered(true);
  }, []);

  const setUserImprovement = useCallback((sectionId: string, text: string) => {
    setUserImprovements((prev) => ({ ...prev, [sectionId]: text }));
  }, []);

  const isFeatureUnlocked = useCallback(
    (featureId: FeatureId) => {
      if (isAdmin) return true;
      return selectedFeatures.includes(featureId);
    },
    [isAdmin, selectedFeatures]
  );

  const isSectionLocked = useCallback(
    (sectionId: string) => {
      if (isAdmin) return false;
      if (!results) return true;
      const linkedinSection = results.linkedinSections.find((s) => s.id === sectionId);
      if (linkedinSection) return linkedinSection.locked;
      const cvSection = results.cvSections.find((s) => s.id === sectionId);
      if (cvSection) return cvSection.locked;
      return true;
    },
    [isAdmin, results]
  );

  const isCoverLetterUnlocked = useCallback(() => {
    if (isAdmin) return true;
    return selectedPlan === "coach";
  }, [isAdmin, selectedPlan]);

  const isExportModuleUnlocked = useCallback(
    (moduleId: ExportModuleId) => {
      if (isAdmin) return true;
      if (!selectedPlan) return false;
      const plan = mockPlans.find((p) => p.id === selectedPlan);
      return plan?.exportModules.includes(moduleId) ?? false;
    },
    [isAdmin, selectedPlan]
  );

  const generateResults = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinText: userInput.linkedinText,
          cvText: userInput.cvText || undefined,
          jobDescription: userInput.jobDescription,
          targetAudience: userInput.targetAudience,
          objectiveMode: userInput.objectiveMode,
          objectiveText: userInput.objectiveText,
          planId: selectedPlan,
          isAdmin,
          locale: exportLocale,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const generatedResults: ProfileResult = data.results;

      setResultsState(generatedResults);

      // Store generation metadata (for fallback warning display)
      if (data.meta) {
        setGenerationMeta({
          modelUsed: data.meta.modelUsed,
          promptVersionsUsed: data.meta.promptVersionsUsed,
          hasFallback: data.meta.hasFallback ?? data.meta.fallbackCount > 0,
          durationMs: data.meta.durationMs,
        });
      } else {
        setGenerationMeta(null);
      }

      // Persist results server-side for export generation
      fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: generatedResults,
          planId: selectedPlan,
          // Persist sanitized userInput + generation metadata
          userInput: {
            jobDescription: userInput.jobDescription,
            targetAudience: userInput.targetAudience,
            objectiveMode: userInput.objectiveMode,
            objectiveText: userInput.objectiveText,
          },
          generationMeta: data.meta ?? null,
        }),
      })
        .then((r) => r.json())
        .then((persistData) => {
          if (persistData.auditId) {
            setAuditId(persistData.auditId);
            // ── Analytics: audit_completed ──
            trackEvent("audit_completed", {
              auditId: persistData.auditId,
              planId: selectedPlan,
              sourceType: userInput.method ?? undefined,
            });
          }
        })
        .catch(() => {
          // Audit persistence failed — exports won't work but UI still functions
        });

      // Initialize user improvements from generated data
      const initialImprovements: Record<string, string> = {};
      [...generatedResults.linkedinRewrites, ...generatedResults.cvRewrites].forEach((r) => {
        if (!r.locked) {
          initialImprovements[r.sectionId] = r.improvements;
        }
      });
      setUserImprovements(initialImprovements);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed. Please try again.";
      setGenerationError(message);
      console.error("generateResults error:", message);
    } finally {
      setIsGenerating(false);
    }
  }, [userInput, selectedPlan, isAdmin, exportLocale]);

  return (
    <AppContext.Provider
      value={{
        currentStep,
        userInput,
        selectedFeatures,
        selectedPlan,
        results,
        isAdmin,
        locale: "en",
        exportLocale,
        showPricingModal,
        showEmailCaptureModal,
        userEmail,
        userImprovements,
        unlockAnimationTriggered,
        auditId,
        isGenerating,
        generationError,
        generationMeta,
        setStep,
        setUserInput,
        toggleFeature,
        selectPlan,
        setResults,
        toggleAdmin,
        setExportLocale,
        setShowPricingModal,
        setShowEmailCaptureModal,
        setUserEmail,
        setUserImprovement,
        triggerUnlockAnimation,
        isFeatureUnlocked,
        isSectionLocked,
        isCoverLetterUnlocked,
        isExportModuleUnlocked,
        generateResults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
