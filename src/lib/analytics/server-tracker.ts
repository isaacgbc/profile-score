/**
 * Server-side analytics tracker — fire-and-forget pattern.
 *
 * Non-blocking: `.catch(() => {})` so analytics never break UX.
 * Privacy: sensitive keys are stripped from metadata before persistence.
 */

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

// ── Sensitive key pattern (same as client tracker) ────────
const SENSITIVE_KEY_RE =
  /content|text|cv|secret|token|password|key|credential|authorization|email|phone|address|ssn/i;

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

// ── Fire-and-forget server event ──────────────────────────
export function trackServerEvent(
  eventName: string,
  payload?: {
    sessionId?: string;
    userId?: string;
    auditId?: string;
    planId?: string | null;
    sourceType?: string;
    locale?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  prisma.analyticsEvent
    .create({
      data: {
        eventName,
        sessionId: payload?.sessionId,
        userId: payload?.userId,
        auditId: payload?.auditId,
        planId: payload?.planId ?? undefined,
        sourceType: payload?.sourceType,
        locale: payload?.locale,
        metadata: (sanitizeMetadata(payload?.metadata) as Prisma.InputJsonValue) ?? undefined,
      },
    })
    .catch(() => {
      // Analytics must never break the flow — silently discard errors
    });
}
