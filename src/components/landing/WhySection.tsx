"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { TargetIcon, LinkIcon, GlobeIcon } from "@/components/ui/Icons";

interface WhyPoint {
  titleKey: string;
  copyKey: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  borderColor: string;
  numberColor: string;
}

export default function WhySection() {
  const { t } = useI18n();
  const l = t.landing as Record<string, string>;

  const points: WhyPoint[] = [
    {
      titleKey: "why1Title",
      copyKey: "why1Copy",
      icon: <TargetIcon size={20} />,
      accentBg: "bg-blue-50",
      accentText: "text-[var(--accent)]",
      borderColor: "border-blue-100",
      numberColor: "text-[var(--accent)]",
    },
    {
      titleKey: "why2Title",
      copyKey: "why2Copy",
      icon: <LinkIcon size={20} />,
      accentBg: "bg-violet-50",
      accentText: "text-violet-600",
      borderColor: "border-violet-100",
      numberColor: "text-violet-600",
    },
    {
      titleKey: "why3Title",
      copyKey: "why3Copy",
      icon: <GlobeIcon size={20} />,
      accentBg: "bg-emerald-50",
      accentText: "text-emerald-600",
      borderColor: "border-emerald-100",
      numberColor: "text-emerald-600",
    },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
      {/* Badge + heading */}
      <div className="text-center mb-12 animate-slide-up">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)] border border-blue-100 mb-4">
          {l.whySectionBadge ?? "Why ProfileScore"}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {l.whySectionTitle ?? "Different by design, not by marketing"}
        </h2>
      </div>

      {/* 3-column grid on md+, stacked on mobile */}
      <div className="grid md:grid-cols-3 gap-5">
        {points.map((point, i) => (
          <div
            key={i}
            className={`
              relative bg-white rounded-2xl border ${point.borderColor}
              p-6 animate-slide-up flex flex-col gap-4
              hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
            `}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Number indicator */}
            <span
              className={`text-xs font-bold tabular-nums ${point.numberColor} opacity-40 absolute top-5 right-5`}
            >
              0{i + 1}
            </span>

            {/* Icon chip */}
            <div
              className={`w-10 h-10 rounded-xl ${point.accentBg} ${point.accentText} flex items-center justify-center shrink-0`}
            >
              {point.icon}
            </div>

            {/* Text */}
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-[var(--text-primary)] leading-snug">
                {l[point.titleKey]}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {l[point.copyKey]}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Subtle CTA link to dedicated page */}
      <p className="text-center mt-8 text-sm text-[var(--text-muted)] animate-slide-up" style={{ animationDelay: "300ms" }}>
        <Link
          href="/why-profilescore"
          className="text-[var(--accent)] hover:underline underline-offset-2 font-medium"
        >
          {l.whySectionBadge ?? "Why ProfileScore"} →
        </Link>
      </p>
    </section>
  );
}
