// Better Auth instance (brief §3.1/§3.4): username plugin only (no email
// collected — non-routable placeholder), Drizzle adapter on D1, seeded
// categories + settings after user creation via databaseHooks.
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { checkUsername } from "../shared/domain/username";
import { seedNewUser } from "./modules/auth/seed";

export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL: string;
  /** Optional override for the auth rate-limit budget per minute (tests raise it). */
  AUTH_RATE_LIMIT_MAX?: string;
  /** When "1", the built-in auth rate limiter is disabled (tests only). */
  AUTH_RATE_LIMIT_OFF?: string;
};

export function createAuth(env: AuthEnv) {
  const orm = drizzle(env.DB, { schema });

  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    database: drizzleAdapter(orm, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Sign-up happens through /sign-up/email with a username field;
      // the client fills `email` with the non-routable placeholder.
    },
    user: {
      additionalFields: {
        // nothing extra; username comes from the plugin
      },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 32,
        usernameValidator: (raw) => checkUsername(raw).ok,
        usernameNormalization: (raw) => raw.trim().toLowerCase(),
        displayUsernameNormalization: (raw) => raw.trim().toLowerCase(),
        immutableUsername: true,
      }),
    ],
    advanced: {
      cookiePrefix: "dakholvakharj",
    },
    rateLimit: {
      // Per-isolate memory limiter for auth endpoints (best effort).
      enabled: true,
      window: 60,
      max: env.AUTH_RATE_LIMIT_MAX ? Number(env.AUTH_RATE_LIMIT_MAX) : 20,
      // Tests disable the built-in limiter entirely (they exercise their
      // own D1-backed limiter for the reset flow).
      customRules: env.AUTH_RATE_LIMIT_OFF === "1" ? { "**": () => false } : undefined,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            await seedNewUser(orm, created.id);
          },
        },
      },
    },
  });
}
