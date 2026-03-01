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

export function useExport(): UseExportReturn {
  const [moduleStates, setModuleStates] = useState<
    Record<string, ModuleState>
  >({});

  const getModuleState = useCallback(
    (moduleId: ExportModuleId): ModuleState => {
      return moduleStates[moduleId] ?? DEFAULT_STATE;
    },
    [moduleStates]
  );

  const createExport = useCallback(
    async (opts: CreateExportOpts) => {
      const { exportType, adminToken, userEdits, ...payload } = opts;

      // HOTFIX-7: Export telemetry
      trackEvent("exportJobStarted", { metadata: { exportType } });

      setModuleStates((prev) => ({
        ...prev,
        [exportType]: { status: "processing", exportId: null, error: null },
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
          body: JSON.stringify({ ...payload, exportType, userEdits }),
        });

        const data = await res.json();

        if (!res.ok) {
          setModuleStates((prev) => ({
            ...prev,
            [exportType]: {
              status: "failed",
              exportId: null,
              error: data.error ?? data.reason ?? "Export failed",
            },
          }));
          return;
        }

        // HOTFIX-7: Export telemetry
        trackEvent("exportJobSucceeded", { metadata: { exportType, exportId: data.exportId } });

        setModuleStates((prev) => ({
          ...prev,
          [exportType]: {
            status: data.status as ExportStatus,
            exportId: data.exportId,
            error: data.error ?? null,
          },
        }));
      } catch {
        setModuleStates((prev) => ({
          ...prev,
          [exportType]: {
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
      const { exportType, adminToken, userEdits, ...payload } = opts;

      trackEvent("exportBypassClicked", { metadata: { exportType } });
      trackEvent("exportJobStarted", { metadata: { exportType } });

      setModuleStates((prev) => ({
        ...prev,
        [exportType]: { status: "processing", exportId: null, error: null },
      }));

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (adminToken) headers["x-admin-token"] = adminToken;

        const res = await fetch("/api/exports/create", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...payload, exportType, userEdits }),
        });
        const data = await res.json();

        if (!res.ok) {
          trackEvent("exportDownloadFailed", {
            metadata: { exportType, reason: data.error ?? "http_error" },
          });
          setModuleStates((prev) => ({
            ...prev,
            [exportType]: {
              status: "failed",
              exportId: null,
              error: data.error ?? data.reason ?? "Export failed",
            },
          }));
          return;
        }

        trackEvent("exportJobCompleted", {
          metadata: { exportType, exportId: data.exportId },
        });

        setModuleStates((prev) => ({
          ...prev,
          [exportType]: {
            status: data.status as ExportStatus,
            exportId: data.exportId,
            error: data.error ?? null,
          },
        }));

        // Auto-trigger download on success
        if (data.exportId && data.status === "ready") {
          trackEvent("exportDownloadTriggered", {
            metadata: { exportType, exportId: data.exportId },
          });
          window.open(`/api/exports/${data.exportId}?download=true`, "_blank");
        }
      } catch {
        trackEvent("exportDownloadFailed", {
          metadata: { exportType, reason: "network_error" },
        });
        setModuleStates((prev) => ({
          ...prev,
          [exportType]: {
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
    // HOTFIX-7: Export telemetry
    trackEvent("exportDownloadStarted", { metadata: { exportId } });
    window.open(`/api/exports/${exportId}?download=true`, "_blank");
  }, []);

  const retryExport = useCallback(
    async (opts: Parameters<UseExportReturn["createExport"]>[0]) => {
      await createExport(opts);
    },
    [createExport]
  );

  return { getModuleState, createExport, createExportAndDownload, downloadExport, retryExport };
}
