"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { trackEvent } from "@/lib/analytics/tracker";
import Button from "@/components/ui/Button";
import { StarIcon, CheckIcon } from "@/components/ui/Icons";

export default function FeedbackForm() {
  const { t } = useI18n();
  const fbT = (t as Record<string, Record<string, string>>).feedback ?? {};

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [useful, setUseful] = useState("");
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [improve, setImprove] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    trackEvent("feedback_submitted", {
      rating,
      useful: useful.slice(0, 500),
      recommend: recommend ?? "skipped",
      improve: improve.slice(0, 500),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-slide-up">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <CheckIcon size={20} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-emerald-800">
          {fbT.thanks ?? "Thank you for your feedback!"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[var(--border)] rounded-2xl p-6 animate-slide-up">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        {fbT.title ?? "How was your experience?"}
      </h3>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        {fbT.desc ?? "Your feedback helps us improve Profile Score."}
      </p>

      {/* Star rating */}
      <div className="mb-5">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          {fbT.rating ?? "Rating"}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <StarIcon
                size={24}
                className={
                  star <= (hoverRating || rating)
                    ? "text-amber-400"
                    : "text-[var(--border-strong)]"
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* What was most useful */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
          {fbT.useful ?? "What did you find most useful?"}
        </label>
        <textarea
          value={useful}
          onChange={(e) => setUseful(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none resize-none transition-colors"
          placeholder={fbT.usefulPlaceholder ?? "e.g., The ATS optimization tips were really helpful..."}
        />
      </div>

      {/* Would you recommend? */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
          {fbT.recommend ?? "Would you recommend Profile Score?"}
        </label>
        <div className="flex gap-2">
          {[
            { value: true, label: fbT.recommendYes ?? "Yes" },
            { value: false, label: fbT.recommendNo ?? "No" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setRecommend(opt.value)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                recommend === opt.value
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Anything to improve */}
      <div className="mb-5">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
          {fbT.improve ?? "Anything we could improve?"} <span className="text-[var(--text-muted)]">({fbT.optional ?? "optional"})</span>
        </label>
        <textarea
          value={improve}
          onChange={(e) => setImprove(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none resize-none transition-colors"
        />
      </div>

      <Button type="submit" disabled={rating === 0} className="w-full">
        {fbT.submit ?? "Submit Feedback"}
      </Button>
    </form>
  );
}
