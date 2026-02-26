"use client";

import { useEffect, useRef, useCallback } from "react";

const STORAGE_PREFIX = "rewriteStudio";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_PROBABILITY = 0.1; // 10% chance on mount
const DEBOUNCE_MS = 300;

interface StoredValue {
  value: string;
  timestamp: number;
}

function makeKey(
  auditId: string,
  source: string,
  sectionOrEntryId: string
): string {
  return `${STORAGE_PREFIX}:${auditId}:${source}:${sectionOrEntryId}`;
}

function safeGetItem(key: string): StoredValue | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredValue;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    const stored: StoredValue = { value, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/** Probabilistic TTL cleanup of stale keys (7 days) */
function maybeCleanupStaleKeys(): void {
  if (Math.random() > CLEANUP_PROBABILITY) return;

  try {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${STORAGE_PREFIX}:`)) continue;

      const stored = safeGetItem(key);
      if (stored && now - stored.timestamp > TTL_MS) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      safeRemoveItem(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[StudioPersistence] Cleaned ${keysToDelete.length} stale keys`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Hook for persisting Rewrite Studio edits to localStorage.
 * Rehydrates on mount, debounce-writes on changes, TTL-based cleanup.
 */
export function useStudioPersistence(
  auditId: string | null,
  source: string,
  state: {
    userOptimized: Record<string, string>;
    userImprovements: Record<string, string>;
  },
  actions: {
    setUserOptimized: (key: string, text: string) => void;
    setUserImprovement: (sectionId: string, text: string) => void;
  }
) {
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasRehydrated = useRef(false);

  // Rehydrate on mount / source change
  useEffect(() => {
    if (!auditId) return;
    hasRehydrated.current = false;

    try {
      const prefix = `${STORAGE_PREFIX}:${auditId}:${source}:`;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;

        const stored = safeGetItem(key);
        if (!stored) continue;

        // Extract the sectionOrEntryId part
        const sectionOrEntryId = key.slice(prefix.length);

        // Determine if this is an optimized or improvements key
        // Optimized keys are stored as-is; improvements keys have ":imp" suffix
        if (sectionOrEntryId.endsWith(":imp")) {
          const sectionId = sectionOrEntryId.slice(0, -4);
          actions.setUserImprovement(sectionId, stored.value);
        } else {
          actions.setUserOptimized(sectionOrEntryId, stored.value);
        }
      }
    } catch {
      // Ignore rehydration errors
    }

    hasRehydrated.current = true;
    maybeCleanupStaleKeys();
  }, [auditId, source]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced persist for optimized edits
  const persistOptimized = useCallback(
    (sectionOrEntryId: string, value: string) => {
      if (!auditId || !hasRehydrated.current) return;
      const key = makeKey(auditId, source, sectionOrEntryId);

      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          safeSetItem(key, value);
          debounceTimers.current.delete(key);
        }, DEBOUNCE_MS)
      );
    },
    [auditId, source]
  );

  // Debounced persist for improvement edits
  const persistImprovement = useCallback(
    (sectionId: string, value: string) => {
      if (!auditId || !hasRehydrated.current) return;
      const key = makeKey(auditId, source, `${sectionId}:imp`);

      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          safeSetItem(key, value);
          debounceTimers.current.delete(key);
        }, DEBOUNCE_MS)
      );
    },
    [auditId, source]
  );

  // Remove persisted keys on reset
  const clearPersistedSection = useCallback(
    (sectionId: string) => {
      if (!auditId) return;
      try {
        const prefix = `${STORAGE_PREFIX}:${auditId}:${source}:`;
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(prefix)) continue;
          const suffix = key.slice(prefix.length);
          // Match section-level key, entry-level keys (sectionId:stableId), and improvements (sectionId:imp)
          if (suffix === sectionId || suffix.startsWith(`${sectionId}:`)) {
            keysToRemove.push(key);
          }
        }

        for (const key of keysToRemove) {
          safeRemoveItem(key);
        }
      } catch {
        // Ignore
      }
    },
    [auditId, source]
  );

  const clearPersistedEntry = useCallback(
    (sectionId: string, entryStableId: string) => {
      if (!auditId) return;
      const key = makeKey(auditId, source, `${sectionId}:${entryStableId}`);
      safeRemoveItem(key);
    },
    [auditId, source]
  );

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return {
    persistOptimized,
    persistImprovement,
    clearPersistedSection,
    clearPersistedEntry,
  };
}
