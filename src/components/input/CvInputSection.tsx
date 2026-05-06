"use client";

import { useRef } from "react";
import type { PreprocessResult } from "@/lib/utils/input-preprocessor";
import { DOCX_NO_EXTRACTION_WARNING } from "@/lib/utils/input-guards";
import InputPreview from "@/components/input/InputPreview";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  UploadIcon,
  CheckIcon,
  FileTextIcon,
} from "@/components/ui/Icons";

/** Maximum processable characters per source (matches server-side truncation) */
const MAX_PROCESSABLE_CHARS = 15_000;

// ── Props ───────────────────────────────────────────────

interface CvInputSectionProps {
  /** Current CV text */
  cvText: string;
  /** CV filename (from upload) */
  cvFileName: string;
  /** Whether CV input passes validation */
  hasCv: boolean;
  /** PDF extraction in progress */
  cvPdfExtracting: boolean;
  /** DOCX extraction in progress */
  cvDocxExtracting: boolean;
  /** Whether to show the DOCX warning */
  showDocxWarning: boolean;
  /** Drag state */
  dragOver: boolean;
  /** Guard result */
  cvGuards: { valid: boolean; warningKey?: string };
  /** Preprocessing result */
  cvPreprocess: PreprocessResult | null;
  /** Callbacks */
  onCvTextChange: (value: string) => void;
  onCvFileUpload: (file: File) => void;
  onDragOverChange: (over: boolean) => void;
  /** i18n strings from t.input cast as Record */
  i18n: Record<string, string>;
  /** Guard i18n strings */
  guardI18n: Record<string, string>;
  /** Preview i18n strings */
  previewI18n: Record<string, string>;
  /** Common strings */
  commonI18n: Record<string, string>;
}

// ── Component ───────────────────────────────────────────

export default function CvInputSection({
  cvText,
  cvFileName,
  hasCv,
  cvPdfExtracting,
  cvDocxExtracting,
  showDocxWarning,
  dragOver,
  cvGuards,
  cvPreprocess,
  onCvTextChange,
  onCvFileUpload,
  onDragOverChange,
  i18n,
  guardI18n,
  previewI18n,
  commonI18n,
}: CvInputSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onDragOverChange(false);
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type === "application/pdf" || file.name.endsWith(".docx"))
    ) {
      onCvFileUpload(file);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCvFileUpload(file);
  }

  return (
    <Card
      variant={hasCv ? "highlighted" : "default"}
      padding="md"
      className="animate-slide-up"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            hasCv
              ? "bg-emerald-100 text-emerald-600"
              : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
          }`}
        >
          {hasCv ? <CheckIcon size={16} /> : <FileTextIcon size={16} />}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {i18n.cvTitle ?? "CV / Resume"}
          </h3>
        </div>
        {hasCv && (
          <Badge variant="success">{i18n.cvUploaded ?? "Uploaded"}</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        {i18n.cvDesc ?? "Upload your CV or paste the text."}
      </p>

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onDragOverChange(true);
        }}
        onDragLeave={() => onDragOverChange(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center py-8 px-6 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent-light)]"
            : hasCv
              ? "border-emerald-300 bg-emerald-50"
              : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-secondary)]"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
      >
        {(cvPdfExtracting || cvDocxExtracting) ? (
          <>
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">
              {cvDocxExtracting
                ? (guardI18n.docxExtracting ?? "Extracting text from DOCX...")
                : (i18n.extractingPdf ?? "Extracting text from PDF...")}
            </p>
          </>
        ) : hasCv ? (
          <>
            <CheckIcon size={20} className="text-emerald-600 mb-2" />
            <p className="text-sm font-medium text-emerald-700">
              {cvFileName || (i18n.pdfExtracted ?? "Text extracted")}
            </p>
          </>
        ) : (
          <>
            <UploadIcon size={20} className="text-[var(--text-muted)] mb-2" />
            <p className="text-sm text-[var(--text-primary)]">
              {i18n.cvUploadDesc ?? "Upload your CV"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {i18n.cvFormats ?? "PDF or DOCX"}
            </p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {/* Paste CV text alternative */}
      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 h-px bg-[var(--border-light)]" />
        <span className="text-[10px] text-[var(--text-muted)] uppercase">
          {commonI18n.or ?? "or"}
        </span>
        <div className="flex-1 h-px bg-[var(--border-light)]" />
      </div>
      <textarea
        value={cvText}
        onChange={(e) => onCvTextChange(e.target.value)}
        placeholder={i18n.cvTextPlaceholder ?? "Paste your CV text here..."}
        rows={3}
        className="w-full px-3 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
        aria-label="CV text"
      />

      {/* HOTFIX-3: Char counter */}
      {cvText.length > 0 && (
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={`text-xs font-medium ${
              cvText.length > MAX_PROCESSABLE_CHARS
                ? "text-amber-600 font-semibold"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {cvText.length.toLocaleString()} / {MAX_PROCESSABLE_CHARS.toLocaleString()} chars
          </span>
          {cvText.length > MAX_PROCESSABLE_CHARS && (
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
              {i18n.charsProcessed?.replace("{max}", MAX_PROCESSABLE_CHARS.toLocaleString()) ??
                `Only the first ${MAX_PROCESSABLE_CHARS.toLocaleString()} characters will be processed`}
            </span>
          )}
        </div>
      )}

      {/* CV input guard warnings */}
      {cvText.trim().length > 0 && cvGuards.warningKey && (
        <p className={`text-xs mt-1.5 ${cvGuards.valid ? "text-amber-600" : "text-red-600"}`}>
          {guardI18n[cvGuards.warningKey] ?? cvGuards.warningKey}
        </p>
      )}

      {/* DOCX no-extraction warning */}
      {showDocxWarning && (
        <p className="text-xs text-amber-600 mt-1.5">
          {guardI18n[DOCX_NO_EXTRACTION_WARNING] ??
            "DOCX text extraction isn't available yet. Paste your CV text directly or upload a PDF."}
        </p>
      )}

      {/* CV Preprocessing preview */}
      <InputPreview
        result={cvPreprocess}
        i18n={previewI18n}
        sourceType="cv"
      />
    </Card>
  );
}
