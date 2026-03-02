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
    </footer>
  );
}
