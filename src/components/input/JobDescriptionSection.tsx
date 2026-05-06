"use client";

import { useRef } from "react";
import {
  UploadIcon,
  CheckIcon,
  LinkIcon,
  FileTextIcon,
} from "@/components/ui/Icons";

// ── Props ───────────────────────────────────────────────

interface JobDescriptionSectionProps {
  /** Objective mode: "job" or "objective" */
  objectiveMode: "job" | "objective";
  /** Job description text */
  jobDescription: string;
  /** Objective text */
  objectiveText: string;
  /** Target URL */
  targetUrl: string;
  /** Target input type: "url" or "pdf" */
  targetInputType: "url" | "pdf";
  /** Target filename (from upload) */
  targetFileName: string;
  /** Job PDF extracting state */
  jobPdfExtracting: boolean;
  /** Drag state for target upload */
  targetDragOver: boolean;
  /** Callbacks */
  onObjectiveModeChange: (mode: "job" | "objective") => void;
  onJobDescriptionChange: (value: string) => void;
  onObjectiveTextChange: (value: string) => void;
  onTargetUrlChange: (value: string) => void;
  onTargetInputTypeChange: (type: "url" | "pdf") => void;
  onTargetPdfUpload: (file: File) => void;
  onTargetDragOverChange: (over: boolean) => void;
  /** i18n strings from t.input cast as Record */
  i18n: Record<string, string>;
  /** Guard i18n strings */
  guardI18n: Record<string, string>;
  /** Common strings */
  commonI18n: Record<string, string>;
}

// ── Component ───────────────────────────────────────────

export default function JobDescriptionSection({
  objectiveMode,
  jobDescription,
  objectiveText,
  targetUrl,
  targetInputType,
  targetFileName,
  jobPdfExtracting,
  targetDragOver,
  onObjectiveModeChange,
  onJobDescriptionChange,
  onObjectiveTextChange,
  onTargetUrlChange,
  onTargetInputTypeChange,
  onTargetPdfUpload,
  onTargetDragOverChange,
  i18n,
  guardI18n,
  commonI18n,
}: JobDescriptionSectionProps) {
  const targetFileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onTargetDragOverChange(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      onTargetPdfUpload(file);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onTargetPdfUpload(file);
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        {i18n.objectiveTitle ?? "What are you optimizing for?"}
      </h3>

      {/* Mode toggle */}
      <div className="flex bg-[var(--surface-secondary)] rounded-xl p-1 mb-4">
        {(["job", "objective"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onObjectiveModeChange(mode)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              objectiveMode === mode
                ? "bg-white text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {mode === "job"
              ? (i18n.objectiveModeJob ?? "Job Description")
              : (i18n.objectiveModeObjective ?? "Career Objective")}
          </button>
        ))}
      </div>

      {objectiveMode === "job" ? (
        <>
          {/* Target input type toggle: URL or PDF */}
          <div className="mb-3">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
              {i18n.targetInputTitle ?? "How would you like to provide it?"}
            </p>
            <div className="flex bg-[var(--surface-secondary)] rounded-lg p-0.5 mb-3 max-w-xs">
              {(["url", "pdf"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onTargetInputTypeChange(type)}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    (targetInputType || "url") === type
                      ? "bg-white text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {type === "url" ? <LinkIcon size={12} /> : <FileTextIcon size={12} />}
                  {type === "url"
                    ? (i18n.targetModeUrl ?? "URL")
                    : (i18n.targetModePdf ?? "PDF")}
                </button>
              ))}
            </div>

            {(targetInputType || "url") === "url" ? (
              <input
                type="url"
                value={targetUrl || ""}
                onChange={(e) => onTargetUrlChange(e.target.value)}
                placeholder={i18n.targetUrlPlaceholder ?? "https://example.com/job-posting"}
                className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
              />
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  onTargetDragOverChange(true);
                }}
                onDragLeave={() => onTargetDragOverChange(false)}
                onDrop={handleDrop}
                onClick={() => targetFileRef.current?.click()}
                className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                  targetDragOver
                    ? "border-[var(--accent)] bg-[var(--accent-light)]"
                    : targetFileName
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-secondary)]"
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    targetFileRef.current?.click();
                }}
              >
                {jobPdfExtracting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      {guardI18n.jobPdfExtracting ?? "Extracting text from PDF..."}
                    </p>
                  </>
                ) : targetFileName ? (
                  <>
                    <CheckIcon size={18} className="text-emerald-600 mb-1.5" />
                    <p className="text-sm font-medium text-emerald-700">
                      {targetFileName}
                    </p>
                  </>
                ) : (
                  <>
                    <UploadIcon size={18} className="text-[var(--text-muted)] mb-1.5" />
                    <p className="text-sm text-[var(--text-primary)]">
                      {i18n.targetUploadDesc ?? "Upload job description PDF"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {i18n.targetFormats ?? "PDF only"}
                    </p>
                  </>
                )}
                <input
                  ref={targetFileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleSelect}
                />
              </div>
            )}
          </div>

          {/* Fallback: paste job description */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-[var(--border-light)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">
              {commonI18n.or ?? "or"}
            </span>
            <div className="flex-1 h-px bg-[var(--border-light)]" />
          </div>
          <textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder={i18n.jobDescPlaceholder ?? "Paste the job description here..."}
            rows={3}
            className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
          />
        </>
      ) : (
        <textarea
          value={objectiveText}
          onChange={(e) => onObjectiveTextChange(e.target.value)}
          placeholder={i18n.objectivePlaceholder ?? "Describe your career objective..."}
          rows={3}
          className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
        />
      )}
      <p className="text-xs text-[var(--text-muted)] mt-1.5">
        {i18n.objectiveHelp ?? "This helps tailor your audit results."}
      </p>
    </div>
  );
}
