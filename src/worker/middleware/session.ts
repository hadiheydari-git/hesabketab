// Session middleware: resolves the Better Auth session once per request
// and stores userId + a shared drizzle instance in the context. Private
// data is never reachable from a public endpoint — every private route
// sits behind this middleware.
import type { MiddlewareHandler } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { AppBindings } from "../env";
import { createAuth } from "../auth";

export function withSession(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json(
        { error: { code: "unauthorized", message: "برای این کار باید وارد شوید." } },
        401,
      );
    }
    c.set("userId", session.user.id);
    c.set("orm", drizzle(c.env.DB));
    await next();
  };
}
