"use client";

import type { PromptRecord } from "@/lib/types";
import PromptStatusBadge from "./PromptStatusBadge";

interface PromptListProps {
  prompts: PromptRecord[];
  selectedId: string | null;
  onSelect: (prompt: PromptRecord) => void;
  keyFilter: string;
  localeFilter: string;
  statusFilter: string;
  onKeyFilterChange: (v: string) => void;
  onLocaleFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
}

export default function PromptList({
  prompts,
  selectedId,
  onSelect,
  keyFilter,
  localeFilter,
  statusFilter,
  onKeyFilterChange,
  onLocaleFilterChange,
  onStatusFilterChange,
}: PromptListProps) {
  // Extract unique keys for filter dropdown
  const uniqueKeys = [...new Set(prompts.map((p) => p.promptKey))].sort();

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex flex-col gap-2 p-3 border-b border-[var(--border-light)]">
        <select
          value={keyFilter}
          onChange={(e) => onKeyFilterChange(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
        >
          <option value="">All Keys</option>
          {uniqueKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={localeFilter}
            onChange={(e) => onLocaleFilterChange(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
          >
            <option value="">All Locales</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {prompts.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            No prompts found
          </div>
        ) : (
          prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`
                w-full text-left px-3 py-3 border-b border-[var(--border-light)] transition-colors
                hover:bg-[var(--surface-secondary)]
                ${selectedId === p.id ? "bg-[var(--accent-light)] border-l-2 border-l-[var(--accent)]" : ""}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate mr-2">
                  {p.promptKey}
                </span>
                <PromptStatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                <span className="uppercase">{p.locale}</span>
                <span>v{p.version}</span>
                {p.modelTarget && <span>{p.modelTarget}</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
