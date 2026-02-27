/**
 * Sprint 1: Two-Step Prompt Activation Script
 *
 * Supports three modes:
 *   --activate-only  Set new versions to active WITHOUT archiving old versions.
 *                    Both old and new are active — the prompt resolver picks highest version.
 *   --finalize       Archive old versions (only run AFTER benchmark confirms GO).
 *   --rollback       Revert new versions to draft (if benchmark says HOLD).
 *
 * Usage:
 *   npx tsx scripts/sprint1-activate-prompts.ts --activate-only
 *   npx tsx scripts/sprint1-activate-prompts.ts --finalize
 *   npx tsx scripts/sprint1-activate-prompts.ts --rollback
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Sprint 1 version map: promptKey → { newVersion, oldVersion }
const SPRINT1_VERSIONS: {
  promptKey: string;
  newVersion: number;
  oldVersion: number;
}[] = [
  { promptKey: "audit.linkedin.system", newVersion: 4, oldVersion: 3 },
  { promptKey: "audit.cv.system", newVersion: 4, oldVersion: 3 },
  { promptKey: "audit.overall-descriptor.system", newVersion: 3, oldVersion: 2 },
  { promptKey: "rewrite.linkedin.section", newVersion: 5, oldVersion: 4 },
  { promptKey: "rewrite.linkedin.section.entries", newVersion: 3, oldVersion: 2 },
  { promptKey: "rewrite.cv.section", newVersion: 5, oldVersion: 4 },
  { promptKey: "rewrite.cv.section.entries", newVersion: 2, oldVersion: 1 },
  { promptKey: "rewrite.regenerate.system", newVersion: 3, oldVersion: 2 },
  { promptKey: "export.polish-pass.system", newVersion: 3, oldVersion: 2 },
];

/**
 * --activate-only: Activate new versions without archiving old ones.
 * Both old (current) and new versions are active simultaneously.
 * The prompt resolver picks the highest active version.
 */
async function activateOnly() {
  console.log("Sprint 1: Activating new prompt versions (no archive)...\n");

  let activated = 0;
  let missing = 0;

  for (const { promptKey, newVersion } of SPRINT1_VERSIONS) {
    for (const locale of ["en", "es"]) {
      // Check new version exists
      const newPrompt = await prisma.promptRegistry.findFirst({
        where: { promptKey, version: newVersion, locale },
      });

      if (!newPrompt) {
        console.error(
          `  MISSING: ${promptKey} v${newVersion} [${locale}] — run 'npx prisma db seed' first`
        );
        missing++;
        continue;
      }

      // Activate new version (do NOT touch old version)
      const result = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: newVersion,
          locale,
          status: { in: ["draft", "active"] },
        },
        data: { status: "active" },
      });

      console.log(
        `  ${promptKey} [${locale}]: v${newVersion} → active (${result.count})`
      );
      activated += result.count;
    }
  }

  console.log(
    `\nActivation complete: ${activated} prompts activated, ${missing} missing.`
  );
  if (missing > 0) {
    console.log("Run 'npx prisma db seed' to insert missing prompts.");
  }
  console.log(
    "Old versions are still active. Run benchmark, then --finalize or --rollback."
  );
}

/**
 * --finalize: Archive old versions after benchmark confirms GO.
 * Only old versions are archived; new versions remain active.
 */
async function finalize() {
  console.log("Sprint 1: Finalizing — archiving old prompt versions...\n");

  let archived = 0;

  for (const { promptKey, oldVersion, newVersion } of SPRINT1_VERSIONS) {
    for (const locale of ["en", "es"]) {
      // Verify new version is active before archiving old
      const newActive = await prisma.promptRegistry.findFirst({
        where: { promptKey, version: newVersion, locale, status: "active" },
      });

      if (!newActive) {
        console.error(
          `  SKIP: ${promptKey} v${newVersion} [${locale}] is not active — cannot finalize`
        );
        continue;
      }

      // Archive old version
      const result = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: oldVersion,
          locale,
          status: "active",
        },
        data: { status: "archived" },
      });

      if (result.count > 0) {
        console.log(
          `  ${promptKey} [${locale}]: v${oldVersion} → archived (${result.count})`
        );
        archived += result.count;
      }
    }
  }

  console.log(`\nFinalization complete: ${archived} old prompts archived.`);
  console.log("Sprint 1 prompts are now the sole active versions.");
}

/**
 * --rollback: Revert new versions to draft if benchmark says HOLD.
 * Old versions remain active.
 */
async function rollback() {
  console.log("Sprint 1: Rolling back — reverting new versions to draft...\n");

  let rolledBack = 0;

  for (const { promptKey, newVersion } of SPRINT1_VERSIONS) {
    for (const locale of ["en", "es"]) {
      const result = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: newVersion,
          locale,
          status: "active",
        },
        data: { status: "draft" },
      });

      if (result.count > 0) {
        console.log(
          `  ${promptKey} [${locale}]: v${newVersion} → draft (${result.count})`
        );
        rolledBack += result.count;
      }
    }
  }

  console.log(`\nRollback complete: ${rolledBack} new prompts reverted to draft.`);
  console.log("Old prompt versions remain active.");
}

// ── CLI dispatcher ──────────────────────────────────────

const mode = process.argv[2];

if (mode === "--activate-only") {
  activateOnly()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
} else if (mode === "--finalize") {
  finalize()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
} else if (mode === "--rollback") {
  rollback()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
} else {
  console.error(
    "Usage:\n" +
    "  npx tsx scripts/sprint1-activate-prompts.ts --activate-only\n" +
    "  npx tsx scripts/sprint1-activate-prompts.ts --finalize\n" +
    "  npx tsx scripts/sprint1-activate-prompts.ts --rollback"
  );
  process.exit(1);
}
