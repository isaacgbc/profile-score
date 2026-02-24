"use client";

import { useState, useCallback } from "react";
import type { ExportModuleId, ExportFormat, ExportStatus } from "@/lib/types";

interface ModuleState {
  status: ExportStatus | "idle";
  exportId: string | null;
  error: string | null;
}

interface UseExportReturn {
  getModuleState: (moduleId: ExportModuleId) => ModuleState;
  createExport: (opts: {
    auditId: string;
    exportType: ExportModuleId;
    format: ExportFormat;
    language: string;
    planId: string | null;
    adminToken?: string;
  }) => Promise<void>;
  downloadExport: (exportId: string) => void;
  retryExport: (opts: {
    auditId: string;
    exportType: ExportModuleId;
    format: ExportFormat;
    language: string;
    planId: string | null;
    adminToken?: string;
  }) => Promise<void>;
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
    async (opts: {
      auditId: string;
      exportType: ExportModuleId;
      format: ExportFormat;
      language: string;
      planId: string | null;
      adminToken?: string;
    }) => {
      const { exportType, adminToken, ...payload } = opts;

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
          body: JSON.stringify({ ...payload, exportType }),
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

  const downloadExport = useCallback((exportId: string) => {
    window.open(`/api/exports/${exportId}?download=true`, "_blank");
  }, []);

  const retryExport = useCallback(
    async (opts: Parameters<UseExportReturn["createExport"]>[0]) => {
      await createExport(opts);
    },
    [createExport]
  );

  return { getModuleState, createExport, downloadExport, retryExport };
}
