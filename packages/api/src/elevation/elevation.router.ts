import z from "zod";

import { PointSchema } from "@pt/shared";

import { userAccessScopes } from "../auth/auth.js";
import { publicProcedure, router } from "../trpc.js";
import { getElevations } from "./elevation.service.js";

export const elevationRouter = router({
  point: publicProcedure.input(PointSchema).query(async ({ ctx, input }) => {
    const scopes = userAccessScopes(ctx.session?.user);
    const result = await getElevations([input], scopes);
    return { data: result.data[0]!, meta: result.meta };
  }),
  query: publicProcedure
    .input(z.array(PointSchema))
    .mutation(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.session?.user);
      return await getElevations(input, scopes);
    }),
});
