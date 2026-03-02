/**
 * Client-side analytics tracker — fire-and-forget pattern.
 *
 * Non-blocking: `fetch().catch(() => {})` so analytics never break UX.
 * SSR-safe: all browser APIs gated behind `typeof window !== "undefined"`.
 * Privacy: metadata sanitizer strips keys containing sensitive terms.
 */

// ── Types ──────────────────────────────────────────────
export interface TrackPayload {
  sessionId?: string;
  userId?: string;
  auditId?: string;
  planId?: string | null;
  sourceType?: "linkedin" | "cv" | "both";
  locale?: string;
  metadata?: Record<string, unknown>;
}

// ── Sensitive key pattern (case-insensitive) ───────────
const SENSITIVE_KEY_RE =
  /content|text|cv|secret|token|password|key|credential|authorization/i;

function sanitizeMetadata(
  meta: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!SENSITIVE_KEY_RE.test(k)) {
      clean[k] = v;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

// ── Session ID (persistent across page views) ──────────
function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = localStorage.getItem("ps_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ps_session_id", id);
    }
    return id;
  } catch {
    // Private browsing or localStorage disabled
    return undefined;
  }
}

// ── Mount-event deduplication (per browser session) ────
export function hasTrackedThisSession(eventName: string): boolean {
  if (typeof window === "undefined") return true; // SSR: skip
  try {
    return sessionStorage.getItem(`ps_tracked_${eventName}`) === "1";
  } catch {
    return false;
  }
}

export function markTrackedThisSession(eventName: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`ps_tracked_${eventName}`, "1");
  } catch {
    // Silently ignore
  }
}

// ── Main tracker ───────────────────────────────────────
export function trackEvent(
  eventName: string,
  payload?: Partial<TrackPayload>
): void {
  if (typeof window === "undefined") return;

  const body = {
    eventName,
    sessionId: payload?.sessionId ?? getSessionId(),
    userId: payload?.userId,
    auditId: payload?.auditId,
    planId: payload?.planId ?? undefined,
    sourceType: payload?.sourceType,
    locale: payload?.locale,
    metadata: sanitizeMetadata(payload?.metadata),
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    referrer: document.referrer || undefined,
  };

  // Fire-and-forget — analytics must never break UX
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
