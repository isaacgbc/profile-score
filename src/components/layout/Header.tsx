"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import { GlobeIcon } from "@/components/ui/Icons";
import AdminPasswordModal from "@/components/ui/AdminPasswordModal";
import type { Locale } from "@/lib/types";

export default function Header() {
  const { t, locale, setLocale } = useI18n();
  const { isAdmin, toggleAdmin } = useApp();
  const [showAdminModal, setShowAdminModal] = useState(false);

  function handleAdminClick() {
    if (isAdmin) {
      // Turn off admin — no password needed
      toggleAdmin();
      return;
    }
    // Turn on admin — require password
    setShowAdminModal(true);
  }

  function handleAdminVerified() {
    setShowAdminModal(false);
    toggleAdmin(); // Now actually enable admin
  }

  return (
    <>
      <AdminPasswordModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={handleAdminVerified}
      />
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[var(--border-light)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight tracking-tight">
                {t.common.brandName}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] leading-tight tracking-wide uppercase">
                {t.common.subtitle}
              </span>
            </div>
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Admin prompts link */}
            {isAdmin && (
              <Link
                href="/admin/prompts"
                className="hidden sm:flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium
                  text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                Prompts
              </Link>
            )}

            {/* Admin toggle (password-protected) */}
            <button
              onClick={handleAdminClick}
              className={`
                hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  isAdmin
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
                }
              `}
              aria-label="Toggle admin mode"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {isAdmin ? t.common.adminActive : t.common.admin}
            </button>

            {/* Language switcher */}
            <div className="relative flex items-center">
              <button
                onClick={() => setLocale(locale === "en" ? "es" : ("en" as Locale))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  bg-[var(--surface-secondary)] text-[var(--text-secondary)]
                  hover:bg-[var(--border-light)] transition-colors border border-transparent"
                aria-label={`Switch language to ${locale === "en" ? "Spanish" : "English"}`}
              >
                <GlobeIcon size={14} />
                <span className="uppercase">{locale}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
