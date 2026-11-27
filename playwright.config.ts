import { defineConfig } from "@playwright/test";

// E2E against a real local deployment: built assets + real Worker + real
// local D1 via wrangler dev (brief §3.6 — real environment, no mocks).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:8788",
    locale: "fa-IR",
  },
  webServer: {
    command:
      "npm run build --silent && npx wrangler d1 migrations apply DB --local -c src/web/dist/dakholvakharj/wrangler.json && npx wrangler dev -c src/web/dist/dakholvakharj/wrangler.json --local --port 8788 --var AUTH_RATE_LIMIT_OFF:1",
    url: "http://localhost:8788/api/health",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
