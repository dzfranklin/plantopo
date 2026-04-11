import z from "zod";

import type { AppStyle } from "@pt/shared";

import { userAccessScopes } from "../auth/auth.service.js";
import { publicProcedure, router } from "../trpc.js";
import { type StyleCatalog, getCatalog, getStyle } from "./map.service.js";

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
});
