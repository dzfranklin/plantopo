import z from "zod";

import { type AppStyle, PointSchema, type StyleCatalog } from "@pt/shared";

import { userAccessScopes } from "../auth/auth.service.js";
import { publicProcedure, router } from "../trpc.js";
import { getElevations } from "./elevation.js";
import {
  completeRouteBetween,
  getCatalog,
  getOverlay,
  getStyle,
} from "./map.service.js";

export const mapRouter = router({
  catalog: publicProcedure
    .output(z.custom<StyleCatalog>())
    .query(async ({ ctx }) => {
      const scopes = userAccessScopes(ctx.session?.user);
      return await getCatalog(scopes);
    }),
  style: publicProcedure
    .input(z.string())
    .output(z.custom<AppStyle>())
    .query(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.session?.user);
      const tileKey = ctx.session?.user.tileKey;
      return await getStyle(input, scopes, tileKey);
    }),
  overlay: publicProcedure
    .input(z.string())
    .output(z.custom<AppStyle>())
    .query(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.session?.user);
      const tileKey = ctx.session?.user.tileKey;
      return await getOverlay(input, scopes, tileKey);
    }),
  // .mutation because large point arrays exceed GET URL length limits
  elevation: publicProcedure
    .input(z.array(z.tuple([z.number(), z.number()])))
    .mutation(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.session?.user);
      return await getElevations(input, scopes);
    }),
  completeRouteBetween: publicProcedure
    .input(z.object({ a: PointSchema, b: PointSchema }))
    .query(({ input, signal }) =>
      completeRouteBetween(input.a, input.b, { signal }),
    ),
});
