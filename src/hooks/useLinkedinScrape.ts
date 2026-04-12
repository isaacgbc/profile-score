"use client";

import { useState, useCallback } from "react";
import { scrapeLinkedinRequestSchema } from "@/lib/schemas/linkedin-profile";
import type { HarvestProfile, ApifyQuotaState } from "@/lib/types";

export type ScrapeStatus = "idle" | "scraping" | "done" | "error";

const ERROR_CODE_TO_I18N: Record<string, string> = {
  APIFY_INVALID_URL: "apify.error.invalidUrl",
  APIFY_PROFILE_PRIVATE: "apify.error.private",
  APIFY_RATE_LIMITED: "apify.error.rateLimit",
  APIFY_CIRCUIT_OPEN: "apify.error.downtime",
  APIFY_DOWNTIME: "apify.error.downtime",
  APIFY_QUOTA_EXCEEDED: "apify.error.quotaExceeded",
  APIFY_SCRAPE_FAILED: "apify.error.generic",
  APIFY_DISABLED: "apify.error.disabled",
  APIFY_TOKEN_MISSING: "apify.error.generic",
};

export function useLinkedinScrape() {
  const [status, setStatus] = useState<ScrapeStatus>("idle");
  const [profile, setProfile] = useState<HarvestProfile | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [quotaState, setQuotaState] = useState<ApifyQuotaState | null>(null);

  const triggerScrape = useCallback(async (rawUrl: string) => {
    setStatus("scraping");
    setErrorKey(null);
    setErrorCode(null);
    setProfile(null);

    // Client-side Zod pre-check (cheap, avoids a round-trip)
    const parsed = scrapeLinkedinRequestSchema.safeParse({ url: rawUrl });
    if (!parsed.success) {
      setStatus("error");
      setErrorCode("APIFY_INVALID_URL");
      setErrorKey("apify.error.invalidUrl");
      return;
    }

    try {
      const res = await fetch("/api/scrape-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.data.url }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code =
          typeof body?.error === "string" ? body.error : "APIFY_SCRAPE_FAILED";
        setStatus("error");
        setErrorCode(code);
        setErrorKey(ERROR_CODE_TO_I18N[code] ?? "apify.error.generic");
        return;
      }

      setProfile(body.profile as HarvestProfile);
      setQuotaState({
        remaining: body.quotaRemaining ?? null,
        plan: body.plan ?? "free",
      });
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorCode("APIFY_SCRAPE_FAILED");
      setErrorKey("apify.error.generic");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProfile(null);
    setErrorKey(null);
    setErrorCode(null);
  }, []);

  return {
    status,
    profile,
    errorKey,
    errorCode,
    quotaState,
    triggerScrape,
    reset,
  };
}
