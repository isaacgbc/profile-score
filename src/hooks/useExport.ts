"use client";

import { useState, useCallback } from "react";
import type { ExportModuleId, ExportFormat, ExportStatus } from "@/lib/types";

interface ModuleState {
  status: ExportStatus | "idle";
  exportId: string | null;
  error: string | null;
}

interface UserEdits {
  userImprovements?: Record<string, string>;
  userRewritten?: Record<string, string>;
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
