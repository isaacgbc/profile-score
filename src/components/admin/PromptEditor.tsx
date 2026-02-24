"use client";

import { useState } from "react";
import type { PromptRecord } from "@/lib/types";
import Button from "@/components/ui/Button";
import PromptDiffViewer from "./PromptDiffViewer";
import PromptStatusBadge from "./PromptStatusBadge";

interface PromptEditorProps {
  prompt: PromptRecord;
  previousVersion: PromptRecord | null;
  onSaveDraft: (content: string, modelTarget?: string) => Promise<void>;
  onActivate: () => Promise<void>;
  onArchive: () => Promise<void>;
  saving: boolean;
}

export default function PromptEditor({
  prompt,
  previousVersion,
  onSaveDraft,
  onActivate,
  onArchive,
  saving,
}: PromptEditorProps) {
  const [content, setContent] = useState(prompt.content);
  const [modelTarget, setModelTarget] = useState(prompt.modelTarget ?? "");
  const [showDiff, setShowDiff] = useState(false);

  const hasChanges = content !== prompt.content || modelTarget !== (prompt.modelTarget ?? "");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {prompt.promptKey}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">
              {prompt.locale}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              v{prompt.version}
            </span>
            <PromptStatusBadge status={prompt.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {previousVersion && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
            >
              {showDiff ? "Hide Diff" : "Show Diff"}
            </Button>
          )}
          {prompt.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onArchive}
              disabled={saving}
            >
              Archive
            </Button>
          )}
          {prompt.status === "draft" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onActivate}
              disabled={saving}
              loading={saving}
            >
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Diff viewer */}
      {showDiff && previousVersion && (
        <div className="p-4 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
          <PromptDiffViewer
            previous={previousVersion.content}
            current={content}
            previousLabel={`v${previousVersion.version} (${previousVersion.status})`}
            currentLabel={`v${prompt.version} (editing)`}
          />
        </div>
      )}

      {/* Model target */}
      <div className="px-4 pt-4 pb-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
          Model Target
        </label>
        <input
          type="text"
          value={modelTarget}
          onChange={(e) => setModelTarget(e.target.value)}
          placeholder="e.g. claude-sonnet (optional)"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Content editor */}
      <div className="flex-1 px-4 pb-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
          Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[calc(100%-28px)] px-3 py-2 text-xs font-mono rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)] resize-none leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between p-4 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]">
        <div className="text-[10px] text-[var(--text-muted)]">
          Updated: {new Date(prompt.updatedAt).toLocaleString()}
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!hasChanges || saving}
          loading={saving}
          onClick={() => onSaveDraft(content, modelTarget || undefined)}
        >
          Save as New Draft
        </Button>
      </div>
    </div>
  );
}
