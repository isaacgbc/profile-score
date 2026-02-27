"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ProgressStage } from "@/lib/services/audit-orchestrator";
import type { ProfileResult, ScoreSection, RewritePreview } from "@/lib/types";

// ── Types ──

export interface SectionPair {
  section: ScoreSection;
  rewrite: RewritePreview;
}

export interface GenerationMeta {
  modelUsed: string;
  promptVersionsUsed: Record<string, number>;
  durationMs: number;
  fallbackCount: number;
  hasFallback: boolean;
  degraded: boolean;
  failureReasons: string[];
  detectedLanguage?: string;
  languageConfidence?: number;
  [key: string]: unknown;
}

export interface PollState {
  stage: ProgressStage | null;
  percent: number;
  label: string;
  completedSections: SectionPair[];
  totalSections: number;
  isPolling: boolean;
  isComplete: boolean;
  error: string | null;
  finalResults: { results: ProfileResult; meta: GenerationMeta } | null;
}

const initialState: PollState = {
  stage: null,
  percent: 0,
  label: "",
  completedSections: [],
  totalSections: 0,
  isPolling: false,
  isComplete: false,
  error: null,
  finalResults: null,
};

export interface GenerateInput {
  linkedinText: string;
  cvText?: string;
  jobDescription: string;
  targetAudience: string;
  objectiveMode: "job" | "objective";
  objectiveText: string;
  planId: string | null;
  isAdmin: boolean;
  locale: string;
  forceFresh?: boolean;
  isPdfSource?: boolean;
}

const POLL_INTERVAL_MS = 1500; // Poll every 1.5s

/**
 * Sprint 2.2: Poll-based progress hook for Vercel Hobby (Lambda).
 *
 * Architecture:
 * 1. Client generates a requestId up-front
 * 2. Fires POST to /api/audit/generate with the requestId in the body
 * 3. Immediately starts polling GET /api/audit/progress/:requestId every 1.5s
 * 4. Progress state updates drive the GenerationProgress UI
 * 5. When POST returns (or polling sees isComplete), stops polling and delivers results
 */
export function useProgressPolling() {
  const [state, setState] = useState<PollState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      abortRef.current?.abort();
    };
  }, [stopPolling]);

  // Poll progress endpoint
  const pollProgress = useCallback(async (requestId: string) => {
    try {
      const res = await fetch(`/api/audit/progress/${requestId}`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!data.found) return;

      setState((prev) => {
        // Don't update if already complete (final results from POST take priority)
        if (prev.isComplete) return prev;

        const next: PollState = {
          ...prev,
          stage: data.stage ?? prev.stage,
          percent: data.percent ?? prev.percent,
          label: data.label ?? prev.label,
          totalSections: data.totalSections ?? prev.totalSections,
          // Use the full array from server (accumulative)
          completedSections: data.completedSections?.length > prev.completedSections.length
            ? data.completedSections
            : prev.completedSections,
        };

        if (data.error) {
          next.error = data.error;
          next.isPolling = false;
        }

        return next;
      });
    } catch {
      // Silently ignore poll errors — the main POST will handle final result
    }
  }, []);

  const startGeneration = useCallback(
    (input: GenerateInput) => {
      // Abort any existing generation
      abortRef.current?.abort();
      stopPolling();

      const controller = new AbortController();
      abortRef.current = controller;

      // Generate requestId client-side
      const requestId = crypto.randomUUID().slice(0, 8);
      requestIdRef.current = requestId;

      setState({
        ...initialState,
        isPolling: true,
      });

      // Start polling immediately
      pollTimerRef.current = setInterval(
        () => pollProgress(requestId),
        POLL_INTERVAL_MS
      );

      // Fire the POST (blocks until generation completes)
      (async () => {
        try {
          const res = await fetch("/api/audit/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...input,
              // Sprint 2.2: Include requestId for progress store registration
              progressRequestId: requestId,
            }),
            signal: controller.signal,
          });

          stopPolling();

          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ error: "Generation failed" }));
            setState((prev) => ({
              ...prev,
              isPolling: false,
              error: err.error || `Server error (${res.status})`,
            }));
            return;
          }

          const data = await res.json();

          setState((prev) => ({
            ...prev,
            isPolling: false,
            isComplete: true,
            percent: 100,
            finalResults: {
              results: data.results,
              meta: data.meta,
            },
          }));
        } catch (err) {
          stopPolling();

          if ((err as Error).name === "AbortError") {
            setState((prev) => ({ ...prev, isPolling: false }));
            return;
          }

          setState((prev) => ({
            ...prev,
            isPolling: false,
            error:
              err instanceof Error
                ? err.message
                : "Generation failed. Please try again.",
          }));
        }
      })();
    },
    [pollProgress, stopPolling]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    stopPolling();
    setState((prev) => ({ ...prev, isPolling: false }));
  }, [stopPolling]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopPolling();
    setState(initialState);
  }, [stopPolling]);

  return { state, startGeneration, abort, reset };
}
