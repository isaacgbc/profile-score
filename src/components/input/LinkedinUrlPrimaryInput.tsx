"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/context/I18nContext";
import { scrapeLinkedinRequestSchema } from "@/lib/schemas/linkedin-profile";
import { SearchIcon } from "@/components/ui/Icons";

// ── Props ───────────────────────────────────────────────

interface LinkedinUrlPrimaryInputProps {
  /** Called when user submits a valid LinkedIn URL */
  onSubmit: (url: string) => void | Promise<void>;
  /** Whether the scrape request is in flight */
  isSubmitting: boolean;
  /** i18n key for current error (null = no error) */
  errorKey: string | null;
  /** Error code for conditional CTA rendering */
  errorCode: string | null;
  /** Called when user clicks "Try again" in error banner */
  onRetry?: () => void;
  /** Called when user clicks "Upload CV instead" in error banner */
  onSwitchToCv?: () => void;
  /** Whether name + email are filled (gates the Analyze button) */
  canAnalyze?: boolean;
}

// ── Component ───────────────────────────────────────────

export default function LinkedinUrlPrimaryInput({
  onSubmit,
  isSubmitting,
  errorKey,
  errorCode,
  onRetry,
  onSwitchToCv,
  canAnalyze = true,
}: LinkedinUrlPrimaryInputProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputI18n = t.input as any as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apifyI18n = (t as any).apify as
    | {
        error: Record<string, string>;
        actions: Record<string, string>;
      }
    | undefined;

  const validateUrl = useCallback(
    (value: string): boolean => {
      if (!value.trim()) {
        setValidationError(null);
        return false;
      }
      const result = scrapeLinkedinRequestSchema.safeParse({ url: value });
      if (!result.success) {
        setValidationError(
          apifyI18n?.error?.invalidUrl ??
            "That doesn't look like a LinkedIn profile URL.",
        );
        return false;
      }
      setValidationError(null);
      return true;
    },
    [apifyI18n],
  );

  const handleBlur = useCallback(() => {
    if (url.trim()) {
      validateUrl(url);
    }
  }, [url, validateUrl]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateUrl(url)) return;
      onSubmit(url);
    },
    [url, validateUrl, onSubmit],
  );

  const isValid = url.trim().length > 0 && !validationError;
  const isDisabled = !isValid || isSubmitting || !canAnalyze;

  // Resolve error message from i18n key
  const resolvedError = errorKey ? resolveI18nKey(errorKey, apifyI18n) : null;

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{
        backgroundColor: "var(--surface-secondary)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <form onSubmit={handleSubmit}>
        {/* Label */}
        <label
          htmlFor="linkedin-url-input"
          className="block text-sm font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          {inputI18n.linkedinUrlPrimaryLabel ??
            "Paste your LinkedIn profile URL"}
        </label>

        {/* Helper text */}
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {inputI18n.linkedinUrlHelp ??
            "We'll analyze your full profile in seconds"}
        </p>

        {/* Input + Submit row */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            >
              <SearchIcon size={16} />
            </div>
            <input
              id="linkedin-url-input"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onBlur={handleBlur}
              placeholder={
                inputI18n.linkedinUrlPlaceholder ??
                "https://linkedin.com/in/yourname"
              }
              disabled={isSubmitting}
              className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--surface-primary)",
                color: "var(--text-primary)",
                borderColor: validationError
                  ? "var(--border-error, #ef4444)"
                  : "var(--border-subtle)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--tw-ring-color" as any]: "var(--accent)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground, #fff)",
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {inputI18n.analyzing ?? "Analyzing..."}
              </span>
            ) : (
              (inputI18n.analyze ?? "Analyze")
            )}
          </button>
        </div>

        {/* Inline validation error */}
        {validationError && !errorKey && (
          <p
            className="text-xs mt-2"
            style={{ color: "var(--text-error, #ef4444)" }}
          >
            {validationError}
          </p>
        )}

        {/* Name + email required hint */}
        {!canAnalyze && !isSubmitting && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {inputI18n.fillNameEmailFirst ??
              "Fill in your name and email above to analyze"}
          </p>
        )}
      </form>

      {/* API error banner with recovery actions */}
      {resolvedError && (
        <div
          className="mt-4 rounded-lg border p-4"
          style={{
            backgroundColor: "var(--surface-secondary)",
            borderColor: "var(--border-error, #ef4444)",
          }}
        >
          <p className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
            {resolvedError}
          </p>

          <div className="flex flex-wrap gap-2">
            {/* Retry button (always shown) */}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md px-3 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-primary)",
                }}
              >
                {apifyI18n?.actions?.retry ?? "Try again"}
              </button>
            )}

            {/* "Upload CV instead" button */}
            {onSwitchToCv && (
              <button
                type="button"
                onClick={onSwitchToCv}
                className="rounded-md px-3 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-primary)",
                }}
              >
                {apifyI18n?.actions?.switchToCv ?? "Upload CV instead"}
              </button>
            )}

            {/* Upgrade button (quota exceeded only) */}
            {errorCode === "APIFY_QUOTA_EXCEEDED" && (
              <a
                href="/pricing"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity inline-block"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground, #fff)",
                }}
              >
                {apifyI18n?.actions?.upgrade ?? "Upgrade plan"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────

function resolveI18nKey(
  key: string,
  apifyI18n?: {
    error: Record<string, string>;
    actions: Record<string, string>;
  },
): string | null {
  if (!key) return null;

  // Keys are like "apify.error.invalidUrl" -> apifyI18n.error.invalidUrl
  const parts = key.split(".");
  if (parts.length === 3 && parts[0] === "apify" && parts[1] === "error") {
    return apifyI18n?.error?.[parts[2]] ?? key;
  }

  return key;
}
