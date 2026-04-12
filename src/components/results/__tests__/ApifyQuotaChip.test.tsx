import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApifyQuotaChip } from "../ApifyQuotaChip";
import type { ApifyQuotaState } from "@/lib/types";

// Mock I18nContext to return controlled translations per test
const mockTranslations = {
  en: {
    apify: {
      dashboard: {
        remaining: "Scans remaining: {count}",
        unlimited: "Unlimited scans",
        label: "LinkedIn scans",
      },
    },
  },
  es: {
    apify: {
      dashboard: {
        remaining: "Escaneos restantes: {count}",
        unlimited: "Escaneos ilimitados",
        label: "Escaneos de LinkedIn",
      },
    },
  },
};

let currentLocale: "en" | "es" = "en";

vi.mock("@/context/I18nContext", () => ({
  useI18n: () => ({
    locale: currentLocale,
    t: mockTranslations[currentLocale],
    setLocale: vi.fn(),
  }),
}));

describe("ApifyQuotaChip", () => {
  beforeEach(() => {
    currentLocale = "en";
  });

  it("renders 'Scans remaining: 1' for free user with 1 remaining", () => {
    const quota: ApifyQuotaState = { remaining: 1, plan: "free" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Scans remaining: 1")).toBeInTheDocument();
  });

  it("renders 'Scans remaining: 0' when quota exhausted", () => {
    const quota: ApifyQuotaState = { remaining: 0, plan: "free" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Scans remaining: 0")).toBeInTheDocument();
  });

  it("renders 'Unlimited scans' for starter plan", () => {
    const quota: ApifyQuotaState = { remaining: null, plan: "starter" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Unlimited scans")).toBeInTheDocument();
  });

  it("renders 'Unlimited scans' for recommended plan", () => {
    const quota: ApifyQuotaState = { remaining: null, plan: "recommended" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Unlimited scans")).toBeInTheDocument();
  });

  it("renders nothing when quota is null (not yet loaded)", () => {
    const { container } = render(<ApifyQuotaChip quota={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Escaneos restantes: 1' in Spanish locale", () => {
    currentLocale = "es";
    const quota: ApifyQuotaState = { remaining: 1, plan: "free" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Escaneos restantes: 1")).toBeInTheDocument();
  });

  it("renders 'Escaneos ilimitados' for paid tier in Spanish locale", () => {
    currentLocale = "es";
    const quota: ApifyQuotaState = { remaining: null, plan: "recommended" };
    render(<ApifyQuotaChip quota={quota} />);
    expect(screen.getByText("Escaneos ilimitados")).toBeInTheDocument();
  });
});
