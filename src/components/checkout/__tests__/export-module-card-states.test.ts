/**
 * HOTFIX-EXPORT-CTA-VISIBILITY — State machine tests
 *
 * Validates that ExportModuleCard always renders a visible primary CTA
 * in every state combination. Tests the state derivation logic (not DOM).
 *
 * States:
 *   canExport=true                           → format buttons (PDF/DOCX)
 *   canExport=false, canBypass=true           → warning + primary bypass Button
 *   canExport=false, canBypass=false           → warning + disabled primary Button
 *   status=processing                         → disabled spinner Button
 *   status=ready                              → download Button
 *   status=failed                             → retry Button
 */

import assert from "node:assert";

// ── Types mirroring ExportModuleCard props ──────────────────────────
type ExportStatus = "processing" | "ready" | "failed";
type ExportFormat = "pdf" | "docx";

interface CardState {
  unlocked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  canBypass?: boolean;
  status: ExportStatus | "idle";
  exportId: string | null;
}

// ── State derivation (mirrors the JSX conditional chain) ────────────
type RenderedCTA =
  | { kind: "locked"; clickable: false }
  | { kind: "disabled-warning-bypass"; buttonLabel: string; clickable: true }
  | { kind: "disabled-warning-no-bypass"; buttonLabel: string; clickable: false }
  | { kind: "processing"; clickable: false }
  | { kind: "ready-download"; clickable: true }
  | { kind: "failed-retry"; clickable: true }
  | { kind: "format-buttons"; formats: ExportFormat[]; clickable: true };

function deriveCTA(
  state: CardState,
  formats: ExportFormat[]
): RenderedCTA {
  if (!state.unlocked) {
    return { kind: "locked", clickable: false };
  }

  // This mirrors the exact conditional chain in ExportModuleCard.tsx
  if (state.disabled && state.disabledReason) {
    if (state.canBypass) {
      return {
        kind: "disabled-warning-bypass",
        buttonLabel: "Export (clean placeholders)",
        clickable: true,
      };
    } else {
      return {
        kind: "disabled-warning-no-bypass",
        buttonLabel: "Export",
        clickable: false,
      };
    }
  }

  if (state.status === "processing") {
    return { kind: "processing", clickable: false };
  }

  if (state.status === "ready" && state.exportId) {
    return { kind: "ready-download", clickable: true };
  }

  if (state.status === "failed") {
    return { kind: "failed-retry", clickable: true };
  }

  // Default: idle → format buttons
  return { kind: "format-buttons", formats, clickable: true };
}

// ── Helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label ? label + ": " : ""}expected ${b}, got ${a}`);
  }
}

// ── Test Groups ─────────────────────────────────────────────────────
console.log("\n=== HOTFIX-EXPORT-CTA-VISIBILITY — State Machine Tests ===\n");

// ── 1. canExport=true (idle, no blocking) ───────────────────────────
console.log("1. canExport=true (idle, no blocking)");

test("idle + unlocked → format buttons (PDF only)", () => {
  const result = deriveCTA(
    { unlocked: true, status: "idle", exportId: null },
    ["pdf"]
  );
  assertEqual(result.kind, "format-buttons");
  if (result.kind === "format-buttons") {
    assertEqual(result.formats, ["pdf"]);
    assertEqual(result.clickable, true);
  }
});

test("idle + unlocked → format buttons (PDF + DOCX)", () => {
  const result = deriveCTA(
    { unlocked: true, status: "idle", exportId: null },
    ["pdf", "docx"]
  );
  assertEqual(result.kind, "format-buttons");
  if (result.kind === "format-buttons") {
    assertEqual(result.formats, ["pdf", "docx"]);
  }
});

test("idle + unlocked + disabled=false → format buttons", () => {
  const result = deriveCTA(
    { unlocked: true, disabled: false, status: "idle", exportId: null },
    ["pdf"]
  );
  assertEqual(result.kind, "format-buttons");
});

// ── 2. canExport=false, canBypass=true ──────────────────────────────
console.log("\n2. canExport=false, canBypass=true (placeholder-only blocks)");

test("disabled + canBypass=true → primary bypass Button", () => {
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      disabledReason: "3 placeholders remaining",
      canBypass: true,
      status: "idle",
      exportId: null,
    },
    ["pdf"]
  );
  assertEqual(result.kind, "disabled-warning-bypass");
  assertEqual(result.clickable, true, "bypass button must be clickable");
});

test("bypass button renders primary CTA (not a tiny link)", () => {
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      disabledReason: "Placeholders",
      canBypass: true,
      status: "idle",
      exportId: null,
    },
    ["pdf", "docx"]
  );
  // Key assertion: kind is "disabled-warning-bypass" → renders a <Button variant="primary">
  // NOT the old tiny underline link
  assertEqual(result.kind, "disabled-warning-bypass");
  if (result.kind === "disabled-warning-bypass") {
    assertEqual(
      result.buttonLabel,
      "Export (clean placeholders)",
      "label must match exportBypassPrimary"
    );
  }
});

// ── 3. canExport=false, canBypass=false ─────────────────────────────
console.log("\n3. canExport=false, canBypass=false (missing sections)");

test("disabled + canBypass=false → disabled primary Button", () => {
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      disabledReason: "Missing: Work Experience",
      canBypass: false,
      status: "idle",
      exportId: null,
    },
    ["pdf"]
  );
  assertEqual(result.kind, "disabled-warning-no-bypass");
  assertEqual(result.clickable, false, "button must be disabled");
});

