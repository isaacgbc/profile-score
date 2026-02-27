"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ProgressStage,
  ProgressEvent,
} from "@/lib/services/audit-orchestrator";
import type { ProfileResult, ScoreSection, RewritePreview } from "@/lib/types";

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

export interface StreamState {
  stage: ProgressStage | null;
  percent: number;
  label: string;
  completedSections: SectionPair[];
  totalSections: number;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  finalResults: { results: ProfileResult; meta: GenerationMeta } | null;
}

const initialState: StreamState = {
  stage: null,
  percent: 0,
  label: "",
  completedSections: [],
  totalSections: 0,
  isStreaming: false,
  isComplete: false,
  error: null,
  finalResults: null,
};

export interface GenerateStreamInput {
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

/**
 * SSE streaming hook for progressive generation.
 * Connects to /api/audit/stream, parses SSE events,
 * and accumulates section results as they arrive.
 */
export function useGenerationStream() {
  const [state, setState] = useState<StreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback((input: GenerateStreamInput) => {
    // Abort any existing stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      ...initialState,
      isStreaming: true,
    });

    // Use an async IIFE to handle the stream
    (async () => {
      try {
        const res = await fetch("/api/audit/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err.error || `Server error (${res.status})`,
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: "No response stream available",
          }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          // Keep the last partial chunk in buffer
          buffer = events.pop() ?? "";

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;

            const lines = eventBlock.split("\n");
            let eventType = "";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6);
              }
            }

            if (!eventType || !eventData) continue;

            try {
              const data = JSON.parse(eventData);

              if (eventType === "progress") {
                const progress = data as ProgressEvent;
                setState((prev) => {
                  const next = {
                    ...prev,
                    stage: progress.stage,
                    percent: progress.percent,
                    label: progress.label ?? prev.label,
                    totalSections: progress.totalSections ?? prev.totalSections,
                  };

                  // Accumulate section pairs as they arrive
                  if (progress.sectionReady) {
                    next.completedSections = [
                      ...prev.completedSections,
                      {
                        section: progress.sectionReady.section,
                        rewrite: progress.sectionReady.rewrite,
                      },
                    ];
                  }

                  return next;
                });
              } else if (eventType === "complete") {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  isComplete: true,
                  percent: 100,
                  finalResults: data as { results: ProfileResult; meta: GenerationMeta },
                }));
              } else if (eventType === "error") {
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: data.error ?? "Generation failed",
                }));
              }
            } catch {
              // Skip malformed JSON events
            }
          }
        }

        // Stream ended without complete event — handle gracefully
        setState((prev) => {
          if (!prev.isComplete && !prev.error) {
            return {
              ...prev,
              isStreaming: false,
              error: "Stream ended unexpectedly",
            };
          }
          return { ...prev, isStreaming: false };
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User aborted — don't set error
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: err instanceof Error ? err.message : "Stream connection failed",
        }));
      }
    })();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  return { state, startStream, abort, reset };
}
