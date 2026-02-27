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

  // HOTFIX-4: Structured contact info variant
  if (isContactInfo) {
    const nameRequired = contactFields.name.trim().length === 0;

    return (
      <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/30">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-amber-600 text-sm font-bold">?</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-800 mb-1">
              {label} — {studioT.missingSectionCardTitle ?? "Not found in source"}
            </h3>
            <p className="text-xs text-amber-700 mb-3">
              {studioT.contactInfoDesc ?? "Add your contact details. Name is required for CV export."}
            </p>

            <div className="space-y-2">
              {/* Name (required) */}
              <div>
                <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  {studioT.contactInfoName ?? "Full Name"} *
                </label>
                <input
                  type="text"
                  value={contactFields.name}
                  onChange={(e) => updateContactField("name", e.target.value)}
                  placeholder="John Doe"
                  className={`w-full text-sm bg-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/50 placeholder:text-amber-300 ${
                    nameRequired && contactFields.name.length > 0
                      ? "border-red-300 text-red-700"
                      : "border-amber-200 text-[var(--text-primary)]"
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
                <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  {studioT.contactInfoEmail ?? "Email"}
                </label>
                <input
                  type="email"
                  value={contactFields.email}
                  onChange={(e) => updateContactField("email", e.target.value)}
                  placeholder="john@example.com"
                  className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/50 placeholder:text-amber-300"
                />
              </div>

              {/* Phone + Location (side by side) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                    {studioT.contactInfoPhone ?? "Phone"}
                  </label>
                  <input
                    type="tel"
                    value={contactFields.phone}
                    onChange={(e) => updateContactField("phone", e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/50 placeholder:text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                    {studioT.contactInfoLocation ?? "Location"}
                  </label>
                  <input
                    type="text"
                    value={contactFields.location}
                    onChange={(e) => updateContactField("location", e.target.value)}
                    placeholder="New York, NY"
                    className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/50 placeholder:text-amber-300"
                  />
                </div>
              </div>

              {/* LinkedIn URL */}
              <div>
                <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  {studioT.contactInfoLinkedin ?? "LinkedIn URL"}
                </label>
                <input
                  type="url"
                  value={contactFields.linkedin}
                  onChange={(e) => updateContactField("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/johndoe"
                  className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/50 placeholder:text-amber-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || isRegenerating}
                className="!bg-amber-600 hover:!bg-amber-700"
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
    <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/30">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-600 text-sm font-bold">?</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">
            {label} — {studioT.missingSectionCardTitle ?? "Not found in source"}
          </h3>
          <p className="text-xs text-amber-700 mb-3">
            {studioT.missingSectionCardDesc ?? "This section was not detected in your uploaded profile. Paste your content below and click regenerate to include it in your analysis."}
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={studioT.missingSectionCardPlaceholder ?? `Paste your ${label.toLowerCase()} content here...`}
            rows={4}
            className="w-full text-sm text-[var(--text-primary)] bg-white border border-amber-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/50 leading-relaxed placeholder:text-amber-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-amber-500">
              {content.length > 0 ? `${content.length} chars` : ""}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || isRegenerating}
              className="!bg-amber-600 hover:!bg-amber-700"
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
