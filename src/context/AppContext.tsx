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
} from "@/lib/types";
import { emptyUserInput } from "@/lib/mock/profile-data";
import { mockResults } from "@/lib/mock/results";
import { mockPlans } from "@/lib/mock/plans";
import { featureFlags } from "@/lib/feature-flags";

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
  generateMockResults: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<JourneyStep>("landing");
  const [userInput, setUserInputState] = useState<UserInput>(emptyUserInput);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureId[]>([
    "linkedin-audit",
  ]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [results, setResults] = useState<ProfileResult | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exportLocale, setExportLocale] = useState<Locale>("en");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showEmailCaptureModal, setShowEmailCaptureModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userImprovements, setUserImprovements] = useState<Record<string, string>>({});
  const [unlockAnimationTriggered, setUnlockAnimationTriggered] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);

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

  const selectPlan = useCallback((id: PlanId) => {
    setSelectedPlan(id);
    setUnlockAnimationTriggered(true);
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

  const generateMockResults = useCallback(() => {
    // Determine which LinkedIn sections to unlock based on plan
    const unlockedLinkedinIds: string[] = (() => {
      if (isAdmin) return mockResults.linkedinSections.map((s) => s.id);
      switch (selectedPlan) {
        case "coach":
        case "pro":
          return mockResults.linkedinSections.map((s) => s.id);
        case "recommended":
          return mockResults.linkedinSections.map((s) => s.id);
        case "starter":
          return ["headline", "summary"];
        default:
          return []; // Free tier — no sections unlocked
      }
    })();

    // Determine which CV sections to unlock based on plan
    const unlockedCvIds: string[] = (() => {
      if (isAdmin) return mockResults.cvSections.map((s) => s.id);
      switch (selectedPlan) {
        case "coach":
        case "pro":
          return mockResults.cvSections.map((s) => s.id);
        case "recommended":
          return ["contact-info", "professional-summary", "work-experience"];
        case "starter":
          return [];
        default:
          return []; // Free tier — no CV sections
      }
    })();

    const adjustedResults: ProfileResult = {
      ...mockResults,
      linkedinSections: mockResults.linkedinSections.map((s) => ({
        ...s,
        locked: !unlockedLinkedinIds.includes(s.id),
      })),
      cvSections: mockResults.cvSections.map((s) => ({
        ...s,
        locked: !unlockedCvIds.includes(s.id),
      })),
      linkedinRewrites: mockResults.linkedinRewrites.map((r) => ({
        ...r,
        locked: !unlockedLinkedinIds.includes(r.sectionId),
      })),
      cvRewrites: mockResults.cvRewrites.map((r) => ({
        ...r,
        locked: !unlockedCvIds.includes(r.sectionId),
      })),
      coverLetter: mockResults.coverLetter
        ? {
            ...mockResults.coverLetter,
            locked: !(isAdmin || selectedPlan === "coach"),
          }
        : null,
    };
    setResults(adjustedResults);

    // Persist results server-side for export generation
    fetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: adjustedResults, planId: selectedPlan }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.auditId) setAuditId(data.auditId);
      })
      .catch(() => {
        // Audit persistence failed — exports won't work but UI still functions
      });

    // Initialize user improvements from mock data
    const initialImprovements: Record<string, string> = {};
    [...adjustedResults.linkedinRewrites, ...adjustedResults.cvRewrites].forEach((r) => {
      if (!r.locked) {
        initialImprovements[r.sectionId] = r.improvements;
      }
    });
    setUserImprovements(initialImprovements);
  }, [isAdmin, selectedPlan]);

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
        generateMockResults,
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
