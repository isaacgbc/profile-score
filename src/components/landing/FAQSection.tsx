"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

export default function FAQSection() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: landingT.faqQ1 ?? "What is Profile Score and how does it work?",
      answer: landingT.faqA1 ?? "Profile Score analyzes your LinkedIn profile and resume using AI to identify gaps, keyword mismatches, and optimization opportunities. You get an actionable score from 0-100 with specific recommendations to improve your visibility to recruiters and ATS systems.",
    },
    {
      question: landingT.faqQ2 ?? "Is my data safe and private?",
      answer: landingT.faqA2 ?? "Absolutely. We use bank-level encryption (AES-256) for all data. Your profile information is never shared with third parties, and you can delete your data at any time. We are GDPR and SOC 2 compliant.",
    },
    {
      question: landingT.faqQ3 ?? "How is this different from other resume tools?",
      answer: landingT.faqA3 ?? "Profile Score analyzes both your LinkedIn profile and resume together, giving you a holistic view. We use the same AI models that recruiters and ATS systems use, so our recommendations directly improve your chances of getting noticed.",
    },
    {
      question: landingT.faqQ4 ?? "How long does the analysis take?",
      answer: landingT.faqA4 ?? "The full analysis completes in under 2 minutes. You'll receive your score, a detailed breakdown across multiple categories, and prioritized action items you can implement immediately.",
    },
    {
      question: landingT.faqQ5 ?? "Can I use Profile Score for free?",
      answer: landingT.faqA5 ?? "Yes! The free tier includes a full profile score, top-3 priority recommendations, and basic ATS compatibility check. Premium unlocks detailed section-by-section analysis, keyword optimization, and personalized rewrite suggestions.",
    },
    {
      question: landingT.faqQ6 ?? "What kind of results can I expect?",
      answer: landingT.faqA6 ?? "On average, users who follow our recommendations see a 40-point score increase and report receiving 3x more recruiter messages and interview invitations within 30 days of optimizing their profiles.",
    },
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // FAQPage JSON-LD structured data
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-3 animate-slide-up tracking-tight">
        {landingT.faqTitle ?? "Frequently Asked Questions"}
      </h2>
      <p className="text-sm text-[var(--text-muted)] text-center mb-12 animate-slide-up" style={{ animationDelay: "60ms" }}>
        {landingT.faqSubtitle ?? "Everything you need to know about Profile Score."}
      </p>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden transition-all duration-200 hover:border-[var(--border-strong)] animate-slide-up"
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded-2xl"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                {faq.question}
              </span>
              <ChevronDown open={openIndex === i} />
            </button>
            <div
              className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                openIndex === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
