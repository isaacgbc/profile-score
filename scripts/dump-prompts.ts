/**
 * Dump all active prompts from the prompt_registry table.
 *
 * Outputs a readable Markdown file at docs/active-prompts-dump.md
 * with the full content of every active prompt.
 *
 * Usage: npx tsx scripts/dump-prompts.ts
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { resolve } from "path";

// Load .env.local for database URL
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const prisma = new PrismaClient();

async function main() {
  console.log("Querying all active prompts from prompt_registry...\n");

  const activePrompts = await prisma.promptRegistry.findMany({
    where: { status: "active" },
    orderBy: [{ promptKey: "asc" }, { locale: "asc" }, { version: "desc" }],
  });

  console.log(`Found ${activePrompts.length} active prompt(s).\n`);

  if (activePrompts.length === 0) {
    console.log("No active prompts found. Checking all prompts...\n");
    const allPrompts = await prisma.promptRegistry.findMany({
      orderBy: [{ promptKey: "asc" }, { version: "desc" }],
    });
    console.log(`Total prompts in registry: ${allPrompts.length}`);
    console.log(
      "Statuses:",
      [...new Set(allPrompts.map((p) => p.status))].join(", ")
    );
    console.log(
      "Keys:",
      [...new Set(allPrompts.map((p) => p.promptKey))].join(", ")
    );

    // If no active prompts, dump the latest version of each key instead
    if (allPrompts.length > 0) {
      console.log("\nDumping latest version of each prompt key instead...\n");
      const latestByKey = new Map<string, (typeof allPrompts)[0]>();
      for (const p of allPrompts) {
        const mapKey = `${p.promptKey}:${p.locale}`;
        if (!latestByKey.has(mapKey)) {
          latestByKey.set(mapKey, p); // Already ordered by version desc
        }
      }
      return generateMarkdown([...latestByKey.values()], "Latest Version (No Active)");
    }
    return;
  }

  return generateMarkdown(activePrompts, "Active");
}

function generateMarkdown(
  prompts: Array<{
    id: string;
    promptKey: string;
    version: number;
    locale: string;
    modelTarget: string | null;
    content: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
  label: string
) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines: string[] = [];

  lines.push(`# ${label} Prompts Dump — ${timestamp}`);
  lines.push("");
  lines.push(`> Total: ${prompts.length} prompt(s)`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| # | Prompt Key | Version | Locale | Status | Model Target | Content Length | Created |");
  lines.push("|---|-----------|---------|--------|--------|-------------|--------------|---------|");

  prompts.forEach((p, i) => {
    lines.push(
      `| ${i + 1} | \`${p.promptKey}\` | v${p.version} | ${p.locale} | ${p.status} | ${p.modelTarget ?? "—"} | ${p.content.length} chars | ${p.createdAt.toISOString().slice(0, 10)} |`
    );
  });

  lines.push("");
  lines.push("---");
  lines.push("");

  // Full content for each prompt
  for (const p of prompts) {
    lines.push(`## \`${p.promptKey}\` (v${p.version}, locale: ${p.locale})`);
    lines.push("");
    lines.push(`- **Status:** ${p.status}`);
    lines.push(`- **Model Target:** ${p.modelTarget ?? "none"}`);
    lines.push(`- **Content Length:** ${p.content.length} characters`);
    lines.push(`- **Created:** ${p.createdAt.toISOString()}`);
    lines.push(`- **Updated:** ${p.updatedAt.toISOString()}`);
    lines.push(`- **ID:** ${p.id}`);
    lines.push("");
    lines.push("### Prompt Content");
    lines.push("");
    lines.push("```");
    lines.push(p.content);
    lines.push("```");
    lines.push("");

    // Extract {{variables}} from content
    const vars = [...p.content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const uniqueVars = [...new Set(vars)];
    if (uniqueVars.length > 0) {
      lines.push(`### Interpolation Variables (${uniqueVars.length})`);
      lines.push("");
      uniqueVars.forEach((v) => lines.push(`- \`{{${v}}}\``));
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  const outputPath = resolve(__dirname, "..", "docs", "active-prompts-dump.md");
  const content = lines.join("\n");
  writeFileSync(outputPath, content, "utf-8");
  console.log(`Written to: ${outputPath}`);
  console.log(`File size: ${(content.length / 1024).toFixed(1)} KB`);

  // Print summary to console
  console.log("\n=== PROMPT KEYS ===");
  const keys = [...new Set(prompts.map((p) => p.promptKey))];
  keys.forEach((k) => {
    const versions = prompts
      .filter((p) => p.promptKey === k)
      .map((p) => `v${p.version}/${p.locale}`)
      .join(", ");
    console.log(`  ${k}: ${versions}`);
  });
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
