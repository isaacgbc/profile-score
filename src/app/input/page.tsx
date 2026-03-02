"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import { extractTextFromPdf } from "@/lib/utils/pdf-extract";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StepIndicator from "@/components/layout/StepIndicator";
import {
  UploadIcon,
  CheckIcon,
  GlobeIcon,
  LinkIcon,
  SearchIcon,
  FileTextIcon,
  MailIcon,
} from "@/components/ui/Icons";
import type { Locale } from "@/lib/types";
import { trackEvent } from "@/lib/analytics/tracker";

/** HOTFIX-2: Maximum processable characters per source (matches server-side truncation) */
const MAX_PROCESSABLE_CHARS = 15_000;

export default function InputPage() {
  const { t } = useI18n();
  const { userInput, setUserInput, exportLocale, setExportLocale, userEmail, setUserEmail } = useApp();
  const router = useRouter();

  const [dragOver, setDragOver] = useState(false);
  const [targetDragOver, setTargetDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const linkedinFileRef = useRef<HTMLInputElement>(null);
  const targetFileRef = useRef<HTMLInputElement>(null);

  // PDF extraction state
  const [linkedinPdfExtracting, setLinkedinPdfExtracting] = useState(false);
  const [cvPdfExtracting, setCvPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [linkedinPdfName, setLinkedinPdfName] = useState<string | null>(null);
  const [linkedinDragOver, setLinkedinDragOver] = useState(false);

  // LinkedIn requires actual text content (from PDF extraction or paste)
  const hasLinkedin = userInput.linkedinText.trim().length > 20;
  // CV requires actual text content (from PDF extraction or paste)
  const hasCv = userInput.cvText.trim().length > 20;
  const hasName = userInput.userName.trim().length >= 2;
  const hasEmail = userEmail.trim().length > 0 && userEmail.includes("@") && userEmail.includes(".");
  // Show upload cards based on audit type chosen in Features page
  const showLinkedin = !userInput.method || userInput.method === "linkedin" || userInput.method === "both";
  const showCv = !userInput.method || userInput.method === "cv" || userInput.method === "both";
  const canContinue = hasName && hasEmail && (hasLinkedin || hasCv);

  function handleContinue() {
    if (!canContinue) {
      setError(t.input.validation);
      return;
    }
    setError("");

    // Derive actual method from what was uploaded (handles partial uploads)
    const derivedMethod =
      hasLinkedin && hasCv ? "both" : hasLinkedin ? "linkedin" : "cv";

    // ── Analytics: start_audit ──
    trackEvent("start_audit", {
      sourceType: derivedMethod,
      locale: exportLocale,
    });

    setUserInput({ method: derivedMethod });
    router.push("/results");
  }

  // ── LinkedIn PDF upload handler ──
  async function handleLinkedinPdfUpload(file: File) {
    if (file.type !== "application/pdf") return;
    setLinkedinPdfExtracting(true);
    setPdfError(null);
    const result = await extractTextFromPdf(file);
    setLinkedinPdfExtracting(false);

    if (result.error === "insufficient_text") {
      setPdfError(t.input.pdfScanError);
      return;
    }
    if (result.error) {
      setPdfError(t.input.pdfParseError);
      return;
    }
    setLinkedinPdfName(file.name);
    setUserInput({ linkedinText: result.text });
  }

  function handleLinkedinPdfDrop(e: React.DragEvent) {
    e.preventDefault();
    setLinkedinDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLinkedinPdfUpload(file);
  }

  function handleLinkedinPdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLinkedinPdfUpload(file);
  }

  // ── CV file handlers — extract text from PDF ──
  async function handleCvPdfUpload(file: File) {
    if (file.type === "application/pdf") {
      setCvPdfExtracting(true);
      setPdfError(null);
      const result = await extractTextFromPdf(file);
      setCvPdfExtracting(false);
      if (result.error === "insufficient_text") {
        setPdfError(t.input.pdfScanError);
        return;
      }
      if (result.error) {
        setPdfError(t.input.pdfParseError);
        return;
      }
      setUserInput({ cvText: result.text, cvFileName: file.name });
    } else if (file.name.endsWith(".docx")) {
      // DOCX: keep filename only (no text extraction for docx yet)
      setUserInput({ cvFileName: file.name });
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type === "application/pdf" || file.name.endsWith(".docx"))
    ) {
      handleCvPdfUpload(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleCvPdfUpload(file);
    }
  }

  function handleTargetFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setTargetDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setUserInput({ targetFileName: file.name, targetInputType: "pdf" });
    }
  }

  function handleTargetFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUserInput({ targetFileName: file.name, targetInputType: "pdf" });
    }
  }

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="input" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            {t.input.title}
          </h1>
          <p className="text-[var(--text-secondary)]">{t.input.subtitle}</p>
        </div>

        {/* Export Language Selector */}
        <div className="flex items-center justify-center gap-3 mb-8 p-3 bg-[var(--surface-secondary)] rounded-xl">
          <GlobeIcon size={16} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {t.input.exportLangLabel}:
          </span>
          <div className="flex bg-white rounded-lg p-0.5 border border-[var(--border)]">
            {(["en", "es"] as Locale[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setExportLocale(lang)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  exportLocale === lang
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {lang === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>

        {/* Full Name (Required) */}
        <div className="mb-6">
          <label
            htmlFor="userName"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
          >
            {(t.input as Record<string, string>).nameLabel ?? "Full Name"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            id="userName"
            type="text"
            value={userInput.userName}
            onChange={(e) => setUserInput({ userName: e.target.value })}
            placeholder={(t.input as Record<string, string>).namePlaceholder ?? "e.g., Jane Smith"}
            className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
            required
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {(t.input as Record<string, string>).nameHelp ?? "Used in your CV export and cover letter."}
          </p>
        </div>

        {/* PDF Error Banner */}
        {pdfError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-6">
            <p className="text-xs text-amber-700">{pdfError}</p>
          </div>
        )}

        {/* ── Source Selection ────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t.input.sourceSelectionTitle}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t.input.sourceSelectionDesc}
            </p>
          </div>

          <div className={`grid ${showLinkedin && showCv ? "md:grid-cols-2" : ""} gap-4`}>
            {/* LinkedIn Card — PDF-first */}
            {showLinkedin && (
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
                  {hasLinkedin ? (
                    <CheckIcon size={16} />
                  ) : (
                    <SearchIcon size={16} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t.input.linkedinTitle}
                  </h3>
                </div>
                {hasLinkedin && (
                  <Badge variant="success">{t.input.linkedinProvided}</Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                {t.input.linkedinDesc}
              </p>

              {/* 1. PDF Upload Drop Zone (Primary) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setLinkedinDragOver(true);
                }}
                onDragLeave={() => setLinkedinDragOver(false)}
                onDrop={handleLinkedinPdfDrop}
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
                      {t.input.extractingPdf}
                    </p>
                  </>
                ) : linkedinPdfName ? (
                  <>
                    <CheckIcon size={18} className="text-emerald-600 mb-1.5" />
                    <p className="text-sm font-medium text-emerald-700">
                      {linkedinPdfName}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {t.input.pdfExtracted}
                    </p>
                  </>
                ) : (
                  <>
                    <UploadIcon
                      size={18}
                      className="text-[var(--text-muted)] mb-1.5"
                    />
                    <p className="text-sm text-[var(--text-primary)]">
                      {t.input.linkedinPdfUpload}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {t.input.linkedinPdfDesc}
                    </p>
                  </>
                )}
                <input
                  ref={linkedinFileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleLinkedinPdfSelect}
                />
              </div>

              {/* 2. "or" divider */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-[var(--border-light)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {t.common.or}
                </span>
                <div className="flex-1 h-px bg-[var(--border-light)]" />
              </div>

              {/* 3. Paste text textarea (Fallback) */}
              <textarea
                value={userInput.linkedinText}
                onChange={(e) =>
                  setUserInput({ linkedinText: e.target.value })
                }
                placeholder={t.input.linkedinTextPlaceholder}
                rows={3}
                className="w-full px-3 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
                aria-label="LinkedIn profile text"
              />

              {/* HOTFIX-3: Char counter — visible from first character, stronger contrast */}
              {userInput.linkedinText.length > 0 && (
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-xs font-medium ${userInput.linkedinText.length > MAX_PROCESSABLE_CHARS ? "text-amber-600 font-semibold" : "text-[var(--text-secondary)]"}`}>
                    {userInput.linkedinText.length.toLocaleString()} / {MAX_PROCESSABLE_CHARS.toLocaleString()} chars
                  </span>
                  {userInput.linkedinText.length > MAX_PROCESSABLE_CHARS && (
                    <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                      {t.input?.charsProcessed?.replace("{max}", MAX_PROCESSABLE_CHARS.toLocaleString()) ?? `Only the first ${MAX_PROCESSABLE_CHARS.toLocaleString()} characters will be processed`}
                    </span>
                  )}
                </div>
              )}

              {/* Extracted text preview */}
              {hasLinkedin && linkedinPdfName && (
                <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                  {userInput.linkedinText.substring(0, 100)}...
                </p>
              )}

              {/* 4. URL input (Optional metadata, de-emphasized) */}
              <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  LinkedIn URL ({t.common.or.toLowerCase()}ptional)
                </label>
                <input
                  type="url"
                  value={userInput.linkedinUrl}
                  onChange={(e) =>
                    setUserInput({ linkedinUrl: e.target.value })
                  }
                  placeholder={t.input.linkedinUrlPlaceholder}
                  className="w-full px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
                  aria-label="LinkedIn URL"
                />
                {userInput.linkedinUrl.trim().length > 5 && !hasLinkedin && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t.input.urlOnlyHint}
                  </p>
                )}
              </div>
            </Card>
            )}

            {/* CV Card */}
            {showCv && (
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
                  {hasCv ? (
                    <CheckIcon size={16} />
                  ) : (
                    <FileTextIcon size={16} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t.input.cvTitle}
                  </h3>
                </div>
                {hasCv && (
                  <Badge variant="success">{t.input.cvUploaded}</Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {t.input.cvDesc}
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
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
                  if (e.key === "Enter" || e.key === " ")
                    fileRef.current?.click();
                }}
              >
                {cvPdfExtracting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t.input.extractingPdf}
                    </p>
                  </>
                ) : hasCv ? (
                  <>
                    <CheckIcon size={20} className="text-emerald-600 mb-2" />
                    <p className="text-sm font-medium text-emerald-700">
                      {userInput.cvFileName || t.input.pdfExtracted}
                    </p>
                  </>
                ) : (
                  <>
                    <UploadIcon
                      size={20}
                      className="text-[var(--text-muted)] mb-2"
                    />
                    <p className="text-sm text-[var(--text-primary)]">
                      {t.input.cvUploadDesc}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {t.input.cvFormats}
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {/* Paste CV text alternative */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-[var(--border-light)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {t.common.or}
                </span>
                <div className="flex-1 h-px bg-[var(--border-light)]" />
              </div>
              <textarea
                value={userInput.cvText}
                onChange={(e) =>
                  setUserInput({ cvText: e.target.value })
                }
                placeholder={t.input.cvTextPlaceholder}
                rows={3}
                className="w-full px-3 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
                aria-label="CV text"
              />

              {/* HOTFIX-3: Char counter — visible from first character, stronger contrast */}
              {userInput.cvText.length > 0 && (
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-xs font-medium ${userInput.cvText.length > MAX_PROCESSABLE_CHARS ? "text-amber-600 font-semibold" : "text-[var(--text-secondary)]"}`}>
                    {userInput.cvText.length.toLocaleString()} / {MAX_PROCESSABLE_CHARS.toLocaleString()} chars
                  </span>
                  {userInput.cvText.length > MAX_PROCESSABLE_CHARS && (
                    <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                      {t.input?.charsProcessed?.replace("{max}", MAX_PROCESSABLE_CHARS.toLocaleString()) ?? `Only the first ${MAX_PROCESSABLE_CHARS.toLocaleString()} characters will be processed`}
                    </span>
                  )}
                </div>
              )}
            </Card>
            )}
          </div>

          {/* Add other source hint */}
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            {hasLinkedin && !hasCv
              ? t.input.addOtherSource.replace("{source}", t.input.addCv)
              : hasCv && !hasLinkedin
                ? t.input.addOtherSource.replace(
                    "{source}",
                    t.input.addLinkedin
                  )
                : null}
          </p>
        </div>

        {/* ── Objective Section ───────────────────────────── */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            {t.input.objectiveTitle}
          </h3>
          <div className="flex bg-[var(--surface-secondary)] rounded-xl p-1 mb-4">
            {(["job", "objective"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setUserInput({ objectiveMode: mode })}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  userInput.objectiveMode === mode
                    ? "bg-white text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {mode === "job"
                  ? t.input.objectiveModeJob
                  : t.input.objectiveModeObjective}
              </button>
            ))}
          </div>

          {userInput.objectiveMode === "job" ? (
            <>
              {/* Target input type toggle: URL or PDF */}
              <div className="mb-3">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                  {t.input.targetInputTitle}
                </p>
                <div className="flex bg-[var(--surface-secondary)] rounded-lg p-0.5 mb-3 max-w-xs">
                  {(["url", "pdf"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setUserInput({ targetInputType: type })
                      }
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                        (userInput.targetInputType || "url") === type
                          ? "bg-white text-[var(--text-primary)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {type === "url" ? (
                        <LinkIcon size={12} />
                      ) : (
                        <FileTextIcon size={12} />
                      )}
                      {type === "url"
                        ? t.input.targetModeUrl
                        : t.input.targetModePdf}
                    </button>
                  ))}
                </div>

                {(userInput.targetInputType || "url") === "url" ? (
                  <input
                    type="url"
                    value={userInput.targetUrl || ""}
                    onChange={(e) =>
                      setUserInput({ targetUrl: e.target.value })
                    }
                    placeholder={t.input.targetUrlPlaceholder}
                    className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
                  />
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setTargetDragOver(true);
                    }}
                    onDragLeave={() => setTargetDragOver(false)}
                    onDrop={handleTargetFileDrop}
                    onClick={() => targetFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                      targetDragOver
                        ? "border-[var(--accent)] bg-[var(--accent-light)]"
                        : userInput.targetFileName
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
                    {userInput.targetFileName ? (
                      <>
                        <CheckIcon
                          size={18}
                          className="text-emerald-600 mb-1.5"
                        />
                        <p className="text-sm font-medium text-emerald-700">
                          {userInput.targetFileName}
                        </p>
                      </>
                    ) : (
                      <>
                        <UploadIcon
                          size={18}
                          className="text-[var(--text-muted)] mb-1.5"
                        />
                        <p className="text-sm text-[var(--text-primary)]">
                          {t.input.targetUploadDesc}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {t.input.targetFormats}
                        </p>
                      </>
                    )}
                    <input
                      ref={targetFileRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleTargetFileSelect}
                    />
                  </div>
                )}
              </div>

              {/* Fallback: paste job description */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-[var(--border-light)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {t.common.or}
                </span>
                <div className="flex-1 h-px bg-[var(--border-light)]" />
              </div>
              <textarea
                value={userInput.jobDescription}
                onChange={(e) =>
                  setUserInput({ jobDescription: e.target.value })
                }
                placeholder={t.input.jobDescPlaceholder}
                rows={3}
                className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
              />
            </>
          ) : (
            <textarea
              value={userInput.objectiveText}
              onChange={(e) =>
                setUserInput({ objectiveText: e.target.value })
              }
              placeholder={t.input.objectivePlaceholder}
              rows={3}
              className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] leading-relaxed transition-shadow"
            />
          )}
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            {t.input.objectiveHelp}
          </p>
        </div>

        {/* Email (Required — used for checkout pre-fill and results delivery) */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
          >
            <span className="inline-flex items-center gap-1.5">
              <MailIcon size={14} className="text-[var(--text-muted)]" />
              {(t.input as Record<string, string>).emailLabelRequired ?? "Your Email"}{" "}
              <span className="text-red-500">*</span>
            </span>
          </label>
          <input
            id="email"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder={(t.input as Record<string, string>).emailPlaceholder ?? "your@email.com"}
            className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
            required
          />
          {userEmail.length > 0 && !hasEmail && (
            <p className="text-xs text-red-500 mt-1">
              {(t.input as Record<string, string>).emailInvalid ?? "Please enter a valid email address."}
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {(t.input as Record<string, string>).emailHelp ?? "We'll use this to send you your results and pre-fill checkout. No spam, ever."}
          </p>
        </div>

        {/* Audience */}
        <div className="mb-8">
          <label
            htmlFor="audience"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
          >
            {t.input.audienceLabel}
          </label>
          <input
            id="audience"
            type="text"
            value={userInput.targetAudience}
            onChange={(e) =>
              setUserInput({ targetAudience: e.target.value })
            }
            placeholder={t.input.audiencePlaceholder}
            className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {t.input.audienceHelp}
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/features">
            <Button variant="ghost">{t.common.back}</Button>
          </Link>
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t.common.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
