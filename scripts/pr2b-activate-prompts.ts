/**
 * PR2B: Activate new prompt versions and archive old ones.
 *
 * This script:
 * 1. Re-runs the seed to insert any new prompt versions (upsert-safe)
 * 2. Activates the new PR2B versions
 * 3. Archives the previous active versions
 *
 * Usage: npx tsx scripts/pr2b-activate-prompts.ts
 * Rollback: npx tsx scripts/pr2b-activate-prompts.ts --rollback
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PR2B version map: promptKey → { newVersion, oldVersion }
const PR2B_VERSIONS: {
  promptKey: string;
  newVersion: number;
  oldVersion: number;
}[] = [
  { promptKey: "audit.linkedin.system", newVersion: 3, oldVersion: 2 },
  { promptKey: "audit.cv.system", newVersion: 3, oldVersion: 2 },
  { promptKey: "audit.overall-descriptor.system", newVersion: 2, oldVersion: 1 },
  { promptKey: "rewrite.linkedin.section", newVersion: 4, oldVersion: 3 },
  { promptKey: "rewrite.linkedin.section.entries", newVersion: 2, oldVersion: 1 },
  { promptKey: "rewrite.cv.section", newVersion: 4, oldVersion: 3 },
  { promptKey: "rewrite.regenerate.system", newVersion: 2, oldVersion: 1 },
  { promptKey: "export.polish-pass.system", newVersion: 2, oldVersion: 1 },
];

// Also includes the brand-new key that didn't exist before
const NEW_KEYS = [
  { promptKey: "rewrite.cv.section.entries", version: 1 },
];

async function activate() {
  console.log("PR2B: Activating new prompt versions...\n");

  for (const { promptKey, newVersion, oldVersion } of PR2B_VERSIONS) {
    for (const locale of ["en", "es"]) {
      // Check new version exists
      const newPrompt = await prisma.promptRegistry.findFirst({
        where: { promptKey, version: newVersion, locale },
      });

      if (!newPrompt) {
        console.error(
          `  MISSING: ${promptKey} v${newVersion} [${locale}] — run 'npx prisma db seed' first`
        );
        continue;
      }

      // Archive old version
      const archived = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: oldVersion,
          locale,
          status: "active",
        },
        data: { status: "archived" },
      });

      // Activate new version
      const activated = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: newVersion,
          locale,
          status: { in: ["draft", "active"] },
        },
        data: { status: "active" },
      });

      console.log(
        `  ${promptKey} [${locale}]: v${oldVersion}→archived(${archived.count}), v${newVersion}→active(${activated.count})`
      );
    }
  }

  // Activate new keys (no old version to archive)
  for (const { promptKey, version } of NEW_KEYS) {
    for (const locale of ["en", "es"]) {
      const activated = await prisma.promptRegistry.updateMany({
        where: { promptKey, version, locale },
        data: { status: "active" },
      });
      console.log(
        `  ${promptKey} [${locale}]: v${version}→active(${activated.count}) [NEW KEY]`
      );
    }
  }

  console.log("\nPR2B activation complete.");
}

async function rollback() {
  console.log("PR2B: Rolling back to previous prompt versions...\n");

  for (const { promptKey, newVersion, oldVersion } of PR2B_VERSIONS) {
    for (const locale of ["en", "es"]) {
      // Archive the new version
      const deactivated = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: newVersion,
          locale,
          status: "active",
        },
        data: { status: "archived" },
      });

      // Re-activate old version
      const restored = await prisma.promptRegistry.updateMany({
        where: {
          promptKey,
          version: oldVersion,
          locale,
          status: "archived",
        },
        data: { status: "active" },
      });

      console.log(
        `  ${promptKey} [${locale}]: v${newVersion}→archived(${deactivated.count}), v${oldVersion}→active(${restored.count})`
      );
    }
  }

  // Archive new keys (they didn't exist before, just archive them)
  for (const { promptKey, version } of NEW_KEYS) {
    for (const locale of ["en", "es"]) {
      const archived = await prisma.promptRegistry.updateMany({
        where: { promptKey, version, locale, status: "active" },
        data: { status: "archived" },
      });
      console.log(
        `  ${promptKey} [${locale}]: v${version}→archived(${archived.count}) [NEW KEY — no previous version]`
      );
    }
  }

  console.log("\nPR2B rollback complete. Previous versions re-activated.");
}

const isRollback = process.argv.includes("--rollback");

(isRollback ? rollback() : activate())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
