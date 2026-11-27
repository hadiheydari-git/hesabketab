import { describe, expect, it } from "vitest";
import app from "./index";
import { APP_TITLE } from "../shared/constants";

describe("GET /api/health", () => {
  it("returns 200 with ok true and the app title", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; name: string; time: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe(APP_TITLE);
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});

describe("unknown API paths", () => {
  it("return a JSON 404 envelope", async () => {
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("not_found");
  });
});
