"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
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
} from "@/components/ui/Icons";
import type { Locale } from "@/lib/types";

export default function InputPage() {
  const { t } = useI18n();
  const { userInput, setUserInput, exportLocale, setExportLocale } = useApp();
  const router = useRouter();

  const [dragOver, setDragOver] = useState(false);
  const [targetDragOver, setTargetDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const targetFileRef = useRef<HTMLInputElement>(null);

  const hasLinkedin =
    userInput.linkedinUrl.trim().length > 5 ||
    userInput.linkedinText.trim().length > 20;
  const hasCv = !!userInput.cvFileName;
  const canContinue = hasLinkedin || hasCv;

  function handleContinue() {
    if (!canContinue) {
      setError(t.input.validation);
      return;
    }
    setError("");
    const method =
      hasLinkedin && hasCv ? "both" : hasLinkedin ? "linkedin" : "cv";
    setUserInput({ method });
    router.push("/features");
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type === "application/pdf" || file.name.endsWith(".docx"))
    ) {
      setUserInput({ cvFileName: file.name });
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUserInput({ cvFileName: file.name });
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

          <div className="grid md:grid-cols-2 gap-4">
            {/* LinkedIn Card */}
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
              <input
                type="url"
                value={userInput.linkedinUrl}
                onChange={(e) => setUserInput({ linkedinUrl: e.target.value })}
                placeholder={t.input.linkedinUrlPlaceholder}
                className="w-full px-3 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] mb-3 transition-shadow"
                aria-label="LinkedIn URL"
              />
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-[var(--border-light)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {t.common.or}
                </span>
                <div className="flex-1 h-px bg-[var(--border-light)]" />
              </div>
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
            </Card>

            {/* CV Card */}
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
                {hasCv ? (
                  <>
                    <CheckIcon size={20} className="text-emerald-600 mb-2" />
                    <p className="text-sm font-medium text-emerald-700">
                      {userInput.cvFileName}
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
            </Card>
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
          <Link href="/">
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
