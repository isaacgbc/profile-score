"use client";

import { useI18n } from "@/context/I18nContext";
import Badge from "@/components/ui/Badge";
import {
  FileTextIcon,
  LinkIcon,
  MailIcon,
  BarChartIcon,
  CheckIcon,
  TrendingUpIcon,
} from "@/components/ui/Icons";

interface DemoStageOutputProps {
  visible: boolean;
}

export default function DemoStageOutput({ visible }: DemoStageOutputProps) {
  const { t } = useI18n();

  const cards = [
    { icon: FileTextIcon, label: t.landing.demoOutputCard1, stat: t.landing.demoOutputCard1Stat },
    { icon: LinkIcon, label: t.landing.demoOutputCard2, stat: t.landing.demoOutputCard2Stat },
    { icon: MailIcon, label: t.landing.demoOutputCard3, stat: t.landing.demoOutputCard3Stat },
    { icon: BarChartIcon, label: t.landing.demoOutputCard4, stat: t.landing.demoOutputCard4Stat },
  ];

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white shadow-sm ${
                visible ? "demo-chip-appear" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-[var(--accent)]" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {card.label}
                </span>
                <span className="text-[11px] text-[var(--success)] font-medium">
                  {card.stat}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Success Badge */}
      <div
        className={`flex justify-center ${
          visible ? "demo-chip-appear" : "opacity-0"
        }`}
        style={{ animationDelay: "500ms" }}
      >
        <Badge variant="success">
          <TrendingUpIcon size={12} />
          {t.landing.demoOutputReady}
        </Badge>
      </div>
    </div>
  );
}
