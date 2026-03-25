import { initTRPC } from "@trpc/server";
import type { Session, User } from "better-auth";

export interface Context {
  session: { session: Session; user: User } | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;

const loggingMiddleware = t.middleware(async ({ path, type, input, next }) => {
  if (process.env.TRPC_LOG) {
    console.log(`[trpc] --> ${type} ${path}`, input);
  }
  const result = await next();
  if (process.env.TRPC_LOG) {
    if (result.ok) {
      console.log(`[trpc] <-- ${type} ${path}`, result.data);
    } else {
      console.log(`[trpc] <-- ${type} ${path} ERROR`, result.error);
    }
  }
  return result;
});

export const publicProcedure = t.procedure.use(loggingMiddleware);
