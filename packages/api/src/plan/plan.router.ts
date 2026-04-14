import z from "zod";

import { PointSchema } from "@pt/shared";

import { publicProcedure, router } from "../trpc.js";
import { completeRouteBetween } from "./plan.service.js";

export const planRouter = router({
  suggestRoute: publicProcedure
    .input(z.object({ a: PointSchema, b: PointSchema }))
    .query(({ input, signal }) =>
      completeRouteBetween(input.a, input.b, { signal }),
    ),
});
