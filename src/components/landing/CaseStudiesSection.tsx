"use client";

import { useI18n } from "@/context/I18nContext";
import { TrendingUpIcon, SparklesIcon } from "@/components/ui/Icons";

interface Case {
  nameKey: string;
  roleKey: string;
  problemKey: string;
  scoreKey: string;
  actionsKey: string;
  resultKey: string;
  metricKey: string;
  avatarColor: string;
  accentColor: string;
  resultBg: string;
  resultText: string;
}

const cases: Case[] = [
  {
    nameKey: "case1Name",
    roleKey: "case1Role",
    problemKey: "case1Problem",
    scoreKey: "case1ScoreBefore",
    actionsKey: "case1Actions",
    resultKey: "case1Result",
    metricKey: "case1Metric",
    avatarColor: "from-blue-400 to-blue-600",
    accentColor: "text-[var(--accent)]",
    resultBg: "bg-emerald-50 border-emerald-100",
    resultText: "text-emerald-700",
  },
  {
    nameKey: "case2Name",
    roleKey: "case2Role",
    problemKey: "case2Problem",
    scoreKey: "case2ScoreBefore",
    actionsKey: "case2Actions",
    resultKey: "case2Result",
    metricKey: "case2Metric",
    avatarColor: "from-violet-400 to-violet-600",
    accentColor: "text-violet-600",
    resultBg: "bg-emerald-50 border-emerald-100",
    resultText: "text-emerald-700",
  },
  {
    nameKey: "case3Name",
    roleKey: "case3Role",
    problemKey: "case3Problem",
    scoreKey: "case3ScoreBefore",
    actionsKey: "case3Actions",
    resultKey: "case3Result",
    metricKey: "case3Metric",
    avatarColor: "from-emerald-400 to-emerald-600",
    accentColor: "text-emerald-600",
    resultBg: "bg-emerald-50 border-emerald-100",
    resultText: "text-emerald-700",
  },
];

function ScoreDot({ score }: { score: string }) {
  const n = parseInt(score, 10);
  const color =
    n < 50
      ? "text-red-500 bg-red-50 border-red-100"
      : n < 70
      ? "text-amber-600 bg-amber-50 border-amber-100"
      : "text-emerald-600 bg-emerald-50 border-emerald-100";

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border tabular-nums ${color}`}
    >
      {score}
    </span>
  );
}

export default function CaseStudiesSection() {
  const { t } = useI18n();
  const l = t.landing as Record<string, string>;

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
      {/* Heading */}
      <div className="text-center mb-12 animate-slide-up">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
          {l.casesTitle ?? "From where they started, to where they got"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] flex items-center justify-center gap-1.5">
          <SparklesIcon size={13} className="text-[var(--accent)]" />
          {l.casesSubtitle ?? "Real cases. Real results. Transparent process."}
        </p>
      </div>

      {/* Case cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {cases.map((c, i) => {
          const name    = l[c.nameKey]    ?? "—";
          const role    = l[c.roleKey]    ?? "";
          const problem = l[c.problemKey] ?? "";
          const score   = l[c.scoreKey]   ?? "—";
          const actions = l[c.actionsKey] ?? "";
          const result  = l[c.resultKey]  ?? "";
          const metric  = l[c.metricKey]  ?? "";

          return (
            <div
              key={i}
              className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden animate-slide-up flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Avatar + name strip */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[var(--border-light)]">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${c.avatarColor} text-white flex items-center justify-center text-sm font-bold shrink-0`}
                >
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{role}</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 flex flex-col gap-4 flex-1">
                {/* Problem */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {l.casesProblemLabel ?? "Starting problem"}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-snug">{problem}</p>
                </div>

                {/* Score before */}
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {l.casesScoreLabel ?? "Initial score"}
                  </p>
                  <ScoreDot score={score} />
                </div>

                {/* Actions */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {l.casesActionsLabel ?? "Actions taken"}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-snug">{actions}</p>
                </div>
              </div>

              {/* Result footer */}
              <div className={`px-5 py-4 border-t ${c.resultBg} border-t`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  {l.casesResultLabel ?? "Result"}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${c.resultText}`}>
                    <TrendingUpIcon size={13} />
                    {metric}
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-1 leading-snug">{result}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder note */}
      <p className="text-center text-xs text-[var(--text-muted)] mt-6 animate-slide-up" style={{ animationDelay: "320ms" }}>
        {l.casesPlaceholderNote ?? "ProfileScore user? Share your case."}
      </p>
    </section>
  );
}
