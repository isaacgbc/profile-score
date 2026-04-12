import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules",
      ".next",
      // Existing tsx-script tests with home-grown assert() helpers — run via `npx tsx`, not vitest.
      "src/lib/services/__tests__/linkedin-experience-archetype.test.ts",
      "src/lib/services/__tests__/cv-routing-benchmark.test.ts",
      "src/lib/services/__tests__/hotfix-6-benchmark.test.ts",
      "src/lib/services/__tests__/hotfix-7-benchmark.test.ts",
      "src/lib/services/__tests__/hotfix-8-benchmark.test.ts",
      "src/lib/services/__tests__/hotfix-9-benchmark.test.ts",
      "src/lib/services/__tests__/perf-hotfix-2-benchmark.test.ts",
      // Pre-existing tsx-scripts using home-grown assert() helpers (not vitest describe/it):
      "src/components/checkout/__tests__/export-module-card-states.test.ts",
      "src/lib/utils/__tests__/placeholder-detect.test.ts",
    ],
    setupFiles: [],
    testTimeout: 10_000,
  },
});
