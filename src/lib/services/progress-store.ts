/**
 * Sprint 2.2: In-memory progress store for poll-based progress tracking.
 *
 * Works on Vercel Hobby (Lambda) where SSE streaming is buffered.
 * Each generation request writes progress here; the client polls
 * GET /api/audit/progress/[requestId] to read it.
 *
 * Note: Lambda instances are ephemeral but long-lived enough for a single
 * generation (30-60s). The polling endpoint hits the SAME Lambda instance
 * that's running the generation because Vercel routes concurrent requests
 * to warm instances first. TTL cleanup prevents memory leaks.
 */

import type { ProgressStage, ProgressEvent } from "./audit-orchestrator";
import type { ScoreSection, RewritePreview, ProfileResult } from "@/lib/types";

// ── Types ──

export interface SectionPairStore {
  section: ScoreSection;
  rewrite: RewritePreview;
}

export interface ProgressState {
  requestId: string;
  stage: ProgressStage | null;
  percent: number;
  label: string;
  completedSections: SectionPairStore[];
  totalSections: number;
  isComplete: boolean;
  error: string | null;
  /** Final results + meta, set on completion */
  finalResults: { results: ProfileResult; meta: Record<string, unknown> } | null;
  createdAt: number;
  updatedAt: number;
}

// ── Feature flag ──
const ENABLE_PROGRESS_REGISTRY =
  process.env.ENABLE_PROGRESS_REGISTRY === "true";

// ── Store ──
const TTL_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every 60s
const store = new Map<string, ProgressState>();

// ── Periodic cleanup of expired entries ──
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of store) {
      if (now - entry.createdAt > TTL_MS) {
        store.delete(id);
      }
    }
    // Stop cleanup timer when store is empty
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ── Public API ──

/**
 * Initialize a new progress entry for a generation request.
 * Returns the requestId (caller should generate it).
 */
export function initProgress(requestId: string): void {
  if (!ENABLE_PROGRESS_REGISTRY) return;

  store.set(requestId, {
    requestId,
    stage: null,
    percent: 0,
    label: "",
    completedSections: [],
    totalSections: 0,
    isComplete: false,
    error: null,
    finalResults: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  ensureCleanup();
}

/**
 * Update progress for an in-flight generation.
 * Called from the orchestrator's onProgress callback.
 */
export function updateProgress(
  requestId: string,
  event: ProgressEvent
): void {
  if (!ENABLE_PROGRESS_REGISTRY) return;

  const entry = store.get(requestId);
  if (!entry) return;

  entry.stage = event.stage;
  entry.percent = event.percent;
  if (event.label) entry.label = event.label;
  if (event.totalSections != null) entry.totalSections = event.totalSections;
  if (event.completedSections != null) {
    // completedSections in ProgressEvent is a count, not an array
    // The sectionReady field contains the actual section pair
  }

  // Accumulate section pairs
  if (event.sectionReady) {
    entry.completedSections.push({
      section: event.sectionReady.section,
      rewrite: event.sectionReady.rewrite,
    });
  }

  entry.updatedAt = Date.now();
}

/**
 * Mark a generation as complete with final results.
 */
export function completeProgress(
  requestId: string,
  results: ProfileResult,
  meta: Record<string, unknown>
): void {
  if (!ENABLE_PROGRESS_REGISTRY) return;

  const entry = store.get(requestId);
  if (!entry) return;

  entry.isComplete = true;
  entry.percent = 100;
  entry.finalResults = { results, meta };
  entry.updatedAt = Date.now();
}

/**
 * Mark a generation as failed with an error message.
 */
export function failProgress(requestId: string, error: string): void {
  if (!ENABLE_PROGRESS_REGISTRY) return;

  const entry = store.get(requestId);
  if (!entry) return;

  entry.error = error;
  entry.updatedAt = Date.now();
}

/**
 * Get the current progress state for a request.
 * Returns null if not found or expired.
 */
export function getProgress(requestId: string): ProgressState | null {
  if (!ENABLE_PROGRESS_REGISTRY) return null;

  const entry = store.get(requestId);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(requestId);
    return null;
  }

  return entry;
}

/**
 * Remove a progress entry (e.g., after client has received final results).
 */
export function deleteProgress(requestId: string): void {
  store.delete(requestId);
}

/** Diagnostic: current store size */
export function getStoreSize(): number {
  return store.size;
}
