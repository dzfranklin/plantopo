import { TRPCError, initTRPC } from "@trpc/server";
import type { DefaultErrorShape } from "@trpc/server/unstable-core-do-not-import";

import { getLog } from "./logger.js";
import type { RequestContext } from "./request-context.js";

const t = initTRPC.context<RequestContext>().create({
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

const loggingMiddleware = t.middleware(
  async ({ path, type, getRawInput, next }) => {
    const log = getLog().child({ path, type });

    if (trpcLog) {
      const input = await getRawInput();
      log.info({ input }, "trpc request");
    }
    const result = await next();
    if (result.ok) {
      if (trpcLog) {
        const input = await getRawInput();
        log.info({ input, result }, "trpc ok");
      }
    } else {
      const err = result.error;
      const input = await getRawInput();
      if (err.code === "INTERNAL_SERVER_ERROR") {
        log.error({ input, err: err.cause }, "error handling trpc request");
      } else {
        log.info({ input, err }, "trpc error response");
      }
    }
    return result;
  },
);

export const publicProcedure = t.procedure.use(loggingMiddleware);

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session: ctx.session } });
});

export const authedProcedure = publicProcedure.use(authMiddleware);
