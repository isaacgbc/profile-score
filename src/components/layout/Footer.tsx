"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { GlobeIcon } from "@/components/ui/Icons";

export default function Footer() {
  const { t, locale, setLocale } = useI18n();
  const ft = (t as Record<string, Record<string, string>>).footer ?? {};

  const productLinks = [
    { href: "/#features", label: ft.features ?? "Features" },
    { href: "/#pricing", label: ft.pricing ?? "Pricing" },
    { href: "/#how-it-works", label: ft.howItWorks ?? "How It Works" },
  ];

  const resourceLinks = [
    { href: "/blog", label: ft.blog ?? "Blog" },
    { href: "/#faq", label: ft.faq ?? "FAQ" },
    { href: "mailto:hello@profilescore.app", label: ft.contact ?? "Contact" },
  ];

  const legalLinks = [
    { href: "/privacy", label: ft.privacy ?? "Privacy Policy" },
    { href: "/terms", label: ft.terms ?? "Terms of Service" },
  ];

  return (
    <footer className="border-t border-[var(--border-light)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* ─── 4-Column Grid ─── */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-10">
          {/* Col 1: Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <BrandLogo size={24} />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {t.common.brandName}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[220px]">
              {ft.tagline ?? "AI-powered optimization for LinkedIn profiles and CVs"}
            </p>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">
              {ft.product ?? "Product"}
            </h4>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">
              {ft.resources ?? "Resources"}
            </h4>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("mailto:") ? (
                    <a
                      href={link.href}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Legal */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3">
              {ft.legal ?? "Legal"}
            </h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Bottom Row ─── */}
        <div className="pt-6 border-t border-[var(--border-light)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} {t.common.brandName}.{" "}
            {ft.allRightsReserved ?? "All rights reserved."}
          </p>

          <div className="flex items-center gap-4">
            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/company/profilescore/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ProfileScore en LinkedIn"
              className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:bg-[#0a66c2] hover:text-white transition-all duration-150"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>

            {/* Language Switcher */}
            <button
              onClick={() => setLocale(locale === "en" ? "es" : "en")}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <GlobeIcon size={14} />
              <span>{locale === "en" ? "Español" : "English"}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
