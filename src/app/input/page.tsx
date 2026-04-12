"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import { extractTextFromPdf } from "@/lib/utils/pdf-extract";
import { extractTextFromDocx } from "@/lib/utils/docx-extract";
import {
  detectUrlAsText,
  checkMinimumContent,
  sniffLinkedinFormat,
  detectDuplicateInput,
} from "@/lib/utils/input-guards";
import {
  preprocessLinkedinText,
  preprocessCvText,
  type PreprocessResult,
} from "@/lib/utils/input-preprocessor";
import StepIndicator from "@/components/layout/StepIndicator";
import { GlobeIcon } from "@/components/ui/Icons";
import UserInfoFields, {
  EmailField,
  AudienceField,
} from "@/components/input/UserInfoFields";
import LinkedinInputSection from "@/components/input/LinkedinInputSection";
import CvInputSection from "@/components/input/CvInputSection";
import JobDescriptionSection from "@/components/input/JobDescriptionSection";
import ContinueButton from "@/components/input/ContinueButton";
import LinkedinUrlPrimaryInput from "@/components/input/LinkedinUrlPrimaryInput";
import { useLinkedinScrape } from "@/hooks/useLinkedinScrape";
import {
  profileToSectionRecord,
  profileToMarkdown,
} from "@/lib/services/linkedin-profile-formatter";
import type { Locale } from "@/lib/types";
import { trackEvent } from "@/lib/analytics/tracker";

