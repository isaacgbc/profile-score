"use client";

interface DemoStageDotsProps {
  activeStage: number;
  stageLabels: string[];
  onStageClick: (stage: number) => void;
}

export default function DemoStageDots({
  activeStage,
  stageLabels,
  onStageClick,
}: DemoStageDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-1 mb-6">
      {stageLabels.map((label, i) => {
        const isActive = i === activeStage;
        return (
          <button
            key={i}
            onClick={() => onStageClick(i)}
            className={`
              transition-all duration-300 rounded-full cursor-pointer
              ${isActive
                ? "bg-[var(--accent)] w-2.5 h-2.5 sm:w-auto sm:h-auto sm:px-4 sm:py-1.5"
                : "bg-[var(--border)] hover:bg-[var(--border-strong)] w-2 h-2 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5"
              }
            `}
            aria-label={label}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={`hidden sm:inline text-xs font-medium ${
                isActive ? "text-white" : "text-[var(--text-muted)]"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
