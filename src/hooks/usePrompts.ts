"use client";

import { useState, useCallback, useEffect } from "react";
import type { PromptRecord } from "@/lib/types";

interface UsePromptsOptions {
  adminToken?: string;
}

interface PromptsState {
  prompts: PromptRecord[];
  loading: boolean;
  error: string | null;
}

export function usePrompts({ adminToken }: UsePromptsOptions = {}) {
  const [state, setState] = useState<PromptsState>({
    prompts: [],
    loading: false,
    error: null,
  });

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) h["x-admin-token"] = adminToken;
    return h;
  }, [adminToken]);

  const fetchPrompts = useCallback(
    async (filters?: { key?: string; locale?: string; status?: string }) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (filters?.key) params.set("key", filters.key);
        if (filters?.locale) params.set("locale", filters.locale);
        if (filters?.status) params.set("status", filters.status);

        const qs = params.toString();
        const res = await fetch(`/api/prompts${qs ? `?${qs}` : ""}`, {
          headers: headers(),
        });
        if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status}`);
        const data = await res.json();
        setState({ prompts: data.prompts, loading: false, error: null });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [headers]
  );

  const createPrompt = useCallback(
    async (input: {
      promptKey: string;
      locale: string;
      content: string;
      modelTarget?: string;
    }) => {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to create prompt: ${res.status}`);
      }
      const data = await res.json();
      return data.prompt as PromptRecord;
    },
    [headers]
  );

  const updatePrompt = useCallback(
    async (
      id: string,
      input: { content?: string; status?: string; modelTarget?: string }
    ) => {
      const res = await fetch(`/api/prompts/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to update prompt: ${res.status}`);
      }
      const data = await res.json();
      return data.prompt as PromptRecord;
    },
    [headers]
  );

  const getPrompt = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/prompts/${id}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Failed to fetch prompt: ${res.status}`);
      const data = await res.json();
      return data.prompt as PromptRecord;
    },
    [headers]
  );

  return {
    ...state,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    getPrompt,
  };
}