export default function InputPage() {
  const { t } = useI18n();
  const {
    userInput,
    setUserInput,
    exportLocale,
    setExportLocale,
    userEmail,
    setUserEmail,
  } = useApp();
  const router = useRouter();

  // ── Apify scrape hook ──────────────────────────────────
  const {
    status: scrapeStatus,
    profile: scrapedProfile,
    errorKey: scrapeErrorKey,
    errorCode: scrapeErrorCode,
    triggerScrape,
    reset: resetScrape,
  } = useLinkedinScrape();

  // Ref for the <details> element to programmatically open it
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // ── Local UI state ──────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [targetDragOver, setTargetDragOver] = useState(false);
  const [error, setError] = useState("");
  const [linkedinPdfExtracting, setLinkedinPdfExtracting] = useState(false);
  const [cvPdfExtracting, setCvPdfExtracting] = useState(false);
  const [cvDocxExtracting, setCvDocxExtracting] = useState(false);
  const [jobPdfExtracting, setJobPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [linkedinPdfName, setLinkedinPdfName] = useState<string | null>(null);
  const [linkedinDragOver, setLinkedinDragOver] = useState(false);

  // ── i18n accessors ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputI18n = t.input as any as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guardI18n = ((t as any).input?.guards ?? {}) as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewI18n = ((t as any).input?.preview ?? {}) as Record<
    string,
    string
  >;
  const commonI18n = t.common as unknown as Record<string, string>;

  // ── Input guards (reactive via useMemo) ──────────────────
  const linkedinGuards = useMemo(() => {
    const text = userInput.linkedinText;
    const url = detectUrlAsText(text);
    if (!url.valid) return url;
    const content = checkMinimumContent(text);
    if (!content.valid) return content;
    const format = sniffLinkedinFormat(text);
    if (format.warningKey) return format;
    return { valid: true };
  }, [userInput.linkedinText]);

  const cvGuards = useMemo(() => {
    const text = userInput.cvText;
    const url = detectUrlAsText(text);
    if (!url.valid) return url;
    const content = checkMinimumContent(text);
    if (!content.valid) return content;
    return { valid: true };
  }, [userInput.cvText]);

  const duplicateGuard = useMemo(
    () => detectDuplicateInput(userInput.linkedinText, userInput.cvText),
    [userInput.linkedinText, userInput.cvText],
  );

  // ── Client-side preprocessing (reactive via useMemo) ────
  const linkedinPreprocess: PreprocessResult | null = useMemo(() => {
    const text = userInput.linkedinText.trim();
    if (text.length < 50) return null;
    const source = linkedinPdfName ? "pdf" : "paste";
    return preprocessLinkedinText(userInput.linkedinText, source);
  }, [userInput.linkedinText, linkedinPdfName]);

  const cvPreprocess: PreprocessResult | null = useMemo(() => {
    const text = userInput.cvText.trim();
    if (text.length < 50) return null;
    const source = userInput.cvFileName ? "pdf" : "paste";
    return preprocessCvText(userInput.cvText, source);
  }, [userInput.cvText, userInput.cvFileName]);

  // ── Derived booleans ────────────────────────────────────
  const showDocxWarning =
    userInput.cvFileName?.endsWith(".docx") &&
    userInput.cvText.trim().length === 0 &&
    !cvDocxExtracting;
  const hasLinkedin =
    userInput.linkedinText.trim().length > 0 && linkedinGuards.valid;
  const hasCv = userInput.cvText.trim().length > 0 && cvGuards.valid;
  const hasName = userInput.userName.trim().length >= 2;
  const hasEmail =
    userEmail.trim().length > 0 &&
    userEmail.includes("@") &&
    userEmail.includes(".");
  const showLinkedin =
    !userInput.method ||
    userInput.method === "linkedin" ||
    userInput.method === "both";
  const showCv =
    !userInput.method ||
    userInput.method === "cv" ||
    userInput.method === "both";
  const canContinue = hasName && hasEmail && (hasLinkedin || hasCv);

  // ── Apify scrape success handler ────────────────────────
  // When scrape completes, convert profile to markdown and store as linkedinText,
  // then store preparsed sections in sessionStorage for Plan 01-10 to wire into AppContext
  useEffect(() => {
    if (scrapeStatus === "done" && scrapedProfile) {
      const markdown = profileToMarkdown(scrapedProfile);
      const sections = profileToSectionRecord(scrapedProfile);

      // Set linkedin text from the structured markdown so existing flow works
      setUserInput({ linkedinText: markdown, linkedinUrl: "" });

      // Store preparsed sections for the audit API (Plan 01-10 will formalize in AppContext)
      try {
        sessionStorage.setItem(
          "__ps_preparsedLinkedinSections",
          JSON.stringify(sections),
        );
        sessionStorage.setItem("__ps_linkedinProfileSource", "apify");
      } catch {
        // sessionStorage unavailable (e.g., private browsing) — the markdown path still works
      }

      trackEvent("scrape_linkedin_success", {
        sourceType: "linkedin",
        metadata: { profileSource: "apify" },
      });

      // If user already has name + email, auto-navigate to results
      if (hasName && hasEmail) {
        router.push("/results");
      }
    }
  }, [scrapeStatus, scrapedProfile, setUserInput, hasName, hasEmail, router]);

  // ── Handlers ────────────────────────────────────────────

  function handleContinue() {
    if (!canContinue) {
      setError(t.input.validation);
      return;
    }
    setError("");
    const derivedMethod =
      hasLinkedin && hasCv ? "both" : hasLinkedin ? "linkedin" : "cv";
    trackEvent("start_audit", {
      sourceType: derivedMethod,
      locale: exportLocale,
    });
    const updates: Record<string, string | null> = { method: derivedMethod };
    if (linkedinPreprocess?.cleanedText)
      updates.linkedinText = linkedinPreprocess.cleanedText;
    if (cvPreprocess?.cleanedText) updates.cvText = cvPreprocess.cleanedText;
    setUserInput(updates);
    router.push("/results");
  }

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

  async function handleCvFileUpload(file: File) {
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
    } else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
      setCvDocxExtracting(true);
      setPdfError(null);
      const result = await extractTextFromDocx(file);
      setCvDocxExtracting(false);
      if (!result.success) {
        setPdfError(
          guardI18n[result.error ?? "docxExtractionFailed"] ??
            "Could not extract text from DOCX.",
        );
        setUserInput({ cvFileName: file.name });
        return;
      }
      setUserInput({ cvText: result.text, cvFileName: file.name });
    }
  }

  async function handleTargetPdfUpload(file: File) {
    if (file.type !== "application/pdf") return;
    setJobPdfExtracting(true);
    setPdfError(null);
    const result = await extractTextFromPdf(file);
    setJobPdfExtracting(false);
    if (result.error === "insufficient_text") {
      setPdfError(
        guardI18n.jobPdfNoExtraction ??
          "Could not extract enough text from the PDF. Paste the job description instead.",
      );
      setUserInput({ targetFileName: file.name, targetInputType: "pdf" });
      return;
    }
    if (result.error) {
      setPdfError(
        guardI18n.jobPdfNoExtraction ??
          "Could not read the PDF. Paste the job description instead.",
      );
      setUserInput({ targetFileName: file.name, targetInputType: "pdf" });
      return;
    }
    setUserInput({
      targetFileName: file.name,
      targetInputType: "pdf",
      jobDescription: result.text,
    });
  }

  // ── Render ──────────────────────────────────────────────
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
                {lang === "en" ? "English" : "Espa\u00f1ol"}
              </button>
            ))}
          </div>
        </div>

        {/* Full Name */}
        <UserInfoFields
          name={userInput.userName}
          email={userEmail}
          hasEmail={hasEmail}
          audience={userInput.targetAudience}
          onNameChange={(v) => setUserInput({ userName: v })}
          onEmailChange={setUserEmail}
          onAudienceChange={(v) => setUserInput({ targetAudience: v })}
          i18n={inputI18n}
        />

        {/* PDF Error Banner */}
        {pdfError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-6">
            <p className="text-xs text-amber-700">{pdfError}</p>
          </div>
        )}

        {/* ── PRIMARY: LinkedIn URL Input (Apify path) ── */}
        <div className="mb-6">
          <LinkedinUrlPrimaryInput
            isSubmitting={scrapeStatus === "scraping"}
            errorKey={scrapeErrorKey}
            errorCode={scrapeErrorCode}
            onSubmit={async (url) => {
              await triggerScrape(url);
            }}
            onRetry={() => {
              resetScrape();
            }}
            onSwitchToCv={() => {
              // Open the details toggle and scroll to it
              if (detailsRef.current) {
                detailsRef.current.open = true;
                detailsRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
          />
        </div>

        {/* ── SECONDARY: CV upload + LinkedIn paste (demoted to <details> toggle) ── */}
        <details
          ref={detailsRef}
          className="mb-8 rounded-xl border border-[var(--border-subtle)]"
        >
          <summary
            className="cursor-pointer px-5 py-3 text-sm font-medium select-none list-none flex items-center gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="transition-transform detail-marker">&#9654;</span>
            {inputI18n.useCvAlternativeTitle ??
              "Prefer to upload your CV instead?"}
          </summary>

          <div className="px-5 pb-5 pt-2">
            {/* Source Selection (existing content, now inside details) */}
            <div className="mb-6">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {t.input.sourceSelectionTitle}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t.input.sourceSelectionDesc}
                </p>
              </div>

              <div
                className={`grid ${showLinkedin && showCv ? "md:grid-cols-2" : ""} gap-4`}
              >
                {showLinkedin && (
                  <LinkedinInputSection
                    linkedinText={userInput.linkedinText}
                    linkedinUrl={userInput.linkedinUrl}
                    hasLinkedin={hasLinkedin}
                    linkedinPdfExtracting={linkedinPdfExtracting}
                    linkedinPdfName={linkedinPdfName}
                    linkedinGuards={linkedinGuards}
                    linkedinPreprocess={linkedinPreprocess}
                    onLinkedinTextChange={(v) =>
                      setUserInput({ linkedinText: v })
                    }
                    onLinkedinUrlChange={(v) =>
                      setUserInput({ linkedinUrl: v })
                    }
                    onLinkedinPdfUpload={handleLinkedinPdfUpload}
                    onLinkedinDragOverChange={setLinkedinDragOver}
                    linkedinDragOver={linkedinDragOver}
                    i18n={inputI18n}
                    guardI18n={guardI18n}
                    previewI18n={previewI18n}
                    commonI18n={commonI18n}
                  />
                )}

                {showCv && (
                  <CvInputSection
                    cvText={userInput.cvText}
                    cvFileName={userInput.cvFileName ?? ""}
                    hasCv={hasCv}
                    cvPdfExtracting={cvPdfExtracting}
                    cvDocxExtracting={cvDocxExtracting}
                    showDocxWarning={!!showDocxWarning}
                    dragOver={dragOver}
                    cvGuards={cvGuards}
                    cvPreprocess={cvPreprocess}
                    onCvTextChange={(v) => setUserInput({ cvText: v })}
                    onCvFileUpload={handleCvFileUpload}
                    onDragOverChange={setDragOver}
                    i18n={inputI18n}
                    guardI18n={guardI18n}
                    previewI18n={previewI18n}
                    commonI18n={commonI18n}
                  />
                )}
              </div>

              {/* Add other source hint */}
              <p className="text-xs text-[var(--text-muted)] text-center mt-3">
                {hasLinkedin && !hasCv
                  ? t.input.addOtherSource.replace("{source}", t.input.addCv)
                  : hasCv && !hasLinkedin
                    ? t.input.addOtherSource.replace(
                        "{source}",
                        t.input.addLinkedin,
                      )
                    : null}
              </p>

              {/* Duplicate input warning */}
              {duplicateGuard.warningKey && (
                <p className="text-xs text-amber-600 text-center mt-2">
                  {guardI18n[duplicateGuard.warningKey] ??
                    duplicateGuard.warningKey}
                </p>
              )}
            </div>

            {/* ── Objective Section ── */}
            <JobDescriptionSection
              objectiveMode={userInput.objectiveMode}
              jobDescription={userInput.jobDescription}
              objectiveText={userInput.objectiveText}
              targetUrl={userInput.targetUrl || ""}
              targetInputType={userInput.targetInputType || "url"}
              targetFileName={userInput.targetFileName || ""}
              jobPdfExtracting={jobPdfExtracting}
              targetDragOver={targetDragOver}
              onObjectiveModeChange={(m: "job" | "objective") =>
                setUserInput({ objectiveMode: m })
              }
              onJobDescriptionChange={(v) =>
                setUserInput({ jobDescription: v })
              }
              onObjectiveTextChange={(v) => setUserInput({ objectiveText: v })}
              onTargetUrlChange={(v) => setUserInput({ targetUrl: v })}
              onTargetInputTypeChange={(type: "url" | "pdf") =>
                setUserInput({ targetInputType: type })
              }
              onTargetPdfUpload={handleTargetPdfUpload}
              onTargetDragOverChange={setTargetDragOver}
              i18n={inputI18n}
              guardI18n={guardI18n}
              commonI18n={commonI18n}
            />

            {/* Email */}
            <EmailField
              email={userEmail}
              hasEmail={hasEmail}
              onEmailChange={setUserEmail}
              i18n={inputI18n}
            />

            {/* Audience */}
            <AudienceField
              audience={userInput.targetAudience}
              onAudienceChange={(v) => setUserInput({ targetAudience: v })}
              i18n={inputI18n}
            />

            {/* Continue */}
            <ContinueButton
              canContinue={canContinue}
              error={error}
              onContinue={handleContinue}
              commonI18n={commonI18n}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
