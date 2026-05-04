import "./env/load.js";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { eq } from "drizzle-orm";

import * as schema from "./auth/auth.schema.js";
import { db } from "./db.js";
import { appRouter } from "./router.js";

type AppRouter = typeof appRouter;

const TRPC_URL = "http://localhost:4000/api/v1/trpc";

let activeSession = {
  user: schema.user.$inferSelect,
  session: schema.session.$inferSelect,
};

export async function impersonateUser(email: string) {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!user) throw new Error(`No user found with email: ${email}`);

  const [session] = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.userId, user.id))
    .limit(1);
  if (!session) throw new Error(`No active session for user: ${email}`);

  activeSession = { user, session };
  return user;
}
export async function createScratchTrpcClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: () => {
          if (activeSession) {
            return { Authorization: `Bearer ${activeSession.session.token}` };
          }
          return {};
        },
      }),
    ],
  });
}
