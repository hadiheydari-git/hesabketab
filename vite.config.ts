import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// One Vite build produces both the SPA (src/web) and the Worker bundle
// (src/worker, per wrangler.jsonc "main"). The Worker runs first only
// for /api/*; everything else is static assets with SPA fallback.
// configPath is absolute because the plugin only searches the Vite root
// (src/web) for wrangler.jsonc by default.
export default defineConfig({
  root: "src/web",
  plugins: [
    react(),
    cloudflare({
      configPath: fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)),
    }),
  ],
});
