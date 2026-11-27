// Better Auth client (react hooks) with the username plugin.
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
