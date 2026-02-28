"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getSectionLabel } from "@/lib/section-labels";
import { SparklesIcon } from "@/components/ui/Icons";

interface MissingSectionCardProps {
  sectionId: string;
  source: "linkedin" | "cv";
  onAddAndRegenerate: (sectionId: string, content: string) => void;
  isRegenerating: boolean;
}

// HOTFIX-4: Structured contact info fields
interface ContactFields {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
}

function formatContactFields(fields: ContactFields): string {
  const lines: string[] = [];
  if (fields.name.trim()) lines.push(`Name: ${fields.name.trim()}`);
  if (fields.email.trim()) lines.push(`Email: ${fields.email.trim()}`);
  if (fields.phone.trim()) lines.push(`Phone: ${fields.phone.trim()}`);
  if (fields.linkedin.trim()) lines.push(`LinkedIn: ${fields.linkedin.trim()}`);
  if (fields.location.trim()) lines.push(`Location: ${fields.location.trim()}`);
  return lines.join("\n");
}

/**
 * HOTFIX-3: Manual Section Recovery card.
 * Shown for critical sections that are missing from the parsed input.
 * Allows user to manually add content and trigger regeneration.
 *
 * HOTFIX-4: When sectionId is "contact-info", renders structured fields
 * (Name, Email, Phone, LinkedIn, Location) instead of a free-text textarea.
 *
 * HOTFIX-4C: Softer neutral design — blue-gray instead of aggressive amber.
 */
export default function MissingSectionCard({
  sectionId,
  source,
  onAddAndRegenerate,
  isRegenerating,
}: MissingSectionCardProps) {
  const { t } = useI18n();
  const sectionLabels = t.sectionLabels as Record<string, string>;
  const studioT = t.rewriteStudio as Record<string, string>;

  const [content, setContent] = useState("");

  // HOTFIX-4: Structured fields for contact-info
  const isContactInfo = sectionId === "contact-info";
  const [contactFields, setContactFields] = useState<ContactFields>({
    name: "", email: "", phone: "", linkedin: "", location: "",
  });

  const label = getSectionLabel(sectionId, sectionLabels);

  // Contact info requires at least a name; others require 20+ chars
  const canSubmit = isContactInfo
    ? contactFields.name.trim().length >= 2
    : content.trim().length > 20;

  function handleSubmit() {
    if (isContactInfo) {
      const formatted = formatContactFields(contactFields);
      onAddAndRegenerate(sectionId, formatted);
    } else {
      onAddAndRegenerate(sectionId, content);
    }
  }

  function updateContactField(field: keyof ContactFields, value: string) {
    setContactFields((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Shared styles ───
  const inputClass =
    "w-full text-sm text-[var(--text-primary)] bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300/50 placeholder:text-slate-300";
  const labelClass =
    "block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1";

  // HOTFIX-4: Structured contact info variant
  if (isContactInfo) {
    const nameRequired = contactFields.name.trim().length === 0;

    return (
      <Card variant="default" padding="md" className="border-slate-200 bg-slate-50/40">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-blue-400 text-xs font-bold">+</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
              {label}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {studioT.contactInfoDesc ?? "Add your contact details. Name is required for CV export."}
            </p>

            <div className="space-y-2">
              {/* Name (required) */}
              <div>
                <label className={labelClass}>
                  {studioT.contactInfoName ?? "Full Name"} *
                </label>
                <input
                  type="text"
                  value={contactFields.name}
                  onChange={(e) => updateContactField("name", e.target.value)}
                  placeholder="John Doe"
                  className={`${inputClass} ${
                    nameRequired && contactFields.name.length > 0
                      ? "!border-red-300 text-red-700"
                      : ""
                  }`}
                />
                {nameRequired && contactFields.name.length > 0 && (
                  <p className="text-[10px] text-red-500 mt-0.5">
                    {studioT.contactInfoRequired ?? "Name is required"}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>
                  {studioT.contactInfoEmail ?? "Email"}
                </label>
                <input
                  type="email"
                  value={contactFields.email}
                  onChange={(e) => updateContactField("email", e.target.value)}
                  placeholder="john@example.com"
                  className={inputClass}
                />
              </div>

              {/* Phone + Location (side by side) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>
                    {studioT.contactInfoPhone ?? "Phone"}
                  </label>
                  <input
                    type="tel"
                    value={contactFields.phone}
                    onChange={(e) => updateContactField("phone", e.target.value)}
                    placeholder="+1 555 123 4567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {studioT.contactInfoLocation ?? "Location"}
                  </label>
                  <input
                    type="text"
                    value={contactFields.location}
                    onChange={(e) => updateContactField("location", e.target.value)}
                    placeholder="New York, NY"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* LinkedIn URL */}
              <div>
                <label className={labelClass}>
                  {studioT.contactInfoLinkedin ?? "LinkedIn URL"}
                </label>
                <input
                  type="url"
                  value={contactFields.linkedin}
                  onChange={(e) => updateContactField("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/johndoe"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-end mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || isRegenerating}
              >
                <span className="flex items-center gap-1.5">
                  <SparklesIcon size={14} />
                  {isRegenerating
                    ? (studioT.regenerating ?? "Regenerating...")
                    : (studioT.addAndRegenerate ?? "Add & Regenerate")}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Default: free-text textarea for other sections
  return (
    <Card variant="default" padding="md" className="border-slate-200 bg-slate-50/40">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-blue-400 text-xs font-bold">+</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
            {label}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {studioT.missingSectionCardDesc ?? "This section was not detected in your uploaded profile. Paste your content below and click regenerate to include it in your analysis."}
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={studioT.missingSectionCardPlaceholder ?? `Paste your ${label.toLowerCase()} content here...`}
            rows={4}
            className="w-full text-sm text-[var(--text-primary)] bg-white border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300/50 leading-relaxed placeholder:text-slate-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[var(--text-muted)]">
              {content.length > 0 ? `${content.length} chars` : ""}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || isRegenerating}
            >
              <span className="flex items-center gap-1.5">
                <SparklesIcon size={14} />
                {isRegenerating
                  ? (studioT.regenerating ?? "Regenerating...")
                  : (studioT.addAndRegenerate ?? "Add & Regenerate")}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
