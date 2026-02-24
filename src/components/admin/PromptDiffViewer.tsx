"use client";

interface PromptDiffViewerProps {
  previous: string;
  current: string;
  previousLabel?: string;
  currentLabel?: string;
}

export default function PromptDiffViewer({
  previous,
  current,
  previousLabel = "Previous Version",
  currentLabel = "Current Version",
}: PromptDiffViewerProps) {
  const prevLines = previous.split("\n");
  const currLines = current.split("\n");

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
          {previousLabel}
        </p>
        <div className="bg-[var(--surface-secondary)] rounded-lg p-3 text-xs font-mono leading-relaxed overflow-auto max-h-80">
          {prevLines.map((line, i) => {
            const changed = currLines[i] !== line;
            return (
              <div
                key={i}
                className={changed ? "bg-red-50 text-red-700 -mx-1 px-1 rounded" : "text-[var(--text-secondary)]"}
              >
                {line || "\u00A0"}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
          {currentLabel}
        </p>
        <div className="bg-[var(--surface-secondary)] rounded-lg p-3 text-xs font-mono leading-relaxed overflow-auto max-h-80">
          {currLines.map((line, i) => {
            const changed = prevLines[i] !== line;
            return (
              <div
                key={i}
                className={changed ? "bg-emerald-50 text-emerald-700 -mx-1 px-1 rounded" : "text-[var(--text-secondary)]"}
              >
                {line || "\u00A0"}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
