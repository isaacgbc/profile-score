"use client";

import { useI18n } from "@/context/I18nContext";

export default function TrustMarquee() {
  const { t } = useI18n();

  const trustCompanies = ["Google", "Amazon", "Meta", "Apple", "Microsoft", "Netflix", "Spotify", "Stripe"];

  return (
    <section className="py-14 overflow-hidden">
      <p className="text-[11px] text-[var(--text-muted)] text-center uppercase tracking-[0.2em] font-semibold mb-8">
        {t.landing.trustedBy}
      </p>

      {/* Marquee container with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--surface)] to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--surface)] to-transparent z-10 pointer-events-none" />

        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {/* Duplicate the list for seamless loop */}
          {[...trustCompanies, ...trustCompanies].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center justify-center px-8 sm:px-12 text-base sm:text-lg font-semibold text-[var(--text-primary)] opacity-[0.18] select-none tracking-wide whitespace-nowrap"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
