"use client";

import { useI18n } from "@/context/I18nContext";
import {
  SearchIcon,
  FileTextIcon,
  TargetIcon,
  MailIcon,
} from "@/components/ui/Icons";

const FEATURE_COLORS = [
  {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    border: "border-blue-100",
    hoverBorder: "hover:border-blue-300",
    glow: "group-hover:shadow-blue-100",
    accent: "bg-gradient-to-br from-blue-50 to-white",
    tag: "bg-blue-50 text-blue-600",
  },
  {
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
    border: "border-violet-100",
    hoverBorder: "hover:border-violet-300",
    glow: "group-hover:shadow-violet-100",
    accent: "bg-gradient-to-br from-violet-50 to-white",
    tag: "bg-violet-50 text-violet-600",
  },
  {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    border: "border-emerald-100",
    hoverBorder: "hover:border-emerald-300",
    glow: "group-hover:shadow-emerald-100",
    accent: "bg-gradient-to-br from-emerald-50 to-white",
    tag: "bg-emerald-50 text-emerald-600",
  },
  {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    border: "border-amber-100",
    hoverBorder: "hover:border-amber-300",
    glow: "group-hover:shadow-amber-100",
    accent: "bg-gradient-to-br from-amber-50 to-white",
    tag: "bg-amber-50 text-amber-600",
  },
];

export default function FeaturesGrid() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  const features = [
    {
      icon: <SearchIcon size={22} />,
      title: t.landing.featureBenefit1Title,
      desc: t.landing.featureBenefit1Desc,
      tag: landingT.featureTag1 ?? "Analyze",
    },
    {
      icon: <FileTextIcon size={22} />,
      title: t.landing.featureBenefit2Title,
      desc: t.landing.featureBenefit2Desc,
      tag: landingT.featureTag2 ?? "Rewrite",
    },
    {
      icon: <TargetIcon size={22} />,
      title: t.landing.featureBenefit3Title,
      desc: t.landing.featureBenefit3Desc,
      tag: landingT.featureTag3 ?? "Target",
    },
    {
      icon: <MailIcon size={22} />,
      title: t.landing.featureBenefit4Title,
      desc: t.landing.featureBenefit4Desc,
      tag: landingT.featureTag4 ?? "Apply",
    },
  ];

  return (
    <section id="features" className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-secondary)] via-white to-[var(--surface-secondary)]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-light)] rounded-full mb-4">
            {landingT.featuresBadge ?? "Features"}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2 tracking-tight animate-slide-up">
            {t.landing.featuresTitle}
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto animate-slide-up" style={{ animationDelay: "60ms" }}>
            {t.landing.featuresSubtitle}
          </p>
        </div>

        {/* 2×2 grid — all cards equal, no bento asymmetry */}
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((feature, i) => {
            const colors = FEATURE_COLORS[i];
            return (
              <div
                key={i}
                className={`group relative rounded-2xl border ${colors.border} ${colors.hoverBorder} ${colors.accent} p-6 sm:p-7 transition-all duration-300 hover:shadow-lg ${colors.glow} animate-slide-up cursor-default`}
                style={{ animationDelay: `${100 + i * 80}ms` }}
              >
                {/* Tag */}
                <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md ${colors.tag} mb-4`}>
                  {feature.tag}
                </span>

                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl ${colors.iconBg} ${colors.iconText} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  {feature.icon}
                </div>

                <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2 leading-snug">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {feature.desc}
                </p>

                {/* Decorative corner dot */}
                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${colors.iconBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
