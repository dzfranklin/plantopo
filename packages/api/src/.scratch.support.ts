import "./loadEnv.js";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { eq } from "drizzle-orm";

import * as schema from "./auth/auth.schema.js";
import { db } from "./db.js";
import { appRouter } from "./router.js";

type AppRouter = typeof appRouter;

const TRPC_URL = "http://localhost:4000/api/v1/trpc";

async function getSessionToken(email: string): Promise<string> {
  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!user) throw new Error(`No user found with email: ${email}`);

  const [session] = await db
    .select({ token: schema.session.token })
    .from(schema.session)
    .where(eq(schema.session.userId, user.id))
    .limit(1);
  if (!session) throw new Error(`No active session for user: ${email}`);

  return session.token;
}

export async function createScratchTrpcClient(userEmail?: string) {
  const headers: Record<string, string> = {};
  if (userEmail) {
    headers["authorization"] = `Bearer ${await getSessionToken(userEmail)}`;
  }
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: TRPC_URL, headers })],
  });
}
