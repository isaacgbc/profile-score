"use client";

import { useState, useEffect, useCallback } from "react";
import type { PromptRecord } from "@/lib/types";
import { usePrompts } from "@/hooks/usePrompts";
import PromptList from "@/components/admin/PromptList";
import PromptEditor from "@/components/admin/PromptEditor";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function AdminPromptsPage() {
  const adminToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminToken") ?? undefined
      : undefined;

  const { prompts, loading, error, fetchPrompts, createPrompt, updatePrompt } =
    usePrompts({ adminToken });

  const [selectedPrompt, setSelectedPrompt] = useState<PromptRecord | null>(null);
  const [previousVersion, setPreviousVersion] = useState<PromptRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyFilter, setKeyFilter] = useState("");
  const [localeFilter, setLocaleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Show "New Prompt" form
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [newContent, setNewContent] = useState("");
  const [newModelTarget, setNewModelTarget] = useState("");

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchPrompts({
      key: keyFilter || undefined,
      locale: localeFilter || undefined,
      status: statusFilter || undefined,
    });
  }, [keyFilter, localeFilter, statusFilter, fetchPrompts]);

  // When a prompt is selected, find the previous version for diff
  const handleSelect = useCallback(
    (prompt: PromptRecord) => {
      setSelectedPrompt(prompt);
      setShowCreate(false);

      // Find previous version: same key + locale, version < current, highest version
      const prev = prompts
        .filter(
          (p) =>
            p.promptKey === prompt.promptKey &&
            p.locale === prompt.locale &&
            p.version < prompt.version
        )
        .sort((a, b) => b.version - a.version)[0] ?? null;
      setPreviousVersion(prev);
    },
    [prompts]
  );

  // Save as new draft (creates a new version)
  const handleSaveDraft = useCallback(
    async (content: string, modelTarget?: string) => {
      if (!selectedPrompt) return;
      setSaving(true);
      try {
        const created = await createPrompt({
          promptKey: selectedPrompt.promptKey,
          locale: selectedPrompt.locale,
          content,
          modelTarget,
        });
        await fetchPrompts({
          key: keyFilter || undefined,
          locale: localeFilter || undefined,
          status: statusFilter || undefined,
        });
        setSelectedPrompt(created);
      } catch {
        // Error state is handled by the hook
      } finally {
        setSaving(false);
      }
    },
    [selectedPrompt, createPrompt, fetchPrompts, keyFilter, localeFilter, statusFilter]
  );

  // Activate
  const handleActivate = useCallback(async () => {
    if (!selectedPrompt) return;
    setSaving(true);
    try {
      const updated = await updatePrompt(selectedPrompt.id, { status: "active" });
      await fetchPrompts({
        key: keyFilter || undefined,
        locale: localeFilter || undefined,
        status: statusFilter || undefined,
      });
      setSelectedPrompt(updated);
    } catch {
      // handled by hook
    } finally {
      setSaving(false);
    }
  }, [selectedPrompt, updatePrompt, fetchPrompts, keyFilter, localeFilter, statusFilter]);

  // Archive
  const handleArchive = useCallback(async () => {
    if (!selectedPrompt) return;
    setSaving(true);
    try {
      const updated = await updatePrompt(selectedPrompt.id, { status: "archived" });
      await fetchPrompts({
        key: keyFilter || undefined,
        locale: localeFilter || undefined,
        status: statusFilter || undefined,
      });
      setSelectedPrompt(updated);
    } catch {
      // handled by hook
    } finally {
      setSaving(false);
    }
  }, [selectedPrompt, updatePrompt, fetchPrompts, keyFilter, localeFilter, statusFilter]);

  // Create new prompt
  const handleCreate = useCallback(async () => {
    if (!newKey.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const created = await createPrompt({
        promptKey: newKey.trim(),
        locale: newLocale,
        content: newContent,
        modelTarget: newModelTarget || undefined,
      });
      await fetchPrompts({
        key: keyFilter || undefined,
        locale: localeFilter || undefined,
        status: statusFilter || undefined,
      });
      setSelectedPrompt(created);
      setShowCreate(false);
      setNewKey("");
      setNewLocale("en");
      setNewContent("");
      setNewModelTarget("");
    } catch {
      // handled by hook
    } finally {
      setSaving(false);
    }
  }, [newKey, newLocale, newContent, newModelTarget, createPrompt, fetchPrompts, keyFilter, localeFilter, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Prompt Registry
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage versioned prompt templates for all AI-powered features.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setShowCreate(true);
            setSelectedPrompt(null);
          }}
        >
          New Prompt
        </Button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[600px]">
        {/* Left: list */}
        <Card variant="default" padding="sm" className="overflow-hidden">
          {loading && prompts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)]">
              Loading...
            </div>
          ) : (
            <PromptList
              prompts={prompts}
              selectedId={selectedPrompt?.id ?? null}
              onSelect={handleSelect}
              keyFilter={keyFilter}
              localeFilter={localeFilter}
              statusFilter={statusFilter}
              onKeyFilterChange={setKeyFilter}
              onLocaleFilterChange={setLocaleFilter}
              onStatusFilterChange={setStatusFilter}
            />
          )}
        </Card>

        {/* Right: editor or create form */}
        <Card variant="default" padding="sm" className="overflow-hidden">
          {showCreate ? (
            <div className="p-4 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Create New Prompt
              </h2>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Prompt Key
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. audit.linkedin.system"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                    Locale
                  </label>
                  <select
                    value={newLocale}
                    onChange={(e) => setNewLocale(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
                  >
                    <option value="en">English (en)</option>
                    <option value="es">Spanish (es)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                    Model Target
                  </label>
                  <input
                    type="text"
                    value={newModelTarget}
                    onChange={(e) => setNewModelTarget(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Content
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)] resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  loading={saving}
                  disabled={!newKey.trim() || !newContent.trim() || saving}
                >
                  Create Draft
                </Button>
              </div>
            </div>
          ) : selectedPrompt ? (
            <PromptEditor
              key={selectedPrompt.id}
              prompt={selectedPrompt}
              previousVersion={previousVersion}
              onSaveDraft={handleSaveDraft}
              onActivate={handleActivate}
              onArchive={handleArchive}
              saving={saving}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <p className="text-sm text-[var(--text-muted)]">
                Select a prompt to edit or create a new one.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
