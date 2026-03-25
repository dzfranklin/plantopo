import { TRPCError, initTRPC } from "@trpc/server";
import type { DefaultErrorShape } from "@trpc/server/unstable-core-do-not-import";
import type { Session, User } from "better-auth";

import { getLog } from "./logger.js";

export interface Context {
  session: { session: Session; user: User } | null;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }): DefaultErrorShape & {
    data: DefaultErrorShape["data"] & { reqId?: string | undefined };
  } {
    return {
      ...shape,
      data: {
        ...shape.data,
        reqId: getLog().bindings().reqId as string | undefined,
      },
    };
  },
});

export const router = t.router;

const trpcLog = !!process.env.TRPC_LOG;

const loggingMiddleware = t.middleware(async ({ path, type, input, next }) => {
  const log = getLog().child({ path, type });
  const inputLog = { input, inputIsUndefined: input === undefined };

  if (trpcLog) log.info(inputLog, "trpc request");
  const result = await next();
  if (result.ok) {
    if (trpcLog) log.info({ ...inputLog, result }, "trpc ok");
  } else {
    const err = result.error;
    if (err.code === "INTERNAL_SERVER_ERROR") {
      log.error({ ...inputLog, err: err.cause }, "error handling trpc request");
    } else {
      log.info({ ...inputLog, code: err.code }, "trpc error response");
    }
  }
  return result;
});

export const publicProcedure = t.procedure.use(loggingMiddleware);

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session: ctx.session } });
});

export const authedProcedure = publicProcedure.use(authMiddleware);
