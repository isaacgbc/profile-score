"use client";

import { useState, useCallback } from "react";
import type { ExportModuleId, ExportFormat, ExportStatus } from "@/lib/types";
import { trackEvent } from "@/lib/analytics/tracker";

interface ModuleState {
  status: ExportStatus | "idle";
  exportId: string | null;
  error: string | null;
}

interface UserEdits {
  userImprovements?: Record<string, string>;
  userRewritten?: Record<string, string>;
  userOptimized?: Record<string, string>;
}

interface CreateExportOpts {
  auditId: string;
  exportType: ExportModuleId;
  format: ExportFormat;
  language: string;
  planId: string | null;
  adminToken?: string;
  userEdits?: UserEdits;
}

interface UseExportReturn {
  /** Get state for a specific module + format combo */
  getModuleFormatState: (moduleId: ExportModuleId, format: ExportFormat) => ModuleState;
  /** @deprecated — use getModuleFormatState instead. Returns aggregate state for backward compat. */
  getModuleState: (moduleId: ExportModuleId) => ModuleState;
  createExport: (opts: CreateExportOpts) => Promise<void>;
  createExportAndDownload: (opts: CreateExportOpts) => Promise<void>;
  downloadExport: (exportId: string) => void;
  retryExport: (opts: CreateExportOpts) => Promise<void>;
}

const DEFAULT_STATE: ModuleState = {
  status: "idle",
  exportId: null,
  error: null,
};

/** Composite key for per-format state tracking */
function formatKey(moduleId: ExportModuleId, format: ExportFormat): string {
  return `${moduleId}:${format}`;
}

export function useExport(): UseExportReturn {
  const [moduleStates, setModuleStates] = useState<
    Record<string, ModuleState>
  >({});

  /** Per-format state: returns the state for a specific module + format combo */
  const getModuleFormatState = useCallback(
    (moduleId: ExportModuleId, format: ExportFormat): ModuleState => {
      return moduleStates[formatKey(moduleId, format)] ?? DEFAULT_STATE;
    },
    [moduleStates]
  );

  /** Aggregate state (backward compat): returns the "most active" state across all formats */
  const getModuleState = useCallback(
    (moduleId: ExportModuleId): ModuleState => {
      // Check all possible format keys for this module
      const formats: ExportFormat[] = ["pdf", "docx"];
      for (const fmt of formats) {
        const key = formatKey(moduleId, fmt);
        const state = moduleStates[key];
        if (state && state.status !== "idle") return state;
      }
      // Fallback: check legacy key (moduleId without format)
      return moduleStates[moduleId] ?? DEFAULT_STATE;
    },
    [moduleStates]
  );

  const createExport = useCallback(
    async (opts: CreateExportOpts) => {
      const { exportType, format, adminToken, userEdits, ...payload } = opts;
      const key = formatKey(exportType, format);

      // HOTFIX-7: Export telemetry
      trackEvent("exportJobStarted", { metadata: { exportType, format } });

      setModuleStates((prev) => ({
        ...prev,
        [key]: { status: "processing", exportId: null, error: null },
      }));

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (adminToken) {
          headers["x-admin-token"] = adminToken;
        }

        const res = await fetch("/api/exports/create", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...payload, exportType, format, userEdits }),
        });

        const data = await res.json();

        if (!res.ok) {
          setModuleStates((prev) => ({
            ...prev,
            [key]: {
              status: "failed",
              exportId: null,
              error: data.error ?? data.reason ?? "Export failed",
            },
          }));
          return;
        }

        // HOTFIX-7: Export telemetry
        trackEvent("exportJobSucceeded", { metadata: { exportType, format, exportId: data.exportId } });

        setModuleStates((prev) => ({
          ...prev,
          [key]: {
            status: data.status as ExportStatus,
            exportId: data.exportId,
            error: data.error ?? null,
          },
        }));
      } catch {
        setModuleStates((prev) => ({
          ...prev,
          [key]: {
            status: "failed",
            exportId: null,
            error: "Network error",
          },
        }));
      }
    },
    []
  );

  // HOTFIX-8: Bypass export — create + auto-download in one action
  const createExportAndDownload = useCallback(
    async (opts: CreateExportOpts) => {
      const { exportType, format, adminToken, userEdits, ...payload } = opts;
      const key = formatKey(exportType, format);

      trackEvent("exportBypassClicked", { metadata: { exportType, format } });
      trackEvent("exportJobStarted", { metadata: { exportType, format } });

      setModuleStates((prev) => ({
        ...prev,
        [key]: { status: "processing", exportId: null, error: null },
      }));

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (adminToken) headers["x-admin-token"] = adminToken;

        const res = await fetch("/api/exports/create", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...payload, exportType, format, userEdits }),
        });
        const data = await res.json();

        if (!res.ok) {
          trackEvent("exportDownloadFailed", {
            metadata: { exportType, format, reason: data.error ?? "http_error" },
          });
          setModuleStates((prev) => ({
            ...prev,
            [key]: {
              status: "failed",
              exportId: null,
              error: data.error ?? data.reason ?? "Export failed",
            },
          }));
          return;
        }

        trackEvent("exportJobCompleted", {
          metadata: { exportType, format, exportId: data.exportId },
        });

        setModuleStates((prev) => ({
          ...prev,
          [key]: {
            status: data.status as ExportStatus,
            exportId: data.exportId,
            error: data.error ?? null,
          },
        }));

        // HOTFIX-9d: Open export in new tab for preview (user can download from there)
        if (data.exportId && data.status === "ready") {
          trackEvent("exportDownloadTriggered", {
            metadata: { exportType, format, exportId: data.exportId },
          });
          // Open in new tab with inline disposition — user sees preview, can download manually
          window.open(
            `/api/exports/${data.exportId}?inline=true`,
            "_blank"
          );
          trackEvent("exportPreviewOpened", {
            metadata: { exportType, format, exportId: data.exportId },
          });
        }
      } catch {
        trackEvent("exportDownloadFailed", {
          metadata: { exportType, format, reason: "network_error" },
        });
        setModuleStates((prev) => ({
          ...prev,
          [key]: {
            status: "failed",
            exportId: null,
            error: "Network error",
          },
        }));
      }
    },
    []
  );

  const downloadExport = useCallback((exportId: string) => {
    // HOTFIX-9d: Open in new tab for preview (user can save from browser)
    trackEvent("exportDownloadStarted", { metadata: { exportId } });
    window.open(`/api/exports/${exportId}?inline=true`, "_blank");
    trackEvent("exportPreviewOpened", { metadata: { exportId } });
  }, []);

  const retryExport = useCallback(
    async (opts: Parameters<UseExportReturn["createExport"]>[0]) => {
      await createExport(opts);
    },
    [createExport]
  );

  return { getModuleState, getModuleFormatState, createExport, createExportAndDownload, downloadExport, retryExport };
}
