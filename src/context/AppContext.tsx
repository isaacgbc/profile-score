"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
  useGenerationStream,
  type SectionPair,
} from "@/hooks/useGenerationStream";
import { useProgressPolling } from "@/hooks/useProgressPolling";
import type { ProgressStage } from "@/lib/services/audit-orchestrator";

const ENABLE_PROGRESSIVE = process.env.NEXT_PUBLIC_ENABLE_PROGRESSIVE === "true";
const USE_POLL_PROGRESS = process.env.NEXT_PUBLIC_USE_POLL_PROGRESS === "true";

/** Lightweight user info from our Prisma User model */
export interface AppUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  activePlanId?: string | null;
  subscriptionStatus?: string | null;
  /** True if email is in ADMIN_ALLOWLIST_EMAILS (server-verified) */
  isOwner?: boolean;
}

interface AppContextValue extends AppState {
  authUser: AppUser | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
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
  /** Per-section regenerated rewritten text (overrides original rewrite) */
  userRewritten: Record<string, string>;
  /** Direct user edits to optimized draft text (highest priority override) */
  userOptimized: Record<string, string>;
  setUserOptimized: (key: string, text: string) => void;
  /** Reset a section to original LLM output (clears optimized, rewritten, improvements) */
  resetSection: (sectionId: string) => void;
  /** Reset a single entry to original LLM output */
  resetEntry: (sectionId: string, entryStableId: string) => void;
  /** Regenerate a section's optimized text using edited improvements */
  regenerateSection: (sectionId: string, source: "linkedin" | "cv") => Promise<void>;
  /** Per-section regeneration loading state */
  regeneratingSection: string | null;
  triggerUnlockAnimation: () => void;
  isFeatureUnlocked: (featureId: FeatureId) => boolean;
  isSectionLocked: (sectionId: string) => boolean;
  isCoverLetterUnlocked: () => boolean;
  isExportModuleUnlocked: (moduleId: ExportModuleId) => boolean;
  generateResults: (options?: { forceFresh?: boolean }) => Promise<void>;
  /** Sprint 2: Progressive generation state */
  progressStage: ProgressStage | null;
  progressPercent: number;
  progressLabel: string;
  completedSections: SectionPair[];
  totalExpectedSections: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // ── Auth state ──
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const planAutoLoadedRef = useRef(false);

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
  const [userRewritten, setUserRewritten] = useState<Record<string, string>>({});
  const [userOptimized, setUserOptimizedState] = useState<Record<string, string>>({});
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [unlockAnimationTriggered, setUnlockAnimationTriggered] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] = useState<GenerationMetaClient | null>(null);

  // Sprint 2: Progressive generation stream (SSE — works on Pro/Enterprise)
  const {
    state: streamState,
    startStream,
    reset: resetStream,
  } = useGenerationStream();

  // Sprint 2.2: Poll-based progress (works on Hobby/Lambda)
  const {
    state: pollState,
    startGeneration: startPollGeneration,
    reset: resetPoll,
  } = useProgressPolling();

  // Sprint 2: Sync stream completion into results state
  useEffect(() => {
    if (streamState.isComplete && streamState.finalResults) {
      const generatedResults = streamState.finalResults.results;
      const meta = streamState.finalResults.meta;

      setResultsState(generatedResults);
      setIsGenerating(false);

      if (meta) {
        setGenerationMeta({
          modelUsed: meta.modelUsed,
          promptVersionsUsed: meta.promptVersionsUsed,
          hasFallback: meta.hasFallback ?? (meta.fallbackCount ?? 0) > 0,
          durationMs: meta.durationMs,
          fallbackCount: meta.fallbackCount ?? 0,
          degraded: meta.degraded ?? false,
          failureReasons: meta.failureReasons ?? [],
          detectedLanguage: meta.detectedLanguage as "en" | "es" | undefined,
          languageConfidence: meta.languageConfidence,
        });

        // Auto-set export locale from detected language
        if (
          meta.detectedLanguage &&
          meta.detectedLanguage !== "unknown" &&
          (meta.languageConfidence ?? 0) >= 0.7
        ) {
          setExportLocale(meta.detectedLanguage as "en" | "es");
        }
      }

      // Persist results server-side for export generation
      fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: generatedResults,
          planId: selectedPlan,
          userInput: {
            jobDescription: userInput.jobDescription,
            targetAudience: userInput.targetAudience,
            objectiveMode: userInput.objectiveMode,
            objectiveText: userInput.objectiveText,
          },
          generationMeta: meta ?? null,
        }),
      })
        .then((r) => r.json())
        .then((persistData) => {
          if (persistData.auditId) {
            setAuditId(persistData.auditId);
            trackEvent("audit_completed", {
              auditId: persistData.auditId,
              planId: selectedPlan,
              sourceType: userInput.method ?? undefined,
            });
          }
        })
        .catch(() => {});

      // Initialize user improvements
      const initialImprovements: Record<string, string> = {};
      [...generatedResults.linkedinRewrites, ...generatedResults.cvRewrites].forEach((r) => {
        if (!r.locked) {
          initialImprovements[r.sectionId] = r.improvements;
        }
      });
      setUserImprovements(initialImprovements);

      resetStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState.isComplete, streamState.finalResults]);

  // Sprint 2: Sync stream error into generation error
  useEffect(() => {
    if (streamState.error && !streamState.isStreaming) {
      setGenerationError(streamState.error);
      setIsGenerating(false);
    }
  }, [streamState.error, streamState.isStreaming]);

  // Sprint 2.2: Sync poll completion into results state
  useEffect(() => {
    if (pollState.isComplete && pollState.finalResults) {
      const generatedResults = pollState.finalResults.results;
      const meta = pollState.finalResults.meta;

      setResultsState(generatedResults);
      setIsGenerating(false);

      if (meta) {
        setGenerationMeta({
          modelUsed: meta.modelUsed,
          promptVersionsUsed: meta.promptVersionsUsed,
          hasFallback: meta.hasFallback ?? (meta.fallbackCount ?? 0) > 0,
          durationMs: meta.durationMs,
          fallbackCount: meta.fallbackCount ?? 0,
          degraded: meta.degraded ?? false,
          failureReasons: meta.failureReasons ?? [],
          detectedLanguage: meta.detectedLanguage as "en" | "es" | undefined,
          languageConfidence: meta.languageConfidence,
        });

        // Auto-set export locale from detected language
        if (
          meta.detectedLanguage &&
          meta.detectedLanguage !== "unknown" &&
          (meta.languageConfidence ?? 0) >= 0.7
        ) {
          setExportLocale(meta.detectedLanguage as "en" | "es");
        }
      }

      // Persist results server-side for export generation
      fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: generatedResults,
          planId: selectedPlan,
          userInput: {
            jobDescription: userInput.jobDescription,
            targetAudience: userInput.targetAudience,
            objectiveMode: userInput.objectiveMode,
            objectiveText: userInput.objectiveText,
          },
          generationMeta: meta ?? null,
        }),
      })
        .then((r) => r.json())
        .then((persistData) => {
          if (persistData.auditId) {
            setAuditId(persistData.auditId);
            trackEvent("audit_completed", {
              auditId: persistData.auditId,
              planId: selectedPlan,
              sourceType: userInput.method ?? undefined,
            });
          }
        })
        .catch(() => {});

      // Initialize user improvements
      const initialImprovements: Record<string, string> = {};
      [...generatedResults.linkedinRewrites, ...generatedResults.cvRewrites].forEach((r) => {
        if (!r.locked) {
          initialImprovements[r.sectionId] = r.improvements;
        }
      });
      setUserImprovements(initialImprovements);

      resetPoll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollState.isComplete, pollState.finalResults]);

  // Sprint 2.2: Sync poll error into generation error
  useEffect(() => {
    if (pollState.error && !pollState.isPolling) {
      setGenerationError(pollState.error);
      setIsGenerating(false);
    }
  }, [pollState.error, pollState.isPolling]);

  // ── Auth: listen for session changes + fetch user ──
  useEffect(() => {
    const supabase = supabaseRef.current;

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthUser({
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? null,
        });
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setAuthUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: session.user.user_metadata?.full_name ?? null,
            avatarUrl: session.user.user_metadata?.avatar_url ?? null,
          });
        } else {
          setAuthUser(null);
          planAutoLoadedRef.current = false;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth: auto-load plan from subscription + owner auto-admin ──
  useEffect(() => {
    if (!authUser || planAutoLoadedRef.current) return;

    // Fetch user's subscription data from server
    fetch(`/api/user/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;

        // Owner allowlist: auto-enable admin + coach plan
        if (data.isOwner) {
          setAuthUser((prev) => prev ? { ...prev, isOwner: true } : prev);
          setIsAdmin(true);
          setSelectedPlan("coach" as PlanId);
          planAutoLoadedRef.current = true;
          console.log("[AppContext] owner_admin_auto_enabled");

          // Issue admin session cookie so admin API routes pass assertAdmin()
          fetch("/api/admin/verify-owner", { method: "POST" })
            .then((r) => {
              if (r.ok) console.log("[AppContext] admin session cookie set for owner");
              else console.warn("[AppContext] verify-owner failed:", r.status);
            })
            .catch(() => {});

          return;
        }

        if (data.activePlanId && data.subscriptionStatus === "active") {
          setSelectedPlan(data.activePlanId as PlanId);
          planAutoLoadedRef.current = true;
        }
      })
      .catch(() => {});
  }, [authUser]);

  const signOut = useCallback(async () => {
    await supabaseRef.current.auth.signOut();
    setAuthUser(null);
    setSelectedPlan(null);
    planAutoLoadedRef.current = false;
  }, []);

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
    // Owner users can always toggle admin; others need adminBypass flag
    if (featureFlags.adminBypass || authUser?.isOwner) {
      setIsAdmin((prev) => !prev);
    }
  }, [authUser?.isOwner]);

  const triggerUnlockAnimation = useCallback(() => {
    setUnlockAnimationTriggered(true);
  }, []);

  const setUserImprovement = useCallback((sectionId: string, text: string) => {
    setUserImprovements((prev) => ({ ...prev, [sectionId]: text }));
  }, []);

  const setUserOptimized = useCallback((key: string, text: string) => {
    setUserOptimizedState((prev) => ({ ...prev, [key]: text }));
  }, []);

  const resetSection = useCallback((sectionId: string) => {
    setUserOptimizedState((prev) => {
      const next = { ...prev };
      // Remove section-level key
      delete next[sectionId];
      // Remove entry-level keys (format: "sectionId:entryStableId")
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${sectionId}:`)) delete next[k];
      }
      return next;
    });
    setUserRewritten((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    setUserImprovements((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  const resetEntry = useCallback((sectionId: string, entryStableId: string) => {
    const key = `${sectionId}:${entryStableId}`;
    setUserOptimizedState((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const regenerateSection = useCallback(
    async (sectionId: string, source: "linkedin" | "cv") => {
      if (!results) return;
      setRegeneratingSection(sectionId);

      try {
        // Find the original rewrite for this section
        const rewrites =
          source === "linkedin" ? results.linkedinRewrites : results.cvRewrites;
        const rewrite = rewrites.find((r) => r.sectionId === sectionId);
        if (!rewrite) {
          console.warn(`[regenerate] No rewrite found for ${sectionId}`);
          return;
        }

        // Check if section is locked
        if (rewrite.locked && !isAdmin) {
          console.warn(`[regenerate] Section ${sectionId} is locked`);
          return;
        }

        // Build objective context from user input
        const objectiveContext = [
          userInput.jobDescription ? `Target role: ${userInput.jobDescription.slice(0, 500)}` : "",
          userInput.targetAudience ? `Audience: ${userInput.targetAudience}` : "",
          userInput.objectiveText ? `Goal: ${userInput.objectiveText}` : "",
        ]
          .filter(Boolean)
          .join(". ");

        const res = await fetch("/api/audit/regenerate-rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId,
            source,
            originalContent: rewrite.original,
            editedImprovements:
              userImprovements[sectionId] ?? rewrite.improvements,
            objectiveContext: objectiveContext || undefined,
            locale: exportLocale,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.rewritten) {
            setUserRewritten((prev) => ({
              ...prev,
              [sectionId]: data.rewritten,
            }));
            // Clear any manual edits so regenerated text takes priority
            setUserOptimizedState((prev) => {
              const next = { ...prev };
              delete next[sectionId];
              // Also clear entry-level keys for this section
              for (const k of Object.keys(next)) {
                if (k.startsWith(`${sectionId}:`)) delete next[k];
              }
              return next;
            });
          }
        } else {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error(`[regenerate] Failed: ${err.error}`);
        }
      } catch (err) {
        console.error("[regenerate] Network error:", err);
      } finally {
        setRegeneratingSection(null);
      }
    },
    [results, isAdmin, userInput, userImprovements, exportLocale]
  );

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

  const generateResults = useCallback(async (options?: { forceFresh?: boolean }) => {
    setIsGenerating(true);
    setGenerationError(null);

    const inputPayload = {
      linkedinText: userInput.linkedinText,
      cvText: userInput.cvText || undefined,
      jobDescription: userInput.jobDescription,
      targetAudience: userInput.targetAudience,
      objectiveMode: userInput.objectiveMode,
      objectiveText: userInput.objectiveText,
      planId: selectedPlan,
      isAdmin,
      locale: exportLocale,
      forceFresh: options?.forceFresh ?? false,
      isPdfSource: !!(userInput.linkedinText && !userInput.linkedinUrl),
    };

    // Sprint 2.2: Use poll-based progress (works on Vercel Hobby/Lambda)
    if (USE_POLL_PROGRESS) {
      startPollGeneration(inputPayload);
      // The poll state is synced via the useEffect above
      // isGenerating stays true until poll completes or errors
      return;
    }

    // Sprint 2: Use SSE streaming path (requires Vercel Pro/Enterprise)
    if (ENABLE_PROGRESSIVE && !USE_POLL_PROGRESS) {
      startStream(inputPayload);
      // The stream state is synced via the useEffect above
      // isGenerating stays true until stream completes or errors
      return;
    }

    // Classic fetch path (fallback when progressive is disabled)
    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const generatedResults: ProfileResult = data.results;

      setResultsState(generatedResults);

      // Store generation metadata (for fallback/degraded warning display)
      if (data.meta) {
        setGenerationMeta({
          modelUsed: data.meta.modelUsed,
          promptVersionsUsed: data.meta.promptVersionsUsed,
          hasFallback: data.meta.hasFallback ?? data.meta.fallbackCount > 0,
          durationMs: data.meta.durationMs,
          fallbackCount: data.meta.fallbackCount ?? 0,
          degraded: data.meta.degraded ?? false,
          failureReasons: data.meta.failureReasons ?? [],
          detectedLanguage: data.meta.detectedLanguage,
          languageConfidence: data.meta.languageConfidence,
        });

        // Auto-set export locale from detected language (confidence >= 0.7)
        if (
          data.meta.detectedLanguage &&
          data.meta.detectedLanguage !== "unknown" &&
          data.meta.languageConfidence >= 0.7
        ) {
          setExportLocale(data.meta.detectedLanguage as "en" | "es");
        }
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
            trackEvent("audit_completed", {
              auditId: persistData.auditId,
              planId: selectedPlan,
              sourceType: userInput.method ?? undefined,
            });
          }
        })
        .catch(() => {});

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
  }, [userInput, selectedPlan, isAdmin, exportLocale, startStream, startPollGeneration]);

  return (
    <AppContext.Provider
      value={{
        authUser,
        authLoading,
        signOut,
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
        userRewritten,
        userOptimized,
        regeneratingSection,
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
        setUserOptimized,
        resetSection,
        resetEntry,
        regenerateSection,
        triggerUnlockAnimation,
        isFeatureUnlocked,
        isSectionLocked,
        isCoverLetterUnlocked,
        isExportModuleUnlocked,
        generateResults,
        // Sprint 2.2: Expose progress from active path (poll takes priority over stream)
        progressStage: USE_POLL_PROGRESS ? pollState.stage : streamState.stage,
        progressPercent: USE_POLL_PROGRESS ? pollState.percent : streamState.percent,
        progressLabel: USE_POLL_PROGRESS ? pollState.label : streamState.label,
        completedSections: USE_POLL_PROGRESS ? pollState.completedSections : streamState.completedSections,
        totalExpectedSections: USE_POLL_PROGRESS ? pollState.totalSections : streamState.totalSections,
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
