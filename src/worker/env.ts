import type { DrizzleD1Database } from "drizzle-orm/d1";

export type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL: string;
};

export type AppBindings = {
  Bindings: Env;
  Variables: {
    userId: string;
    orm: DrizzleD1Database;
  };
};
