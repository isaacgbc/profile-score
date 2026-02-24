"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import Button from "./Button";
import Card from "./Card";
import { MailIcon, XIcon } from "./Icons";

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
}

export default function EmailCaptureModal({ isOpen, onClose, onSubmit }: EmailCaptureModalProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    onSubmit(email);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card
        variant="elevated"
        padding="lg"
        className="relative max-w-md w-full animate-slide-up z-10"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Close"
        >
          <XIcon size={16} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center">
            <MailIcon size={24} className="text-[var(--accent)]" />
          </div>
        </div>

        {/* Copy */}
        <h2 className="text-lg font-semibold text-[var(--text-primary)] text-center mb-1">
          {t.checkout.emailCapture}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
          {t.checkout.emailCaptureDesc}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder={t.checkout.emailPlaceholder}
              className="w-full px-4 py-3 text-sm rounded-xl border border-[var(--border)] bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              autoFocus
            />
            {error && (
              <p className="text-xs text-[var(--error)] mt-1.5">{error}</p>
            )}
          </div>
          <Button type="submit" fullWidth size="lg">
            {t.checkout.emailSubmit}
          </Button>
        </form>
      </Card>
    </div>
  );
}
