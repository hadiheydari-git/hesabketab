import { Hono } from "hono";
import type { AppBindings } from "./env";
import { APP_TITLE } from "../shared/constants";

const app = new Hono<AppBindings>();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    name: APP_TITLE,
    time: new Date().toISOString(),
  }),
);

// Within the Worker (run_worker_first matches /api/* only), unknown paths
// get a JSON 404; all other paths are served as static SPA assets.
app.notFound((c) =>
  c.json(
    { error: { code: "not_found", message: "not found" } },
    404,
  ),
);

export default app;
