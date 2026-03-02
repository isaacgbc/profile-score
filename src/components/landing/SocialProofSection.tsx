"use client";

import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import { StarIcon, TrendingUpIcon, SparklesIcon } from "@/components/ui/Icons";

export default function SocialProofSection() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  const testimonials = [
    { quote: t.landing.socialProof1, author: t.landing.socialProof1Author, role: t.landing.socialProof1Role, metric: t.landing.socialProof1Metric },
    { quote: t.landing.socialProof2, author: t.landing.socialProof2Author, role: t.landing.socialProof2Role, metric: t.landing.socialProof2Metric },
    { quote: t.landing.socialProof3, author: t.landing.socialProof3Author, role: t.landing.socialProof3Role, metric: t.landing.socialProof3Metric },
    { quote: landingT.socialProof4 ?? "", author: landingT.socialProof4Author ?? "", role: landingT.socialProof4Role ?? "", metric: landingT.socialProof4Metric ?? "" },
    { quote: landingT.socialProof5 ?? "", author: landingT.socialProof5Author ?? "", role: landingT.socialProof5Role ?? "", metric: landingT.socialProof5Metric ?? "" },
    { quote: landingT.socialProof6 ?? "", author: landingT.socialProof6Author ?? "", role: landingT.socialProof6Role ?? "", metric: landingT.socialProof6Metric ?? "" },
  ].filter((t) => t.quote && t.author); // filter out empty ones until i18n is populated

  return (
    <section className="bg-white border-y border-[var(--border-light)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-4 animate-slide-up tracking-tight">
          {t.landing.socialProofTitle}
        </h2>

        {/* Metrics summary bar (Stripe pattern) */}
        <p className="text-sm text-[var(--text-secondary)] text-center mb-12 animate-slide-up flex items-center justify-center gap-2" style={{ animationDelay: "60ms" }}>
          <SparklesIcon size={14} className="text-[var(--accent)]" />
          {landingT.socialProofMetricsSummary ?? "Professionals who used Profile Score saw an average 40-point score increase and 3\u00d7 more interviews."}
        </p>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((item, i) => (
            <Card key={i} variant="default" padding="md" hoverable className="animate-slide-up group" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon key={s} size={14} className="text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5 italic">&ldquo;{item.quote}&rdquo;</p>
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  <TrendingUpIcon size={12} />
                  {item.metric}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                  {item.author.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{item.author}</span>
                  <span className="text-xs text-[var(--text-muted)]">{item.role}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
