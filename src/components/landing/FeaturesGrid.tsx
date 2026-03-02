"use client";

import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import {
  SearchIcon,
  FileTextIcon,
  TargetIcon,
  MailIcon,
} from "@/components/ui/Icons";

export default function FeaturesGrid() {
  const { t } = useI18n();

  const features = [
    { icon: <SearchIcon size={22} />, title: t.landing.featureBenefit1Title, desc: t.landing.featureBenefit1Desc },
    { icon: <FileTextIcon size={22} />, title: t.landing.featureBenefit2Title, desc: t.landing.featureBenefit2Desc },
    { icon: <TargetIcon size={22} />, title: t.landing.featureBenefit3Title, desc: t.landing.featureBenefit3Desc },
    { icon: <MailIcon size={22} />, title: t.landing.featureBenefit4Title, desc: t.landing.featureBenefit4Desc },
  ];

  return (
    <section className="bg-[var(--surface-secondary)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-3 animate-slide-up tracking-tight">
          {t.landing.featuresTitle}
        </h2>
        <p className="text-sm text-[var(--text-muted)] text-center mb-12 animate-slide-up" style={{ animationDelay: "60ms" }}>
          {t.landing.featuresSubtitle}
        </p>

        {/* Bento grid: first 2 larger, last 2 standard */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <Card
              key={i}
              variant="default"
              padding="lg"
              hoverable
              className={`animate-slide-up group ${i < 2 ? "lg:col-span-2" : ""}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--accent-light)] text-[var(--text-muted)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:text-[var(--accent)] group-hover:shadow-md group-hover:shadow-[var(--accent)]/10">
                {feature.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
