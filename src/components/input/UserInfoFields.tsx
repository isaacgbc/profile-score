"use client";

import { MailIcon } from "@/components/ui/Icons";

// ── Props ───────────────────────────────────────────────

interface UserInfoFieldsProps {
  /** Current name value */
  name: string;
  /** Current email value */
  email: string;
  /** Whether email passes validation */
  hasEmail: boolean;
  /** Audience string */
  audience: string;
  /** Callbacks */
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  /** i18n — the full t.input cast as Record<string,string> */
  i18n: Record<string, string>;
}

// ── Component ───────────────────────────────────────────

export default function UserInfoFields({
  name,
  email,
  hasEmail,
  audience,
  onNameChange,
  onEmailChange,
  onAudienceChange,
  i18n,
}: UserInfoFieldsProps) {
  return (
    <>
      {/* Full Name (Required) */}
      <div className="mb-6">
        <label
          htmlFor="userName"
          className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
        >
          {i18n.nameLabel ?? "Full Name"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          id="userName"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={i18n.namePlaceholder ?? "e.g., Jane Smith"}
          className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
          required
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {i18n.nameHelp ?? "Used in your CV export and cover letter."}
        </p>
      </div>
    </>
  );
}

// ── Email sub-component (rendered separately in the page) ──

export function EmailField({
  email,
  hasEmail,
  onEmailChange,
  i18n,
}: Pick<UserInfoFieldsProps, "email" | "hasEmail" | "onEmailChange" | "i18n">) {
  return (
    <div className="mb-6">
      <label
        htmlFor="email"
        className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
      >
        <span className="inline-flex items-center gap-1.5">
          <MailIcon size={14} className="text-[var(--text-muted)]" />
          {i18n.emailLabelRequired ?? "Your Email"}{" "}
          <span className="text-red-500">*</span>
        </span>
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder={i18n.emailPlaceholder ?? "your@email.com"}
        className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
        required
      />
      {email.length > 0 && !hasEmail && (
        <p className="text-xs text-red-500 mt-1">
          {i18n.emailInvalid ?? "Please enter a valid email address."}
        </p>
      )}
      <p className="text-xs text-[var(--text-muted)] mt-1">
        {i18n.emailHelp ?? "We'll use this to send you your results and pre-fill checkout. No spam, ever."}
      </p>
    </div>
  );
}

// ── Audience sub-component ──

export function AudienceField({
  audience,
  onAudienceChange,
  i18n,
}: Pick<UserInfoFieldsProps, "audience" | "onAudienceChange" | "i18n"> & {
  /** i18n strings from t.input */
  i18n: Record<string, string>;
}) {
  return (
    <div className="mb-8">
      <label
        htmlFor="audience"
        className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
      >
        {i18n.audienceLabel ?? "Target Audience"}
      </label>
      <input
        id="audience"
        type="text"
        value={audience}
        onChange={(e) => onAudienceChange(e.target.value)}
        placeholder={i18n.audiencePlaceholder ?? "e.g., Tech recruiters in LATAM"}
        className="w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-white border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent placeholder:text-[var(--text-muted)] transition-shadow"
      />
      <p className="text-xs text-[var(--text-muted)] mt-1">
        {i18n.audienceHelp ?? "Who will read your profile?"}
      </p>
    </div>
  );
}
