import z from "zod";

import { type AppStyle, type StyleCatalog } from "@pt/shared";

import { userAccessScopes } from "../auth/auth.js";
import { publicProcedure, router } from "../trpc.js";
import { getCatalog, getOverlay, getStyle } from "./map.service.js";

export const mapRouter = router({
  catalog: publicProcedure
    .output(z.custom<StyleCatalog>())
    .query(async ({ ctx }) => {
      const scopes = userAccessScopes(ctx.user);
      return await getCatalog(scopes);
    }),
  style: publicProcedure
    .input(z.string())
    .output(z.custom<AppStyle>())
    .query(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.user);
      const tileKey = ctx.user?.tileKey;
      return await getStyle(input, scopes, tileKey);
    }),
  overlay: publicProcedure
    .input(z.string())
    .output(z.custom<AppStyle>())
    .query(async ({ ctx, input }) => {
      const scopes = userAccessScopes(ctx.user);
      const tileKey = ctx.user?.tileKey;
      return await getOverlay(input, scopes, tileKey);
    }),
});
