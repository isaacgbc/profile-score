"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Button from "@/components/ui/Button";

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const avatarInitials = ["A", "M", "S", "J", "R"];
const avatarColors = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
];

export default function BottomCTA() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[var(--accent-light)]/40 to-[var(--accent-light)]" />
      {/* Decorative orb */}
      <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[80px]" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
        <h2
          className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4 tracking-tight animate-slide-up"
        >
          {t.landing.bottomCtaTitle}
        </h2>
        <p
          className="text-base text-[var(--text-secondary)] max-w-lg mx-auto mb-4 leading-relaxed animate-slide-up"
          style={{ animationDelay: "60ms" }}
        >
          {t.landing.bottomCtaDesc}
        </p>

        {/* Urgency line */}
        <p
          className="text-xs font-semibold text-amber-600 mb-8 animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
          {t.landing.bottomCtaWarning}
        </p>

        {/* Mini social proof: avatar row + trust text */}
        <div className="flex flex-col items-center gap-3 mb-10 animate-slide-up" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center -space-x-2">
            {avatarInitials.map((initial, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i]} text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm`}
              >
                {initial}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {landingT.bottomCtaTrust ?? "Join 50,000+ professionals who improved their profile score"}
          </p>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "160ms" }}>
          <Link href="/features">
            <Button size="lg">
              {t.landing.cta}
              <ChevronRight />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