test("disabled + no disabledReason → falls through to format buttons", () => {
  // Edge case: disabled=true but no reason → no warning block
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      // disabledReason is undefined
      status: "idle",
      exportId: null,
    },
    ["pdf"]
  );
  assertEqual(result.kind, "format-buttons", "should fall through without disabledReason");
});

// ── 4. Status states (processing, ready, failed) ───────────────────
console.log("\n4. Status states (processing, ready, failed)");

test("status=processing → spinner button (not clickable)", () => {
  const result = deriveCTA(
    { unlocked: true, status: "processing", exportId: null },
    ["pdf"]
  );
  assertEqual(result.kind, "processing");
  assertEqual(result.clickable, false);
});

test("status=ready + exportId → download button", () => {
  const result = deriveCTA(
    { unlocked: true, status: "ready", exportId: "exp_123" },
    ["pdf"]
  );
  assertEqual(result.kind, "ready-download");
  assertEqual(result.clickable, true);
});

test("status=ready but no exportId → format buttons (fallthrough)", () => {
  const result = deriveCTA(
    { unlocked: true, status: "ready", exportId: null },
    ["pdf"]
  );
  // Without exportId, ready condition doesn't match → falls to default
  assertEqual(result.kind, "format-buttons");
});

test("status=failed → retry button", () => {
  const result = deriveCTA(
    { unlocked: true, status: "failed", exportId: null },
    ["pdf"]
  );
  assertEqual(result.kind, "failed-retry");
  assertEqual(result.clickable, true);
});

// ── 5. Locked state ────────────────────────────────────────────────
console.log("\n5. Locked state");

test("unlocked=false → locked (unlock button, not export)", () => {
  const result = deriveCTA(
    { unlocked: false, status: "idle", exportId: null },
    ["pdf"]
  );
  assertEqual(result.kind, "locked");
});

// ── 6. Priority: disabled takes precedence over status ──────────────
console.log("\n6. Priority: disabled+disabledReason takes precedence over status");

test("disabled+reason overrides status=processing", () => {
  // If both disabled and processing, disabled block renders first
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      disabledReason: "Blocked",
      canBypass: false,
      status: "processing",
      exportId: null,
    },
    ["pdf"]
  );
  assertEqual(result.kind, "disabled-warning-no-bypass");
});

test("disabled+reason+canBypass overrides status=ready", () => {
  const result = deriveCTA(
    {
      unlocked: true,
      disabled: true,
      disabledReason: "Placeholders",
      canBypass: true,
      status: "ready",
      exportId: "exp_456",
    },
    ["pdf"]
  );
  assertEqual(result.kind, "disabled-warning-bypass");
  assertEqual(result.clickable, true);
});

// ── 7. Button always present assertion ──────────────────────────────
console.log("\n7. Button always present in unlocked state");

const ALL_STATES: CardState[] = [
  // idle, no block
  { unlocked: true, status: "idle", exportId: null },
  // idle, placeholder block, bypass OK
  { unlocked: true, disabled: true, disabledReason: "Placeholders", canBypass: true, status: "idle", exportId: null },
  // idle, missing sections block, no bypass
  { unlocked: true, disabled: true, disabledReason: "Missing sections", canBypass: false, status: "idle", exportId: null },
  // processing
  { unlocked: true, status: "processing", exportId: null },
  // ready
  { unlocked: true, status: "ready", exportId: "exp_789" },
  // failed
  { unlocked: true, status: "failed", exportId: null },
];

test("every unlocked state renders some kind of button", () => {
  for (const state of ALL_STATES) {
    const result = deriveCTA(state, ["pdf"]);
    assert(result.kind !== "locked", `state ${JSON.stringify(state)} rendered locked`);
    // All non-locked states should have a button-like element
    const hasButton = [
      "format-buttons",
      "disabled-warning-bypass",
      "disabled-warning-no-bypass",
      "processing",
      "ready-download",
      "failed-retry",
    ].includes(result.kind);
    assert(hasButton, `state ${JSON.stringify(state)} has no button: kind=${result.kind}`);
  }
});

// ── 8. Module-specific download labels (HOTFIX-6C) ───────────────────
console.log("\n8. Module-specific download labels (HOTFIX-6C)");

// Mirror the MODULE_DOWNLOAD_LABELS mapping from ExportModuleCard.tsx
const MODULE_DOWNLOAD_LABELS: Record<string, string> = {
  "results-summary": "downloadResultsSummary",
  "updated-cv": "downloadUpdatedCv",
  "full-audit": "downloadFullAudit",
  "cover-letter": "downloadCoverLetter",
  "linkedin-updates": "downloadLinkedinUpdates",
};

test("every module has a download label mapping", () => {
  const moduleIds = ["results-summary", "updated-cv", "full-audit", "cover-letter", "linkedin-updates"];
  for (const id of moduleIds) {
    assert(MODULE_DOWNLOAD_LABELS[id], `Missing download label for ${id}`);
    assert(MODULE_DOWNLOAD_LABELS[id].length > 0, `Empty download label for ${id}`);
  }
});

test("download labels are distinct per module", () => {
  const labels = Object.values(MODULE_DOWNLOAD_LABELS);
  const unique = new Set(labels);
  assertEqual(unique.size, labels.length, "All download labels should be unique");
});

test("download label resolves for updated-cv", () => {
  const label = MODULE_DOWNLOAD_LABELS["updated-cv"];
  assertEqual(label, "downloadUpdatedCv", "CV module should use downloadUpdatedCv key");
});

test("download label resolves for full-audit", () => {
  const label = MODULE_DOWNLOAD_LABELS["full-audit"];
  assertEqual(label, "downloadFullAudit", "Audit module should use downloadFullAudit key");
});

// ── Results ─────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log("All export CTA state machine tests passed ✓\n");
