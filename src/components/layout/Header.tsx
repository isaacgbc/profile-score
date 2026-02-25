"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import { GlobeIcon } from "@/components/ui/Icons";
import AdminPasswordModal from "@/components/ui/AdminPasswordModal";
import BrandLogo from "@/components/ui/BrandLogo";
import type { Locale } from "@/lib/types";

export default function Header() {
  const { t, locale, setLocale } = useI18n();
  const { isAdmin, toggleAdmin, authUser, authLoading, signOut } = useApp();
  const [showAdminModal, setShowAdminModal] = useState(false);

  function handleAdminClick() {
    if (isAdmin) {
      // Turn off admin — no password needed
      toggleAdmin();
      return;
    }
    // Owner allowlist: skip password modal, enable directly
    if (authUser?.isOwner) {
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
            <BrandLogo size={32} className="shadow-sm group-hover:shadow-md transition-shadow rounded-lg" />
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
            {/* User auth */}
            {authUser ? (
              <div className="hidden sm:flex items-center gap-2">
                {authUser.avatarUrl ? (
                  <img src={authUser.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-[var(--accent)]">
                      {(authUser.name?.[0] ?? authUser.email[0] ?? "U").toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xs text-[var(--text-muted)] max-w-[120px] truncate">
                  {authUser.name ?? authUser.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : !authLoading ? (
              <Link
                href="/auth/login"
                className="hidden sm:flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium
                  text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                Sign in
              </Link>
            ) : null}

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
