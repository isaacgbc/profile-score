"use client";

import { useRef } from "react";
import type { PreprocessResult } from "@/lib/utils/input-preprocessor";
import InputPreview from "@/components/input/InputPreview";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  UploadIcon,
  CheckIcon,
  SearchIcon,
} from "@/components/ui/Icons";

/** Maximum processable characters per source (matches server-side truncation) */
const MAX_PROCESSABLE_CHARS = 15_000;

// ── Props ───────────────────────────────────────────────

interface LinkedinInputSectionProps {
  /** Current LinkedIn text */
  linkedinText: string;
  /** Current LinkedIn URL */
  linkedinUrl: string;
  /** Whether LinkedIn input passes validation */
  hasLinkedin: boolean;
  /** PDF extraction in progress */
  linkedinPdfExtracting: boolean;
  /** Name of extracted PDF (null if none) */
  linkedinPdfName: string | null;
  /** Guard result */
  linkedinGuards: { valid: boolean; warningKey?: string };
  /** Preprocessing result */
  linkedinPreprocess: PreprocessResult | null;
  /** Callbacks */
  onLinkedinTextChange: (value: string) => void;
  onLinkedinUrlChange: (value: string) => void;
  onLinkedinPdfUpload: (file: File) => void;
  onLinkedinDragOverChange: (over: boolean) => void;
  /** Whether drag is over the upload zone */
  linkedinDragOver: boolean;
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

export default function LinkedinInputSection({
  linkedinText,
  linkedinUrl,
  hasLinkedin,
  linkedinPdfExtracting,
  linkedinPdfName,
  linkedinGuards,
  linkedinPreprocess,
  onLinkedinTextChange,
  onLinkedinUrlChange,
  onLinkedinPdfUpload,
  onLinkedinDragOverChange,
  linkedinDragOver,
  i18n,
  guardI18n,
  previewI18n,
  commonI18n,
}: LinkedinInputSectionProps) {
  const linkedinFileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onLinkedinDragOverChange(false);
    const file = e.dataTransfer.files[0];
    if (file) onLinkedinPdfUpload(file);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onLinkedinPdfUpload(file);
  }

  return (
    <Card
      variant={hasLinkedin ? "highlighted" : "default"}
      padding="md"
      className="animate-slide-up"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            hasLinkedin
              ? "bg-emerald-100 text-emerald-600"
              : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
          }`}
        >
          {hasLinkedin ? <CheckIcon size={16} /> : <SearchIcon size={16} />}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {i18n.linkedinTitle ?? "LinkedIn Profile"}
          </h3>
        </div>
        {hasLinkedin && (
          <Badge variant="success">{i18n.linkedinProvided ?? "Provided"}</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-2">
        {i18n.linkedinDesc ?? "Upload your LinkedIn PDF export or paste your profile text."}
      </p>

      {/* 1. PDF Upload Drop Zone (Primary) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onLinkedinDragOverChange(true);
        }}
        onDragLeave={() => onLinkedinDragOverChange(false)}
        onDrop={handleDrop}
        onClick={() => linkedinFileRef.current?.click()}
        className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          linkedinDragOver
            ? "border-[var(--accent)] bg-[var(--accent-light)]"
            : linkedinPdfName
              ? "border-emerald-300 bg-emerald-50"
              : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-secondary)]"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            linkedinFileRef.current?.click();
        }}
      >
        {linkedinPdfExtracting ? (
          <>
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">
              {i18n.extractingPdf ?? "Extracting text from PDF..."}
            </p>
          </>
        ) : linkedinPdfName ? (
          <>
            <CheckIcon size={18} className="text-emerald-600 mb-1.5" />
            <p className="text-sm font-medium text-emerald-700">
              {linkedinPdfName}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {i18n.pdfExtracted ?? "Text extracted"}
            </p>
          </>
        ) : (
          <>
            <UploadIcon size={18} className="text-[var(--text-muted)] mb-1.5" />
            <p className="text-sm text-[var(--text-primary)]">
              {i18n.linkedinPdfUpload ?? "Upload LinkedIn PDF"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {i18n.linkedinPdfDesc ?? "Export your profile from LinkedIn as PDF"}
            </p>
          </>
        )}
        <input
          ref={linkedinFileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {/* 2. "or" divider */}
      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 h-px bg-[var(--border-light)]" />
        <span className="text-[10px] text-[var(--text-muted)] uppercase">
          {commonI18n.or ?? "or"}
        </span>
        <div className="flex-1 h-px bg-[var(--border-light)]" />
      </div>

      {/* 3. Paste text textarea (Fallback) */}
      <textarea
        value={linkedinText}
        onChange={(e) => onLinkedinTextChange(e.target.value)}
        placeholder={i18n.linkedinTextPlaceholder ?? "Paste your LinkedIn profile text here..."}
        rows={3}
        className="w-full px-3 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
        aria-label="LinkedIn profile text"
      />

      {/* HOTFIX-3: Char counter */}
      {linkedinText.length > 0 && (
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={`text-xs font-medium ${
              linkedinText.length > MAX_PROCESSABLE_CHARS
                ? "text-amber-600 font-semibold"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {linkedinText.length.toLocaleString()} / {MAX_PROCESSABLE_CHARS.toLocaleString()} chars
          </span>
          {linkedinText.length > MAX_PROCESSABLE_CHARS && (
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
              {i18n.charsProcessed?.replace("{max}", MAX_PROCESSABLE_CHARS.toLocaleString()) ??
                `Only the first ${MAX_PROCESSABLE_CHARS.toLocaleString()} characters will be processed`}
            </span>
          )}
        </div>
      )}

      {/* Input guard warnings */}
      {linkedinText.trim().length > 0 && linkedinGuards.warningKey && (
        <p className={`text-xs mt-1.5 ${linkedinGuards.valid ? "text-amber-600" : "text-red-600"}`}>
          {guardI18n[linkedinGuards.warningKey] ?? linkedinGuards.warningKey}
        </p>
      )}

      {/* Extracted text preview */}
      {hasLinkedin && linkedinPdfName && (
        <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
          {linkedinText.substring(0, 100)}...
        </p>
      )}

      {/* Preprocessing preview */}
      <InputPreview
        result={linkedinPreprocess}
        i18n={previewI18n}
        sourceType="linkedin"
      />

      {/* 4. URL input (Optional metadata, de-emphasized) */}
      <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
        <label className="block text-xs text-[var(--text-muted)] mb-1">
          LinkedIn URL ({(commonI18n.or ?? "or").toLowerCase()}ptional)
        </label>
        <input
          type="url"
          value={linkedinUrl}
          onChange={(e) => onLinkedinUrlChange(e.target.value)}
          placeholder={i18n.linkedinUrlPlaceholder ?? "https://linkedin.com/in/your-profile"}
          className="w-full px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
          aria-label="LinkedIn URL"
        />
        {linkedinUrl.trim().length > 5 && !hasLinkedin && (
          <p className="text-xs text-amber-600 mt-1">
            {i18n.urlOnlyHint ?? "A URL alone isn't enough — upload the PDF or paste your profile text."}
          </p>
        )}
      </div>
    </Card>
  );
}
