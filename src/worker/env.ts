import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema";

export type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL: string;
  AUTH_RATE_LIMIT_MAX?: string;
  AUTH_RATE_LIMIT_OFF?: string;
};

export type WorkerDb = DrizzleD1Database<typeof schema>;

export type AppBindings = {
  Bindings: Env;
  Variables: {
    userId: string;
    orm: WorkerDb;
  };
};
