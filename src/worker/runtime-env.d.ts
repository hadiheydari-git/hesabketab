// Ambient bindings for cloudflare:test (`env`) and the Workers runtime —
// mirrors src/worker/env.ts so integration tests and the worker share one
// contract.
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BETTER_AUTH_SECRET: string;
      APP_URL: string;
      AUTH_RATE_LIMIT_MAX?: string;
    }
  }
}

export {};
