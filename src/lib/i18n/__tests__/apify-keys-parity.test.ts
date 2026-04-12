/**
 * EN ↔ ES i18n parity enforcer for the Apify LinkedIn Integration phase.
 *
 * Two responsibilities:
 *  1. Assert full key-set parity between en.json and es.json (fails loudly
 *     listing any drifted keys on either side).
 *  2. Explicitly assert that every Phase 01 `apify.*` / `input.*` / `progress.*`
 *     key introduced by Plan 01-01 is present in BOTH locales. This is belt-
 *     and-suspenders protection against a future PR that adds a key to one
 *     locale only but happens to also remove an unrelated key from the other
 *     (which would keep the set sizes equal while still breaking UX).
 */
import { describe, it, expect } from "vitest";
import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

type JsonObject = { [k: string]: unknown };

function flatten(
  obj: unknown,
  prefix = "",
  out: Set<string> = new Set(),
): Set<string> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as JsonObject)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        flatten(v, path, out);
      } else {
        out.add(path);
      }
    }
  }
  return out;
}

const enKeys = flatten(en);
const esKeys = flatten(es);

/** Every key introduced by Plan 01-01 — Wave 0 foundation. */
const PHASE_01_REQUIRED_KEYS: readonly string[] = [
  // input.* additions
  "input.linkedinUrlPrimaryLabel",
  "input.linkedinUrlHelp",
  "input.linkedinUrlPlaceholder",
  "input.useCvAlternativeTitle",
  // progress.* additions
  "progress.stageScraping",
  // apify.error.*
  "apify.error.private",
  "apify.error.invalidUrl",
  "apify.error.rateLimit",
  "apify.error.downtime",
  "apify.error.quotaExceeded",
  "apify.error.generic",
  "apify.error.disabled",
  // apify.dashboard.*
  "apify.dashboard.remaining",
  "apify.dashboard.unlimited",
  "apify.dashboard.label",
  // apify.actions.*
  "apify.actions.retry",
  "apify.actions.switchToCv",
  "apify.actions.upgrade",
];

describe("i18n EN ↔ ES key parity", () => {
  it("every key in en.json exists in es.json", () => {
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();
    expect(
      missingInEs,
      `Keys missing in es.json: ${missingInEs.join(", ")}`,
    ).toEqual([]);
  });

  it("every key in es.json exists in en.json", () => {
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();
    expect(
      missingInEn,
      `Keys missing in en.json: ${missingInEn.join(", ")}`,
    ).toEqual([]);
  });

  it("key counts match exactly", () => {
    expect(enKeys.size).toBe(esKeys.size);
  });
});

describe("Phase 01 apify.* keys — required on both locales", () => {
  for (const key of PHASE_01_REQUIRED_KEYS) {
    it(`"${key}" exists in en.json`, () => {
      expect(enKeys.has(key)).toBe(true);
    });
    it(`"${key}" exists in es.json`, () => {
      expect(esKeys.has(key)).toBe(true);
    });
  }
});

describe("Phase 01 brief-locked copy", () => {
  // The following literal strings are locked by the phase brief (D-21 and the
  // research i18n tables). Changing them must be a deliberate decision, not
  // an accidental drift.
  it("es.progress.stageScraping matches brief-locked copy", () => {
    const progress = (es as JsonObject).progress as JsonObject;
    expect(progress.stageScraping).toBe("Analizando tu perfil de LinkedIn...");
  });
  it("en.progress.stageScraping matches brief-locked copy", () => {
    const progress = (en as JsonObject).progress as JsonObject;
    expect(progress.stageScraping).toBe("Analyzing your LinkedIn profile...");
  });
});
