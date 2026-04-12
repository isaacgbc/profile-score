"use client";

import { useApp } from "@/context/AppContext";
import type { HarvestProfile, ApifyQuotaState } from "@/lib/types";

export type ScrapeStatus = "idle" | "scraping" | "done" | "error";

/**
 * Thin wrapper over AppContext Apify state.
 * Preserves the same API surface as the original hook so existing consumers
 * (e.g. /input page from Plan 01-09) continue working without changes.
 */
export function useLinkedinScrape(): {
  status: ScrapeStatus;
  profile: HarvestProfile | null;
  errorKey: string | null;
  errorCode: string | null;
  quotaState: ApifyQuotaState | null;
  triggerScrape: (url: string) => Promise<void>;
  reset: () => void;
} {
  const ctx = useApp();
  return {
    status: ctx.scrapeStatus,
    profile: ctx.scrapedProfile,
    errorKey: ctx.scrapeErrorKey,
    errorCode: ctx.scrapeErrorCode,
    quotaState: ctx.apifyQuota,
    triggerScrape: ctx.triggerLinkedinScrape,
    reset: ctx.resetLinkedinScrape,
  };
}
