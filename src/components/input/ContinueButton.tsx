"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

// ── Props ───────────────────────────────────────────────

interface ContinueButtonProps {
  /** Whether the form can be submitted */
  canContinue: boolean;
  /** Validation error to display */
  error: string;
  /** Callback when Continue is clicked */
  onContinue: () => void;
  /** i18n strings from t.common */
  commonI18n: Record<string, string>;
}

// ── Component ───────────────────────────────────────────

export default function ContinueButton({
  canContinue,
  error,
  onContinue,
  commonI18n,
}: ContinueButtonProps) {
  return (
    <>
      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 text-center mb-4">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/features">
          <Button variant="ghost">{commonI18n.back ?? "Back"}</Button>
        </Link>
        <Button onClick={onContinue} disabled={!canContinue}>
          {commonI18n.continue ?? "Continue"}
        </Button>
      </div>
    </>
  );
}
