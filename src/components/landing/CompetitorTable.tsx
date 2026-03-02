"use client";

import { useI18n } from "@/context/I18nContext";
import { CheckIcon } from "@/components/ui/Icons";

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

type CellValue = "yes" | "no" | "partial";

interface Row {
  featureKey: string;
  ps: CellValue;
  jobscan: CellValue;
  careerflow: CellValue;
  rezi: CellValue;
  teal: CellValue;
}

const rows: Row[] = [
  { featureKey: "compareFeature1", ps: "yes", jobscan: "no",      careerflow: "no",      rezi: "no",      teal: "no"      },
  { featureKey: "compareFeature2", ps: "yes", jobscan: "no",      careerflow: "no",      rezi: "no",      teal: "no"      },
  { featureKey: "compareFeature3", ps: "yes", jobscan: "no",      careerflow: "no",      rezi: "no",      teal: "no"      },
  { featureKey: "compareFeature4", ps: "yes", jobscan: "no",      careerflow: "no",      rezi: "no",      teal: "no"      },
  { featureKey: "compareFeature5", ps: "yes", jobscan: "partial", careerflow: "partial", rezi: "partial", teal: "partial" },
];

function Cell({ value, partial }: { value: CellValue; partial: string }) {
  if (value === "yes") {
    return (
      <td className="py-4 px-3 text-center">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600">
          <CheckIcon size={14} />
        </span>
      </td>
    );
  }
  if (value === "partial") {
    return (
      <td className="py-4 px-3 text-center">
        <span className="inline-flex items-center justify-center text-[11px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-100 whitespace-nowrap">
          {partial}
        </span>
      </td>
    );
  }
  return (
    <td className="py-4 px-3 text-center">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--surface-secondary)] text-[var(--text-muted)]">
        <XIcon size={13} />
      </span>
    </td>
  );
}

export default function CompetitorTable() {
  const { t } = useI18n();
  const l = t.landing as Record<string, string>;

  const competitors = ["Jobscan", "Careerflow", "Rezi", "Teal"];

  return (
    <section className="bg-white border-y border-[var(--border-light)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        {/* Heading */}
        <div className="text-center mb-10 animate-slide-up">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">
            {l.compareTitle ?? "ProfileScore vs the competition"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {l.compareSubtitle ?? "Data, not hype."}
          </p>
        </div>

        {/* Table wrapper — horizontal scroll on mobile */}
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] animate-slide-up" style={{ animationDelay: "80ms" }}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--surface-secondary)] border-b border-[var(--border)]">
                {/* Feature column */}
                <th className="py-3.5 px-4 text-left font-semibold text-[var(--text-primary)] text-xs uppercase tracking-wide min-w-[180px]">
                  Feature
                </th>

                {/* ProfileScore — highlighted column */}
                <th className="py-3.5 px-3 text-center bg-[var(--accent-light)] border-x border-blue-100 min-w-[120px]">
                  <span className="inline-flex flex-col items-center gap-0.5">
                    <span className="font-bold text-[var(--accent)] text-xs">ProfileScore</span>
                    <span className="text-[10px] font-medium text-[var(--accent)] opacity-70">★ You</span>
                  </span>
                </th>

                {/* Competitors */}
                {competitors.map((name) => (
                  <th
                    key={name}
                    className="py-3.5 px-3 text-center font-medium text-[var(--text-secondary)] text-xs min-w-[90px]"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-[var(--border-light)] last:border-0 ${
                    i % 2 === 0 ? "bg-white" : "bg-[var(--surface-secondary)]/40"
                  }`}
                >
                  {/* Feature label */}
                  <td className="py-4 px-4 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {l[row.featureKey] ?? row.featureKey}
                  </td>

                  {/* ProfileScore cell — accented */}
                  <td className="py-4 px-3 text-center bg-[var(--accent-light)]/50 border-x border-blue-100/60">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600">
                      <CheckIcon size={14} />
                    </span>
                  </td>

                  {/* Competitor cells */}
                  <Cell value={row.jobscan}    partial={l.comparePartial ?? "Partial"} />
                  <Cell value={row.careerflow} partial={l.comparePartial ?? "Partial"} />
                  <Cell value={row.rezi}       partial={l.comparePartial ?? "Partial"} />
                  <Cell value={row.teal}       partial={l.comparePartial ?? "Partial"} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <p className="text-center text-xs text-[var(--text-muted)] mt-4 animate-slide-up" style={{ animationDelay: "160ms" }}>
          {l.compareNote ?? "Based on our own product analysis. Data subject to change."}
        </p>
      </div>
    </section>
  );
}
