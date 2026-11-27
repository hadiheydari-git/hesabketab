import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// Three test projects (brief §3.6):
// - unit: pure domain functions in plain node
// - component: React Testing Library in jsdom
// - integration: the real Worker + local D1 via @cloudflare/vitest-pool-workers
//   (vitest 4 style: options go to the cloudflareTest() plugin)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/shared/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/web/**/*.test.tsx"],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./tests/wrangler.test.jsonc" },
            // SQL migrations are imported as text in tests/setup/d1.ts.
            miniflare: {
              modulesRules: [{ type: "Text", include: ["**/*.sql"] }],
            },
          }),
        ],
        test: {
          name: "integration",
          include: ["src/worker/**/*.integration.test.ts"],
          setupFiles: ["./tests/setup/d1.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
