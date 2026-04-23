import z from "zod";

import { PointSchema } from "@pt/shared";

import { userAccessScopes } from "../auth/auth.js";
import { publicProcedure, router } from "../trpc.js";
import { suggestRoute } from "./plan.service.js";

export const planRouter = router({
  suggestRoute: publicProcedure
    .input(z.object({ a: PointSchema, b: PointSchema }))
    .query(({ input, ctx, signal }) => {
      const accessScopes = userAccessScopes(ctx.user);
      return suggestRoute(input.a, input.b, accessScopes, { signal });
    }),
});
