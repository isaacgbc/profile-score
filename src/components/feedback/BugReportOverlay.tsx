"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { trackEvent } from "@/lib/analytics/tracker";
import Button from "@/components/ui/Button";
import { BugIcon, XIcon, CheckIcon } from "@/components/ui/Icons";

export default function BugReportOverlay() {
  const { t } = useI18n();
  const brT = (t as Record<string, Record<string, string>>).bugReport ?? {};

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    trackEvent("bug_report_submitted", {
      severity,
      url: typeof window !== "undefined" ? window.location.pathname : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
      description: description.slice(0, 1000),
      steps: steps.slice(0, 500),
    });
    setSubmitted(true);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setSubmitted(false);
      setDescription("");
      setSteps("");
      setSeverity("medium");
    }, 300);
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl hover:shadow-[var(--accent)]/30 active:scale-95"
        aria-label={brT.button ?? "Report a bug"}
        title={brT.button ?? "Report a bug"}
      >
        <BugIcon size={20} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Slide-out drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[380px] bg-white shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-2">
              <BugIcon size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {brT.title ?? "Report a Bug"}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <XIcon size={16} className="text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {submitted ? (
              <div className="text-center py-12 animate-slide-up">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckIcon size={24} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {brT.thanks ?? "Thanks for reporting!"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {brT.thanksDesc ?? "We'll look into this issue."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  {brT.desc ?? "Help us fix issues by describing what went wrong."}
                </p>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                    {brT.description ?? "What happened?"} <span className="text-[var(--error)]">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none resize-none transition-colors"
                    placeholder={brT.descriptionPlaceholder ?? "Describe the issue you encountered..."}
                  />
                </div>

                {/* Steps to reproduce */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                    {brT.steps ?? "Steps to reproduce"} <span className="text-[var(--text-muted)]">({brT.optional ?? "optional"})</span>
                  </label>
                  <textarea
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none resize-none transition-colors"
                    placeholder={brT.stepsPlaceholder ?? "1. Go to...\n2. Click on...\n3. See error"}
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                    {brT.severity ?? "Severity"}
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: "low", label: brT.severityLow ?? "Low", color: "bg-blue-50 text-blue-700 border-blue-200" },
                      { value: "medium", label: brT.severityMed ?? "Medium", color: "bg-amber-50 text-amber-700 border-amber-200" },
                      { value: "high", label: brT.severityHigh ?? "High", color: "bg-red-50 text-red-700 border-red-200" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSeverity(opt.value)}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          severity === opt.value
                            ? opt.color
                            : "bg-white text-[var(--text-muted)] border-[var(--border)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-captured info */}
                <p className="text-[10px] text-[var(--text-muted)]">
                  {brT.autoCapture ?? "URL and browser info are captured automatically."}
                </p>

                <Button type="submit" disabled={!description.trim()} className="w-full">
                  {brT.submit ?? "Submit Report"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
